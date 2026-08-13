import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = process.env.DATA_DIR || path.resolve(__dirname, '..', 'data');
const UPLOADS_DIR = path.join(DATA_DIR, 'uploads');
const MEETINGS_DIR = path.join(DATA_DIR, 'meetings');
const RECORDINGS_DIR = path.join(DATA_DIR, 'recordings');
const SPEAKERS_DIR = path.join(DATA_DIR, 'speakers');
const TRANSCRIPTS_DIR = path.join(DATA_DIR, 'transcripts');

for (const dir of [UPLOADS_DIR, MEETINGS_DIR, RECORDINGS_DIR, SPEAKERS_DIR, TRANSCRIPTS_DIR]) {
  fs.mkdirSync(dir, { recursive: true });
}

async function readJson(filePath, fallback = null) {
  try {
    const raw = await fs.promises.readFile(filePath, 'utf8');
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

async function writeJson(filePath, data) {
  await fs.promises.writeFile(filePath, JSON.stringify(data, null, 2), 'utf8');
}

function meetingFile(id) {
  return path.join(MEETINGS_DIR, `${id}.json`);
}

function recordingFile(meetingId, recordingId) {
  return path.join(RECORDINGS_DIR, `${meetingId}__${recordingId}.json`);
}

// ── Meetings ────────────────────────────────────────
export async function getMeeting(meetingId) {
  return readJson(meetingFile(meetingId));
}

export async function listMeetings(ownerUid) {
  const files = await fs.promises.readdir(MEETINGS_DIR).catch(() => []);
  const meetings = [];
  for (const file of files) {
    if (!file.endsWith('.json')) continue;
    const meeting = await readJson(path.join(MEETINGS_DIR, file));
    if (meeting && meeting.ownerUid === ownerUid) meetings.push(meeting);
  }
  return meetings.sort((a, b) =>
    String(a.createdAt) < String(b.createdAt) ? 1 : -1,
  );
}

export async function createMeeting({ ownerUid, title, participantHints = [], scheduledAt }) {
  const meeting = {
    id: randomUUID(),
    ownerUid,
    title,
    participantHints: Array.isArray(participantHints) ? participantHints : [],
    status: 'Recording',
    scheduledAt: scheduledAt ? new Date(scheduledAt).toISOString() : null,
    failureReason: null,
    failureMessage: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  await writeJson(meetingFile(meeting.id), meeting);
  return meeting;
}

export async function updateMeeting(meetingId, patch) {
  const meeting = await getMeeting(meetingId);
  if (!meeting) return null;
  Object.assign(meeting, patch, { updatedAt: new Date().toISOString() });
  await writeJson(meetingFile(meetingId), meeting);
  return meeting;
}

export async function deleteMeeting(meetingId) {
  try {
    await fs.promises.unlink(meetingFile(meetingId));
    return true;
  } catch {
    return false;
  }
}

// ── Recordings ──────────────────────────────────────
export async function getRecording(meetingId, recordingId) {
  return readJson(recordingFile(meetingId, recordingId));
}

export async function listRecordings(meetingId) {
  const files = await fs.promises.readdir(RECORDINGS_DIR).catch(() => []);
  const recordings = [];
  for (const file of files) {
    if (!file.endsWith('.json')) continue;
    if (!file.startsWith(`${meetingId}__`)) continue;
    recordings.push(await readJson(path.join(RECORDINGS_DIR, file)));
  }
  return recordings.sort((a, b) =>
    String(a.createdAt) < String(b.createdAt) ? 1 : -1,
  );
}

export async function createRecording({ meetingId, ownerUid, contentType, fileExtension }) {
  const recording = {
    id: randomUUID(),
    meetingId,
    ownerUid,
    contentType,
    fileExtension,
    storageKey: `meetings/${meetingId}/${randomUUID()}.${fileExtension}`,
    durationMs: 0,
    status: 'Pending',
    createdAt: new Date().toISOString(),
  };
  await writeJson(recordingFile(meetingId, recording.id), recording);
  return recording;
}

export async function updateRecording(meetingId, recordingId, patch) {
  const recording = await getRecording(meetingId, recordingId);
  if (!recording) return null;
  Object.assign(recording, patch);
  await writeJson(recordingFile(meetingId, recordingId), recording);
  return recording;
}

// ── Blobs ───────────────────────────────────────────
export function blobPath(storageKey) {
  return path.join(UPLOADS_DIR, storageKey);
}

export async function writeBlob(storageKey, buffer) {
  const target = blobPath(storageKey);
  await fs.promises.mkdir(path.dirname(target), { recursive: true });
  await fs.promises.writeFile(target, buffer);
}

export async function blobExists(storageKey) {
  try {
    const stat = await fs.promises.stat(blobPath(storageKey));
    return stat.size > 0;
  } catch {
    return false;
  }
}

export async function readBlob(storageKey) {
  try {
    return await fs.promises.readFile(blobPath(storageKey));
  } catch {
    return null;
  }
}

// ── Transcripts ─────────────────────────────────────
const transcriptFile = (meetingId) => path.join(TRANSCRIPTS_DIR, `${meetingId}.json`);

export async function getTranscript(meetingId) {
  return readJson(transcriptFile(meetingId));
}

export async function saveTranscript(t) {
  await writeJson(transcriptFile(t.meetingId), t);
}

// ── Speakers ────────────────────────────────────────
const speakersFile = (meetingId) => path.join(SPEAKERS_DIR, `${meetingId}.json`);

export async function getSpeakers(meetingId) {
  return (await readJson(speakersFile(meetingId), {})) || {};
}

export async function setSpeakerLabel(meetingId, speakerId, label) {
  const speakers = await getSpeakers(meetingId);
  speakers[speakerId] = { id: speakerId, label };
  await writeJson(speakersFile(meetingId), speakers);
  return speakers[speakerId];
}