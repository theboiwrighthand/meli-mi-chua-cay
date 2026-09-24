import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [{ protocol: "https", hostname: "down-bs-vn.img.susercontent.com", pathname: "/**" }],
  },
};

export default nextConfig;
