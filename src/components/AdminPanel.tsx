'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { OnboardingData } from '@/types'
import Sidebar from '@/components/Sidebar'
import DataTable from '@/components/DataTable'
import CohortCharts from '@/components/CohortCharts'
import AttendanceUpload from '@/components/AttendanceUpload'
import XPLeaderboard from '@/components/XPLeaderboard'
import { Menu, X } from 'lucide-react'
import FeedbackTable from '@/components/FeedbackTable'

// Temporary local type definition for FeedbackData
type FeedbackData = {
  EnrollmentID: string
  Mentor1Feedback: string
  Mentor2Feedback: string
  OverallFeedback: string
  ChallengesFaced: string
  SuggestionsToImprove: string
}

export default function AdminPanel() {
  const [activeTab, setActiveTab] = useState<'table' | 'charts' | 'feedback' | 'attendance' | 'xp'>('table')
  const [onboardingData, setOnboardingData] = useState<OnboardingData[]>([])
  const [feedbackData, setFeedbackData] = useState<FeedbackData[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)

  useEffect(() => {
    fetchData()
    fetchFeedbackData()
  }, [])

  const fetchData = async () => {
    try {
      setIsLoading(true)
      setError(null)
      
      const { data: onboardingData, error } = await supabase
        .from('onboarding')
        .select('*')
        .order('EnrollmentID', { ascending: true })

      if (error) {
        throw error
      }

      setOnboardingData(onboardingData || [])
    } catch (err) {
      console.error('Error fetching onboarding data:', err)
      setError(err instanceof Error ? err.message : 'An error occurred while fetching onboarding data')
    } finally {
      setIsLoading(false)
    }
  }

  const fetchFeedbackData = async () => {
    try {
      setIsLoading(true)
      setError(null)
      
      const { data: feedbackData, error } = await supabase
        .from('mentibyFeedback')
        .select('*')
        .order('EnrollmentID', { ascending: true })

      if (error) {
        throw error
      }

      setFeedbackData(feedbackData || [])
    } catch (err) {
      console.error('Error fetching feedback data:', err)
      setError(err instanceof Error ? err.message : 'An error occurred while fetching feedback data')
    } finally {
      setIsLoading(false)
    }
  }

  const handleTabChange = (tab: 'table' | 'charts' | 'feedback' | 'attendance' | 'xp') => {
    setActiveTab(tab)
    setIsMobileMenuOpen(false) // Close mobile menu when tab changes
  }

  const renderContent = () => {
    if (error) {
      return (
        <div className="flex items-center justify-center h-full px-4">
          <div className="text-center max-w-md">
            <div className="w-16 h-16 sm:w-20 sm:h-20 bg-destructive/20 rounded-full flex items-center justify-center mx-auto mb-4 sm:mb-6 glow-purple">
              <svg className="w-8 h-8 sm:w-10 sm:h-10 text-destructive" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h3 className="text-xl sm:text-2xl font-semibold gradient-text mb-2 sm:mb-3">Error Loading Data</h3>
            <p className="text-muted-foreground mb-4 sm:mb-6 text-sm sm:text-base">{error}</p>
            <button
              onClick={() => {
                if (activeTab === 'feedback') {
                  fetchFeedbackData()
                } else {
                  fetchData()
                }
              }}
              className="px-4 py-2 sm:px-6 sm:py-3 gradient-purple text-white rounded-xl hover:scale-105 transition-all duration-300 font-medium glow-purple text-sm sm:text-base"
            >
              Retry Connection
            </button>
          </div>
        </div>
      )
    }

    switch (activeTab) {
      case 'table':
        return <DataTable data={onboardingData} isLoading={isLoading} onDataUpdate={fetchData} />
      case 'feedback':
        return <FeedbackTable data={feedbackData} isLoading={isLoading} onDataUpdate={fetchFeedbackData} />
      case 'charts':
        return <CohortCharts data={onboardingData} isLoading={isLoading} />
      case 'xp':
        return <XPLeaderboard />
      case 'attendance':
        return <AttendanceUpload />
      default:
        return <DataTable data={onboardingData} isLoading={isLoading} onDataUpdate={fetchData} />
    }
  }

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      {/* Mobile Menu Button */}
      <button
        onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
        className="fixed top-6 left-4 z-50 lg:hidden p-3 bg-card/80 backdrop-blur-xl border border-border/50 rounded-xl hover:scale-105 transition-all duration-300 glow-purple"
      >
        {isMobileMenuOpen ? (
          <X className="w-5 h-5 text-foreground" />
        ) : (
          <Menu className="w-5 h-5 text-foreground" />
        )}
      </button>

      {/* Mobile Overlay */}
      {isMobileMenuOpen && (
        <div 
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 lg:hidden"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div className={`
        fixed lg:relative inset-y-0 left-0 z-40 lg:z-auto
        transform ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
        transition-transform duration-300 ease-in-out lg:transition-none
      `}>
        <Sidebar 
          activeTab={activeTab} 
          onTabChange={handleTabChange}
        />
      </div>
      
      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="flex-1 p-4 sm:p-6 lg:p-8 overflow-auto pt-20 lg:pt-4">
          <div className="h-full flex flex-col">
            {renderContent()}
          </div>
        </div>
      </div>
    </div>
  )
} 