# MeetFlow — Meeting Recording & AI Transcription

MeetFlow is the web + mobile client for the **Meeting Recorder** service. It captures meeting
audio in the browser, uploads it to the backend, and shows the timestamped transcript the
backend produces.

This repository contains **no server of its own**. All meeting, recording, and transcript data
comes from the .NET **MeetingRecorder API**:

```
https://meeting-recorder-backend-286455810620.europe-west1.run.app
```

> **No diarization.** Nothing in the pipeline tries to tell voices apart. A transcript is a
> single stream of timestamped text; where the API supplies a speaker label it is shown and can
> be renamed, and where it does not the segments simply read as prose.

---

## Features

- **One-tap browser recording** — start/stop with a single button (MediaRecorder, no plugins).
- **Live caption preview** while recording via the browser **Web Speech API** (on-device, no
  external STT keys). It is a preview only — never saved as the transcript.
- **Automatic AI transcription** with timestamped segments, produced by the backend.
- **Real-time updates** over **SignalR**, with a status-polling fallback.
- **Retry** a failed meeting from the transcript page.
- **Transcript export** in TXT, SRT, VTT, and DOCX.
- **Audio playback** of past recordings via a short-lived signed URL.
- **Recording library** with folders and renaming (**device-local** — see below).
- **Firebase authentication** via Google Sign-In.
- **Dark / light theme.**

---

## Tech Stack

| Layer         | Technology                                                        |
| ------------- | ----------------------------------------------------------------- |
| Web frontend  | React 19, TypeScript, Vite 8, Material UI, Tailwind CSS 4          |
| Backend       | MeetingRecorder .NET API (separate repository)                     |
| Auth          | Firebase Authentication (Google Sign-In)                           |
| Realtime      | SignalR meeting hub (`@microsoft/signalr`)                         |
| Mobile        | Flutter, Firebase SDKs, LiveKit client                             |

---

## Repository Layout

```
├── src/                  # React web app
│   ├── components/       # AppLayout, VoiceRecorder
│   ├── context/          # Auth + theme providers
│   ├── pages/            # Login, Dashboard, Meeting, Recordings, Settings
│   ├── services/         # api.ts, firebase.ts, recorder.ts, signalr.ts, library.ts
│   └── types.ts          # Shapes mirroring the API's DTOs
├── firebase/             # Firebase project config + Cloud Functions
├── token-server/         # Standalone LiveKit JWT token server
├── voice-server/         # Lightweight voice/health server
├── mobile/               # Flutter companion app
└── .env.example          # Required environment variables
```

---

## Getting Started

```bash
npm install
cp .env.example .env      # fill in your Firebase credentials
npm run dev               # http://localhost:5173
```

`VITE_API_BASE_URL` defaults to the deployed API above, so the app works without setting it.
Point it at `http://localhost:5000` to run against a local `MeetingRecorder.Api`.

### Environment Variables

| Variable                            | Description                                                  |
| ----------------------------------- | ------------------------------------------------------------ |
| `VITE_FIREBASE_API_KEY`             | Firebase web API key                                         |
| `VITE_FIREBASE_AUTH_DOMAIN`         | Firebase auth domain                                         |
| `VITE_FIREBASE_PROJECT_ID`          | Firebase project ID                                          |
| `VITE_FIREBASE_STORAGE_BUCKET`      | Firebase storage bucket                                      |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | Firebase messaging sender ID                                 |
| `VITE_FIREBASE_APP_ID`              | Firebase web app ID                                          |
| `VITE_API_BASE_URL`                 | Meeting Recorder API base (optional; defaults to the deployed service) |
| `VITE_LIVEKIT_*`                    | LiveKit credentials for the real-time room features          |
| `VITE_USE_EMULATORS`                | Force Firebase emulators outside dev builds (`true`/`false`) |

---

## Recording & Transcription Pipeline

**Record → upload → process → return.** The backend is the single source of truth for the
transcript; nothing the client hears locally is ever persisted as one.

1. **Record.** Audio is captured in the browser; a live caption preview streams below the
   button (Web Speech API, optional, on-device only).
2. **Upload.** On stop the app calls `POST /meetings`, then `POST /meetings/{id}/recordings`
   with the audio as the request body. The API writes it to storage itself.
3. **Process.** That same call starts the backend pipeline, which moves the meeting through
   `Recording → Uploaded → Processing → Ready` (or `Failed` with a `failureReason`).
