/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Hot Reloading in Docker aktivieren
  webpack: (config) => {
    config.watchOptions = {
      poll: 1000, // Prüft alle 1 Sekunde auf Änderungen
      aggregateTimeout: 300, // Wartet 300ms bevor neu gebaut wird
    };
    return config;
  },
};

export default nextConfig;
