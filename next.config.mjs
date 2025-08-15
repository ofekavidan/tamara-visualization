/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  // לא לעצור build על טיפוסים/לינט
  typescript: { ignoreBuildErrors: true },
  eslint: { ignoreDuringBuilds: true },

  // בלי אופטימיזציית תמונות (אין לנו דומיינים מוגדרים)
  images: { unoptimized: true },

  // אופציונלי: טוב לדפלוימנט קליל
  // output: 'standalone',
};

export default nextConfig;
