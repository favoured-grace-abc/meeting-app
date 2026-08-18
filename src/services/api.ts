import { auth } from "./firebase";
import {
  FAILURE_REASONS,
  MEETING_STATUSES,
  type AudioUrlResponse,
  type ExportFormat,
  type FailureReason,
  type Meeting,
  type MeetingStatus,
  type MeetingStatusPayload,
  type Speaker,
  type Transcript,
  type TranscriptSegment,
  type UploadUrlResponse,
} from "../types";

export type { MeetingStatusPayload };

const DEFAULT_API_BASE_URL =
  "https://meeting-recorder-backend-286455810620.europe-west1.run.app";

export const API_BASE_URL = (
  import.meta.env.VITE_API_BASE_URL || DEFAULT_API_BASE_URL
).replace(/\/$/, "");

export class ApiError extends Error {
  readonly status: number;
  readonly errors?: string[];

  constructor(status: number, title: string, errors?: string[]) {
    super(title);
    this.name = "ApiError";
    this.status = status;
    this.errors = errors;
  }
}

async function authToken(): Promise<string> {
  const user = auth.currentUser;
  if (!user) throw new ApiError(401, "Not signed in");
  return user.getIdToken();
}

/** RFC 7807 problem details, as returned by the API's exception handler. */
interface ProblemBody {
  status?: number;
  title?: string;
  detail?: string;
  errors?: string[] | Record<string, string[]>;
}

function problemErrors(errors: ProblemBody["errors"]): string[] | undefined {
  if (!errors) return undefined;
  if (Array.isArray(errors)) return errors;
  return Object.values(errors).flat();
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = await authToken();
  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    ...(options.headers as Record<string, string> | undefined),
  };
  if (
    options.body &&
    typeof options.body === "string" &&
    !headers["Content-Type"]
  ) {
    headers["Content-Type"] = "application/json";
  }

  const res = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers,
  }).catch(() => {
    throw new ApiError(
      0,
      `Cannot reach the Meeting Recorder API at ${API_BASE_URL}. ` +
        "It may be offline, or this origin may not be allowed by its CORS policy.",
    );
  });
  if (res.status === 204) return undefined as T;

  const text = await res.text();
  let data: ProblemBody | null = null;
  if (text) {
    try {
      data = JSON.parse(text) as ProblemBody;
    } catch {
      data = null;
    }
  }

  if (!res.ok) {
    throw new ApiError(
      res.status,
      data?.title || data?.detail || `Request failed (${res.status})`,
      problemErrors(data?.errors),
    );
  }
  return data as T;
}

// ── Enum normalization ──────────────────────────────
// REST responses carry raw .NET enums, which System.Text.Json writes as numbers
// (the API registers no JsonStringEnumConverter). The SignalR hub, meanwhile,
// sends `status.ToString()`. Accept either and always hand back the name.
function toEnumName<T extends string>(
  names: readonly T[],
  value: unknown,
  fallback: T,
): T {
  if (typeof value === "number") return names[value] ?? fallback;
  if (typeof value === "string") {
    const byName = names.find((n) => n.toLowerCase() === value.toLowerCase());
    if (byName) return byName;
    const index = Number(value);
    if (Number.isInteger(index)) return names[index] ?? fallback;
  }
  return fallback;
}

export function toMeetingStatus(value: unknown): MeetingStatus {
  return toEnumName(MEETING_STATUSES, value, "Recording");
}

export function toFailureReason(value: unknown): FailureReason {
  return toEnumName(FAILURE_REASONS, value, "None");
}

interface RawMeeting extends Omit<Meeting, "status" | "failureReason"> {
  status: unknown;
  failureReason: unknown;
}

function normalizeMeeting(raw: RawMeeting): Meeting {
  return {
    ...raw,
    status: toMeetingStatus(raw.status),
    failureReason: toFailureReason(raw.failureReason),
    failureMessage: raw.failureMessage ?? null,
    participantHints: raw.participantHints ?? [],
  };
}

interface RawSegment extends Omit<TranscriptSegment, "speakerId" | "speakerLabel"> {
  speakerId?: string | null;
  speakerLabel?: string | null;
}

/**
 * The hub pushes the *domain* TranscriptSegment, which has no `speakerLabel`,
 * while REST returns the DTO, which does. Normalize to one shape.
 */
export function normalizeSegment(raw: RawSegment): TranscriptSegment {
  return {
    id: raw.id,
    speakerId: raw.speakerId ?? null,
    speakerLabel: raw.speakerLabel ?? null,
    text: raw.text ?? "",
    startMs: Number(raw.startMs) || 0,
    endMs: Number(raw.endMs) || 0,
    confidence: Number(raw.confidence) || 0,
  };
}

