"use client";

import { useEffect, useId, useRef } from "react";

declare global {
  interface Window {
    turnstile?: {
      render: (container: string | HTMLElement, options: Record<string, unknown>) => string;
      remove: (widgetId: string) => void;
      reset: (widgetId: string) => void;
    };
  }
}

const SCRIPT_SRC = "https://challenges.cloudflare.com/turnstile/v0/api.js";
const SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;

/** Renders nothing when CAPTCHA isn't configured (no NEXT_PUBLIC_TURNSTILE_
 *  SITE_KEY) — the same "inert unless opted in" shape as src/lib/captcha.ts
 *  on the server. When it is configured, loads Cloudflare's widget script
 *  once and reports the resulting token via onToken; the server is the only
 *  place that token is ever actually trusted (src/lib/captcha.ts calls
 *  Cloudflare's siteverify endpoint itself). */
export function Captcha({ onToken }: { onToken: (token: string | null) => void }) {
  const containerId = useId().replace(/[^a-zA-Z0-9]/g, "");
  const widgetIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!SITE_KEY) return;

    function renderWidget() {
      if (!window.turnstile) return;
      widgetIdRef.current = window.turnstile.render(`#${containerId}`, {
        sitekey: SITE_KEY,
        callback: (token: string) => onToken(token),
        "expired-callback": () => onToken(null),
        "error-callback": () => onToken(null),
      });
    }

    if (window.turnstile) {
      renderWidget();
    } else {
      const existing = document.querySelector<HTMLScriptElement>(`script[src="${SCRIPT_SRC}"]`);
      const script = existing ?? document.createElement("script");
      if (!existing) {
        script.src = SCRIPT_SRC;
        script.async = true;
        document.head.appendChild(script);
      }
      script.addEventListener("load", renderWidget, { once: true });
    }

    return () => {
      if (widgetIdRef.current && window.turnstile) window.turnstile.remove(widgetIdRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [containerId]);

  if (!SITE_KEY) return null;
  return <div id={containerId} className="my-1" />;
}
