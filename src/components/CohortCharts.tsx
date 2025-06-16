'use client'

import { useState, useEffect, useMemo } from 'react'
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts'
import { OnboardingData, CohortDistribution } from '@/types'
import { TrendingUp, Users, BarChart3, PieChart as PieIcon } from 'lucide-react'

interface CohortChartsProps {
  data: OnboardingData[]
  isLoading: boolean
}

interface ChartData {
  name: string
  value: number
  color: string
  percentage?: number
}

const COLORS = {
  Basic: '#6366f1',
  Placement: '#10b981',
  MERN: '#f59e0b',
  'Full Stack': '#8b5cf6'
}

const DETAILED_COLORS = [
  '#6366f1', // Blue
  '#10b981', // Green
  '#f59e0b', // Yellow
  '#ef4444', // Red
  '#8b5cf6', // Purple
  '#06b6d4', // Cyan
  '#f97316', // Orange
  '#84cc16', // Lime
  '#ec4899', // Pink
  '#6b7280', // Gray
  '#14b8a6', // Teal
  '#a855f7', // Violet
]

const GRADIENT_COLORS = {
  Basic: ['#6366f1', '#4338ca'],
  Placement: ['#10b981', '#059669'],
  MERN: ['#f59e0b', '#d97706'],
  'Full Stack': ['#8b5cf6', '#7c3aed']
}

