const nextConfig = {
  output: 'standalone',
  images: {
    unoptimized: true,
    remotePatterns: [
      { protocol: 'https', hostname: 'avatars.githubusercontent.com', pathname: '/**' },
      { protocol: 'https', hostname: 'lh3.googleusercontent.com', pathname: '/**' },
    ],
  },
  serverExternalPackages: ['mongodb'],
  webpack(config, { dev }) {
    if (dev) {
      config.watchOptions = {
        poll: 2000,
        aggregateTimeout: 300,
        ignored: ['**/node_modules'],
      };
    }
    return config;
  },
  onDemandEntries: {
    maxInactiveAge: 10000,
    pagesBufferLength: 2,
  },
  async headers() {
    // Origins allowed for CORS. Restrict in production by setting CORS_ORIGINS.
    // Defaults include the Emergent preview and Capacitor WebView origins.
    const corsOrigins = process.env.CORS_ORIGINS || '*';
    // Frame ancestors: keep permissive during dev to not break the preview iframe;
    // restrict in production via NEXT_PUBLIC_BASE_URL.
    const frameAncestors = process.env.FRAME_ANCESTORS || "'self' https:";
    return [
      {
        // API routes: CORS + no framing
        source: '/api/:path*',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Access-Control-Allow-Origin', value: corsOrigins },
          { key: 'Access-Control-Allow-Credentials', value: 'true' },
          { key: 'Access-Control-Allow-Methods', value: 'GET, POST, PATCH, PUT, DELETE, OPTIONS' },
          { key: 'Access-Control-Allow-Headers', value: 'Content-Type, Authorization, X-Session-ID' },
        ],
      },
      {
        // App pages: CSP + hardening
        source: '/((?!api/).*)',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(self), microphone=()' },
          { key: 'Content-Security-Policy', value: `frame-ancestors ${frameAncestors};` },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
