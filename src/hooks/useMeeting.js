import { useState, useEffect, useCallback, useRef } from 'react';
import {
  doc,
  onSnapshot,
  collection,
} from '../services/firebase';
import { db } from '../services/firebase';
import { LiveKitService } from '../services/livekit';

export function useMeeting(meetingId) {
  const [meeting, setMeeting] = useState(null);
  const [participants, setParticipants] = useState([]);
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

    return () => {
      unsubscribeMeeting();
      unsubscribeParticipants();
    };
  }, [meetingId]);

  return {
    meeting,
    participants,
    loading,
    error,
  };
}

export function useLiveKit() {
  const [service] = useState(() => new LiveKitService());
  const [room, setRoom] = useState(null);
  const [participantList, setParticipantList] = useState([]);
  const [isConnected, setIsConnected] = useState(false);
  const [reconnecting, setReconnecting] = useState(false);
  const reconnectRef = useRef(null);

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
      setReconnecting(false);

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

      connectedRoom.on('disconnected', () => {
        setIsConnected(false);
        setRoom(null);
        setParticipantList([]);
      });

      connectedRoom.on('reconnecting', () => {
        setReconnecting(true);
      });

      connectedRoom.on('reconnected', () => {
        setReconnecting(false);
        setIsConnected(true);
        setRoom(connectedRoom);
      });

      updateParticipants(connectedRoom);
    },
    [service, updateParticipants],
  );

  const disconnect = useCallback(() => {
    if (reconnectRef.current) {
      clearTimeout(reconnectRef.current);
      reconnectRef.current = null;
    }
    service.cleanup();
    setRoom(null);
    setIsConnected(false);
    setReconnecting(false);
    setParticipantList([]);
  }, [service]);

  return {
    service,
    room,
    participants: participantList,
    isConnected,
    reconnecting,
    connect,
    disconnect,
  };
}
