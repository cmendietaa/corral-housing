/** @type {import('next').NextConfig} */

// Baseline security headers for every route.
// - frame-ancestors / X-Frame-Options: no other site can frame Corral (clickjacking).
// - Referrer-Policy: invite links carry their token in the path, so only the
//   origin is ever sent to other sites.
const securityHeaders = [
  { key: "Content-Security-Policy", value: "frame-ancestors 'none'; base-uri 'self'; form-action 'self'; object-src 'none'" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" }
];

const nextConfig = {
  async headers() {
    return [
      { source: "/:path*", headers: securityHeaders },
      // Development only: Safari keeps reusing an old copy of the dev stylesheet (same address,
      // new contents), so new styles don't show up. Tell browsers not to store it at all.
      ...(process.env.NODE_ENV === "development"
        ? [{ source: "/_next/static/:path*", headers: [{ key: "Cache-Control", value: "no-store, must-revalidate" }] }]
        : [])
    ];
  }
};

export default nextConfig;
