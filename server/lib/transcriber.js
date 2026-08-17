import {
  getMeeting,
  updateMeeting,
  updateRecording,
  readBlob,
  getTranscript,
  saveTranscript,
} from "./store.js";
import { isValidAudioType } from "./audio.js";

const MOCK_LINES = [
  "Welcome everyone, let’s get started.",
  "Let’s run through the agenda for today.",
  "We shipped the last milestone on schedule.",
  "The next release is blocked on the auth flow.",
  "Let’s assign owners for each open item.",
  "I’ll follow up with a summary by Friday.",
  "Thanks all, that completes the meeting.",
];

function buildMockTranscript({ durationMs, participantHints }) {
  const duration = Math.max(durationMs, 15_000);
  const totalSeconds = duration / 1000;
  const hintNames = (participantHints || []).filter(Boolean);
  const lines = MOCK_LINES;
  const segments = [];
  const gap = totalSeconds / lines.length;
  let t = 0;
  for (let i = 0; i < lines.length; i += 1) {
    const segStart = t;
    const segEnd = Math.min(t + gap * 0.85, totalSeconds - 0.1);
    const speakerIndex = i % 2;
    const speakerId = `spk_${speakerIndex}`;
    const label = hintNames[speakerIndex] || `Speaker ${speakerIndex + 1}`;
    segments.push({
      id: `seg_${i}`,
      speakerId,
      speakerLabel: label,
      text: lines[i],
      startMs: Math.round(segStart * 1000),
      endMs: Math.round((segEnd + 0.1) * 1000),
      confidence: 0.95,
    });
    t += gap;
  }
  return segments;
}

function speakerLabelFor(meeting, speakerId) {
  const index = Number(speakerId.split("_")[1]);
  const hints = (meeting?.participantHints || []).filter(Boolean);
  if (hints[index]) return hints[index];
  return `Speaker ${index + 1}`;
}

// Split a plain segment list into speakers. OpenAI's diarize model gives real
// speaker turns; when only a plain transcript exists, this heuristic splits on
// silence gaps (>1.5s) and cycles through up to 4 speakers.
function diarize(whisperSegments, meeting) {
  const speakers = new Map();
  let currentSpeakerIndex = 0;
  const segments = whisperSegments.map((seg, i) => {
    const prev = whisperSegments[i - 1];
    const gap = prev ? seg.start - prev.end : 0;
    const startsNewTurn =
      !prev || gap > 1.5 || (seg.text && prev.text && seg.text.endsWith("?") && gap > 0.8);
    if (startsNewTurn) currentSpeakerIndex = (currentSpeakerIndex + 1) % 4;
    const speakerId = `spk_${currentSpeakerIndex}`;
    if (!speakers.has(speakerId))
      speakers.set(speakerId, speakerLabelFor(meeting, speakerId));
    const speakerLabel =
      seg.speakerLabel && /^speaker \d+$/i.test(seg.speakerLabel)
        ? seg.speakerLabel
        : speakers.get(speakerId);
    return {
      id: `seg_${Date.now().toString(36)}${i}`,
      speakerId,
      speakerLabel,
      text: seg.text,
      startMs: Math.round(seg.start * 1000),
      endMs: Math.round(seg.end * 1000),
      confidence: Math.min(0.99, (seg.confidence ?? 0.9) + 0.02),
    };
  });
  return segments;
}

async function transcribeWithGroq(buffer, contentType) {
  const { default: OpenAI } = await import("openai");
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) throw new Error("GROQ_API_KEY is not set");
  const client = new OpenAI({
    apiKey,
    baseURL: "https://api.groq.com/openai/v1",
  });
  const extension = (contentType.split("/")[1] || "webm").split(";")[0];
  const mimeType = contentType.split(";")[0].trim();
  const file = new File([new Uint8Array(buffer)], `audio.${extension}`, {
    type: mimeType,
  });
  const result = await client.audio.transcriptions.create({
    file,
    model: "whisper-large-v3-turbo",
    response_format: "verbose_json",
    timestamp_granularities: ["segment"],
  });
  const segments = (result.segments || []).map((seg) => ({
    start: seg.start,
    end: seg.end,
    text: seg.text,
    confidence: seg.avg_logprob ? Math.max(0, 1 + seg.avg_logprob) : 0.9,
  }));
  // Groq sometimes returns only a plain text (no segments); synthesize one.
  if (segments.length === 0 && result.text && result.text.trim()) {
    segments.push({
      start: 0,
      end: 0,
      text: result.text.trim(),
      confidence: 0.9,
    });
  }
  return segments;
}

