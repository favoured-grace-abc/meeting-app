import crypto from 'node:crypto';

const DEFAULT_TTL_MS = 15 * 60 * 1000;

function secret() {
  return process.env.SIGNED_URL_SECRET || 'local-dev-signature-secret-change-me';
}

function signature(key, action, expiresAt) {
  return crypto
    .createHmac('sha256', secret())
    .update(`${action}\n${key}\n${expiresAt}`)
    .digest('base64url');
}

function assertValid({ key, action, expiresAt, sig }) {
  const now = Date.now();
  if (!key || !sig) throw new Error('Missing signed URL parameters');
  const exp = Number(expiresAt);
  if (!Number.isFinite(exp) || exp <= now) throw new Error('Signed URL expired');
  const expected = signature(key, action, exp);
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    throw new Error('Invalid signature');
  }
}

export function createUploadUrl({ key, contentType, baseUrl, ttlMs = DEFAULT_TTL_MS }) {
  const expiresAt = Date.now() + ttlMs;
  const sig = signature(key, 'upload', expiresAt);
  const url = new URL(`${baseUrl.replace(/\/$/, '')}/upload/${encodeURIComponent(key)}`);
  url.searchParams.set('exp', String(expiresAt));
  url.searchParams.set('sig', sig);
  if (contentType) url.searchParams.set('contentType', contentType);
  return { url: url.toString(), expiresAt: new Date(expiresAt).toISOString() };
}

export function createDownloadUrl({ key, baseUrl, ttlMs = DEFAULT_TTL_MS }) {
  const expiresAt = Date.now() + ttlMs;
  const sig = signature(key, 'download', expiresAt);
  const url = new URL(`${baseUrl.replace(/\/$/, '')}/download/${encodeURIComponent(key)}`);
  url.searchParams.set('exp', String(expiresAt));
  url.searchParams.set('sig', sig);
  return { url: url.toString(), expiresAt: new Date(expiresAt).toISOString() };
}

export function validateSignedUrl({ key, action, expiresAt, sig }) {
  assertValid({ key, action, expiresAt, sig });
  return true;
}