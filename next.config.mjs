/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    // The mined corpus lives in /data as plain files and is read with fs at
    // request time. Tracing it keeps `next build` output portable.
    // (Top-level in Next 15; still under `experimental` on 14.x.)
    outputFileTracingIncludes: {
      '/api/**/*': ['./data/**/*'],
      '/': ['./data/**/*'],
    },
  },
};
export default nextConfig;
