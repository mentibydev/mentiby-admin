'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { OnboardingData } from '@/types'
import Sidebar from '@/components/Sidebar'
import DataTable from '@/components/DataTable'
import CohortCharts from '@/components/CohortCharts'

export default function AdminPanel() {
  const [activeTab, setActiveTab] = useState<'table' | 'charts'>('table')
  const [data, setData] = useState<OnboardingData[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchData()
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

      setData(onboardingData || [])
    } catch (err) {
      console.error('Error fetching data:', err)
      setError(err instanceof Error ? err.message : 'An error occurred while fetching data')
    } finally {
      setIsLoading(false)
    }
  }

  const renderContent = () => {
    if (error) {
      return (
        <div className="flex items-center justify-center h-full">
          <div className="text-center">
            <div className="w-20 h-20 bg-destructive/20 rounded-full flex items-center justify-center mx-auto mb-6 glow-purple">
              <svg className="w-10 h-10 text-destructive" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h3 className="text-2xl font-semibold gradient-text mb-3">Error Loading Data</h3>
            <p className="text-muted-foreground mb-6 max-w-md">{error}</p>
            <button
              onClick={fetchData}
              className="px-6 py-3 gradient-purple text-white rounded-xl hover:scale-105 transition-all duration-300 font-medium glow-purple"
            >
              Retry Connection
            </button>
          </div>
        </div>
      )
    }

    switch (activeTab) {
      case 'table':
        return <DataTable data={data} isLoading={isLoading} onDataUpdate={fetchData} />
      case 'charts':
        return <CohortCharts data={data} isLoading={isLoading} />
      default:
        return <DataTable data={data} isLoading={isLoading} onDataUpdate={fetchData} />
    }
  }

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      {/* Sidebar */}
      <Sidebar 
        activeTab={activeTab} 
        onTabChange={setActiveTab} 
      />
      
      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="flex-1 p-8 overflow-auto">
          <div className="h-full flex flex-col">
            {renderContent()}
          </div>
        </div>
      </div>
    </div>
  )
} 