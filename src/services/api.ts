import { auth } from "./firebase";
import type {
  Meeting,
  Recording,
  RecordingComplaint,
  Folder,
  Transcript,
  UploadUrlResponse,
} from "../types";

export const API_BASE_URL = (
  import.meta.env.VITE_API_BASE_URL || ""
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

interface ProblemBody {
  status?: number;
  title?: string;
  errors?: string[];
  message?: string;
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
      `Cannot reach the backend server at ${API_BASE_URL || window.location.origin}. ` +
        "It may be offline. Start it with `npm run dev:server` and try again.",
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
      data?.title || data?.message || `Request failed (${res.status})`,
      data?.errors,
    );
  }
  return data as T;
}

export interface MeetingStatusPayload {
  meetingId: string;
  status: string;
  failureReason?: string | null;
  failureMessage?: string | null;
}

export const api = {
  createMeeting(title: string) {
    return request<Meeting>("/meetings", {
      method: "POST",
      body: JSON.stringify({
        title,
      }),
    });
  },

  listMeetings() {
    return request<Meeting[]>("/meetings");
  },

  getMeeting(meetingId: string) {
    return request<Meeting>(`/meetings/${encodeURIComponent(meetingId)}`);
  },

  getMeetingStatus(meetingId: string) {
    return request<MeetingStatusPayload>(
      `/meetings/${encodeURIComponent(meetingId)}/status`,
    );
  },

  listRecordings(meetingId: string) {
    return request<Recording[]>(
      `/meetings/${encodeURIComponent(meetingId)}/recordings`,
    );
  },

  requestUploadUrl(
    meetingId: string,
    contentType: string,
    fileExtension?: string,
  ) {
    return request<UploadUrlResponse>(
      `/meetings/${encodeURIComponent(meetingId)}/recordings/upload-url`,
      {
        method: "POST",
        body: JSON.stringify({ contentType, fileExtension }),
      },
    );
  },

  async uploadBlob(uploadUrl: string, blob: Blob): Promise<void> {
    const res = await fetch(uploadUrl, {
      method: "PUT",
      headers: { "Content-Type": blob.type || "application/octet-stream" },
      body: blob,
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
        body: JSON.stringify({ durationMs }),
      },
    );
  },

  getTranscript(meetingId: string) {
    return request<Transcript>(
      `/meetings/${encodeURIComponent(meetingId)}/transcript`,
    );
  },

  saveTranscript(meetingId: string, segments: TranscriptSegment[]) {
    return request<Transcript>(
      `/meetings/${encodeURIComponent(meetingId)}/transcript`,
      {
        method: "PUT",
        body: JSON.stringify({ segments }),
      },
    );
  },

  getAudioUrl(meetingId: string, recordingId: string) {
    return request<{ url: string; expiresAt: string }>(
      `/meetings/${encodeURIComponent(meetingId)}/recordings/${encodeURIComponent(recordingId)}/audio-url`,
    );
  },

  renameSpeaker(meetingId: string, speakerId: string, label: string) {
    return request(
      `/meetings/${encodeURIComponent(meetingId)}/speakers/${encodeURIComponent(speakerId)}`,
      {
        method: "PATCH",
        body: JSON.stringify({ label }),
      },
    );
  },

  updateRecording(
    meetingId: string,
    recordingId: string,
    patch: {
      title?: string | null;
      folderId?: string | null;
      complaint?: RecordingComplaint | null;
    },
  ) {
    return request<Recording>(
      `/meetings/${encodeURIComponent(meetingId)}/recordings/${encodeURIComponent(recordingId)}`,
      {
        method: "PATCH",
        body: JSON.stringify(patch),
      },
    );
  },

  deleteRecording(meetingId: string, recordingId: string) {
    return request<void>(
      `/meetings/${encodeURIComponent(meetingId)}/recordings/${encodeURIComponent(recordingId)}`,
      { method: "DELETE" },
    );
  },

  listAllRecordings() {
    return request<
      (Recording & {
        meetingTitle?: string | null;
        transcriptText?: string;
        transcriptReady?: boolean;
      })[]
    >("/recordings");
  },

  listFolders() {
    return request<Folder[]>("/folders");
  },

  createFolder(name: string) {
    return request<Folder>("/folders", {
      method: "POST",
      body: JSON.stringify({ name }),
    });
  },

  deleteFolder(folderId: string) {
    return request<void>(`/folders/${encodeURIComponent(folderId)}`, {
      method: "DELETE",
    });
  },

  async exportTranscript(
    meetingId: string,
    format: "srt" | "vtt" | "docx" | "txt",
    fileName: string,
  ) {
    const token = await authToken();
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
