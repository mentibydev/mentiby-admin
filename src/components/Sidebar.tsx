'use client'

import { Database, PieChart, Users } from 'lucide-react'
import { cn } from '@/lib/utils'

interface SidebarProps {
  activeTab: 'table' | 'charts'
  onTabChange: (tab: 'table' | 'charts') => void
}

export default function Sidebar({ activeTab, onTabChange }: SidebarProps) {
  const menuItems = [
    {
      id: 'table' as const,
      label: 'Onboarding Data',
      icon: Database,
      description: 'View and filter student data',
      gradient: 'gradient-blue'
    },
    {
      id: 'charts' as const,
      label: 'Cohort Graphs',
      icon: PieChart,
      description: 'Analytics and charts',
      gradient: 'gradient-purple'
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

      {/* Footer */}
      <div className="p-3 sm:p-4 border-t border-border/50">
        <div className="text-xs text-muted-foreground text-center">
          © 2025 MentiBY Admin
        </div>
        <div className="flex items-center justify-center space-x-1 text-xs mt-2">
          <span className="font-bold bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
            techSas
          </span>
          <span className="text-sm" style={{lineHeight: 1}}>❤️</span>
        </div>
      </div>
    </div>
  )
} 