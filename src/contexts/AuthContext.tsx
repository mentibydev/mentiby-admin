'use client'

import React, { createContext, useContext, useEffect, useState, useRef, useCallback } from 'react'
import { User, Session } from '@supabase/supabase-js'
import { authService } from '@/lib/auth'

interface AuthContextType {
  user: User | null
  session: Session | null
  loading: boolean
  signIn: (email: string, password: string) => Promise<{ data: any; error: any }>
  signOut: () => Promise<{ error: any }>
  updatePassword: (password: string, displayName?: string) => Promise<{ data: any; error: any }>
  resetPassword: (email: string) => Promise<{ data: any; error: any }>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  const [mounted, setMounted] = useState(false)
  const verificationIntervalRef = useRef<NodeJS.Timeout | null>(null)

  // Only mount on client side to prevent hydration issues
  useEffect(() => {
    setMounted(true)
  }, [])

  // Auto-verify authentication every 2 seconds (client-side only)
  const startAuthVerification = useCallback(() => {
    // Only run on client side
    if (typeof window === 'undefined' || !mounted) return
    
    if (verificationIntervalRef.current) {
      clearInterval(verificationIntervalRef.current)
    }

    verificationIntervalRef.current = setInterval(async () => {
      try {
        // Only verify if we think we have a user
        if (user && session) {
          
          // Use the robust verification method
          const { isValid, user: freshUser, session: freshSession } = await authService.verifyUserExists()
          
          if (!isValid || !freshSession || !freshUser) {
            // User no longer exists or session is invalid - force logout
            setUser(null)
            setSession(null)
            setLoading(false)
            
            // Clear any local storage or session data
            await authService.signOut()
          } else {
            // Update with fresh data
            setUser(freshUser)
            setSession(freshSession)
          }
        }
      } catch (error) {
        // On verification error, assume user is invalid and force logout
        setUser(null)
        setSession(null)
        setLoading(false)
        await authService.signOut()
      }
    }, 30000) // Every 30 seconds instead of 2 seconds
  }, [mounted, user, session])

  const stopAuthVerification = () => {
    if (verificationIntervalRef.current) {
      clearInterval(verificationIntervalRef.current)
      verificationIntervalRef.current = null
    }
  }

  useEffect(() => {
    // Only run auth logic after component is mounted on client side
    if (!mounted) return

    // Get initial session
    authService.getSession().then(({ session, user }) => {
      setSession(session)
      setUser(user)
      setLoading(false)
      
      // Start verification if user is authenticated
      if (user && session) {
        startAuthVerification()
      }
    })

    // Listen for auth changes
    const { data: { subscription } } = authService.onAuthStateChange((event, session) => {
      setSession(session)
      setUser(session?.user || null)
      setLoading(false)
      
      // Start/stop verification based on auth status
      if (session?.user) {
        startAuthVerification()
      } else {
        stopAuthVerification()
      }
    })

    // Cleanup on unmount
    return () => {
      subscription.unsubscribe()
      stopAuthVerification()
    }
  }, [mounted, startAuthVerification])

  // Also verify on window focus (when user returns to tab) - client-side only
  useEffect(() => {
    // Only run on client side after mounted
    if (!mounted || typeof window === 'undefined') return

    const handleFocus = async () => {
      if (user && session) {
        try {
          const { isValid, user: freshUser, session: freshSession } = await authService.verifyUserExists()
          
          if (!isValid || !freshSession || !freshUser) {
            setUser(null)
            setSession(null)
            await authService.signOut()
          } else {
            setUser(freshUser)
            setSession(freshSession)
          }
        } catch (error) {
          setUser(null)
          setSession(null)
          await authService.signOut()
        }
      }
    }

    window.addEventListener('focus', handleFocus)
    return () => window.removeEventListener('focus', handleFocus)
  }, [user, session, mounted])

  const signIn = async (email: string, password: string) => {
    setLoading(true)
    const result = await authService.signIn(email, password)
    setLoading(false)
    return result
  }

  const signOut = async () => {
    setLoading(true)
    stopAuthVerification() // Stop verification when signing out
    const result = await authService.signOut()
    setLoading(false)
    return result
  }

  const updatePassword = async (password: string, displayName?: string) => {
    return authService.updatePassword(password, displayName)
  }

  const resetPassword = async (email: string) => {
    return authService.resetPassword(email)
  }

  // Don't render children until mounted to prevent hydration mismatch
  if (!mounted) {
    return null
  }

  return (
    <AuthContext.Provider value={{
      user,
      session,
      loading,
      signIn,
      signOut,
      updatePassword,
      resetPassword
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
} 