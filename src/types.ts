export interface Meeting {
  id: string;
  title: string;
  status: string;
  scheduledAt?: string | null;
  failureReason: string | null;
  failureMessage: string | null;
  participantHints: string[];
  createdAt?: string;
  updatedAt?: string;
}

export interface Recording {
  id: string;
  meetingId: string;
  ownerUid: string;
  contentType: string;
  fileExtension: string;
  storageKey: string;
  durationMs: number;
  status: string;
  createdAt: string;
}

export interface TranscriptSegment {
  id: string;
  speakerId: string;
  speakerLabel: string;
  text: string;
  startMs: number;
  endMs: number;
  confidence: number;
}

export interface Transcript {
  id: string;
  meetingId: string;
  createdAt: string;
  segments: TranscriptSegment[];
}

export interface UploadUrlResponse {
  recordingId: string;
  uploadUrl: string;
  storageKey: string;
  expiresAt: string;
}

export interface MeetingStatusPayload {
  meetingId: string;
  status: string;
  failureReason?: string | null;
  failureMessage?: string | null;
}

export interface Speaker {
  id: string;
  label: string;
}
