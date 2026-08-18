import * as signalR from '@microsoft/signalr';
import { auth } from './firebase';
import { API_BASE_URL, normalizeSegment, toMeetingStatus } from './api';
import type { MeetingStatusPayload, TranscriptSegment } from '../types';

/**
 * What the hub actually sends. `meetingStatusChanged` carries only the id and a
 * stringified status — no failure detail, unlike the REST status endpoint — and
 * `transcriptSegmentReady` carries the domain entity, which has no speakerLabel.
 */
interface RawStatusPayload {
  meetingId: string;
  status: unknown;
}

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

    connection.on('meetingStatusChanged', (payload: RawStatusPayload) => {
      handlers.onStatus?.({
        meetingId: payload.meetingId,
        status: toMeetingStatus(payload.status),
        failureReason: 'None',
        failureMessage: null,
      });
    });
    connection.on('transcriptSegmentReady', (segment: Parameters<typeof normalizeSegment>[0]) => {
      handlers.onSegment?.(normalizeSegment(segment));
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
