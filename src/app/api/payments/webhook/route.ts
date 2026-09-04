export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { ingestWebhook } from "@/lib/payments/process";

/**
 * Payment gateway webhook. We read the RAW body (signature is computed over
 * it), verify the signature inside the provider adapter, dedupe on the event
 * id, and re-verify the transaction with the gateway before settling —
 * never trust the webhook payload alone. Always 200 on a well-formed-but-
 * unknown event so the gateway doesn't hammer retries; 400 only on a bad
 * signature.
 */
export async function POST(req: Request) {
  const raw = await req.text();
  try {
    const result = await ingestWebhook(raw, req.headers);
    if (!result.accepted) {
      return NextResponse.json({ ok: false, error: result.reason }, { status: 400 });
    }
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    console.error("[webhook] error:", e);
    // Do not leak internals; 200 so the provider does not retry a poison event forever.
    return NextResponse.json({ ok: false }, { status: 200 });
  }
}
