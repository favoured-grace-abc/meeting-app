/**
 * Device-local index of the meetings recorded from this browser.
 *
 * The Meeting Recorder API is addressed strictly by id — it exposes no
 * `GET /meetings` list, no recordings list, and no folder or delete endpoints.
 * Without a local index the app would have no way to find a past meeting again
 * once you navigated away from it, so the library page is backed by
 * localStorage and hydrated from the API per id.
 *
 * Consequences worth knowing: the library does not follow the user to another
 * browser or device, and "remove" only drops the entry from this index — the
 * meeting and its audio stay on the server. Both go away once the API grows a
 * list endpoint and a delete endpoint.
 */

const ENTRIES_KEY = "meetflow.library.entries.v1";
const FOLDERS_KEY = "meetflow.library.folders.v1";

/** Dispatched on `window` whenever the library changes. */
export const LIBRARY_UPDATED_EVENT = "meetflow:library-updated";

export interface LibraryEntry {
  meetingId: string;
  recordingId: string | null;
  /** Local override of the meeting title; seeded from the title we created it with. */
  title: string;
  createdAt: string;
  durationMs: number;
  contentType: string;
  folderId: string | null;
}

export interface LibraryFolder {
  id: string;
  name: string;
  createdAt: string;
}

function read<T>(key: string): T[] {
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as T[]) : [];
  } catch {
    return [];
  }
}

function write<T>(key: string, value: T[]): void {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* quota or private mode — the library is best-effort */
  }
  window.dispatchEvent(new Event(LIBRARY_UPDATED_EVENT));
}

function newId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

// ── Entries ─────────────────────────────────────────
/** Newest first. */
export function listEntries(): LibraryEntry[] {
  return read<LibraryEntry>(ENTRIES_KEY).sort((a, b) =>
    a.createdAt < b.createdAt ? 1 : -1,
  );
}

export function getEntry(meetingId: string): LibraryEntry | null {
  return listEntries().find((e) => e.meetingId === meetingId) ?? null;
}

export function addEntry(entry: LibraryEntry): void {
  const entries = read<LibraryEntry>(ENTRIES_KEY).filter(
    (e) => e.meetingId !== entry.meetingId,
  );
  write(ENTRIES_KEY, [entry, ...entries]);
}

export function updateEntry(
  meetingId: string,
  patch: Partial<Omit<LibraryEntry, "meetingId">>,
): void {
  write(
    ENTRIES_KEY,
    read<LibraryEntry>(ENTRIES_KEY).map((e) =>
      e.meetingId === meetingId ? { ...e, ...patch } : e,
    ),
  );
}

export function removeEntry(meetingId: string): void {
  write(
    ENTRIES_KEY,
    read<LibraryEntry>(ENTRIES_KEY).filter((e) => e.meetingId !== meetingId),
  );
}

// ── Folders ─────────────────────────────────────────
export function listFolders(): LibraryFolder[] {
  return read<LibraryFolder>(FOLDERS_KEY).sort((a, b) =>
    a.name.localeCompare(b.name),
  );
}

export function createFolder(name: string): LibraryFolder {
  const folder: LibraryFolder = {
    id: newId(),
    name,
    createdAt: new Date().toISOString(),
  };
  write(FOLDERS_KEY, [...read<LibraryFolder>(FOLDERS_KEY), folder]);
  return folder;
}

/** Deletes the folder and un-files its entries; the entries themselves are kept. */
export function deleteFolder(folderId: string): void {
  write(
    ENTRIES_KEY,
    read<LibraryEntry>(ENTRIES_KEY).map((e) =>
      e.folderId === folderId ? { ...e, folderId: null } : e,
    ),
  );
  write(
    FOLDERS_KEY,
    read<LibraryFolder>(FOLDERS_KEY).filter((f) => f.id !== folderId),
  );
}
