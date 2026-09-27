/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Why: Emits a self-contained server in .next/standalone so the Docker image ships only the
  // traced runtime files instead of the whole node_modules tree (see Dockerfile).
  output: 'standalone',
};

module.exports = nextConfig;
