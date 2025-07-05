'use client'

import React, { useEffect, useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import LoginForm from './LoginForm'
import PasswordSetup from './PasswordSetup'
import { Shield, Loader2 } from 'lucide-react'

interface AuthWrapperProps {
  children: React.ReactNode
}

export default function AuthWrapper({ children }: AuthWrapperProps) {
  const { user, session, loading } = useAuth()
  const [needsPasswordSetup, setNeedsPasswordSetup] = useState(false)
  const [authChecked, setAuthChecked] = useState(false)
  const [wasForcedLogout, setWasForcedLogout] = useState(false)
  const [mounted, setMounted] = useState(false)
  const [isAuthenticatedAndReady, setIsAuthenticatedAndReady] = useState(false)

  // Ensure we're on the client side
  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (!loading && mounted) {
      if (user && session) {
        // Check if user needs password setup based on metadata
        const hasDisplayName = !!(user.user_metadata?.display_name || user.user_metadata?.full_name)
        const needsSetup = user.user_metadata?.needs_password_setup === true
        
        // Only calculate time difference on client side to prevent hydration issues
        let isVeryNew = false
        if (user.created_at) {
          isVeryNew = (Date.now() - new Date(user.created_at).getTime()) < 5 * 60 * 1000 // 5 minutes
        }
        
        // Only require setup if explicitly marked as needing it, or if very new and no display name
        const requiresSetup = needsSetup || (!hasDisplayName && isVeryNew)
        setNeedsPasswordSetup(requiresSetup)
        
        // Only mark as authenticated and ready if no password setup is needed
        setIsAuthenticatedAndReady(!requiresSetup)
        setWasForcedLogout(false) // Reset forced logout flag when user is authenticated
      } else {
        setNeedsPasswordSetup(false)
        setIsAuthenticatedAndReady(false)
        // Check if this logout was unexpected (user was previously authenticated)
        if (authChecked && (user || session)) {
          setWasForcedLogout(true)
        }
      }
      setAuthChecked(true)
    }
  }, [user, session, loading, authChecked, mounted])

  // Reset forced logout flag after some time
  useEffect(() => {
    if (wasForcedLogout && mounted) {
      const timer = setTimeout(() => {
        setWasForcedLogout(false)
      }, 10000) // Reset after 10 seconds
      return () => clearTimeout(timer)
    }
  }, [wasForcedLogout, mounted])

  // Show loading spinner while checking auth or if not yet mounted
  if (loading || !authChecked || !mounted) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="absolute inset-0 bg-gradient-to-br from-purple-900/20 via-blue-900/20 to-teal-900/20" />
        <div className="relative text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-purple-500 to-blue-500 rounded-2xl mb-4 shadow-lg">
            <Shield className="w-8 h-8 text-white" />
          </div>
          <div className="flex items-center justify-center gap-3 mb-4">
            <Loader2 className="w-6 h-6 text-purple-400 animate-spin" />
            <h2 className="text-xl font-semibold text-white">
              Verifying Access...
            </h2>
          </div>
          <p className="text-gray-400">
            Checking authentication status
          </p>
        </div>
      </div>
    )
  }

  // Show login form if not authenticated
  if (!user || !session) {
    return (
      <LoginForm 
        onSuccess={() => {
          setAuthChecked(false)
          setWasForcedLogout(false)
        }} 
        forcedLogout={wasForcedLogout}
      />
    )
  }

  // Show password setup if needed
  if (needsPasswordSetup) {
    return (
      <PasswordSetup 
        onSuccess={() => {
          setNeedsPasswordSetup(false)
          setIsAuthenticatedAndReady(true)
        }} 
      />
    )
  }

  // CRITICAL SECURITY: Only render children if user is fully authenticated and ready
  // This prevents any sensitive components from being loaded before authentication
  if (!isAuthenticatedAndReady) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="absolute inset-0 bg-gradient-to-br from-purple-900/20 via-blue-900/20 to-teal-900/20" />
        <div className="relative text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-purple-500 to-blue-500 rounded-2xl mb-4 shadow-lg">
            <Shield className="w-8 h-8 text-white" />
          </div>
          <div className="flex items-center justify-center gap-3 mb-4">
            <Loader2 className="w-6 h-6 text-purple-400 animate-spin" />
            <h2 className="text-xl font-semibold text-white">
              Preparing Secure Workspace...
            </h2>
          </div>
          <p className="text-gray-400">
            Initializing admin panel
          </p>
        </div>
      </div>
    )
  }

  // User is fully authenticated and ready - now we can safely render the sensitive components
  return <>{children}</>
} 