4. **Return.** Segments arrive over SignalR (`transcriptSegmentReady` / `meetingStatusChanged`)
   with a 2.5s status poll as fallback. The meeting page shows the current stage until the
   transcript lands, and offers **Retry** if it failed.

---

## API Notes

Quirks of the API that `src/services/api.ts` normalizes so the rest of the app never sees them:

- **Enums are integers over REST, names over SignalR.** The API registers no
  `JsonStringEnumConverter`, so `GET /meetings/{id}/status` returns `"status": 3`, while the
  hub sends `"status": "Ready"`. `toMeetingStatus` / `toFailureReason` accept either.
- **`MeetingStatusDto` names its key `id`, not `meetingId`.** The client renames it.
- **`format` is case-sensitive.** `?format=Txt` works; `?format=txt` is a `400`.
- **`participantHints` is required** on `POST /meetings` — the client always sends `[]`.
- **The hub's `transcriptSegmentReady` sends the domain entity**, which has no `speakerLabel`,
  unlike the REST DTO. `normalizeSegment` reconciles the two.

### Endpoints used

| Method | Endpoint                                                 |
| ------ | -------------------------------------------------------- |
| POST   | `/meetings`                                              |
| GET    | `/meetings/{id}`                                         |
| GET    | `/meetings/{id}/status`                                  |
| POST   | `/meetings/{id}/retry?recordingId=`                      |
| POST   | `/meetings/{id}/recordings?durationMs=&fileExtension=` (audio as body) |
| GET    | `/meetings/{id}/recordings/{recordingId}/audio-url`      |
| GET    | `/meetings/{id}/transcript`                              |
| GET    | `/meetings/{id}/transcript/search?q=`                    |
| GET    | `/meetings/{id}/export?format=Txt\|Srt\|Vtt\|Docx`       |
| PATCH  | `/meetings/{id}/speakers/{speakerId}`                    |

Hub: `/hubs/meeting` — events `meetingStatusChanged`, `transcriptSegmentReady`; methods
`JoinMeetingGroup(meetingId)`, `LeaveMeetingGroup(meetingId)`.

### The device-local library

The API is addressed strictly by id: there is **no** `GET /meetings` list, no recordings list,
and no folder or delete endpoints. So `src/services/library.ts` keeps a localStorage index of
the meetings recorded from this browser, and the dashboard and Recordings page are built on it,
hydrating live status and transcript text from the API per id.

What that means in practice:

- The library **does not follow you** to another browser, device, or profile.
- **Renaming and folders are local only** — they never reach the server.
- **"Remove from library"** only drops the local entry; the meeting and its audio stay on the
  server, because the API has no delete endpoint.
- Reporting a transcription problem was dropped — there is no endpoint to receive it.

All of this goes away once the API grows list/delete endpoints.

---

## npm Scripts

| Script              | Description                              |
| ------------------- | ---------------------------------------- |
| `npm run dev`       | Start the Vite dev server                |
| `npm run build`     | Production build of the web app (`dist/`)|
| `npm run preview`   | Preview the production build             |
| `npm run emulators` | Start Firebase emulators (functions only)|
| `npm run lint`      | Run ESLint over the project              |

---

## Deployment

```bash
npm run build
firebase deploy --only hosting
```

The app is a static SPA — there is no server to deploy alongside it. The API allows any
origin, so a new deployment host needs no CORS setup.

---

## Project Status

Active development. Record → upload works against the deployed service. Remaining backend-side
gaps before a transcript comes back:

1. `MeetingRecorder.Workers` is not deployed, so nothing consumes `RecordingUploaded` and a
   meeting never leaves `Processing`.
2. `MergeTranscriptAndDiarization` returns early unless both `TranscriptionReady` and
   `DiarizationReady` are set, so a meeting cannot reach `Ready` while diarization is off.
3. The deployment has **no authentication middleware**: requests with no token are served as
   `ownerId: "dev-user"`, so anyone can read or write any meeting. The client already sends a
   Firebase bearer token; the API needs to verify it. This matters more now that the API
   accepts any origin.
4. Audio is stored in `musterus-api.appspot.com`, which grants `allUsers` read. Recordings are
   downloadable by object path without a credential.

Uploads are capped at 32 MiB by Cloud Run's HTTP/1 request limit — roughly 3 hours of Opus
audio, but a hard ceiling. Longer recordings would need chunking or the signed-URL path (which
in turn needs a CORS policy on the bucket).
