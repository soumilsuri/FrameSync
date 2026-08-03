import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  experimental: {
    // Allows importing files outside of the frontend directory (e.g., shared/)
    externalDir: true,
  }
};

export default nextConfig;
