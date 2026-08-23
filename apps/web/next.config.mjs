/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ["@stuido/core"],
  experimental: { typedRoutes: true },
};
export default nextConfig;
