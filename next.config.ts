import type { NextConfig } from "next";
const nextConfig: NextConfig = {
  serverExternalPackages: ["@supabase/ssr"],
  images: { remotePatterns: [{ protocol: "https", hostname: "*.supabase.co" }] },
  eslint: { ignoreDuringBuilds: true },
};
export default nextConfig;
