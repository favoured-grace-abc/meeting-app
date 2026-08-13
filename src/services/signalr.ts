import * as signalR from '@microsoft/signalr';
import { auth } from './firebase';
import { API_BASE_URL } from './api';
import type { MeetingStatusPayload, TranscriptSegment } from '../types';

export interface MeetingHubHandlers {
  onStatus?: (payload: MeetingStatusPayload) => void;
  onSegment?: (segment: TranscriptSegment) => void;
}

export class MeetingHubClient {
  private connection: signalR.HubConnection | null = null;
  private meetingId = '';

  async connect(meetingId: string, handlers: MeetingHubHandlers): Promise<void> {
    await this.disconnect();
    this.meetingId = meetingId;

    const token = await auth.currentUser?.getIdToken();
    if (!token) throw new Error('Not signed in');

    const connection = new signalR.HubConnectionBuilder()
      .withUrl(`${API_BASE_URL}/hubs/meeting`, {
        accessTokenFactory: () => token,
        transport: signalR.HttpTransportType.WebSockets,
      })
      .withAutomaticReconnect()
      .build();

    connection.on('meetingStatusChanged', (payload: MeetingStatusPayload) => {
      handlers.onStatus?.(payload);
    });
    connection.on('transcriptSegmentReady', (segment: TranscriptSegment) => {
      handlers.onSegment?.(segment);
    });

    this.connection = connection;
    await connection.start();
    await connection.invoke('JoinMeetingGroup', meetingId);
  }

  async disconnect(): Promise<void> {
    const connection = this.connection;
    this.connection = null;
    if (!connection) return;
    if (this.meetingId) {
      try {
        await connection.invoke('LeaveMeetingGroup', this.meetingId);
      } catch {
        /* ignore */
      }
    }
    try {
      await connection.stop();
    } catch {
      /* ignore */
    }
    this.meetingId = '';
  }
}
