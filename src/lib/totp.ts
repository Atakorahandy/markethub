import { createHmac, randomBytes, timingSafeEqual } from "crypto";

/**
 * TOTP (RFC 6238) over HOTP (RFC 4226), implemented directly on Node's
 * built-in `crypto` rather than pulling in a dependency — the algorithm is
 * short enough that hand-rolling it is less risk than a new supply-chain
 * dependency for something this security-sensitive. Compatible with every
 * standard authenticator app (Google Authenticator, Authy, 1Password, etc.)
 * since they all implement the same RFC.
 */

const BASE32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

export function generateTotpSecret(): string {
  // 20 bytes = 160 bits, the size HOTP/TOTP's reference implementation uses
  // for HMAC-SHA1 — encoded as base32 so it can be typed into an
  // authenticator app or embedded in an otpauth:// URI.
  return base32Encode(randomBytes(20));
}

function base32Encode(buf: Buffer): string {
  let bits = 0;
  let value = 0;
  let out = "";
  for (const byte of buf) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += BASE32_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += BASE32_ALPHABET[(value << (5 - bits)) & 31];
  return out;
}

function base32Decode(input: string): Buffer {
  const clean = input.toUpperCase().replace(/[^A-Z2-7]/g, "");
  let bits = 0;
  let value = 0;
  const bytes: number[] = [];
  for (const char of clean) {
    const idx = BASE32_ALPHABET.indexOf(char);
    if (idx === -1) continue;
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return Buffer.from(bytes);
}

function hotp(secret: Buffer, counter: number, digits = 6): string {
  const msg = Buffer.alloc(8);
  // Counter fits comfortably in the low 32 bits for any realistic clock;
  // write it as a 64-bit big-endian value per RFC 4226 regardless.
  msg.writeUInt32BE(Math.floor(counter / 2 ** 32), 0);
  msg.writeUInt32BE(counter >>> 0, 4);

  const hmac = createHmac("sha1", secret).update(msg).digest();
  const offset = hmac[hmac.length - 1]! & 0xf;
  const binCode =
    ((hmac[offset]! & 0x7f) << 24) |
    ((hmac[offset + 1]! & 0xff) << 16) |
    ((hmac[offset + 2]! & 0xff) << 8) |
    (hmac[offset + 3]! & 0xff);
  return String(binCode % 10 ** digits).padStart(digits, "0");
}

/** Generates the current 6-digit code for a base32 secret — used only for
 *  tests/tooling, never on a path that needs to check a user-supplied code
 *  (that's `verifyTotp`, which also tolerates clock drift). */
export function currentTotp(base32Secret: string, step = 30): string {
  return hotp(base32Decode(base32Secret), Math.floor(Date.now() / 1000 / step));
}

/** Verifies a user-supplied code against one step before/after the current
 *  one, to tolerate normal clock drift between the server and the user's
 *  phone. Uses a timing-safe comparison per candidate so verification time
 *  doesn't leak which of the ~3 candidates (if any) matched. */
export function verifyTotp(base32Secret: string, code: string, step = 30, window = 1): boolean {
  const trimmed = code.trim().replace(/\s+/g, "");
  if (!/^\d{6}$/.test(trimmed)) return false;
  const secret = base32Decode(base32Secret);
  const counter = Math.floor(Date.now() / 1000 / step);
  const candidate = Buffer.from(trimmed);
  for (let i = -window; i <= window; i++) {
    const expected = Buffer.from(hotp(secret, counter + i));
    if (expected.length === candidate.length && timingSafeEqual(expected, candidate)) return true;
  }
  return false;
}

export function otpauthUri(base32Secret: string, accountEmail: string, issuer = "MarketHub"): string {
  const label = encodeURIComponent(`${issuer}:${accountEmail}`);
  return `otpauth://totp/${label}?secret=${base32Secret}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=6&period=30`;
}
