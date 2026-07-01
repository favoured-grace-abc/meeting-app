import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { onDocumentCreated, onDocumentUpdated } from 'firebase-functions/v2/firestore';
import { onRequest } from 'firebase-functions/v2/https';
import { initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';
import { v4 as uuidv4 } from 'uuid';
import { generateJoinToken, createRoom } from './livekit.js';
import { transcribeAudio, generateSummary } from './transcription.js';

initializeApp();
const db = getFirestore();
const storage = getStorage();

// ============================================================
// Generate LiveKit join token (callable function)
// ============================================================
export const getLiveKitToken = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'You must be signed in.');
  }

  const { roomName, metadata } = request.data as {
    roomName: string;
    metadata?: string;
  };

  if (!roomName) {
    throw new HttpsError('invalid-argument', 'roomName is required.');
  }

  await createRoom(roomName);

  const token = generateJoinToken({
    identity: request.auth.uid,
    displayName: request.auth.token.name || 'Anonymous',
    roomName,
    metadata,
  });

  return {
    token,
    roomName,
    serverUrl: process.env.LIVEKIT_SERVER_URL || 'wss://your-livekit-instance.com',
  };
});

// ============================================================
// Create instant meeting (callable function)
// ============================================================
export const createInstantMeeting = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'You must be signed in.');
  }

  const { title, description, recordingEnabled } = request.data as {
    title?: string;
    description?: string;
    recordingEnabled?: boolean;
  };

  const roomName = `meeting-${uuidv4()}`;
  await createRoom(roomName);

  const meetingRef = await db.collection('meetings').add({
    title: title || 'Instant Meeting',
    description: description || '',
    hostId: request.auth.uid,
    scheduledAt: null,
    startedAt: new Date(),
    endedAt: null,
    status: 'active',
    roomName,
    recordingEnabled: recordingEnabled ?? false,
    maxParticipants: 50,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  await meetingRef.collection('participants').doc(request.auth.uid).set({
    displayName: request.auth.token.name || 'Anonymous',
    email: request.auth.token.email || '',
    photoURL: request.auth.token.picture || null,
    joinedAt: new Date(),
    leftAt: null,
    role: 'host',
    isMuted: false,
    isVideoOn: true,
  });

  const token = generateJoinToken({
    identity: request.auth.uid,
    displayName: request.auth.token.name || 'Anonymous',
    roomName,
  });

  return {
    meetingId: meetingRef.id,
    roomName,
    token,
    serverUrl: process.env.LIVEKIT_SERVER_URL || 'wss://your-livekit-instance.com',
  };
});

// ============================================================
// Schedule a meeting (callable function)
// ============================================================
export const scheduleMeeting = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'You must be signed in.');
  }

  const { title, description, scheduledAt } = request.data as {
    title: string;
    description?: string;
    scheduledAt: string;
  };

  if (!title || !scheduledAt) {
    throw new HttpsError('invalid-argument', 'title and scheduledAt are required.');
  }

  const roomName = `meeting-${uuidv4()}`;

  const meetingRef = await db.collection('meetings').add({
    title,
    description: description || '',
    hostId: request.auth.uid,
    scheduledAt: new Date(scheduledAt),
    startedAt: null,
    endedAt: null,
    status: 'scheduled',
    roomName,
    recordingEnabled: false,
    maxParticipants: 50,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  return {
    meetingId: meetingRef.id,
    roomName,
  };
});

// ============================================================
// End a meeting (callable function)
// ============================================================
export const endMeeting = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'You must be signed in.');
  }

  const { meetingId } = request.data as { meetingId: string };

  const meetingRef = db.collection('meetings').doc(meetingId);
  const meetingSnap = await meetingRef.get();

  if (!meetingSnap.exists) {
    throw new HttpsError('not-found', 'Meeting not found.');
  }

  const meetingData = meetingSnap.data()!;
  if (meetingData.hostId !== request.auth.uid) {
    throw new HttpsError('permission-denied', 'Only the host can end the meeting.');
  }

  await meetingRef.update({
    status: 'ended',
    endedAt: new Date(),
    updatedAt: new Date(),
  });

  return { success: true };
});

