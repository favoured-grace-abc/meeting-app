import { AccessToken, RoomServiceClient } from 'livekit-server-sdk';
import { v4 as uuidv4 } from 'uuid';
import { config } from './config.js';

const roomService = new RoomServiceClient(
  config.livekit.serverUrl,
  config.livekit.apiKey,
  config.livekit.apiSecret,
);

export interface CreateTokenParams {
  identity: string;
  displayName: string;
  roomName: string;
  metadata?: string;
}

export function generateJoinToken(params: CreateTokenParams): string {
  const at = new AccessToken(config.livekit.apiKey, config.livekit.apiSecret, {
    identity: params.identity,
    name: params.displayName,
    metadata: params.metadata,
  });

  at.addGrant({
    roomJoin: true,
    room: params.roomName,
    canPublish: true,
    canSubscribe: true,
    canPublishData: true,
  });

  return at.toJwt();
}

export function generateAdminToken(roomName: string): string {
  const at = new AccessToken(config.livekit.apiKey, config.livekit.apiSecret, {
    identity: `admin-${uuidv4()}`,
    name: 'Admin',
  });

  at.addGrant({
    roomJoin: true,
    room: roomName,
    canPublish: true,
    canSubscribe: true,
    canPublishData: true,
    canUpdateOwnMetadata: true,
  });

  return at.toJwt();
}

export async function createRoom(roomName: string): Promise<void> {
  try {
    await roomService.createRoom({
      name: roomName,
      emptyTimeout: 60 * 10,
      maxParticipants: 50,
    });
  } catch (error: unknown) {
    if (error instanceof Error && !error.message.includes('already exists')) {
      throw error;
    }
  }
}

export async function endRoom(roomName: string): Promise<void> {
  await roomService.deleteRoom(roomName);
}