async function transcribeWithOpenAI(buffer, contentType) {
  const { default: OpenAI } = await import("openai");
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY is not set");
  const client = new OpenAI({ apiKey });
  const extension = (contentType.split("/")[1] || "webm").split(";")[0];
  const mimeType = contentType.split(";")[0].trim();
  const file = new File([new Uint8Array(buffer)], `audio.${extension}`, {
    type: mimeType,
  });
  // gpt-4o-mini-transcribe is the fastest accurate model; when diarization is
  // needed, gpt-4o-transcribe-diarize returns real speaker turns.
  const wantsDiarization = process.env.OPENAI_DIARIZE !== "false";
  const model = wantsDiarization
    ? "gpt-4o-transcribe-diarize"
    : "gpt-4o-mini-transcribe";
  const result = await client.audio.transcriptions.create({
    file,
    model,
    response_format: "verbose_json",
    timestamp_granularities: ["segment"],
  });

  // Diarized model returns speaker turns directly.
  const turns = result.turns || result.segments || [];
  const segments = turns
    .filter((t) => t && t.text && String(t.text).trim())
    .map((seg, i) => {
      const rawSpeaker = seg.speaker
        ? String(seg.speaker).trim()
        : `Speaker ${(i % 2) + 1}`;
      const numMatch = rawSpeaker.match(/(\d+)/);
      const index = numMatch ? Number(numMatch[1]) - 1 : i % 2;
      return {
        speakerId: `spk_${index}`,
        speakerLabel: `Speaker ${index + 1}`,
        start: seg.start ?? 0,
        end: seg.end ?? 0,
        text: seg.text,
        confidence: seg.avg_logprob ? Math.max(0, 1 + seg.avg_logprob) : 0.9,
      };
    });
  if (segments.length === 0 && result.text && result.text.trim()) {
    segments.push({
      speakerId: "spk_0",
      speakerLabel: "Speaker 1",
      start: 0,
      end: 0,
      text: result.text.trim(),
      confidence: 0.9,
    });
  }
  return segments;
}

function mapFailure(err) {
  const msg = (err && err.message) || String(err);
  if (/storage|bucket|blob|buffer/i.test(msg) || err?.name === "StorageError")
    return "StorageError";
  if (/diariz|speaker/i.test(msg)) return "DiarizationFailed";
  if (/merge/i.test(msg)) return "MergeFailed";
  return "TranscriptionFailed";
}

/**
 * Runs the Recording -> Uploaded -> Processing -> Ready pipeline for one
 * recording. Emits hub events via the supplied broadcaster and stores the
 * resulting transcript. Resolves once the pipeline is dispatched (background).
 */
export async function processRecording(
  { meetingId, recordingId, durationMs },
  broadcast,
) {
  const meeting = await getMeeting(meetingId);
  if (!meeting) return;

  const recording = await updateRecording(meetingId, recordingId, {
    durationMs: Math.max(0, Math.round(durationMs || 0)),
    status: "Uploaded",
  });

  const sendStatus = (status, extra = {}) => {
    const payload = { meetingId, status, ...extra };
    broadcast(meetingId, "meetingStatusChanged", payload);
  };

  try {
    await updateMeeting(meetingId, {
      status: "Uploaded",
      failureReason: null,
      failureMessage: null,
    });
    sendStatus("Uploaded");

    await updateMeeting(meetingId, { status: "Processing" });
    sendStatus("Processing");

    const buffer = await readBlob(recording.storageKey);
    if (!buffer || buffer.byteLength < 100) {
      const storageErr = new Error("Uploaded audio is missing or too small");
      storageErr.name = "StorageError";
      throw storageErr;
    }
    if (!isValidAudioType(recording.contentType)) {
      throw new Error(
        `Unsupported audio content type: ${recording.contentType}`,
      );
    }

    let segments;
    const fallbackToMock = process.env.FALLBACK_TO_MOCK === "true";
    const source = process.env.OPENAI_API_KEY
      ? "openai"
      : process.env.GROQ_API_KEY && process.env.GROQ_API_KEY !== "your-groq-api-key"
        ? "groq"
        : null;

    if (source) {
      const transcribe =
        source === "groq"
          ? transcribeWithGroq
          : transcribeWithOpenAI;
      try {
        const raw = await transcribe(buffer, recording.contentType);
        segments = diarize(raw, meeting);
      } catch (transcribeErr) {
        if (!fallbackToMock) {
          throw transcribeErr;
        }
        console.warn(
          `${source} transcription failed, using mock fallback:`,
          transcribeErr.message,
        );
        segments = [];
      }
    } else {
      if (!fallbackToMock) {
        throw new Error(
          "Neither GROQ_API_KEY nor OPENAI_API_KEY is set and mock fallback is disabled",
        );
      }
      console.warn("No transcription source configured; using mock fallback");
      segments = [];
    }

    // Prefer live captions saved by the client (VoiceRecorder) over synthetic
    // mock text when there is no real transcription source. Checked right
    // before saving to be robust against the client save racing the
    // background processing pipeline.
    const savedTranscript = await getTranscript(meetingId);
    const clientCaptions =
      savedTranscript?.segments?.length > 0 &&
      savedTranscript?.id?.startsWith("client-") &&
      savedTranscript.segments.every((s) =>
        s.speakerId === "caption" || String(s.speakerId || "").startsWith("spk_"),
      )
        ? savedTranscript
        : null;

    if (clientCaptions && (!source || segments.length === 0)) {
      segments = clientCaptions.segments;
    } else if (segments.length === 0) {
      segments = buildMockTranscript({
        durationMs: recording.durationMs,
        participantHints: meeting.participantHints,
      });
    }

    const transcript = {
      id: recordingId,
      meetingId,
      createdAt: new Date().toISOString(),
      segments,
    };
    await saveTranscript(transcript);

    for (const segment of segments) {
      broadcast(meetingId, "transcriptSegmentReady", segment);
    }

    await updateMeeting(meetingId, { status: "Ready" });
    sendStatus("Ready");
  } catch (err) {
    console.error("Recording processing failed:", err);
    const failureReason = mapFailure(err);
    await updateMeeting(meetingId, {
      status: "Failed",
      failureReason,
      failureMessage: (err && err.message) || "Processing failed",
    });
    sendStatus("Failed", { failureReason, failureMessage: err?.message });
  }
}
