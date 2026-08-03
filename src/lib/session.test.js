import { describe, it, expect } from 'vitest';
import {
  sign,
  verify,
  readCookie,
  buildCookie,
  clearCookie,
  COOKIE_NAME
} from './session.js';

const SECRET = 'test-signing-secret-value';
const NOW = 1_770_000_000_000;

describe('sign / verify', () => {
  it('round-trips a payload', async () => {
    const token = await sign({ sub: '12345', email: 'a@b.com' }, SECRET, 3600, NOW);
    const payload = await verify(token, SECRET, NOW);
    expect(payload.sub).toBe('12345');
    expect(payload.email).toBe('a@b.com');
  });

  it('rejects a token signed with a different secret', async () => {
    const token = await sign({ sub: '1' }, SECRET, 3600, NOW);
    expect(await verify(token, 'a-different-secret', NOW)).toBeNull();
  });

  it('rejects a tampered payload', async () => {
    const token = await sign({ sub: 'user-a' }, SECRET, 3600, NOW);
    const [, signature] = token.split('.');
    const forged = `${btoa('{"sub":"user-b","exp":9999999999}')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '')}.${signature}`;
    expect(await verify(forged, SECRET, NOW)).toBeNull();
  });

  it('rejects a tampered signature', async () => {
    const token = await sign({ sub: '1' }, SECRET, 3600, NOW);
    const [encoded, signature] = token.split('.');
    // Mutate a middle character. The FINAL base64url character of a 32-byte
    // signature carries only 4 significant bits, so several values there decode
    // to identical bytes — flipping it is not actually tampering.
    const i = Math.floor(signature.length / 2);
    const flipped =
      signature.slice(0, i) + (signature[i] === 'A' ? 'B' : 'A') + signature.slice(i + 1);
    expect(flipped).not.toBe(signature);
    expect(await verify(`${encoded}.${flipped}`, SECRET, NOW)).toBeNull();
  });

  it('rejects a truncated or padded signature', async () => {
    const token = await sign({ sub: '1' }, SECRET, 3600, NOW);
    const [encoded, signature] = token.split('.');
    expect(await verify(`${encoded}.${signature.slice(0, -4)}`, SECRET, NOW)).toBeNull();
    expect(await verify(`${encoded}.${signature}AAAA`, SECRET, NOW)).toBeNull();
  });

  it('rejects a signature lifted from a different token', async () => {
    const mine = await sign({ sub: 'me' }, SECRET, 3600, NOW);
    const theirs = await sign({ sub: 'someone-else' }, SECRET, 3600, NOW);
    const spliced = `${theirs.split('.')[0]}.${mine.split('.')[1]}`;
    expect(await verify(spliced, SECRET, NOW)).toBeNull();
  });

  it('rejects an expired token', async () => {
    const token = await sign({ sub: '1' }, SECRET, 60, NOW);
    expect(await verify(token, SECRET, NOW + 61_000)).toBeNull();
  });

  it('accepts a token that is still just inside its lifetime', async () => {
    const token = await sign({ sub: '1' }, SECRET, 60, NOW);
    expect(await verify(token, SECRET, NOW + 59_000)).not.toBeNull();
  });

  it('rejects malformed input without throwing', async () => {
    for (const bad of [null, undefined, '', 'no-dot', 'a.b.c', 42, {}, 'not.base64!!']) {
      expect(await verify(bad, SECRET, NOW)).toBeNull();
    }
  });

  it('rejects everything when no secret is configured', async () => {
    const token = await sign({ sub: '1' }, SECRET, 3600, NOW);
    expect(await verify(token, '', NOW)).toBeNull();
    expect(await verify(token, undefined, NOW)).toBeNull();
  });

  it('refuses to sign without a secret, rather than signing with an empty one', async () => {
    await expect(sign({ sub: '1' }, '', 3600, NOW)).rejects.toThrow();
  });

  it('handles unicode in the payload', async () => {
    const token = await sign({ name: 'Adam — Wesley Chapel 🏠' }, SECRET, 3600, NOW);
    expect((await verify(token, SECRET, NOW)).name).toBe('Adam — Wesley Chapel 🏠');
  });

  it('produces a different signature for a different payload', async () => {
    const a = await sign({ sub: '1' }, SECRET, 3600, NOW);
    const b = await sign({ sub: '2' }, SECRET, 3600, NOW);
    expect(a.split('.')[1]).not.toBe(b.split('.')[1]);
  });
});

describe('readCookie', () => {
  it('finds the session cookie among others', () => {
    expect(readCookie(`a=1; ${COOKIE_NAME}=abc.def; b=2`, COOKIE_NAME)).toBe('abc.def');
  });

  it('returns null when absent', () => {
    expect(readCookie('a=1; b=2', COOKIE_NAME)).toBeNull();
  });

  it('handles a missing or malformed header', () => {
    expect(readCookie(undefined, COOKIE_NAME)).toBeNull();
    expect(readCookie('', COOKIE_NAME)).toBeNull();
    expect(readCookie('garbage', COOKIE_NAME)).toBeNull();
  });

  it('does not match a cookie whose name merely ends with ours', () => {
    expect(readCookie(`x_${COOKIE_NAME}=nope`, COOKIE_NAME)).toBeNull();
  });

  it('keeps a value containing = intact', () => {
    expect(readCookie(`${COOKIE_NAME}=a=b=c`, COOKIE_NAME)).toBe('a=b=c');
  });
});

describe('buildCookie', () => {
  const cookie = buildCookie('token-value', 3600);

  it('is not readable by JavaScript', () => {
    expect(cookie).toContain('HttpOnly');
  });

  it('only travels over https', () => {
    expect(cookie).toContain('Secure');
  });

  it('is not sent on cross-site requests', () => {
    expect(cookie).toContain('SameSite=Lax');
  });

  it('clears by expiring immediately', () => {
    expect(clearCookie()).toContain('Max-Age=0');
  });
});
