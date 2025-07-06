'use client'

import { Database, PieChart, Users, LogOut, User, ChevronUp, Upload, Trophy, ClipboardList, MessageSquare } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAuth } from '@/contexts/AuthContext'
import { useState, useEffect } from 'react'

interface SidebarProps {
  activeTab: 'table' | 'charts' | 'feedback' | 'attendance' | 'xp' | 'records'
  onTabChange: (tab: 'table' | 'charts' | 'feedback' | 'attendance' | 'xp' | 'records') => void
}

export default function Sidebar({ activeTab, onTabChange }: SidebarProps) {
  const { user, signOut } = useAuth()
  const [showUserMenu, setShowUserMenu] = useState(false)
  const [isLoggingOut, setIsLoggingOut] = useState(false)
  const [mounted, setMounted] = useState(false)

  // Ensure we're on the client side
  useEffect(() => {
    setMounted(true)
  }, [])

  const handleSignOut = async () => {
    setIsLoggingOut(true)
    try {
      await signOut()
    } catch (error) {
      console.error('Sign out error:', error)
    }
    setIsLoggingOut(false)
  }

  // Get display name from user metadata or fall back to email (prevent hydration mismatch)
  const displayName = mounted && user
    ? (user.user_metadata?.display_name || user.user_metadata?.full_name || user.email?.split('@')[0] || 'Admin')
    : 'Admin'

  // Only calculate last login date on client side to prevent hydration issues
  const lastLoginDate = mounted && user?.last_sign_in_at
    ? new Date(user.last_sign_in_at).toLocaleDateString()
    : 'Never'

  const menuItems = [
    {
      id: 'table' as const,
      label: 'Onboarding Data',
      icon: Database,
      description: 'View and filter student data',
      gradient: 'gradient-blue'
    },
    {
      id: 'feedback' as const,
      label: 'Mentiby Feedback',
      icon: MessageSquare,
      description: 'Students Feedback on Mentiby',
      gradient: 'gradient-orange'
    },
    {
      id: 'charts' as const,
      label: 'Cohort Graphs',
      icon: PieChart,
      description: 'Analytics and charts',
      gradient: 'gradient-purple'
    },
    {
      id: 'xp' as const,
      label: 'XP Leaderboard',
      icon: Trophy,
      description: 'Student XP rankings',
      gradient: 'gradient-gold'
    },
    {
      id: 'records' as const,
      label: 'Attendance Records',
      icon: ClipboardList,
      description: 'View attendance statistics by cohort',
      gradient: 'gradient-blue'
    },
    {
      id: 'attendance' as const,
      label: 'Attendance Upload',
      icon: Upload,
      description: 'Upload attendance CSV files',
      gradient: 'gradient-green'
    }
  ]

  return (
    <div className="w-72 sm:w-80 bg-card/50 backdrop-blur-xl border-r border-border/50 h-screen flex flex-col">
      {/* Header */}
      <div className="p-4 sm:p-6 border-b border-border/50">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 sm:w-12 sm:h-12 gradient-purple rounded-xl flex items-center justify-center glow-purple">
            <Users className="w-5 h-5 sm:w-7 sm:h-7 text-white" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold gradient-text">MentiBY</h1>
            <p className="text-xs sm:text-sm text-muted-foreground">Admin Panel</p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <div className="flex-1 p-3 sm:p-4">
        <nav className="space-y-2 sm:space-y-3">
          {menuItems.map((item) => {
            const Icon = item.icon
            const isActive = activeTab === item.id

            return (
              <button
                key={item.id}
                onClick={() => onTabChange(item.id)}
                className={cn(
                  "w-full p-4 sm:p-5 rounded-xl sm:rounded-2xl text-left transition-all duration-300 group relative overflow-hidden",
                  "hover:scale-[1.02] hover:shadow-2xl",
                  isActive
                    ? `${item.gradient} text-white shadow-2xl scale-[1.02] glow-purple`
                    : "bg-muted/30 text-muted-foreground hover:text-foreground hover:bg-muted/50"
                )}
              >
                <div className="flex items-center space-x-3 sm:space-x-4 relative z-10">
                  <div className={cn(
                    "w-8 h-8 sm:w-10 sm:h-10 rounded-lg sm:rounded-xl flex items-center justify-center transition-all duration-300",
                    isActive
                      ? "bg-white/20 backdrop-blur-sm"
                      : "bg-accent group-hover:bg-accent/70"
                  )}>
                    <Icon className="w-4 h-4 sm:w-5 sm:h-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-sm sm:text-base truncate">{item.label}</div>
                    <div className={cn(
                      "text-xs transition-colors truncate",
                      isActive
                        ? "text-white/80"
                        : "text-muted-foreground group-hover:text-foreground/70"
                    )}>
                      {item.description}
                    </div>
                  </div>
                </div>

                {/* Animated background for active state */}
                {isActive && (
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent transform -skew-x-12 animate-pulse" />
                )}
              </button>
            )
          })}
        </nav>
      </div>

      {/* User Info & Logout */}
      <div className="p-3 sm:p-4 border-t border-border/50">
        <div className="relative">
          {/* User Profile Button */}
          <button
            onClick={() => setShowUserMenu(!showUserMenu)}
            className="w-full p-3 sm:p-4 bg-muted/30 hover:bg-muted/50 rounded-xl sm:rounded-2xl transition-all duration-300 group"
          >
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 sm:w-10 sm:h-10 bg-gradient-to-br from-purple-500 to-blue-500 rounded-lg sm:rounded-xl flex items-center justify-center glow-purple">
                <User className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
              </div>
              <div className="flex-1 text-left min-w-0">
                <div className="font-semibold text-sm sm:text-base text-foreground truncate" suppressHydrationWarning>
                  {displayName}
                </div>
                <div className="text-xs text-muted-foreground">
                  Administrator
                </div>
              </div>
              <ChevronUp className={`w-4 h-4 text-muted-foreground transition-transform duration-200 ${showUserMenu ? 'rotate-180' : ''}`} />
            </div>
          </button>

          {/* User Menu Dropdown */}
          {showUserMenu && mounted && (
            <div className="absolute bottom-full left-0 right-0 mb-2 bg-card/80 backdrop-blur-xl border border-border/50 rounded-xl shadow-2xl z-50">
              {/* User Info */}
              <div className="p-3 sm:p-4 border-b border-border/50">
                <p className="text-sm font-medium text-foreground truncate" suppressHydrationWarning>
                  {mounted && user?.email ? user.email : 'Loading...'}
                </p>
                <p className="text-xs text-muted-foreground" suppressHydrationWarning>
                  Last login: {mounted ? lastLoginDate : 'Loading...'}
                </p>
              </div>

              {/* Logout Button */}
              <div className="p-2">
                <button
                  onClick={handleSignOut}
                  disabled={isLoggingOut}
                  className="w-full p-2 sm:p-3 text-left text-sm text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-lg transition-colors flex items-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isLoggingOut ? (
                    <>
                      <div className="w-4 h-4 border-2 border-red-400/30 border-t-red-400 rounded-full animate-spin" />
                      Signing Out...
                    </>
                  ) : (
                    <>
                      <LogOut className="w-4 h-4" />
                      Sign Out
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="mt-4 text-xs text-muted-foreground text-center">
          © 2025 MentiBY Admin
        </div>
        <div className="flex items-center justify-center space-x-1 text-xs mt-2">
          <span className="font-bold bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
            techSas
          </span>
          <span className="text-sm" style={{ lineHeight: 1 }}>❤️</span>
        </div>
      </div>

      {/* Click outside to close menu */}
      {showUserMenu && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setShowUserMenu(false)}
        />
      )}
    </div>
  )
} 