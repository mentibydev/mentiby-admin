'use client'

import { Suspense } from 'react'
import AuthWrapper from '@/components/auth/AuthWrapper'
import { Shield, Loader2 } from 'lucide-react'

// Dynamic import for AdminPanel - this ensures it's only loaded after authentication
import dynamic from 'next/dynamic'

// Lazy load AdminPanel - this is the key security feature
const AdminPanel = dynamic(() => import('@/components/AdminPanel'), {
  ssr: false, // Disable server-side rendering for this component
  loading: () => (
    <div className="min-h-screen bg-black flex items-center justify-center">
      <div className="absolute inset-0 bg-gradient-to-br from-purple-900/20 via-blue-900/20 to-teal-900/20" />
      <div className="relative text-center">
        <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-purple-500 to-blue-500 rounded-2xl mb-4 shadow-lg">
          <Shield className="w-8 h-8 text-white" />
        </div>
        <div className="flex items-center justify-center gap-3 mb-4">
          <Loader2 className="w-6 h-6 text-purple-400 animate-spin" />
          <h2 className="text-xl font-semibold text-white">
            Loading Admin Panel...
          </h2>
        </div>
        <p className="text-gray-400">
          Initializing secure workspace
        </p>
      </div>
    </div>
  )
})

export default function Page() {
  return (
    <AuthWrapper>
      <Suspense fallback={
        <div className="min-h-screen bg-black flex items-center justify-center">
          <div className="absolute inset-0 bg-gradient-to-br from-purple-900/20 via-blue-900/20 to-teal-900/20" />
          <div className="relative text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-purple-500 to-blue-500 rounded-2xl mb-4 shadow-lg">
              <Shield className="w-8 h-8 text-white" />
            </div>
            <div className="flex items-center justify-center gap-3 mb-4">
              <Loader2 className="w-6 h-6 text-purple-400 animate-spin" />
              <h2 className="text-xl font-semibold text-white">
                Loading Admin Panel...
              </h2>
            </div>
            <p className="text-gray-400">
              Initializing secure workspace
            </p>
          </div>
        </div>
      }>
        <AdminPanel />
      </Suspense>
    </AuthWrapper>
  )
}