// ============================================================
// AI Transcription pipeline (triggered on recording upload)
// ============================================================
export const processRecording = onDocumentCreated(
  'recordings/{recordingId}',
  async (event) => {
    const snapshot = event.data;
    if (!snapshot) return;

    const data = snapshot.data();
    const { url, meetingId, title } = data;
    const recordingId = event.params.recordingId;

    try {
      await snapshot.ref.update({ status: 'processing' });

      const bucket = storage.bucket();
      const filePath = decodeURIComponent(new URL(url).pathname.split('/o/')[1] || '');
      const [fileBuffer] = await bucket.file(filePath).download();

      const mimeType = 'audio/webm';
      const transcription = await transcribeAudio(fileBuffer, mimeType);
      const summary = await generateSummary(transcription.text);

      const transcriptFileName = `transcripts/${meetingId}/${recordingId}.json`;
      const transcriptFile = bucket.file(transcriptFileName);
      await transcriptFile.save(
        JSON.stringify({
          meetingId,
          recordingId,
          title,
          transcription,
          summary,
          processedAt: new Date().toISOString(),
        }),
        { contentType: 'application/json' },
      );

      const [transcriptUrl] = await transcriptFile.getSignedUrl({
        action: 'read',
        expires: Date.now() + 365 * 24 * 60 * 60 * 1000,
      });

      await snapshot.ref.update({
        status: 'ready',
        aiSummary: summary,
        aiTranscription: transcription.text,
        transcriptUrl,
      });

      const speakers = new Map<string, { id: string; name: string }>();
      const participantsSnap = await db
        .collection('meetings')
        .doc(meetingId)
        .collection('participants')
        .get();

      participantsSnap.forEach((doc) => {
        const p = doc.data();
        speakers.set(doc.id, { id: doc.id, name: p.displayName || 'Unknown' });
      });

      await snapshot.ref.update({
        speakers: Array.from(speakers.values()),
      });
    } catch (error) {
      console.error('Recording processing failed:', error);
      await snapshot.ref.update({ status: 'failed' });
    }
  },
);

// ============================================================
// Webhook receiver for LiveKit events
// ============================================================
export const livekitWebhook = onRequest(async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).send('Method Not Allowed');
    return;
  }

  const event = req.body;

  if (!event || !event.event) {
    res.status(400).send('Invalid webhook payload');
    return;
  }

  const { event: eventType, room } = event;

  try {
    switch (eventType) {
      case 'room_started': {
        const meetingsSnap = await db
          .collection('meetings')
          .where('roomName', '==', room.name)
          .limit(1)
          .get();

        if (!meetingsSnap.empty) {
          const meetingDoc = meetingsSnap.docs[0];
          await meetingDoc.ref.update({
            status: 'active',
            startedAt: new Date(),
            updatedAt: new Date(),
          });
        }
        break;
      }

      case 'room_finished': {
        const meetingsSnap = await db
          .collection('meetings')
          .where('roomName', '==', room.name)
          .limit(1)
          .get();

        if (!meetingsSnap.empty) {
          const meetingDoc = meetingsSnap.docs[0];
          await meetingDoc.ref.update({
            status: 'ended',
            endedAt: new Date(),
            updatedAt: new Date(),
          });
        }
        break;
      }

      case 'participant_joined': {
        const { participant } = event;
        const meetingsSnap = await db
          .collection('meetings')
          .where('roomName', '==', room.name)
          .limit(1)
          .get();

        if (!meetingsSnap.empty) {
          const meetingDoc = meetingsSnap.docs[0];
          await meetingDoc.ref
            .collection('participants')
            .doc(participant.identity)
            .set(
              {
                displayName: participant.name || participant.identity,
                joinedAt: new Date(),
                leftAt: null,
                role: 'participant',
                isMuted: false,
                isVideoOn: true,
              },
              { merge: true },
            );
        }
        break;
      }

      case 'participant_left': {
        const { participant } = event;
        const meetingsSnap = await db
          .collection('meetings')
          .where('roomName', '==', room.name)
          .limit(1)
          .get();

        if (!meetingsSnap.empty) {
          const meetingDoc = meetingsSnap.docs[0];
          await meetingDoc.ref
            .collection('participants')
            .doc(participant.identity)
            .update({ leftAt: new Date() });
        }
        break;
      }

      default:
        console.log(`Unhandled webhook event: ${eventType}`);
    }

    res.status(200).json({ received: true });
  } catch (error) {
    console.error('Webhook handler error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});
