# MeetFlow — Meeting Recording & AI Transcription

MeetFlow is a full-stack meeting recording platform that captures meeting audio in the browser,
automatically transcribes it with AI, and produces timestamped, speaker-labelled transcripts
you can edit and export.

Built as a monorepo containing a **React web app**, a **Node/Express backend**, **Firebase
Cloud Functions**, **LiveKit** real-time tooling, and a **Flutter mobile app**.

---

## Features

- **One-tap browser recording** — start/stop with a single button (MediaRecorder, no plugins).
- **Live captions** as you record using the browser **Web Speech API** (on-device, no external STT keys).
- **Automatic AI transcription** with timestamped segments and speaker diarization.
- **Real-time transcript streaming** to the meeting page via **SignalR**, with a polling fallback.
- **Speaker labelling** — rename speakers inline in the transcript and the labels persist.
- **Recording library** — organize recordings into **folders**, rename them, and filter by folder.
- **Transcript export** in **TXT, SRT, VTT, and DOCX** formats.
- **Audio playback** of past recordings directly on the transcript page.
- **Transcription feedback** — flag a recording with a complaint so quality issues can be reviewed.
- **Firebase authentication** via Google Sign-In.
- **Dark / light theme** with a settings toggle.
- **Secure uploads** via short-lived signed URLs (no auth header on the upload — the URL is the credential).
- **Rate limiting** and per-user access control on every backend endpoint.
- **Cross-platform Flutter app** (Firebase + LiveKit + local audio recording).

---

## Tech Stack

| Layer          | Technology                                                                 |
| -------------- | -------------------------------------------------------------------------- |
| Web frontend   | React 19, TypeScript, Vite 8, Material UI, Tailwind CSS 4                  |
| Backend        | Node.js, Express 4, SignalR (`@microsoft/signalr`), CORS                   |
| Data           | Local file-based store (`server/data`) or Firebase Firestore + Storage     |
| Auth           | Firebase Authentication (Google Sign-In)                                   |
| Realtime       | SignalR meeting hub (+ LiveKit via Cloud Functions / mobile)               |
| Transcription  | Groq Whisper (`whisper-large-v3-turbo`), OpenAI Whisper fallback, or mock  |
| Mobile         | Flutter, Firebase SDKs, LiveKit client, Riverpod/Provider                  |
| DevOps         | Firebase Hosting, Cloud Functions (Node 20), Firebase Emulators            |

---

## Repository Layout

```
├── src/                  # React web app
│   ├── components/       # AppLayout, VoiceRecorder
│   ├── context/          # Auth + theme providers
│   ├── pages/            # Login, Dashboard, Meeting, Recordings, Settings
│   ├── services/         # api.ts, firebase.ts, recorder.ts, signalr.ts
│   └── types.ts          # Shared TypeScript types
├── server/               # Express backend (REST API + SignalR hub)
│   ├── lib/              # auth, store, transcriber, signalr, signedUrl, transcript
│   └── data/             # local runtime storage (gitignored)
├── firebase/             # Firebase project config
│   └── functions/        # Cloud Functions (LiveKit tokens, transcription, webhooks)
├── token-server/         # Standalone LiveKit JWT token server (Spark-plan alternative)
├── voice-server/         # Lightweight voice/health server
├── mobile/               # Flutter companion app
├── dev.mjs               # Runs Vite + backend together
└── .env.example          # All required environment variables
```

---

## Getting Started

### Prerequisites

- **Node.js 20+** (LTS recommended)
- **npm**
- A **Firebase** project (free tier is fine; only Cloud Functions need the Blaze plan)
- A **LiveKit** instance or cloud account
- A **Groq API key** (free) for real transcription — or an OpenAI key

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment variables

```bash
cp .env.example .env
```

