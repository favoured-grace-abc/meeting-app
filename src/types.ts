// Shapes mirror the MeetingRecorder .NET API DTOs. Note that the API serializes
// its enums as *integers* over REST but as *names* over SignalR — `api.ts`
// normalizes both to the names below, so nothing downstream sees a number.

export const MEETING_STATUSES = [
  "Recording",
  "Uploaded",
  "Processing",
  "Ready",
  "Failed",
] as const;
export type MeetingStatus = (typeof MEETING_STATUSES)[number];

export const FAILURE_REASONS = [
  "None",
  "TranscriptionFailed",
  "DiarizationFailed",
  "StorageError",
  "MergeFailed",
] as const;
export type FailureReason = (typeof FAILURE_REASONS)[number];

/** `MeetingDto` */
export interface Meeting {
  id: string;
  ownerId: string;
  title: string;
  status: MeetingStatus;
  failureReason: FailureReason;
  failureMessage: string | null;
  createdAt: string;
  participantHints: string[];
}

/** `MeetingStatusDto` — the API calls the key `id`; we normalize it to `meetingId`. */
export interface MeetingStatusPayload {
  meetingId: string;
  status: MeetingStatus;
  failureReason: FailureReason;
  failureMessage: string | null;
}

/** `TranscriptSegmentDto`. Speaker fields are nullable server-side. */
export interface TranscriptSegment {
  id: string;
  speakerId: string | null;
  speakerLabel: string | null;
  text: string;
  startMs: number;
  endMs: number;
  confidence: number;
}

/** `TranscriptDto` */
export interface Transcript {
  id: string;
  meetingId: string;
  createdAt: string;
  segments: TranscriptSegment[];
}

/** `GetUploadUrlResponse` */
export interface UploadUrlResponse {
  recordingId: string;
  uploadUrl: string;
  storageKey: string;
  expiresAt: string;
}

/** `AudioUrlResponse` */
export interface AudioUrlResponse {
  url: string;
  expiresAt: string;
}

/** `SpeakerDto` */
export interface Speaker {
  id: string;
  meetingId: string;
  label: string;
  totalSpeakingMs: number;
}

/** The API binds this enum by name and is case-sensitive — `txt` is a 400. */
export const EXPORT_FORMATS = ["Txt", "Srt", "Vtt", "Docx"] as const;
export type ExportFormat = (typeof EXPORT_FORMATS)[number];
