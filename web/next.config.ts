import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {
    // Repo root, so the app can import the scraper's ../output/student_programs.json
    root: path.join(__dirname, ".."),
  },
};

export default nextConfig;
