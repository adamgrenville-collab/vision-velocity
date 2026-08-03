/**
 * Signed, stateless tokens — used for both the login session cookie and the
 * OAuth CSRF state.
 *
 * Same shape as the referral app: an HMAC-signed payload, so there is no
 * server-side session table to run or expire. A token is `payload.signature`,
 * both base64url. Nothing secret goes inside — the payload is readable by
 * anyone holding it, the signature only proves we issued it and that it has
 * not been edited.
 *
 * Uses Web Crypto, which exists in both the browser and Netlify's function
 * runtime, so this file is testable without mocking anything.
 */

const encoder = new TextEncoder();
const decoder = new TextDecoder();

const toBase64Url = (bytes) => {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};

const fromBase64Url = (text) => {
  const padded = text.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(text.length / 4) * 4, '=');
  const binary = atob(padded);
  return Uint8Array.from(binary, (c) => c.charCodeAt(0));
};

async function hmacKey(secret) {
  return crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify']
  );
}

/** Constant-time compare, so a signature cannot be guessed byte by byte. */
function equal(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a[i] ^ b[i];
  return diff === 0;
}

/**
 * @param {object} payload  Anything JSON-serialisable. Not secret.
 * @param {string} secret   Server-side signing secret.
 * @param {number} ttlSeconds
 * @param {number} now      Injectable for tests.
 */
export async function sign(payload, secret, ttlSeconds, now = Date.now()) {
  if (!secret) throw new Error('missing signing secret');
  const body = { ...payload, exp: Math.floor(now / 1000) + ttlSeconds };
  const encoded = toBase64Url(encoder.encode(JSON.stringify(body)));
  const signature = await crypto.subtle.sign('HMAC', await hmacKey(secret), encoder.encode(encoded));
  return `${encoded}.${toBase64Url(new Uint8Array(signature))}`;
}

/**
 * Returns the payload, or null for anything wrong: bad shape, bad signature,
 * wrong secret, or expired. Never throws, never explains which — a caller that
 * distinguishes those leaks information to an attacker.
 */
export async function verify(token, secret, now = Date.now()) {
  if (typeof token !== 'string' || !secret) return null;
  const parts = token.split('.');
  if (parts.length !== 2) return null;

  const [encoded, signature] = parts;
  try {
    const expected = await crypto.subtle.sign('HMAC', await hmacKey(secret), encoder.encode(encoded));
    if (!equal(new Uint8Array(expected), fromBase64Url(signature))) return null;

    const payload = JSON.parse(decoder.decode(fromBase64Url(encoded)));
    if (typeof payload?.exp !== 'number' || payload.exp * 1000 <= now) return null;
    return payload;
  } catch {
    return null;
  }
}

export const COOKIE_NAME = 'vv_session';
export const SESSION_TTL_SECONDS = 60 * 60 * 24 * 60; // 60 days
export const STATE_TTL_SECONDS = 60 * 10;

/** Read one cookie out of a Cookie header. */
export function readCookie(header, name) {
  if (typeof header !== 'string') return null;
  for (const part of header.split(';')) {
    const [key, ...rest] = part.trim().split('=');
    if (key === name) return rest.join('=') || null;
  }
  return null;
}

export function buildCookie(value, maxAgeSeconds) {
  const attrs = [
    `${COOKIE_NAME}=${value}`,
    'Path=/',
    'HttpOnly',
    'Secure',
    'SameSite=Lax',
    `Max-Age=${maxAgeSeconds}`
  ];
  return attrs.join('; ');
}

export const clearCookie = () => buildCookie('', 0);
