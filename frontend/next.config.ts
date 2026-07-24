import type { NextConfig } from 'next';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const monorepoRoot = path.resolve(path.dirname(__filename), '..');

const nextConfig: NextConfig = {
  output: 'standalone',
  turbopack: {
    root: monorepoRoot,
  },
};

export default nextConfig;
