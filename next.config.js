/** @type {import('next').NextConfig} */
const nextConfig = {
  // App directory is enabled by default in Next.js 13+
  
  // Security and optimization configurations
  webpack: (config, { isServer }) => {
    // Optimize code splitting for better security
    if (!isServer) {
      config.optimization.splitChunks = {
        ...config.optimization.splitChunks,
        chunks: 'all',
        cacheGroups: {
          ...config.optimization.splitChunks.cacheGroups,
          // Create a separate chunk for admin components
          adminComponents: {
            test: /[\\/]components[\\/]((?!auth).)*\.tsx?$/,
            name: 'admin-components',
            chunks: 'async',
            priority: 10,
            enforce: true
          },
          // Create a separate chunk for auth components
          authComponents: {
            test: /[\\/]components[\\/]auth[\\/].*\.tsx?$/,
            name: 'auth-components',
            chunks: 'all',
            priority: 20,
            enforce: true
          }
        }
      }
    }
    
    return config
  },
  
  // Production optimizations
  experimental: {
    optimizePackageImports: ['lucide-react']
  }
}
 
module.exports = nextConfig 