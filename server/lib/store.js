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
const FOLDERS_DIR = path.join(DATA_DIR, 'folders');

for (const dir of [UPLOADS_DIR, MEETINGS_DIR, RECORDINGS_DIR, SPEAKERS_DIR, TRANSCRIPTS_DIR, FOLDERS_DIR]) {
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

// Serialize writes per file path so concurrent updates (e.g. status + meeting
// patch racing) cannot interleave and corrupt the JSON.
const writeQueues = new Map();

function enqueueWrite(filePath, work) {
  const prev = writeQueues.get(filePath) || Promise.resolve();
  const next = prev.then(work, work);
  writeQueues.set(
    filePath,
    next.catch(() => {}),
  );
  return next;
}

function writeJson(filePath, data) {
  const payload = JSON.stringify(data, null, 2);
  return enqueueWrite(filePath, async () => {
    const tmpPath = `${filePath}.${randomUUID()}.tmp`;
    await fs.promises.writeFile(tmpPath, payload, 'utf8');
    await fs.promises.rename(tmpPath, filePath);
  });
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

export async function listAllRecordings(ownerUid) {
  const files = await fs.promises.readdir(RECORDINGS_DIR).catch(() => []);
  const recordings = [];
  for (const file of files) {
    if (!file.endsWith('.json')) continue;
    const recording = await readJson(path.join(RECORDINGS_DIR, file));
    if (recording && recording.ownerUid === ownerUid) recordings.push(recording);
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
    title: null,
    folderId: null,
    complaint: null,
    createdAt: new Date().toISOString(),
  };
  await writeJson(recordingFile(meetingId, recording.id), recording);
  return recording;
}

export async function updateRecording(meetingId, recordingId, patch) {
  const recording = await getRecording(meetingId, recordingId);
  if (!recording) return null;
  Object.assign(recording, patch, { updatedAt: new Date().toISOString() });
  await writeJson(recordingFile(meetingId, recordingId), recording);
  return recording;
}

export async function deleteRecording(meetingId, recordingId) {
  const recording = await getRecording(meetingId, recordingId);
  if (!recording) return false;
  try {
    await fs.promises.unlink(recordingFile(meetingId, recordingId));
  } catch {
    /* ignore */
  }
  if (recording.storageKey) {
    try {
      await fs.promises.rm(blobPath(recording.storageKey), { force: true });
    } catch {
      /* ignore */
    }
  }
  return true;
}

export async function deleteAllRecordings(ownerUid) {
  const files = await fs.promises.readdir(RECORDINGS_DIR).catch(() => []);
  let deleted = 0;
  for (const file of files) {
    if (!file.endsWith('.json')) continue;
    const recording = await readJson(path.join(RECORDINGS_DIR, file));
    if (!recording || recording.ownerUid !== ownerUid) continue;
    if (await deleteRecording(recording.meetingId, recording.id)) deleted++;
  }
  return deleted;
}

export async function clearFolderFromRecordings(folderId) {
  const files = await fs.promises.readdir(RECORDINGS_DIR).catch(() => []);
  for (const file of files) {
    if (!file.endsWith('.json')) continue;
    const filePath = path.join(RECORDINGS_DIR, file);
    const recording = await readJson(filePath);
    if (recording && recording.folderId === folderId) {
      recording.folderId = null;
      await writeJson(filePath, recording);
    }
  }
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

export async function getTranscriptTextsByMeeting() {
  const files = await fs.promises.readdir(TRANSCRIPTS_DIR).catch(() => []);
  const byMeeting = {};
  for (const file of files) {
    if (!file.endsWith('.json')) continue;
    const transcript = await readJson(path.join(TRANSCRIPTS_DIR, file));
    if (!transcript?.meetingId) continue;
    byMeeting[transcript.meetingId] = transcript;
  }
  return byMeeting;
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

// ── Folders ────────────────────────────────────────
const folderFile = (folderId) => path.join(FOLDERS_DIR, `${folderId}.json`);

export async function getFolder(folderId) {
  return readJson(folderFile(folderId));
}

export async function listFolders(ownerUid) {
  const files = await fs.promises.readdir(FOLDERS_DIR).catch(() => []);
  const folders = [];
  for (const file of files) {
    if (!file.endsWith('.json')) continue;
    const folder = await readJson(path.join(FOLDERS_DIR, file));
    if (folder && folder.ownerUid === ownerUid) folders.push(folder);
  }
  return folders.sort((a, b) => String(a.name).localeCompare(String(b.name)));
}

export async function createFolder({ ownerUid, name }) {
  const folder = {
    id: randomUUID(),
    ownerUid,
    name,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  await writeJson(folderFile(folder.id), folder);
  return folder;
}

export async function renameFolder(folderId, name) {
  const folder = await getFolder(folderId);
  if (!folder) return null;
  folder.name = name;
  folder.updatedAt = new Date().toISOString();
  await writeJson(folderFile(folderId), folder);
  return folder;
}

export async function deleteFolder(folderId) {
  try {
    await fs.promises.unlink(folderFile(folderId));
    return true;
  } catch {
    return false;
  }
}