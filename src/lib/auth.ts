import { supabase } from './supabase'
import type { User, Session } from '@supabase/supabase-js'

export interface AuthUser {
  id: string
  email: string
  created_at: string
  email_confirmed_at?: string
}

export const authService = {
  // Sign in with email and password
  async signIn(email: string, password: string) {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    })
    return { data, error }
  },

  // Sign out
  async signOut() {
    const { error } = await supabase.auth.signOut()
    return { error }
  },

  // Get current session
  async getSession(): Promise<{ session: Session | null; user: User | null }> {
    const { data: { session } } = await supabase.auth.getSession()
    return { session, user: session?.user || null }
  },

  // Verify if current user still exists and is valid (more thorough check)
  async verifyUserExists(): Promise<{ isValid: boolean; user: User | null; session: Session | null }> {
    try {
      // First get the current session
      const { data: { session }, error: sessionError } = await supabase.auth.getSession()

      if (sessionError || !session || !session.user) {
        return { isValid: false, user: null, session: null }
      }

      // Try to refresh the session to ensure it's still valid on the server
      const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession()

      if (refreshError || !refreshData.session || !refreshData.user) {
        console.log('Session refresh failed:', refreshError?.message)
        return { isValid: false, user: null, session: null }
      }

      // Additional check: try to get user info to ensure user still exists
      const { data: { user }, error: userError } = await supabase.auth.getUser()

      if (userError || !user) {
        console.log('User verification failed:', userError?.message)
        return { isValid: false, user: null, session: null }
      }

      return {
        isValid: true,
        user: refreshData.user,
        session: refreshData.session
      }
    } catch (error) {
      console.error('Auth verification error:', error)
      return { isValid: false, user: null, session: null }
    }
  },

  // Update user password and display name (for setting initial password)
  async updatePassword(password: string, displayName?: string) {
    const updateData: any = { password }

    if (displayName) {
      updateData.data = {
        display_name: displayName,
        full_name: displayName,
        needs_password_setup: false,
        password_set: true
      }
    }

    const { data, error } = await supabase.auth.updateUser(updateData)
    return { data, error }
  },

  // Reset password for email
  async resetPassword(email: string) {
    const { data, error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/reset-password`
    })
    return { data, error }
  },

  // Listen to auth state changes
  onAuthStateChange(callback: (event: string, session: Session | null) => void) {
    return supabase.auth.onAuthStateChange(callback)
  }
} 