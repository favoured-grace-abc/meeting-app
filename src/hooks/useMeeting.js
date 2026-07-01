import { useState, useEffect, useCallback } from 'react';
import {
  doc,
  onSnapshot,
  collection,
  query,
  orderBy,
  addDoc,
  serverTimestamp,
} from '../services/firebase';
import { db } from '../services/firebase';
import { LiveKitService } from '../services/livekit';

export function useMeeting(meetingId) {
  const [meeting, setMeeting] = useState(null);
  const [participants, setParticipants] = useState([]);
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!meetingId) return;

    const unsubscribeMeeting = onSnapshot(
      doc(db, 'meetings', meetingId),
      (snapshot) => {
        if (snapshot.exists()) {
          setMeeting({ id: snapshot.id, ...snapshot.data() });
        } else {
          setError('Meeting not found');
        }
        setLoading(false);
      },
      (err) => {
        setError(err.message);
        setLoading(false);
      },
    );

    const unsubscribeParticipants = onSnapshot(
      collection(db, 'meetings', meetingId, 'participants'),
      (snapshot) => {
        const list = [];
        snapshot.forEach((doc) => {
          list.push({ id: doc.id, ...doc.data() });
        });
        setParticipants(list);
      },
    );

    const messagesQuery = query(
      collection(db, 'meetings', meetingId, 'messages'),
      orderBy('timestamp'),
    );

    const unsubscribeMessages = onSnapshot(messagesQuery, (snapshot) => {
      const list = [];
      snapshot.forEach((doc) => {
        list.push({ id: doc.id, ...doc.data() });
      });
      setMessages(list);
    });

    return () => {
      unsubscribeMeeting();
      unsubscribeParticipants();
      unsubscribeMessages();
    };
  }, [meetingId]);

  const sendMessage = useCallback(
    async (content, senderId, senderName) => {
      if (!meetingId || !content.trim()) return;

      await addDoc(collection(db, 'meetings', meetingId, 'messages'), {
        senderId,
        senderName,
        content: content.trim(),
        timestamp: serverTimestamp(),
        type: 'text',
      });
    },
    [meetingId],
  );

  return {
    meeting,
    participants,
    messages,
    loading,
    error,
    sendMessage,
  };
}

export function useLiveKit() {
  const [service] = useState(() => new LiveKitService());
  const [room, setRoom] = useState(null);
  const [participantList, setParticipantList] = useState([]);
  const [isConnected, setIsConnected] = useState(false);

  const updateParticipants = useCallback((currentRoom) => {
    if (!currentRoom) return;
    const list = [
      currentRoom.localParticipant,
      ...currentRoom.remoteParticipants.values(),
    ].filter(Boolean);
    setParticipantList(list);
  }, []);

  const connect = useCallback(
    async (token, serverUrl) => {
      const connectedRoom = await service.connectToRoom(token, serverUrl);
      setRoom(connectedRoom);
      setIsConnected(true);

      connectedRoom.on('participantConnected', () => {
        updateParticipants(connectedRoom);
      });
      connectedRoom.on('participantDisconnected', () => {
        updateParticipants(connectedRoom);
      });
      connectedRoom.on('trackPublished', () => {
        updateParticipants(connectedRoom);
      });
      connectedRoom.on('trackUnpublished', () => {
        updateParticipants(connectedRoom);
      });
      connectedRoom.on('trackSubscribed', () => {
        updateParticipants(connectedRoom);
      });

      updateParticipants(connectedRoom);
    },
    [service, updateParticipants],
  );

  const disconnect = useCallback(() => {
    service.cleanup();
    setRoom(null);
    setIsConnected(false);
    setParticipantList([]);
  }, [service]);

  return {
    service,
    room,
    participants: participantList,
    isConnected,
    connect,
    disconnect,
  };
}
