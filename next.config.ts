import type {NextConfig} from 'next';

const nextConfig: NextConfig = {
  /* config options here */
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'placehold.co',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'github.com',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'raw.githubusercontent.com',
        port: '',
        pathname: '/**',
      },
    ],
  },
  webpack: (config, { isServer }) => {
    // Exclude better-sqlite3 from webpack bundling on the client side.
    if (!isServer) {
      config.externals = [...(config.externals || []), 'better-sqlite3'];
    }

    // Provide empty module stubs for optional Genkit Firebase integration & tracing if not installed/needed.
    config.resolve = config.resolve || {};
    config.resolve.alias = {
      ...(config.resolve.alias || {}),
      '@genkit-ai/firebase': false, // mark as optional; prevents module not found
    } as any;

    config.plugins = config.plugins || [];
    // Define no-op for process.env.GENKIT_TRACING to avoid dynamic import attempts
    config.plugins.push(new (require('webpack').DefinePlugin)({ 'process.env.GENKIT_TRACING': JSON.stringify('false') }));

    return config;
  },
};

export default nextConfig;
