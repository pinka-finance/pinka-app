/** @type {import('next').NextConfig} */
const nextConfig = {
  // Static export → Cloudflare Pages (SPA). All data is read client-side via the
  // public anon key (RLS-gated), so no server runtime is needed. Public campaign
  // pages use ?slug= query params (no dynamic SSR routes) so export stays clean.
  output: "export",
  reactStrictMode: true,
  poweredByHeader: false,
  images: { unoptimized: true },
  experimental: {
    optimizePackageImports: ["lucide-react"],
  },
};

export default nextConfig;