export const api = {
  // ── Meetings ──────────────────────────────────────
  async createMeeting(title: string, participantHints: string[] = []) {
    // `participantHints` is non-optional in the API's request contract.
    const raw = await request<RawMeeting>("/meetings", {
      method: "POST",
      body: JSON.stringify({ title, participantHints }),
    });
    return normalizeMeeting(raw);
  },

  async getMeeting(meetingId: string) {
    const raw = await request<RawMeeting>(
      `/meetings/${encodeURIComponent(meetingId)}`,
    );
    return normalizeMeeting(raw);
  },

  async getMeetingStatus(meetingId: string): Promise<MeetingStatusPayload> {
    // MeetingStatusDto names the key `id`; the rest of the app wants `meetingId`.
    const raw = await request<{
      id: string;
      status: unknown;
      failureReason: unknown;
      failureMessage?: string | null;
    }>(`/meetings/${encodeURIComponent(meetingId)}/status`);
    return {
      meetingId: raw.id,
      status: toMeetingStatus(raw.status),
      failureReason: toFailureReason(raw.failureReason),
      failureMessage: raw.failureMessage ?? null,
    };
  },

  retryMeeting(meetingId: string, recordingId: string) {
    return request<void>(
      `/meetings/${encodeURIComponent(meetingId)}/retry?recordingId=${encodeURIComponent(recordingId)}`,
      { method: "POST" },
    );
  },

  // ── Recordings ────────────────────────────────────
  requestUploadUrl(
    meetingId: string,
    contentType: string,
    fileExtension: string,
  ) {
    return request<UploadUrlResponse>(
      `/meetings/${encodeURIComponent(meetingId)}/recordings/upload-url`,
      {
        method: "POST",
        body: JSON.stringify({ contentType, fileExtension }),
      },
    );
  },

  /** Direct PUT to the signed storage URL — the URL is the credential, so no auth header. */
  async uploadBlob(uploadUrl: string, blob: Blob): Promise<void> {
    const res = await fetch(uploadUrl, {
      method: "PUT",
      headers: { "Content-Type": blob.type || "application/octet-stream" },
      body: blob,
    }).catch(() => {
      throw new ApiError(0, "Could not reach storage to upload the recording.");
    });
    if (!res.ok && res.status !== 204) {
      throw new ApiError(res.status, `Upload failed (${res.status})`);
    }
  },

  completeRecording(
    meetingId: string,
    recordingId: string,
    durationMs: number,
  ) {
    return request<void>(
      `/meetings/${encodeURIComponent(meetingId)}/recordings/${encodeURIComponent(recordingId)}/complete`,
      {
        method: "POST",
        body: JSON.stringify({ durationMs: Math.round(durationMs) }),
      },
    );
  },

  getAudioUrl(meetingId: string, recordingId: string) {
    return request<AudioUrlResponse>(
      `/meetings/${encodeURIComponent(meetingId)}/recordings/${encodeURIComponent(recordingId)}/audio-url`,
    );
  },

  // ── Transcripts ───────────────────────────────────
  async getTranscript(meetingId: string): Promise<Transcript> {
    const raw = await request<
      Omit<Transcript, "segments"> & { segments: RawSegment[] }
    >(`/meetings/${encodeURIComponent(meetingId)}/transcript`);
    return { ...raw, segments: (raw.segments ?? []).map(normalizeSegment) };
  },

  async searchTranscript(meetingId: string, q: string) {
    const raw = await request<RawSegment[]>(
      `/meetings/${encodeURIComponent(meetingId)}/transcript/search?q=${encodeURIComponent(q)}`,
    );
    return (raw ?? []).map(normalizeSegment);
  },

  renameSpeaker(meetingId: string, speakerId: string, label: string) {
    return request<Speaker>(
      `/meetings/${encodeURIComponent(meetingId)}/speakers/${encodeURIComponent(speakerId)}`,
      {
        method: "PATCH",
        body: JSON.stringify({ label }),
      },
    );
  },

  async exportTranscript(
    meetingId: string,
    format: ExportFormat,
    fileName: string,
  ) {
    const token = await authToken();
    // The enum binds by name and is case-sensitive: `txt` returns 400.
    const res = await fetch(
      `${API_BASE_URL}/meetings/${encodeURIComponent(meetingId)}/export?format=${format}`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new ApiError(res.status, text || `Export failed (${res.status})`);
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  },
};
