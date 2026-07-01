import { Room, RoomEvent } from 'livekit-client';
import { db, collection, addDoc, doc, updateDoc, serverTimestamp } from './firebase';

const TOKEN_SERVER =
  import.meta.env.VITE_LIVEKIT_TOKEN_SERVER || 'http://localhost:4000';

export async function getLiveKitToken(roomName, identity, displayName) {
  const res = await fetch(`${TOKEN_SERVER}/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ roomName, identity, displayName }),
  });
  if (!res.ok) throw new Error(`Token server error: ${res.statusText}`);
  return res.json();
}

export async function createInstantMeeting(hostId, title) {
  const roomName = `meeting-${crypto.randomUUID()}`;
  const meetingRef = await addDoc(collection(db, 'meetings'), {
    title: title || 'Instant Meeting',
    description: '',
    hostId,
    scheduledAt: null,
    startedAt: serverTimestamp(),
    endedAt: null,
    status: 'active',
    roomName,
    recordingEnabled: false,
    maxParticipants: 50,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  await addDoc(collection(db, 'meetings', meetingRef.id, 'participants'), {
    displayName: 'Host',
    joinedAt: serverTimestamp(),
    leftAt: null,
    role: 'host',
    isMuted: false,
    isVideoOn: true,
  });

  return { meetingId: meetingRef.id, roomName };
}

export async function endMeeting(meetingId) {
  await updateDoc(doc(db, 'meetings', meetingId), {
    status: 'ended',
    endedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

export async function scheduleMeeting(data) {
  const roomName = `meeting-${crypto.randomUUID()}`;
  const meetingRef = await addDoc(collection(db, 'meetings'), {
    title: data.title,
    description: data.description || '',
    hostId: data.hostId,
    scheduledAt: data.scheduledAt,
    startedAt: null,
    endedAt: null,
    status: 'scheduled',
    roomName,
    recordingEnabled: false,
    maxParticipants: 50,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  return { meetingId: meetingRef.id, roomName };
}

export class LiveKitService {
  constructor() {
    this.room = null;
    this.audioTrack = null;
    this.videoTrack = null;
  }

  async connectToRoom(token, serverUrl) {
    this.room = new Room({
      adaptiveStream: true,
      dynacast: true,
      videoCaptureDefaults: {
        resolution: { width: 1280, height: 720 },
      },
    });

    await this.room.connect(serverUrl, token);
    this.setupEventListeners();
    return this.room;
  }

  setupEventListeners() {
    if (!this.room) return;

    this.room.on(RoomEvent.TrackSubscribed, (track, publication, participant) => {
      participant.setMedia(track);
    });

    this.room.on(RoomEvent.TrackUnsubscribed, (track) => {
      track.detach();
    });

    this.room.on(RoomEvent.Disconnected, () => {
      this.cleanup();
    });
  }

  async toggleMic(enabled) {
    if (!this.room) return;
    if (enabled) {
      this.audioTrack = await this.room.localParticipant.enableCameraAndMicrophone();
    } else {
      this.room.localParticipant.setMicrophoneEnabled(false);
    }
  }

  async toggleCamera(enabled) {
    if (!this.room) return;
    if (enabled) {
      this.videoTrack = await this.room.localParticipant.setCameraEnabled(true);
    } else {
      this.room.localParticipant.setCameraEnabled(false);
    }
  }

  async toggleScreenShare() {
    if (!this.room) return;
    await this.room.localParticipant.setScreenShareEnabled(
      !this.room.localParticipant.isScreenShareEnabled,
    );
  }

  cleanup() {
    if (this.room) {
      this.room.disconnect();
      this.room = null;
    }
    this.audioTrack = null;
    this.videoTrack = null;
  }
}
