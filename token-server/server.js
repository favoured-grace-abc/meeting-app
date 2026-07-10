import express from 'express';
import cors from 'cors';
import { AccessToken } from 'livekit-server-sdk';

const app = express();
app.use(cors());
app.use(express.json());

// Rate limiting (simple in-memory)
const rateLimitMap = new Map();
function rateLimit(limit, windowMs) {
  return (req, res, next) => {
    const ip = req.ip || req.connection.remoteAddress;
    const now = Date.now();
    const entry = rateLimitMap.get(ip) || { count: 0, resetAt: now + windowMs };
    if (now > entry.resetAt) {
      entry.count = 0;
      entry.resetAt = now + windowMs;
    }
    entry.count++;
    rateLimitMap.set(ip, entry);
    if (entry.count > limit) {
      return res.status(429).json({ error: 'Too many requests' });
    }
    next();
  };
}

const requiredEnvVars = ['LIVEKIT_API_KEY', 'LIVEKIT_API_SECRET', 'LIVEKIT_SERVER_URL'];
for (const envVar of requiredEnvVars) {
  if (!process.env[envVar]) {
    console.error(`FATAL: Missing required environment variable: ${envVar}`);
    process.exit(1);
  }
}

const LIVEKIT_API_KEY = process.env.LIVEKIT_API_KEY;
const LIVEKIT_API_SECRET = process.env.LIVEKIT_API_SECRET;
const LIVEKIT_SERVER_URL = process.env.LIVEKIT_SERVER_URL;

app.post('/token', rateLimit(30, 60000), (req, res) => {
  const { roomName, identity, displayName } = req.body;

  if (!roomName || !identity) {
    return res.status(400).json({ error: 'roomName and identity are required' });
  }

  if (!/^[a-zA-Z0-9_-]{1,64}$/.test(roomName)) {
    return res.status(400).json({ error: 'Invalid room name format' });
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
