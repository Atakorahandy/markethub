/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  eslint: { ignoreDuringBuilds: true },
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "images.unsplash.com" },
      { protocol: "https", hostname: "images.pexels.com" },
      { protocol: "https", hostname: "res.cloudinary.com" },
    ],
  },
  async headers() {
    // No user content is ever rendered as raw HTML (grep confirms the only
    // dangerouslySetInnerHTML in the app is the static, hardcoded theme-detect
    // script in layout.tsx — everything else goes through JSX's auto-escaping),
    // so a strict CSP earns its keep here without needing per-request nonces.
    // 'unsafe-inline' stays on script-src/style-src as a deliberate tradeoff:
    // Next.js's own hydration/RSC-streaming inline scripts and this app's
    // dynamic inline `style={{ height }}` bars (reports/analytics charts) both
    // require it, and a nonce-based CSP would force every page in the app to
    // render dynamically instead of statically (next/headers() in the root
    // layout opts the whole tree out of static generation) — a real cost for
    // a benefit this codebase's XSS surface doesn't currently need.
    const csp = [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: https:", // vendors paste arbitrary hosted image URLs — no fixed allowlist to enforce
      "font-src 'self' data:",
      "connect-src 'self'",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "frame-ancestors 'none'",
      "upgrade-insecure-requests",
    ].join("; ");

    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-DNS-Prefetch-Control", value: "off" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(self)" },
          // Isolates the browsing context (blocks window.opener-based
          // reverse-tabnabbing and cross-window timing leaks). Safe here: the
          // one place this app leaves the origin mid-flow is the Paystack
          // checkout redirect, done via `window.location.href` (a top-level
          // navigation), never `window.open()`/postMessage, so COOP has
          // nothing legitimate to break.
          { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
          { key: "Content-Security-Policy", value: csp },
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
        ],
      },
    ];
  },
};

export default nextConfig;