Edit `.env` and fill in your credentials. See [Environment Variables](#environment-variables)
for a full reference.

### 3. Run the development servers

MeetFlow is split across two processes in development:

```bash
# Option A — run both together:
node dev.mjs

# Option B — run them separately:
npm run dev           # Vite web app on http://localhost:5173
npm run dev:server    # Backend API on http://localhost:3001
```

Then open **http://localhost:5173** and sign in with Google.

> The Vite dev server proxies `/api` to `http://localhost:3001`, and the web SDK
> uses the functions emulator automatically in dev builds.

---

## Environment Variables

| Variable                          | Description                                                    | Used By        |
| --------------------------------- | -------------------------------------------------------------- | -------------- |
| `VITE_FIREBASE_API_KEY`           | Firebase web API key                                           | Web app        |
| `VITE_FIREBASE_AUTH_DOMAIN`       | Firebase auth domain (e.g. `your-project.firebaseapp.com`)     | Web app        |
| `VITE_FIREBASE_PROJECT_ID`        | Firebase project ID                                            | Web + server   |
| `VITE_FIREBASE_STORAGE_BUCKET`    | Firebase storage bucket                                        | Web app        |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | Firebase messaging sender ID                                 | Web app        |
| `VITE_FIREBASE_APP_ID`            | Firebase web app ID                                            | Web app        |
| `VITE_LIVEKIT_API_KEY`            | LiveKit API key                                                | Web app        |
| `VITE_LIVEKIT_API_SECRET`         | LiveKit API secret                                             | Web app        |
| `VITE_LIVEKIT_SERVER_URL`         | LiveKit WebSocket URL (`wss://…`)                              | Web app        |
| `VITE_LIVEKIT_TOKEN_SERVER`       | Token server base URL (default `http://localhost:4000`)        | Web app        |
| `VITE_API_BASE_URL`               | Backend REST API base (default `http://localhost:3001`)        | Web app        |
| `VITE_USE_EMULATORS`              | Force Firebase emulators outside dev builds (`true`/`false`)   | Web app        |
| `PORT`                            | Backend server port (default `3001`)                           | Backend        |
| `SERVER_BASE_URL`                 | Public base URL used to build signed URLs                      | Backend        |
| `SIGNED_URL_SECRET`               | Secret used to sign upload/download URLs (change in prod!)     | Backend        |
| `GROQ_API_KEY`                    | Groq Whisper key — preferred transcription source (free)       | Backend        |
| `OPENAI_API_KEY`                  | Legacy OpenAI Whisper fallback (used only if Groq is unset)    | Backend        |
| `FALLBACK_TO_MOCK`                | `"true"` to fall back to mock transcripts if transcription fails | Backend      |

Live captions in the recorder use the browser **Web Speech API**, so no external
STT/TTS/LLM keys are required for that path.

---

## Recording & Transcription Pipeline

1. Tap record in the dashboard — audio is captured in the browser and **live captions**
   stream below the button (Web Speech API, optional).
2. On stop, the app creates a meeting, uploads the blob with a **signed URL**, and marks
   the recording complete.
3. The backend stores the blob and moves the meeting through
   `Recording → Uploaded → Processing → Ready` (or `Failed`).
4. Transcription uses **Groq Whisper** (`whisper-large-v3-turbo`) by default;
   if `GROQ_API_KEY` is unset, it falls back to **OpenAI Whisper**.
5. Segments are diarized into 2 speakers and labelled using your participant hints
   (or "Speaker 1", "Speaker 2").
6. If live captions were enabled, the on-device captions are saved as the transcript
   immediately; the server transcription replaces/augments it in the background.
7. Transcripts stream live to the meeting page over **SignalR** (`transcriptSegmentReady`),
   with a polling fallback.

If neither key is set and `FALLBACK_TO_MOCK=true`, a demo transcript is generated so you can
try the UI without external services.

---

## Firebase Cloud Functions

Cloud Functions handle the LiveKit & AI pieces and **require the Blaze plan** to deploy.

- `getLiveKitToken` — mint a LiveKit join token for an authenticated user.
- `createInstantMeeting` / `scheduleMeeting` / `endMeeting` — meeting lifecycle.
- `processRecording` — Firestore-triggered AI transcription pipeline (Storage → Whisper → transcript).
- `livekitWebhook` — receives LiveKit room/participant events and updates Firestore.

Run them locally:

```bash
npm run emulators    # firebase emulators:start --only functions
```

Deploy:

```bash
cd firebase/functions
npm install
npm run build
npm run deploy       # firebase deploy --only functions
```

> **On the Spark (free) plan?** Skip Cloud Functions — the app falls back to
> direct Firestore operations and the standalone token server below.

### Token server (Spark-plan alternative)

Issues LiveKit JWT tokens without Cloud Functions:

```bash
cd token-server
cp .env.example .env   # fill in LiveKit credentials
npm install
npm run dev            # http://localhost:4000
```

### Voice server

A minimal health-check service:

```bash
cd voice-server
cp .env.example .env
npm install
npm run dev            # http://localhost:4001
```

---

## Flutter Mobile App

A companion app located in `mobile/`:

```bash
cd mobile
flutter pub get
flutter run
```

- Firebase Auth, Firestore, Storage, Cloud Messaging & Functions.
- LiveKit-based real-time rooms.
- Local audio recording with the `record` package.
- Riverpod/Provider state management and `go_router` navigation.
- Dark theme, Google Fonts, and responsive layout.

---

## API Overview

All REST endpoints (except signed upload/download) require a Firebase ID token via
`Authorization: Bearer <token>`.

| Method   | Endpoint                                                       | Description                                   |
| -------- | -------------------------------------------------------------- | --------------------------------------------- |
| GET      | `/api/voice/health`                                            | Health check                                  |
| GET      | `/meetings`                                                    | List the current user's meetings              |
| POST     | `/meetings`                                                    | Create a meeting (title)                      |
| GET      | `/meetings/:meetingId`                                         | Get one meeting                               |
| GET      | `/meetings/:meetingId/status`                                  | Get meeting status                            |
| GET      | `/meetings/:meetingId/recordings`                              | List recordings for a meeting                 |
| POST     | `/meetings/:meetingId/recordings/upload-url`                   | Get a signed upload URL                       |
| POST     | `/meetings/:meetingId/recordings/:recordingId/complete`        | Mark upload done & start processing           |
| GET      | `/meetings/:meetingId/recordings/:recordingId/audio-url`       | Get a signed download URL                     |
| PATCH    | `/meetings/:meetingId/recordings/:recordingId`                 | Rename, move to a folder, or complain         |
| DELETE   | `/meetings/:meetingId/recordings/:recordingId`                 | Delete a recording                            |
| GET      | `/recordings`                                                  | Bulk-list all recordings (with transcript text) |
| GET      | `/folders`                                                     | List folders                                  |
| POST     | `/folders`                                                     | Create a folder                               |
| DELETE   | `/folders/:folderId`                                           | Delete a folder (keeps its recordings)        |
| GET      | `/meetings/:meetingId/transcript`                              | Get the transcript                            |
| PUT      | `/meetings/:meetingId/transcript`                              | Save a transcript (used for live captions)    |
| GET      | `/meetings/:meetingId/transcript/search?q=`                    | Search transcript segments                    |
| GET      | `/meetings/:meetingId/export?format=srt\|vtt\|docx\|txt`       | Download a transcript export                  |
| PATCH    | `/meetings/:meetingId/speakers/:speakerId`                     | Rename a speaker                              |
| PUT      | `/upload/:storageKey?exp&sig`                                  | Direct blob upload (signed URL)               |
| GET      | `/download/:storageKey?exp&sig`                                | Direct blob download (signed URL)             |

### SignalR hub

- Path: `/hubs/meeting`
- Events: `meetingStatusChanged`, `transcriptSegmentReady`
- Methods: `JoinMeetingGroup(meetingId)`, `LeaveMeetingGroup(meetingId)`

---

## npm Scripts

| Script               | Description                                          |
| -------------------- | ---------------------------------------------------- |
| `npm run dev`        | Start the Vite dev server                            |
| `npm run dev:server` | Start the backend with hot reload (`--watch`)        |
| `npm run build`      | Production build of the web app (to `dist/`)         |
| `npm run start`      | Serve the production build + API from the backend    |
| `npm run preview`    | Preview the production build                         |
| `npm run emulators`  | Start Firebase emulators (functions only)            |
| `npm run lint`       | Run ESLint over the project                          |

---

## Deployment

1. **Build the web app:**

   ```bash
   npm run build
   ```

2. **Deploy to Firebase Hosting** (serves `dist/` with an SPA rewrite):

   ```bash
   firebase deploy --only hosting
   ```

3. **Run the backend** in production (`NODE_ENV=production`) on your host of choice —
   it serves both the static build and the REST API:

   ```bash
   npm run start
   ```

4. **Deploy Cloud Functions** (Blaze plan):

   ```bash
   cd firebase/functions && npm run deploy
   ```

> Set `SERVER_BASE_URL` and `VITE_API_BASE_URL` to your deployed backend URL so signed
> upload/download URLs resolve correctly.

---

## Security Notes

- `.env` files are gitignored — never commit real secrets.
- Change `SIGNED_URL_SECRET` to a strong random value before deploying.
- All meeting/recording/transcript/folder endpoints enforce ownership (`ownerUid`).
- Signed upload/download URLs are time-limited and action-bound.
- Requests are rate-limited per IP.
- Firebase rules for Firestore and Storage live under `firebase/`.

---

## Project Status

Active development. The web + backend + transcription flow (recorder, live captions, folders,
transcript editing, and export) are functional; the Flutter app and Cloud Functions are in progress.
