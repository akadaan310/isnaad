/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // The mined corpus lives in /data as plain JSON and is read with fs at
  // request time on the server. Tracing it keeps `next build` output portable.
  outputFileTracingIncludes: {
    '/api/**/*': ['./data/**/*'],
  },
};
export default nextConfig;