export default function CohortCharts({ data, isLoading }: CohortChartsProps) {
  const [selectedCohortType, setSelectedCohortType] = useState<string>('Basic')

  const cohortTypes = ['Basic', 'Placement', 'MERN', 'Full Stack']

  // Calculate cohort distribution
  const cohortDistribution = useMemo(() => {
    const distribution: Record<string, Record<string, number>> = {}
    
    data.forEach(student => {
      const cohortType = student['Cohort Type']
      const cohortNumber = student['Cohort Number']
      
      if (!distribution[cohortType]) {
        distribution[cohortType] = {}
      }
      
      if (!distribution[cohortType][cohortNumber]) {
        distribution[cohortType][cohortNumber] = 0
      }
      
      distribution[cohortType][cohortNumber]++
    })
    
    return distribution
  }, [data])

  // Calculate overall stats
  const overallStats = useMemo(() => {
    const total = data.length
    const byType = data.reduce((acc, student) => {
      const type = student['Cohort Type']
      acc[type] = (acc[type] || 0) + 1
      return acc
    }, {} as Record<string, number>)

    return {
      total,
      byType
    }
  }, [data])

  const getChartData = (cohortType: string): ChartData[] => {
    const typeData = cohortDistribution[cohortType] || {}
    const total = Object.values(typeData).reduce((sum, count) => sum + count, 0)
    
    return Object.entries(typeData).map(([cohortNumber, count], index) => ({
      name: `${cohortType} ${cohortNumber}`,
      value: count,
      color: DETAILED_COLORS[index % DETAILED_COLORS.length],
      percentage: total > 0 ? Math.round((count / total) * 100) : 0
    }))
  }

  const getOverviewChartData = (): ChartData[] => {
    const total = overallStats.total
    return cohortTypes.map(type => ({
      name: type,
      value: overallStats.byType[type] || 0,
      color: COLORS[type as keyof typeof COLORS],
      percentage: total > 0 ? Math.round(((overallStats.byType[type] || 0) / total) * 100) : 0
    }))
  }

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0]
      return (
        <div className="bg-card/90 backdrop-blur-xl border border-border/50 rounded-xl p-4 shadow-2xl glow-purple">
          <p className="text-foreground font-semibold text-base">{data.name}</p>
          <p className="text-primary font-bold text-lg">{data.value} students</p>
          {data.payload.percentage && (
            <p className="text-muted-foreground text-sm">{data.payload.percentage}% of total</p>
          )}
        </div>
      )
    }
    return null
  }

  const CustomLegend = ({ payload }: any) => {
    return (
      <div className="flex flex-wrap justify-center gap-4 mt-6">
        {payload.map((entry: any, index: number) => (
          <div key={index} className="flex items-center space-x-2">
            <div 
              className="w-4 h-4 rounded-full shadow-lg"
              style={{ backgroundColor: entry.color }}
            />
            <span className="text-foreground font-medium">{entry.value}</span>
            <span className="text-muted-foreground text-sm">
              ({entry.payload?.percentage || 0}%)
            </span>
          </div>
        ))}
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin w-12 h-12 border-4 border-primary border-t-transparent rounded-full glow-purple"></div>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h2 className="text-3xl font-bold gradient-text">Cohort Analytics</h2>
        <p className="text-muted-foreground mt-1">
          Visual representation of student distribution across cohorts
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
        <div className="bg-card/50 backdrop-blur-xl border border-border/50 rounded-2xl p-6 hover:scale-105 transition-all duration-300 glow-purple">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Total Students</p>
              <p className="text-3xl font-bold gradient-text">{overallStats.total}</p>
            </div>
            <div className="w-14 h-14 gradient-purple rounded-2xl flex items-center justify-center glow-purple">
              <Users className="w-7 h-7 text-white" />
            </div>
          </div>
        </div>

        {cohortTypes.map(type => (
          <div key={type} className="bg-card/50 backdrop-blur-xl border border-border/50 rounded-2xl p-6 hover:scale-105 transition-all duration-300">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">{type}</p>
                <p className="text-2xl font-bold text-foreground">
                  {overallStats.byType[type] || 0}
                </p>
                <p className="text-xs text-muted-foreground">
                  {Math.round(((overallStats.byType[type] || 0) / overallStats.total) * 100)}% of total
                </p>
              </div>
              <div 
                className="w-12 h-12 rounded-xl flex items-center justify-center shadow-lg"
                style={{ 
                  background: `linear-gradient(135deg, ${GRADIENT_COLORS[type as keyof typeof GRADIENT_COLORS][0]}, ${GRADIENT_COLORS[type as keyof typeof GRADIENT_COLORS][1]})`,
                  boxShadow: `0 8px 32px ${COLORS[type as keyof typeof COLORS]}40`
                }}
              >
                <PieIcon 
                  className="w-6 h-6 text-white" 
                />
              </div>
            </div>
          </div>
        ))}
      </div>
      
      {/* Cohort Type Selector */}
      <div className="bg-card/50 backdrop-blur-xl border border-border/50 rounded-2xl p-8">
        <h3 className="text-2xl font-semibold gradient-text mb-6">Detailed Cohort Breakdown</h3>
        <div className="mb-8">
          <label className="block text-sm font-medium text-foreground mb-3">
            Select Cohort Type for Detailed Analysis
          </label>
          <select
            value={selectedCohortType}
            onChange={(e) => setSelectedCohortType(e.target.value)}
            className="w-full max-w-md px-4 py-3 bg-input/50 backdrop-blur-sm border border-border/50 rounded-xl text-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all duration-300"
          >
            <option value="">Select a cohort type...</option>
            {cohortTypes.map(type => (
              <option key={type} value={type}>{type}</option>
            ))}
          </select>
        </div>

        {selectedCohortType && (
          <div className="h-96">
            <h4 className="text-xl font-semibold text-foreground mb-6 flex items-center space-x-2">
              <div 
                className="w-6 h-6 rounded-full"
                style={{ backgroundColor: COLORS[selectedCohortType as keyof typeof COLORS] }}
              />
              <span>{selectedCohortType} Cohort Distribution</span>
            </h4>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <defs>
                  {getChartData(selectedCohortType).map((entry, index) => (
                    <linearGradient key={`detailed-gradient-${index}`} id={`detailed-gradient-${index}`} x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor={entry.color} />
                      <stop offset="100%" stopColor={`${entry.color}CC`} />
                    </linearGradient>
                  ))}
                </defs>
                <Pie
                  data={getChartData(selectedCohortType)}
                  cx="50%"
                  cy="50%"
                  innerRadius={80}
                  outerRadius={140}
                  paddingAngle={6}
                  dataKey="value"
                  strokeWidth={2}
                  stroke="rgba(255,255,255,0.1)"
                >
                  {getChartData(selectedCohortType).map((entry, index) => (
                    <Cell 
                      key={`cell-${index}`} 
                      fill={`url(#detailed-gradient-${index})`}
                      style={{
                        filter: `drop-shadow(0 4px 20px ${entry.color}60)`
                      }}
                    />
                  ))}
                </Pie>
                <Tooltip content={<CustomTooltip />} />
                <Legend content={<CustomLegend />} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        )}

        {selectedCohortType && getChartData(selectedCohortType).length === 0 && (
          <div className="text-center py-16">
            <div className="w-20 h-20 bg-muted/30 rounded-full flex items-center justify-center mx-auto mb-6">
              <PieIcon className="w-10 h-10 text-muted-foreground" />
            </div>
            <h4 className="text-xl font-semibold text-foreground mb-2">No Data Available</h4>
            <p className="text-muted-foreground">No students found in the {selectedCohortType} cohort.</p>
          </div>
        )}
      </div>
      
      {/* Overview Chart */}
      <div className="bg-card/50 backdrop-blur-xl border border-border/50 rounded-2xl p-8">
        <h3 className="text-2xl font-semibold gradient-text mb-8">Overall Distribution</h3>
        <div className="h-96">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <defs>
                {cohortTypes.map(type => (
                  <linearGradient key={type} id={`gradient-${type}`} x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor={GRADIENT_COLORS[type as keyof typeof GRADIENT_COLORS][0]} />
                    <stop offset="100%" stopColor={GRADIENT_COLORS[type as keyof typeof GRADIENT_COLORS][1]} />
                  </linearGradient>
                ))}
              </defs>
              <Pie
                data={getOverviewChartData()}
                cx="50%"
                cy="50%"
                innerRadius={80}
                outerRadius={140}
                paddingAngle={8}
                dataKey="value"
                strokeWidth={3}
                stroke="rgba(255,255,255,0.1)"
              >
                {getOverviewChartData().map((entry, index) => (
                  <Cell 
                    key={`cell-${index}`} 
                    fill={`url(#gradient-${entry.name})`}
                    style={{
                      filter: 'drop-shadow(0 4px 20px rgba(139, 92, 246, 0.4))'
                    }}
                  />
                ))}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
              <Legend content={<CustomLegend />} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  )
} 