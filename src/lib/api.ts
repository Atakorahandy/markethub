import { NextResponse } from "next/server";
import { z, ZodError } from "zod";

/** Consistent API envelope. */
export type ApiOk<T> = { ok: true; data: T; meta?: Record<string, unknown> };
export type ApiErr = { ok: false; error: { code: string; message: string; details?: unknown } };

export function ok<T>(data: T, init?: number | ResponseInit, meta?: Record<string, unknown>) {
  const status = typeof init === "number" ? init : (init as ResponseInit)?.status ?? 200;
  return NextResponse.json<ApiOk<T>>({ ok: true, data, ...(meta ? { meta } : {}) }, { status });
}

export class ApiError extends Error {
  code: string;
  status: number;
  details?: unknown;
  constructor(code: string, message: string, status = 400, details?: unknown) {
    super(message);
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

export const Errors = {
  unauthorized: (m = "Please sign in to continue.") => new ApiError("unauthorized", m, 401),
  forbidden: (m = "You do not have permission to do that.") => new ApiError("forbidden", m, 403),
  notFound: (m = "That item could not be found.") => new ApiError("not_found", m, 404),
  conflict: (m = "That action conflicts with the current state.") => new ApiError("conflict", m, 409),
  validation: (details: unknown, m = "Some details are missing or invalid.") =>
    new ApiError("validation_error", m, 422, details),
  rateLimited: (m = "Too many requests. Please slow down.") => new ApiError("rate_limited", m, 429),
  server: (m = "Something went wrong on our side. Please try again.") => new ApiError("server_error", m, 500),
};

export function fail(err: unknown) {
  if (err instanceof ApiError) {
    return NextResponse.json<ApiErr>(
      { ok: false, error: { code: err.code, message: err.message, details: err.details } },
      { status: err.status },
    );
  }
  if (err instanceof ZodError) {
    return NextResponse.json<ApiErr>(
      { ok: false, error: { code: "validation_error", message: "Some details are missing or invalid.", details: err.flatten() } },
      { status: 422 },
    );
  }
  const anyErr = err as { code?: string };
  if (anyErr?.code === "P2002") {
    return NextResponse.json<ApiErr>(
      { ok: false, error: { code: "conflict", message: "That already exists." } },
      { status: 409 },
    );
  }
  if (anyErr?.code === "P2025") {
    return NextResponse.json<ApiErr>(
      { ok: false, error: { code: "not_found", message: "That item could not be found." } },
      { status: 404 },
    );
  }
  console.error("[api] unhandled error:", err);
  return NextResponse.json<ApiErr>(
    { ok: false, error: { code: "server_error", message: "Something went wrong on our side. Please try again." } },
    { status: 500 },
  );
}

/** Wrap a route handler so thrown ApiError/ZodError become clean responses. */
export function handler<T extends (...args: any[]) => Promise<Response>>(fn: T): T {
  return (async (...args: any[]) => {
    try {
      return await fn(...args);
    } catch (err) {
      return fail(err);
    }
  }) as T;
}

export async function parseBody<S extends z.ZodTypeAny>(req: Request, schema: S): Promise<z.infer<S>> {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    throw Errors.validation({ body: "Expected a JSON body." });
  }
  const result = schema.safeParse(raw);
  if (!result.success) throw Errors.validation(result.error.flatten());
  return result.data;
}

export function parseQuery<S extends z.ZodTypeAny>(req: Request, schema: S): z.infer<S> {
  const url = new URL(req.url);
  const obj: Record<string, string> = {};
  url.searchParams.forEach((v, k) => (obj[k] = v));
  const result = schema.safeParse(obj);
  if (!result.success) throw Errors.validation(result.error.flatten());
  return result.data;
}
