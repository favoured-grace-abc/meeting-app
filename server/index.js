import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";

import { authenticate, AuthError } from "./lib/auth.js";
import { MeetingHub } from "./lib/signalr.js";
import {
  createUploadUrl,
  createDownloadUrl,
  validateSignedUrl,
} from "./lib/signedUrl.js";
import {
  createMeeting,
  getMeeting,
  listMeetings,
  updateMeeting,
  deleteMeeting,
  createRecording,
  getRecording,
  listRecordings,
  getTranscript,
  saveTranscript,
  getSpeakers,
  setSpeakerLabel,
  blobExists,
  writeBlob,
  readBlob,
} from "./lib/store.js";
import { processRecording } from "./lib/transcriber.js";
import { generateTranscriptBlob } from "./lib/transcript.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const isDev = process.env.NODE_ENV !== "production";
const transcriptionSource = process.env.GROQ_API_KEY
  ? "groq"
  : process.env.OPENAI_API_KEY
    ? "openai"
    : null;
const mockFallbackEnabled = process.env.FALLBACK_TO_MOCK === "true";

console.log(`Server starting on port ${process.env.PORT || 3001}`);
console.log(`Transcription source: ${transcriptionSource || "none"}`);
console.log(`FALLBACK_TO_MOCK=${mockFallbackEnabled}`);
if (!transcriptionSource && !mockFallbackEnabled) {
  console.warn(
    "No GROQ_API_KEY or OPENAI_API_KEY found and FALLBACK_TO_MOCK is not enabled. Transcription will fail instead of returning mock text.",
  );
}

const app = express();
const PORT = Number(process.env.PORT) || 3001;

const hub = new MeetingHub();

const BASE_URL =
  process.env.SERVER_BASE_URL ||
  process.env.VITE_API_BASE_URL ||
  `http://localhost:${PORT}`;

// ── CORS ────────────────────────────────────────────
const ALLOWED_HEADERS = [
  "Content-Type",
  "Authorization",
  "X-SignalR-Client",
  "X-SignalR-User-Agent",
  "x-requested-with",
];

app.use(
  cors({
    origin: true,
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ALLOWED_HEADERS,
  }),
);
app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (origin) {
    res.header("Access-Control-Allow-Origin", origin);
    res.header("Access-Control-Allow-Credentials", "true");
    res.header("Access-Control-Allow-Headers", ALLOWED_HEADERS.join(", "));
    res.header(
      "Access-Control-Allow-Methods",
      "GET, POST, PUT, PATCH, DELETE, OPTIONS",
    );
  }
  if (req.method === "OPTIONS") {
    return res.sendStatus(204);
  }
  next();
});
// ── Rate limiting ───────────────────────────────────
const rateLimitMap = new Map();
function rateLimit(limit, windowMs) {
  return (req, res, next) => {
    const ip = req.ip || req.connection.remoteAddress;
    const now = Date.now();
    const entry = rateLimitMap.get(ip) || { count: 0, resetAt: now + windowMs };
    if (now > entry.resetAt) {
      entry.count = 0;
      entry.resetAt = now + windowMs;
    }
    entry.count++;
    rateLimitMap.set(ip, entry);
    if (entry.count > limit) {
      return res.status(429).json({ status: 429, title: "Too many requests" });
    }
    next();
  };
}
app.use(rateLimit(120, 60000));

// ── Signed upload/download (no auth header — the URL is the credential) ──
app.put(
  "/upload/:storageKey",
  express.raw({ type: () => true, limit: "200mb" }),
  async (req, res, next) => {
    try {
      const storageKey = req.params.storageKey;
      const { exp, sig } = req.query;
      validateSignedUrl({
        key: storageKey,
        action: "upload",
        expiresAt: exp,
        sig,
      });
      await writeBlob(storageKey, req.body || Buffer.alloc(0));
      res.status(204).end();
    } catch (err) {
      next(err);
    }
  },
);

app.get("/download/:storageKey", async (req, res, next) => {
  try {
    const storageKey = req.params.storageKey;
    const { exp, sig } = req.query;
    validateSignedUrl({
      key: storageKey,
      action: "download",
      expiresAt: exp,
      sig,
    });
    const buffer = await readBlob(storageKey);
    if (!buffer) {
      return res
        .status(404)
        .json({ status: 404, title: "Recording not found" });
    }
    res.setHeader("Content-Type", "application/octet-stream");
    res.send(buffer);
  } catch (err) {
    next(err);
  }
});

