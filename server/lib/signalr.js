import { randomUUID } from 'node:crypto';
import { WebSocketServer } from 'ws';
import { verifyIdToken } from './auth.js';

const RS = String.fromCharCode(0x1e);

function frame(payload) {
  return JSON.stringify(payload) + RS;
}

/**
 * Minimal SignalR (JSON protocol) hub server that supports exactly what the
 * frontend needs: /hubs/meeting/negotiate plus a WebSocket that implements
 * JoinMeetingGroup / LeaveMeetingGroup and server-pushed events.
 */
export class MeetingHub {
  constructor() {
    this.connections = new Map(); // connectionToken -> { userUid, groups:Set, ws }
  }

  attach({ app, server, path }) {
    const hubPath = path || '/hubs/meeting';

    // Negotiate: returns a short-lived connectionToken used by the client for
    // the WebSocket connection (stateful reconnect keeps the same token).
    // eslint-disable-next-line no-unused-vars
    const negotiate = async (req, res) => {
      const token = extractToken(req);
      let payload;
      try {
        payload = await verifyIdToken(token);
      } catch {
        return res.status(401).end();
      }

      const connectionId = randomUUID();
      const connectionToken = randomUUID();
      this.connections.set(connectionToken, {
        userUid: payload.uid || payload.sub,
        groups: new Set(),
        ws: null,
      });

      const negotiateVersion = Number(req.query.negotiateVersion) || 0;
      const body = {
        connectionId,
        availableTransports: [
          { transport: 'WebSockets', transferFormats: ['Text', 'Binary'] },
        ],
      };
      if (negotiateVersion >= 1) {
        body.connectionToken = connectionToken;
        body.negotiateVersion = 1;
      }
      res.json(body);
    };

    app.get(`${hubPath}/negotiate`, negotiate);
    app.post(`${hubPath}/negotiate`, negotiate);

    const wss = new WebSocketServer({ noServer: true });

    server.on('upgrade', (req, socket, head) => {
      const { pathname } = new URL(req.url, `http://${req.headers.host}`);
      if (pathname !== hubPath) {
        socket.destroy();
        return;
      }

      wss.handleUpgrade(req, socket, head, async (ws) => {
        const url = new URL(req.url, `http://${req.headers.host}`);
        const connectionToken = url.searchParams.get('id') || '';
        const connection = this.connections.get(connectionToken);

        try {
          const token = extractToken(req);
          const payload = await verifyIdToken(token);
          if (!connection || connection.userUid !== (payload.uid || payload.sub)) {
            ws.close(4401, 'Unauthorized');
            return;
          }
        } catch {
          ws.close(4401, 'Unauthorized');
          return;
        }

        this.attachSocket(connection, ws);
      });
    });
  }

  attachSocket(connection, ws) {
    connection.ws = ws;
    ws.send(frame({ protocol: 'json', version: 1 }));

    let buffer = '';
    ws.on('message', (data) => {
      buffer += data.toString('utf8');
      let idx;
      while ((idx = buffer.indexOf(RS)) !== -1) {
        const chunk = buffer.slice(0, idx).trim();
        buffer = buffer.slice(idx + RS.length);
        if (chunk) this.handleMessage(connection, ws, chunk);
      }
    });

    ws.on('close', () => {
      if (connection.ws === ws) connection.ws = null;
    });

    ws.on('error', () => {
      /* ignore */
    });
  }

  handleMessage(connection, ws, text) {
    let msg;
    try {
      msg = JSON.parse(text);
    } catch {
      return;
    }

    const { type } = msg;

    if (type === 6) {
      // Ping
      ws.send(frame({ type: 6 }));
      return;
    }

    if (type === 1 && msg.invocationId) {
      const { target, arguments: args = [] } = msg;
      if (target === 'JoinMeetingGroup') {
        connection.groups.add(String(args[0]));
      } else if (target === 'LeaveMeetingGroup') {
        connection.groups.delete(String(args[0]));
      }
      // Completion (no result) for a simple invocation.
      ws.send(frame({ type: 3, invocationId: msg.invocationId, result: null }));
      return;
    }

    if (type === 1) {
      // Invocation without an id (fire-and-forget from a client) — ignore.
      return;
    }

    // type 7 = close from client
    if (type === 7) {
      ws.close();
    }
  }

  broadcast(meetingId, method, args = []) {
    const argumentsList = Array.isArray(args) ? args : [args];
    const payload = frame({ type: 1, target: method, arguments: argumentsList });
    for (const connection of this.connections.values()) {
      if (!connection.groups.has(String(meetingId))) continue;
      if (connection.ws && connection.ws.readyState === connection.ws.OPEN) {
        connection.ws.send(payload);
      }
    }
  }
}

function extractToken(req) {
  const header = req.headers.authorization || '';
  if (header.startsWith('Bearer ')) return header.slice('Bearer '.length).trim();
  if (req.query && req.query.access_token) return req.query.access_token.trim();
  const parsed = new URL(req.url || '', 'http://localhost');
  return parsed.searchParams.get('access_token') || '';
}