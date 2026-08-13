import { createPublicKey, createVerify } from 'node:crypto';

const KEYS_URL = 'https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com';
const KEYS_TTL = 5 * 60 * 1000;

let keysCache = null;
let keysCachedAt = 0;

function b64urlDecode(input) {
  const padded = input.replace(/-/g, '+').replace(/_/g, '/');
  const bin = Buffer.from(padded, 'base64').toString('binary');
  return Buffer.from(bin, 'binary').toString('utf8');
}

function getProjectId() {
  return process.env.FIREBASE_PROJECT_ID || process.env.VITE_FIREBASE_PROJECT_ID || '';
}

// ── Minimal DER encoder for building an RSA SPKI public key from JWK n/e ──
function derLength(len) {
  if (len < 0x80) {
    return Buffer.from([len]);
  }
  const bytes = [];
  let value = len;
  while (value > 0) {
    bytes.unshift(value & 0xff);
    value >>= 8;
  }
  // 0x80 | byteCount is the "long form" length marker (0x81 = 1 byte, 0x82 = 2 bytes, ...).
  return Buffer.from([0x80 | bytes.length, ...bytes]);
}

function derInteger(buf) {
  let data = buf;
  if (data[0] & 0x80) data = Buffer.concat([Buffer.from([0x00]), data]);
  return Buffer.concat([Buffer.from([0x02]), derLength(data.length), data]);
}

function derSequence(...parts) {
  const body = Buffer.concat(parts);
  return Buffer.concat([Buffer.from([0x30]), derLength(body.length), body]);
}

// AlgorithmIdentifier for rsaEncryption (OID 1.2.840.113549.1.1.1) + NULL params
const RSA_ALG_ID = Buffer.from('300d06092a864886f70d0101010500', 'hex');

function b64urlToBuffer(input) {
  return Buffer.from(input.replace(/-/g, '+').replace(/_/g, '/'), 'base64');
}

function publicKeyFromJwk(key) {
  // Prefer the x5c certificate chain if the JWKS exposes one.
  if (key.x5c && key.x5c.length > 0) {
    const pem = `-----BEGIN CERTIFICATE-----\n${key.x5c[0]}\n-----END CERTIFICATE-----`;
    return createPublicKey(pem);
  }

  if (key.kty === 'RSA' && key.n && key.e) {
    // Build an RSA SubjectPublicKeyInfo from n/e (Google publishes Firebase
    // securetoken keys as raw RSA params, not certificates).
    const rsaPubKey = derSequence(derInteger(b64urlToBuffer(key.n)), derInteger(b64urlToBuffer(key.e)));
    const bitStringBody = Buffer.concat([Buffer.from([0x00]), rsaPubKey]);
    const bitString = Buffer.concat([
      Buffer.from([0x03]),
      derLength(bitStringBody.length),
      bitStringBody,
    ]);
    const spki = derSequence(RSA_ALG_ID, bitString);
    return createPublicKey({ key: spki, format: 'der', type: 'spki' });
  }

  throw new AuthError('Unsupported JWK key type');
}

async function getSigningKeys() {
  if (keysCache && Date.now() - keysCachedAt < KEYS_TTL) {
    return keysCache;
  }
  const res = await fetch(KEYS_URL);
  if (!res.ok) {
    throw new Error(`Failed to load Firebase signing keys (${res.status})`);
  }
  const data = await res.json();
  keysCache = data.keys || [];
  keysCachedAt = Date.now();
  return keysCache;
}

export class AuthError extends Error {
  constructor(message) {
    super(message);
    this.name = 'AuthError';
  }
}

/**
 * Verifies a Firebase ID token (RS256, issued by securetoken.google.com).
 * The signing keys are fetched from Google's public JWKS and cached.
 * Returns the decoded payload on success, throws AuthError otherwise.
 */
export async function verifyIdToken(idToken) {
  if (!idToken) throw new AuthError('No token provided');
  if (typeof idToken !== 'string') throw new AuthError('Invalid token');

  const parts = idToken.split('.');
  if (parts.length !== 3) throw new AuthError('Invalid token');

  const projectId = getProjectId();
  if (!projectId) throw new AuthError('FIREBASE_PROJECT_ID is not configured');

  const header = JSON.parse(b64urlDecode(parts[0]));
  const payload = JSON.parse(b64urlDecode(parts[1]));

  if (payload.aud !== projectId) throw new AuthError('Invalid audience');
  if (payload.iss !== `https://securetoken.google.com/${projectId}`) {
    throw new AuthError('Invalid issuer');
  }
  if (typeof payload.exp !== 'number' || Date.now() >= payload.exp * 1000) {
    throw new AuthError('Token expired');
  }
  if (typeof payload.auth_time !== 'number' && typeof payload.iat !== 'number') {
    throw new AuthError('Invalid token claims');
  }

  const [keys] = await Promise.all([getSigningKeys()]);
  const jwk = keys.find((k) => k.kid === header.kid);
  if (!jwk) throw new AuthError('Unknown signing key');

  const signature = Buffer.from(parts[2].replace(/-/g, '+').replace(/_/g, '/'), 'base64');
  const signingInput = `${parts[0]}.${parts[1]}`;
  const publicKey = publicKeyFromJwk(jwk);
  const verified = createVerify('RSA-SHA256')
    .update(signingInput)
    .verify(publicKey, signature);
  if (!verified) throw new AuthError('Invalid signature');

  return payload;
}

/**
 * Express middleware. Reads the bearer token from the Authorization header or
 * the access_token query string, verifies it and attaches req.user (the
 * Firebase token payload). A missing/invalid token results in a bare 401.
 */
export function authenticate(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ')
    ? header.slice('Bearer '.length).trim()
    : (req.query.access_token || '').trim();

  if (!token) {
    return res.status(401).end();
  }

  verifyIdToken(token)
    .then((payload) => {
      req.user = payload;
      next();
    })
    .catch((err) => {
      console.error(
        "Auth failed:",
        err instanceof Error ? err.message : String(err),
      );
      res.status(401).end();
    });
}