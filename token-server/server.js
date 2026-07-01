import express from 'express';
import cors from 'cors';
import { AccessToken } from 'livekit-server-sdk';

const app = express();
app.use(cors());
app.use(express.json());

const LIVEKIT_API_KEY = process.env.LIVEKIT_API_KEY || 'your-api-key';
const LIVEKIT_API_SECRET = process.env.LIVEKIT_API_SECRET || 'your-api-secret';
const LIVEKIT_SERVER_URL = process.env.LIVEKIT_SERVER_URL || 'wss://your-livekit-instance.com';

app.post('/token', (req, res) => {
  const { roomName, identity, displayName } = req.body;

  if (!roomName || !identity) {
    return res.status(400).json({ error: 'roomName and identity are required' });
  }

  const at = new AccessToken(LIVEKIT_API_KEY, LIVEKIT_API_SECRET, {
    identity,
    name: displayName || identity,
  });

  at.addGrant({
    roomJoin: true,
    room: roomName,
    canPublish: true,
    canSubscribe: true,
    canPublishData: true,
  });

  const token = at.toJwt();

  res.json({ token, roomName, serverUrl: LIVEKIT_SERVER_URL });
});

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`MeetFlow token server running on http://localhost:${PORT}`);
});
