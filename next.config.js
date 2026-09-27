/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Why: Emits a self-contained server in .next/standalone so the Docker image ships only the
  // traced runtime files instead of the whole node_modules tree (see Dockerfile).
  output: 'standalone',
  images: {
    // Why: Public product, submission and profile images are served by the backend under
    // /files/** (local dev and production hosts). Private refund images are not included and
    // must be rendered with a plain <img>/blob, never next/image.
    remotePatterns: [
      { protocol: 'http', hostname: 'localhost', port: '4000', pathname: '/files/**' },
      { protocol: 'https', hostname: 'api.fastsport.co.za', pathname: '/files/**' },
    ],
  },
};

module.exports = nextConfig;
