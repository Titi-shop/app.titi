/** @type {import('next').NextConfig} */

const nextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },

  typescript: {
    ignoreBuildErrors: true,
  },

  images: {
    unoptimized: true,

    remotePatterns: [
      {
        protocol: "https",
        hostname: "*.public.blob.vercel-storage.com",
      },

      {
        protocol: "https",
        hostname: "*.googleusercontent.com",
      },

      {
        protocol: "https",
        hostname: "images.unsplash.com",
      },
    ],
  },

  async headers() {
    return [
      {
        source: "/(.*)",

        headers: [
          {
            key: "Content-Security-Policy",

            value: [
              "default-src 'self' data: blob: https:;",

              "script-src 'self' 'unsafe-inline' 'unsafe-eval' https: blob:;",

              "connect-src 'self' https: wss: blob:;",

              "img-src 'self' https: data: blob:;",

              "style-src 'self' 'unsafe-inline' https:;",

              "frame-src 'self' https:;",

              "font-src 'self' https: data:;",

              "media-src 'self' https: blob:;",
            ].join(" "),
          },

          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },

          {
            key: "Permissions-Policy",
            value:
              "camera=(), microphone=(), geolocation=()",
          },

          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },

          {
            key: "X-Frame-Options",
            value: "SAMEORIGIN",
          },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
