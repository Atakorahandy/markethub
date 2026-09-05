import { randomBytes, createHash } from "crypto";
import { verifyTotp } from "./totp";

/** 8 single-use recovery codes, shown to the user exactly once at
 *  enrollment time — only their sha256 hashes are ever persisted. */
export function generateBackupCodes(count = 8): string[] {
  return Array.from({ length: count }, () => {
    const raw = randomBytes(5).toString("hex").toUpperCase();
    return `${raw.slice(0, 5)}-${raw.slice(5)}`;
  });
}

export function hashBackupCode(code: string): string {
  return createHash("sha256").update(code.trim().toUpperCase()).digest("hex");
}

export type MfaCheck = { ok: boolean; usedBackupCode: boolean; remainingBackupCodesJson?: string };

/** Checks a user-supplied code against either the live TOTP secret or one
 *  of the hashed backup codes. A matched backup code is consumed (removed
 *  from the returned list) — the caller is responsible for persisting
 *  `remainingBackupCodesJson` when `usedBackupCode` is true. */
export function verifyMfaCode(input: { secret: string; backupCodesJson: string; code: string }): MfaCheck {
  if (verifyTotp(input.secret, input.code)) return { ok: true, usedBackupCode: false };

  const hashes: string[] = JSON.parse(input.backupCodesJson || "[]");
  const hashed = hashBackupCode(input.code);
  const idx = hashes.indexOf(hashed);
  if (idx === -1) return { ok: false, usedBackupCode: false };

  hashes.splice(idx, 1);
  return { ok: true, usedBackupCode: true, remainingBackupCodesJson: JSON.stringify(hashes) };
}