// ── JSON body parsing for the REST API ──────────────
app.use(express.json({ limit: "2mb" }));

// ── Helpers ─────────────────────────────────────────
function problem(res, status, title, errors) {
  const body = { status, title };
  if (Array.isArray(errors) && errors.length > 0) body.errors = errors;
  res.status(status).json(body);
}

function uidOf(user) {
  return user.uid || user.sub;
}

function toMeetingDto(meeting) {
  if (!meeting) return null;
  return {
    id: meeting.id,
    title: meeting.title,
    status: meeting.status,
    scheduledAt: meeting.scheduledAt || null,
    failureReason: meeting.failureReason,
    failureMessage: meeting.failureMessage,
    participantHints: meeting.participantHints || [],
    createdAt: meeting.createdAt,
    updatedAt: meeting.updatedAt,
  };
}

async function requireOwnedMeeting(req, res, { recordingId } = {}) {
  const { meetingId } = req.params;
  const meeting = await getMeeting(meetingId);
  if (!meeting) {
    problem(res, 404, "Meeting not found");
    return null;
  }
  if (meeting.ownerUid !== uidOf(req.user)) {
    problem(res, 403, "You do not have access to this meeting");
    return null;
  }
  if (recordingId) {
    const recording = await getRecording(meetingId, recordingId);
    if (!recording) {
      problem(res, 404, "Recording not found");
      return null;
    }
    return { meeting, recording };
  }
  return { meeting };
}

// ── Health ──────────────────────────────────────────
app.get("/api/voice/health", (_req, res) => {
  res.json({ status: "ok" });
});

// ── Meetings ────────────────────────────────────────
app.get("/meetings", authenticate, async (req, res, next) => {
  try {
    const meetings = await listMeetings(uidOf(req.user));
    res.json(meetings.map(toMeetingDto));
  } catch (err) {
    next(err);
  }
});

app.post("/meetings", authenticate, async (req, res, next) => {
  try {
    const title =
      typeof req.body?.title === "string" ? req.body.title.trim() : "";
    if (!title) {
      return problem(res, 400, "Validation failed: title is required", [
        "title",
      ]);
    }
    const participantHints = Array.isArray(req.body.participantHints)
      ? req.body.participantHints.filter((h) => typeof h === "string")
      : null;

    const rawScheduledAt = req.body?.scheduledAt;
    const scheduledAt =
      typeof rawScheduledAt === "string" && rawScheduledAt.trim()
        ? new Date(rawScheduledAt)
        : null;
    if (rawScheduledAt && scheduledAt && Number.isNaN(scheduledAt.getTime())) {
      return problem(res, 400, "Validation failed: scheduledAt is invalid", [
        "scheduledAt",
      ]);
    }

    const meeting = await createMeeting({
      ownerUid: uidOf(req.user),
      title,
      participantHints,
      scheduledAt: scheduledAt ? scheduledAt.toISOString() : null,
    });
    res.status(201).json(toMeetingDto(meeting));
  } catch (err) {
    next(err);
  }
});

app.get("/meetings/:meetingId", authenticate, async (req, res, next) => {
  try {
    const owned = await requireOwnedMeeting(req, res);
    if (!owned) return;
    res.json(toMeetingDto(owned.meeting));
  } catch (err) {
    next(err);
  }
});

app.get("/meetings/:meetingId/status", authenticate, async (req, res, next) => {
  try {
    const owned = await requireOwnedMeeting(req, res);
    if (!owned) return;
    res.json({
      id: owned.meeting.id,
      status: owned.meeting.status,
      failureReason: owned.meeting.failureReason,
      failureMessage: owned.meeting.failureMessage,
    });
  } catch (err) {
    next(err);
  }
});

app.post("/meetings/:meetingId/retry", authenticate, async (req, res, next) => {
  try {
    const recordingId = String(req.query.recordingId || "");
    if (!recordingId) {
      return problem(res, 400, "Validation failed: recordingId is required", [
        "recordingId",
      ]);
    }
    const owned = await requireOwnedMeeting(req, res, { recordingId });
    if (!owned) return;
    if (owned.meeting.status !== "Failed") {
      await updateMeeting(owned.meeting.id, {
        status: "Processing",
        failureReason: null,
        failureMessage: null,
      });
    }
    hub.broadcast(owned.meeting.id, "meetingStatusChanged", {
      meetingId: owned.meeting.id,
      status: "Processing",
    });
    processRecording(
      {
        meetingId: owned.meeting.id,
        recordingId,
        durationMs: owned.recording.durationMs || 0,
      },
      hub.broadcast.bind(hub),
    );
    res.status(202).end();
  } catch (err) {
    next(err);
  }
});

