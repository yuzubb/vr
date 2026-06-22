/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  webpack: (config) => {
    // MediaPipe / Three.js が参照する一部 Node モジュールをブラウザで無効化
    config.resolve.fallback = { ...config.resolve.fallback, fs: false, path: false };
    return config;
  },
  async headers() {
    // SharedArrayBuffer を使う MediaPipe WASM のために必要
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
          { key: 'Cross-Origin-Embedder-Policy', value: 'require-corp' },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
