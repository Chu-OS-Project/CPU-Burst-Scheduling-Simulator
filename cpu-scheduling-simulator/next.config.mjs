/** @type {import('next').NextConfig} */

const repo = 'cpu-scheduling-simulator';

const nextConfig = {
  output: 'export',
  basePath: `/${repo}`,
  images: {
    unoptimized: true,
  },
  reactCompiler: true,
};

export default nextConfig;