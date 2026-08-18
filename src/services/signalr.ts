import * as signalR from '@microsoft/signalr';
import { auth } from './firebase';
import { API_BASE_URL, normalizeSegment, toMeetingStatus } from './api';
import type { MeetingStatusPayload, TranscriptSegment } from '../types';

/**
 * What the hub actually sends. `meetingStatusChanged` carries only the id and a
 * stringified status — no failure detail, unlike the REST status endpoint — and
 * `transcriptSegmentsReady` carries domain entities, which have no speakerLabel.
 */
interface RawStatusPayload {
  meetingId: string;
  status: unknown;
}

type RawSegment = Parameters<typeof normalizeSegment>[0];

export interface MeetingHubHandlers {
  onStatus?: (payload: MeetingStatusPayload) => void;
  onSegments?: (segments: TranscriptSegment[]) => void;
  /**
   * Fires whenever the connection goes live or drops, including across automatic
   * reconnects. Callers use it to decide whether the REST polling fallback is
   * needed — while the hub is live, polling is pure duplicate traffic.
   */
  onConnectionChange?: (connected: boolean) => void;
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
    connection.on('transcriptSegmentsReady', (segments: RawSegment[]) => {
      handlers.onSegments?.((segments ?? []).map(normalizeSegment));
    });
    // Older API builds pushed one message per segment. Harmless to keep listening.
    connection.on('transcriptSegmentReady', (segment: RawSegment) => {
      handlers.onSegments?.([normalizeSegment(segment)]);
    });

    connection.onreconnecting(() => handlers.onConnectionChange?.(false));
    connection.onreconnected(async () => {
      // Group membership does not survive a reconnect — the server sees a new
      // connection id — so rejoin before reporting the hub as live again.
      try {
        await connection.invoke('JoinMeetingGroup', meetingId);
        handlers.onConnectionChange?.(true);
      } catch {
        handlers.onConnectionChange?.(false);
      }
    });
    connection.onclose(() => handlers.onConnectionChange?.(false));

    this.connection = connection;
    await connection.start();
    await connection.invoke('JoinMeetingGroup', meetingId);
    handlers.onConnectionChange?.(true);
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