app.patch("/meetings/:meetingId", authenticate, async (req, res, next) => {
  try {
    const owned = await requireOwnedMeeting(req, res);
    if (!owned) return;

    const patch = {};
    if (typeof req.body?.title === "string") {
      const title = req.body.title.trim();
      if (!title) {
        return problem(res, 400, "Validation failed: title is required", [
          "title",
        ]);
      }
      patch.title = title;
    }
    if (Array.isArray(req.body.participantHints)) {
      patch.participantHints = req.body.participantHints.filter(
        (h) => typeof h === "string",
      );
    }
    const rawScheduledAt = req.body?.scheduledAt;
    if (typeof rawScheduledAt === "string") {
      const scheduledAt = rawScheduledAt.trim()
        ? new Date(rawScheduledAt)
        : null;
      if (scheduledAt && Number.isNaN(scheduledAt.getTime())) {
        return problem(
          res,
          400,
          "Validation failed: scheduledAt is invalid",
          ["scheduledAt"],
        );
      }
      patch.scheduledAt = scheduledAt ? scheduledAt.toISOString() : null;
    }

    const meeting = await updateMeeting(owned.meeting.id, patch);
    res.json(toMeetingDto(meeting));
  } catch (err) {
    next(err);
  }
});

app.delete("/meetings/:meetingId", authenticate, async (req, res, next) => {
  try {
    const owned = await requireOwnedMeeting(req, res);
    if (!owned) return;
    await deleteMeeting(owned.meeting.id);
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});


// ── Recordings ──────────────────────────────────────
app.get(
  "/meetings/:meetingId/recordings",
  authenticate,
  async (req, res, next) => {
    try {
      const owned = await requireOwnedMeeting(req, res);
      if (!owned) return;
      const recordings = await listRecordings(owned.meeting.id);
      res.json(recordings);
    } catch (err) {
      next(err);
    }
  },
);

app.post(
  "/meetings/:meetingId/recordings/upload-url",
  authenticate,
  async (req, res, next) => {
    try {
      const contentType =
        typeof req.body?.contentType === "string"
          ? req.body.contentType.trim()
          : "";
      if (!contentType) {
        return problem(res, 400, "Validation failed: contentType is required", [
          "contentType",
        ]);
      }
      const owned = await requireOwnedMeeting(req, res);
      if (!owned) return;

      const fileExtension =
        typeof req.body.fileExtension === "string" &&
        req.body.fileExtension.trim()
          ? req.body.fileExtension.trim().replace(/^\./, "")
          : (contentType.split("/")[1] || "webm").split(";")[0];

      const recording = await createRecording({
        meetingId: owned.meeting.id,
        ownerUid: uidOf(req.user),
        contentType,
        fileExtension,
      });

      const { url, expiresAt } = createUploadUrl({
        key: recording.storageKey,
        contentType,
        baseUrl: BASE_URL,
      });

      res.status(201).json({
        recordingId: recording.id,
        uploadUrl: url,
        storageKey: recording.storageKey,
        expiresAt,
      });
    } catch (err) {
      next(err);
    }
  },
);

app.post(
  "/meetings/:meetingId/recordings/:recordingId/complete",
  authenticate,
  async (req, res, next) => {
    try {
      const owned = await requireOwnedMeeting(req, res, {
        recordingId: req.params.recordingId,
      });
      if (!owned) return;
      const durationMs = Number(req.body?.durationMs) || 0;

      if (!(await blobExists(owned.recording.storageKey))) {
        return problem(
          res,
          400,
          "Upload not found — complete the direct upload first",
        );
      }

      processRecording(
        {
          meetingId: owned.meeting.id,
          recordingId: owned.recording.id,
          durationMs,
        },
        hub.broadcast.bind(hub),
      );
      res.status(204).end();
    } catch (err) {
      next(err);
    }
  },
);

app.get(
  "/meetings/:meetingId/recordings/:recordingId/audio-url",
  authenticate,
  async (req, res, next) => {
    try {
      const owned = await requireOwnedMeeting(req, res, {
        recordingId: req.params.recordingId,
      });
      if (!owned) return;
      if (!(await blobExists(owned.recording.storageKey))) {
        return problem(res, 404, "Recording not found");
      }
      const { url, expiresAt } = createDownloadUrl({
        key: owned.recording.storageKey,
        baseUrl: BASE_URL,
      });
      res.json({ url, expiresAt });
    } catch (err) {
      next(err);
    }
  },
);

// ── Transcripts ─────────────────────────────────────
app.get(
  "/meetings/:meetingId/transcript",
  authenticate,
  async (req, res, next) => {
    try {
      const owned = await requireOwnedMeeting(req, res);
      if (!owned) return;
      const transcript = await getTranscript(owned.meeting.id);
      if (!transcript) {
        return problem(res, 404, "Transcript not ready yet");
      }
      res.json(transcript);
    } catch (err) {
      next(err);
    }
  },
);

app.get(
  "/meetings/:meetingId/transcript/search",
  authenticate,
  async (req, res, next) => {
    try {
      const owned = await requireOwnedMeeting(req, res);
      if (!owned) return;
      const q = String(req.query.q || "")
        .trim()
        .toLowerCase();
      const transcript = await getTranscript(owned.meeting.id);
      if (!transcript) {
        return res.json([]);
      }
      const matches = transcript.segments.filter((seg) =>
        q ? (seg.text || "").toLowerCase().includes(q) : true,
      );
      res.json(matches);
    } catch (err) {
      next(err);
    }
  },
);

app.get("/meetings/:meetingId/export", authenticate, async (req, res, next) => {
  try {
    const owned = await requireOwnedMeeting(req, res);
    if (!owned) return;
    const transcript = await getTranscript(owned.meeting.id);
    if (!transcript) {
      return problem(res, 404, "Transcript not ready yet");
    }

    const format = String(req.query.format || "Txt").toLowerCase();
    const supported = ["srt", "vtt", "docx", "txt"];
    if (!supported.includes(format)) {
      return problem(res, 400, `Unsupported format: ${req.query.format}`, [
        "format",
      ]);
    }

    const { buffer, mimeType, extension } = generateTranscriptBlob(
      transcript.segments,
      format,
    );
    res.setHeader("Content-Type", mimeType);
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="transcript.${extension}"`,
    );
    res.send(buffer);
  } catch (err) {
    next(err);
  }
});

// ── Speakers ────────────────────────────────────────
app.patch(
  "/meetings/:meetingId/speakers/:speakerId",
  authenticate,
  async (req, res, next) => {
    try {
      const label =
        typeof req.body?.label === "string" ? req.body.label.trim() : "";
      if (!label) {
        return problem(res, 400, "Validation failed: label is required", [
          "label",
        ]);
      }

      const owned = await requireOwnedMeeting(req, res);
      if (!owned) return;
      const speakerId = String(req.params.speakerId);

      const speakers = await getSpeakers(owned.meeting.id);
      if (!speakers[speakerId]) {
        return problem(res, 404, "Speaker not found");
      }

      const updated = await setSpeakerLabel(owned.meeting.id, speakerId, label);

      // Re-label any transcript segments for this speaker.
      const transcript = await getTranscript(owned.meeting.id);
      if (transcript) {
        transcript.segments = transcript.segments.map((seg) =>
          seg.speakerId === speakerId ? { ...seg, speakerLabel: label } : seg,
        );
        await saveTranscript(transcript);
      }

      res.json(updated);
    } catch (err) {
      next(err);
    }
  },
);

// ── Error handling ──────────────────────────────────
app.use((err, _req, res, _next) => {
  if (err instanceof AuthError) {
    return res.status(401).end();
  }
  if (err?.type === "entity.too.large") {
    return problem(res, 413, "Payload too large");
  }
  if (err?.message && /signature|expired/i.test(err.message)) {
    return problem(res, 403, err.message);
  }
  console.error(err);
  problem(res, 500, "Internal server error");
});

// ── Static hosting (production) ─────────────────────
if (!isDev) {
  app.use(express.static(path.join(__dirname, "..", "dist")));
  app.get("*", (_req, res) => {
    res.sendFile(path.join(__dirname, "..", "dist", "index.html"));
  });
}

const server = app.listen(PORT, () => {
  console.log(`MeetFlow server running on http://localhost:${PORT}`);
  console.log(`  REST API base:  ${BASE_URL}`);
  console.log(`  Meeting hub:    ${BASE_URL}/hubs/meeting`);
});

hub.attach({ app, server, path: "/hubs/meeting" });

export { app, hub };
