const nextConfig = {
  output: 'standalone',
  // Identifies this build so an app left open can notice a newer deploy (see /api/version).
  env: { NEXT_PUBLIC_BUILD_ID: process.env.VERCEL_GIT_COMMIT_SHA || 'dev' },
  images: {
    unoptimized: true,
    remotePatterns: [
      { protocol: 'https', hostname: 'avatars.githubusercontent.com', pathname: '/**' },
      { protocol: 'https', hostname: 'lh3.googleusercontent.com', pathname: '/**' },
    ],
  },
  serverExternalPackages: ['mongodb', '@sentry/node'],
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
    // Credenciais + "*" não são aceitos pelos navegadores, então "*" ou vazio
    // significa "sem CORS" (só a própria origem). Para liberar outro site,
    // informe UMA origem exata em CORS_ORIGINS.
    const corsEnv = (process.env.CORS_ORIGINS || '').trim();
    const corsOrigin = corsEnv && corsEnv !== '*' && !corsEnv.includes(',') ? corsEnv : null;
    // Frame ancestors: only the app itself may embed its pages (clickjacking).
    // Set FRAME_ANCESTORS only if a trusted site must embed it.
    const frameAncestors = process.env.FRAME_ANCESTORS || "'self'";
    return [
      {
        // API routes: CORS + no framing
        source: '/api/:path*',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          ...(corsOrigin ? [
            { key: 'Access-Control-Allow-Origin', value: corsOrigin },
            { key: 'Access-Control-Allow-Credentials', value: 'true' },
            { key: 'Access-Control-Allow-Methods', value: 'GET, POST, PATCH, PUT, DELETE, OPTIONS' },
            { key: 'Access-Control-Allow-Headers', value: 'Content-Type, Authorization, X-Session-ID' },
            { key: 'Vary', value: 'Origin' },
          ] : []),
        ],
      },
      {
        // App pages: CSP + hardening
        source: '/((?!api/).*)',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(self), microphone=(), geolocation=()' },
          { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains' },
          { key: 'Content-Security-Policy', value: `frame-ancestors ${frameAncestors};` },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
