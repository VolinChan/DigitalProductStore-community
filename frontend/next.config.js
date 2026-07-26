const createNextIntlPlugin = require('next-intl/plugin');

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  transpilePackages: ['antd', '@ant-design/icons', '@ant-design/nextjs-registry'],
  turbopack: {
    root: __dirname,
  },

  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '**' },
      { protocol: 'http', hostname: 'localhost' },
    ],
    dangerouslyAllowSVG: true,
    contentDispositionType: 'attachment',
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
    formats: ['image/avif', 'image/webp'],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
  },

  compiler: {
    removeConsole: process.env.NODE_ENV === 'production' ? { exclude: ['error', 'warn'] } : false,
  },

  experimental: {
    optimizePackageImports: ['antd', '@ant-design/icons', 'lodash'],
  },

  async headers() {
    return [
      {
        source: '/images/:path*',
        headers: [{ key: 'Cache-Control', value: 'public, max-age=604800' }],
      },
    ];
  },

};

module.exports = createNextIntlPlugin('./src/i18n/request.ts')(nextConfig);
