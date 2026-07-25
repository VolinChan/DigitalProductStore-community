/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  transpilePackages: ['antd', '@ant-design/icons', '@ant-design/nextjs-registry'],
  turbopack: {
    root: __dirname,
  },

  // Image optimization (Requirement 23.5-23.6, 32.5-32.6)
  // Next.js Image component provides automatic lazy loading and responsive sizing
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**',
      },
      {
        protocol: 'http',
        hostname: 'localhost',
      },
    ],
    // Allow the bundled SVG placeholder to be rendered by next/image.
    // The placeholder has no user-generated content, so the "dangerously"
    // CSP headers added below keep it safe.
    dangerouslyAllowSVG: true,
    contentDispositionType: 'attachment',
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
    // Optimize image formats for better performance
    formats: ['image/avif', 'image/webp'],
    // Device sizes for responsive images
    deviceSizes: [640, 750, 828, 1080, 1200, 1920],
    // Image sizes for layout optimization
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
  },

  // Performance optimizations (Requirement 32.5-32.6: FCP < 1.5s)
  // Next.js 14 automatically handles:
  // - Code splitting per route (automatic)
  // - Tree shaking (automatic with webpack)
  // - Image lazy loading (via next/image component)
  // - Font optimization (via next/font)
  // - Static generation where possible (App Router)

  // Compiler optimizations
  compiler: {
    // Remove console.log in production
    removeConsole: process.env.NODE_ENV === 'production' ? { exclude: ['error', 'warn'] } : false,
  },

  // Enable experimental features for better performance
  experimental: {
    // Optimize package imports to reduce bundle size
    optimizePackageImports: ['antd', '@ant-design/icons', 'lodash'],
  },

  // Headers for public assets. Next.js owns the immutable caching policy for
  // /_next/static and warns if applications override it.
  async headers() {
    return [
      {
        source: '/images/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=604800',
          },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
