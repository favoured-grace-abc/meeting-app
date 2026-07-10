import { getFunctions, httpsCallable } from 'firebase/functions';
import { app } from './firebase';
import { Room, RoomEvent } from 'livekit-client';

const functions = getFunctions(app);

const callCreateInstantMeeting = httpsCallable(functions, 'createInstantMeeting');
const callScheduleMeeting = httpsCallable(functions, 'scheduleMeeting');
const callEndMeeting = httpsCallable(functions, 'endMeeting');
const callGetLiveKitToken = httpsCallable(functions, 'getLiveKitToken');

export async function getLiveKitToken(roomName, identity, displayName) {
  const result = await callGetLiveKitToken({ roomName, metadata: JSON.stringify({ displayName }) });
  return result.data;
}

export async function createInstantMeeting(hostId, title) {
  const result = await callCreateInstantMeeting({ title, recordingEnabled: true });
  return result.data;
}

export async function endMeeting(meetingId) {
  await callEndMeeting({ meetingId });
}

export async function scheduleMeeting(data) {
  const result = await callScheduleMeeting({
    title: data.title,
    description: data.description,
    scheduledAt: data.scheduledAt,
  });
  return result.data;
}

export class LiveKitService {
  constructor() {
    this.room = null;
    this.audioTrack = null;
  }

  async connectToRoom(token, serverUrl) {
    this.room = new Room({
      adaptiveStream: true,
      dynacast: true,
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
    await this.room.localParticipant.setMicrophoneEnabled(enabled);
  }

  cleanup() {
    if (this.room) {
      this.room.disconnect();
      this.room = null;
    }
    this.audioTrack = null;
  }
}
