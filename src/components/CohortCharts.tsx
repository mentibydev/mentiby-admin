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
  Basic: '#3b82f6',        // Bright Blue
  Placement: '#10b981',    // Green
  MERN: '#f59e0b',         // Orange
  'Full Stack': '#ff1493'  // Deep Pink
}

const DETAILED_COLORS = [
  '#6366f1', // Blue
  '#10b981', // Green
  '#f59e0b', // Yellow
  '#ef4444', // Red
  '#ec4899', // Pink
  '#06b6d4', // Cyan
  '#f97316', // Orange
  '#84cc16', // Lime
  '#a855f7', // Purple
  '#6b7280', // Gray
  '#14b8a6', // Teal
  '#f472b6', // Light Pink
]

const GRADIENT_COLORS = {
  Basic: ['#3b82f6', '#2563eb'],
  Placement: ['#10b981', '#059669'],
  MERN: ['#f59e0b', '#d97706'],
  'Full Stack': ['#ff1493', '#dc143c']  // Deep Pink gradient
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
    const chartData = cohortTypes.map(type => ({
      name: type,
      value: overallStats.byType[type] || 0,
      color: COLORS[type as keyof typeof COLORS],
      percentage: total > 0 ? Math.round(((overallStats.byType[type] || 0) / total) * 100) : 0
    }))

    // Debug: Log colors to ensure they're correct
    console.log('Chart Data Colors:', chartData.map(d => ({ name: d.name, color: d.color })))

    return chartData
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
      <div className="flex flex-wrap justify-center gap-6 mt-8">
        {payload.map((entry: any, index: number) => (
          <div key={index} className="flex items-center space-x-3 bg-gray-800/40 backdrop-blur-sm border border-gray-600/30 rounded-lg px-4 py-3 hover:bg-gray-700/50 transition-all duration-300">
            <div
              className="w-7 h-7 rounded-full border-2 border-white/50 flex-shrink-0"
              style={{
                backgroundColor: entry.color,
                boxShadow: `0 0 25px ${entry.color}, 0 0 50px ${entry.color}60, inset 0 2px 4px rgba(255,255,255,0.2)`,
                filter: `brightness(1.1) saturate(1.2)`
              }}
            />
            <div className="flex items-center space-x-2">
              <span className="text-white font-bold text-sm">{entry.value}</span>
              <span className="text-gray-300 text-xs font-medium">
                ({entry.payload?.percentage || 0}%)
              </span>
            </div>
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
    <div className="space-y-6 sm:space-y-8">
      {/* Header */}
      <div className="pt-2 sm:pt-0">
        <h2 className="text-xl sm:text-2xl lg:text-3xl font-bold gradient-text">Cohort Analytics</h2>
        <p className="text-muted-foreground mt-1 text-sm sm:text-base">
          Visual representation of student distribution across cohorts
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 sm:gap-6">
        <div className="bg-card/50 backdrop-blur-xl border border-border/50 rounded-xl sm:rounded-2xl p-3 sm:p-6 hover:scale-105 transition-all duration-300 glow-purple col-span-2 sm:col-span-1">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
            <div className="mb-2 sm:mb-0">
              <p className="text-xs sm:text-sm text-muted-foreground">Total Students</p>
              <p className="text-xl sm:text-3xl font-bold gradient-text">{overallStats.total}</p>
            </div>
            <div className="w-10 h-10 sm:w-14 sm:h-14 gradient-purple rounded-xl sm:rounded-2xl flex items-center justify-center glow-purple self-end sm:self-auto">
              <Users className="w-5 h-5 sm:w-7 sm:h-7 text-white" />
            </div>
          </div>
        </div>

        {cohortTypes.map(type => (
          <div key={type} className="bg-card/50 backdrop-blur-xl border border-border/50 rounded-xl sm:rounded-2xl p-3 sm:p-6 hover:scale-105 transition-all duration-300">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
              <div className="mb-2 sm:mb-0">
                <p className="text-xs sm:text-sm text-muted-foreground truncate">{type}</p>
                <p className="text-lg sm:text-2xl font-bold text-foreground">
                  {overallStats.byType[type] || 0}
                </p>
                <p className="text-xs text-muted-foreground">
                  {Math.round(((overallStats.byType[type] || 0) / overallStats.total) * 100)}%
                </p>
              </div>
              <div
                className="w-8 h-8 sm:w-12 sm:h-12 rounded-lg sm:rounded-xl flex items-center justify-center shadow-lg self-end sm:self-auto"
                style={{
                  background: `linear-gradient(135deg, ${GRADIENT_COLORS[type as keyof typeof GRADIENT_COLORS][0]}, ${GRADIENT_COLORS[type as keyof typeof GRADIENT_COLORS][1]})`,
                  boxShadow: `0 4px 16px ${COLORS[type as keyof typeof COLORS]}40`
                }}
              >
                <PieIcon
                  className="w-4 h-4 sm:w-6 sm:h-6 text-white"
                />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Cohort Type Selector */}
      <div className="bg-card/50 backdrop-blur-xl border border-border/50 rounded-xl sm:rounded-2xl p-4 sm:p-8">
        <h3 className="text-xl sm:text-2xl font-semibold gradient-text mb-4 sm:mb-6">Detailed Cohort Breakdown</h3>
        <div className="mb-6 sm:mb-8">
          <label className="block text-sm font-medium text-foreground mb-3">
            Select Cohort Type for Detailed Analysis
          </label>
          <select
            value={selectedCohortType}
            onChange={(e) => setSelectedCohortType(e.target.value)}
            className="w-full max-w-md px-3 py-2 sm:px-4 sm:py-3 bg-input/50 backdrop-blur-sm border border-border/50 rounded-xl text-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all duration-300 text-sm sm:text-base"
          >
            <option value="">Select a cohort type...</option>
            {cohortTypes.map(type => (
              <option key={type} value={type}>{type}</option>
            ))}
          </select>
        </div>

        {selectedCohortType && (
          <div>
            <h4 className="text-lg sm:text-xl font-semibold text-foreground mb-4 sm:mb-6 flex items-center space-x-2">
              <div
                className="w-4 h-4 sm:w-6 sm:h-6 rounded-full"
                style={{ backgroundColor: COLORS[selectedCohortType as keyof typeof COLORS] }}
              />
              <span className="text-sm sm:text-base lg:text-xl">{selectedCohortType} Cohort Distribution</span>
            </h4>

            {/* Chart Container */}
            <div className="relative h-64 sm:h-80 lg:h-96">
              {/* Detailed Pie Chart */}
              <div className="h-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={getChartData(selectedCohortType)}
                      cx="50%"
                      cy="50%"
                      innerRadius="40%"
                      outerRadius="75%"
                      paddingAngle={4}
                      dataKey="value"
                      strokeWidth={2}
                      stroke="rgba(255,255,255,0.2)"
                    >
                      {getChartData(selectedCohortType).map((entry, index) => (
                        <Cell
                          key={`detailed-cell-${index}-${entry.name}`}
                          fill={entry.color}
                          stroke={entry.color}
                          strokeWidth={2}
                          style={{
                            filter: `drop-shadow(0 4px 20px ${entry.color}60)`,
                            opacity: 1
                          }}
                        />
                      ))}
                    </Pie>
                    <Tooltip content={<CustomTooltip />} />
                  </PieChart>
                </ResponsiveContainer>
              </div>

              {/* Floating Mini Stats for Detailed */}
              <div className="absolute top-1/2 left-[70%] sm:left-[75%] -translate-y-1/2 space-y-1 sm:space-y-1.5 hidden sm:block">
                {getChartData(selectedCohortType).map((entry, index) => (
                  <div
                    key={index}
                    className="relative flex items-center space-x-3 bg-gradient-to-r from-gray-900/80 via-gray-800/60 to-gray-900/80 backdrop-blur-2xl border border-white/20 rounded-2xl px-4 py-2.5 hover:scale-105 hover:border-white/30 transition-all duration-500 group overflow-hidden"
                    style={{
                      boxShadow: `0 1px 3px ${entry.color}20, inset 0 1px 0 rgba(255,255,255,0.1)`
                    }}
                  >
                    {/* Animated background glow */}
                    <div
                      className="absolute inset-0 opacity-0 group-hover:opacity-20 transition-opacity duration-500 rounded-2xl"
                      style={{
                        background: `radial-gradient(circle at 50% 50%, ${entry.color}60, transparent 70%)`
                      }}
                    />

                    {/* Glowing dot with pulse animation */}
                    <div className="relative">
                      <div
                        className="w-4 h-4 rounded-full flex-shrink-0 group-hover:scale-125 transition-all duration-300 animate-pulse"
                        style={{
                          backgroundColor: entry.color,
                          boxShadow: `0 0 15px ${entry.color}80, 0 0 30px ${entry.color}40`
                        }}
                      />
                      <div
                        className="absolute inset-0 w-4 h-4 rounded-full opacity-30 group-hover:scale-150 group-hover:opacity-10 transition-all duration-500"
                        style={{
                          backgroundColor: entry.color,
                          filter: 'blur(4px)'
                        }}
                      />
                    </div>

                    {/* Text content with better hierarchy */}
                    <div className="flex items-center space-x-2 relative z-10">
                      <span
                        className="text-sm font-bold tracking-wide group-hover:text-white transition-colors duration-300"
                        style={{ color: entry.color }}
                      >{selectedCohortType} {entry.name.replace(`${selectedCohortType} `, '')}</span>
                      <div className="w-px h-4 bg-white/20"></div>
                      <span className="text-white text-sm font-extrabold">{entry.value}</span>
                      <span className="text-gray-300 text-xs font-medium bg-white/10 px-2 py-0.5 rounded-full">
                        {entry.percentage}%
                      </span>
                    </div>
                  </div>
                ))}

                {/* Total Counter for Detailed */}
                <div className="relative mt-3 flex items-center justify-center bg-gradient-to-r from-purple-600/60 via-blue-600/60 to-purple-600/60 backdrop-blur-2xl border border-purple-400/30 rounded-2xl px-4 py-2 hover:scale-105 transition-all duration-500 group overflow-hidden">
                  {/* Shimmer effect */}
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000 skew-x-12"></div>

                  <span className="text-purple-200 text-xs font-medium mr-2 relative z-10">TOTAL</span>
                  <div className="w-px h-4 bg-white/30 relative z-10"></div>
                  <span className="text-white text-lg font-black ml-2 relative z-10 tracking-wider">
                    {getChartData(selectedCohortType).reduce((sum, item) => sum + item.value, 0)}
                  </span>
                </div>
              </div>
            </div>

            {/* Mobile Stats - Below Chart */}
            <div className="sm:hidden mt-6 space-y-2">
              {getChartData(selectedCohortType).map((entry, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between bg-card/30 backdrop-blur-sm border border-border/30 rounded-lg px-3 py-2"
                >
                  <div className="flex items-center space-x-2">
                    <div
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: entry.color }}
                    />
                    <span className="text-sm font-medium text-foreground">
                      {selectedCohortType} {entry.name.replace(`${selectedCohortType} `, '')}
                    </span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className="text-sm font-bold text-foreground">{entry.value}</span>
                    <span className="text-xs text-muted-foreground">({entry.percentage}%)</span>
                  </div>
                </div>
              ))}
              <div className="flex items-center justify-between bg-gradient-to-r from-purple-600/20 to-blue-600/20 border border-purple-400/30 rounded-lg px-3 py-2 mt-3">
                <span className="text-sm font-medium text-purple-200">Total</span>
                <span className="text-lg font-bold text-white">
                  {getChartData(selectedCohortType).reduce((sum, item) => sum + item.value, 0)}
                </span>
              </div>
            </div>
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
      <div className="bg-card/50 backdrop-blur-xl border border-border/50 rounded-xl sm:rounded-2xl p-4 sm:p-8">
        <h3 className="text-xl sm:text-2xl font-semibold gradient-text mb-6 sm:mb-8">Overall Distribution</h3>
        <div className="relative">
          {/* Main Pie Chart */}
          <div className="h-64 sm:h-80 lg:h-96">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={getOverviewChartData()}
                  cx="50%"
                  cy="50%"
                  innerRadius="40%"
                  outerRadius="75%"
                  paddingAngle={6}
                  dataKey="value"
                  strokeWidth={2}
                  stroke="rgba(255,255,255,0.2)"
                >
                  {getOverviewChartData().map((entry, index) => (
                    <Cell
                      key={`cell-${index}-${entry.name}`}
                      fill={entry.color}
                      stroke={entry.color}
                      strokeWidth={2}
                      style={{
                        filter: `drop-shadow(0 4px 20px ${entry.color}60)`,
                        opacity: 1
                      }}
                    />
                  ))}
                </Pie>
                <Tooltip content={<CustomTooltip />} />
              </PieChart>
            </ResponsiveContainer>
          </div>

          {/* Floating Mini Stats */}
          <div className="absolute top-1/2 left-[70%] sm:left-[75%] -translate-y-1/2 space-y-1 sm:space-y-1.5 hidden sm:block">
            {getOverviewChartData().map((entry, index) => (
              <div
                key={index}
                className="relative flex items-center space-x-3 bg-gradient-to-r from-gray-900/80 via-gray-800/60 to-gray-900/80 backdrop-blur-2xl border border-white/20 rounded-2xl px-4 py-2.5 hover:scale-105 hover:border-white/30 transition-all duration-500 group overflow-hidden"
                style={{
                  boxShadow: `0 1px 3px ${entry.color}20, inset 0 1px 0 rgba(255,255,255,0.1)`
                }}
              >
                {/* Animated background glow */}
                <div
                  className="absolute inset-0 opacity-0 group-hover:opacity-20 transition-opacity duration-500 rounded-2xl"
                  style={{
                    background: `radial-gradient(circle at 50% 50%, ${entry.color}60, transparent 70%)`
                  }}
                />

                {/* Glowing dot with pulse animation */}
                <div className="relative">
                  <div
                    className="w-4 h-4 rounded-full flex-shrink-0 group-hover:scale-125 transition-all duration-300 animate-pulse"
                    style={{
                      backgroundColor: entry.color,
                      boxShadow: `0 0 15px ${entry.color}80, 0 0 30px ${entry.color}40`
                    }}
                  />
                  <div
                    className="absolute inset-0 w-4 h-4 rounded-full opacity-30 group-hover:scale-150 group-hover:opacity-10 transition-all duration-500"
                    style={{
                      backgroundColor: entry.color,
                      filter: 'blur(4px)'
                    }}
                  />
                </div>

                {/* Text content with better hierarchy */}
                <div className="flex items-center space-x-2 relative z-10">
                  <span
                    className="text-sm font-bold tracking-wide group-hover:text-white transition-colors duration-300"
                    style={{ color: entry.color }}
                  >{entry.name}</span>
                  <div className="w-px h-4 bg-white/20"></div>
                  <span className="text-white text-sm font-extrabold">{entry.value}</span>
                  <span className="text-gray-300 text-xs font-medium bg-white/10 px-2 py-0.5 rounded-full">
                    {entry.percentage}%
                  </span>
                </div>
              </div>
            ))}

            {/* Total Counter */}
            <div className="relative mt-3 flex items-center justify-center bg-gradient-to-r from-purple-600/60 via-blue-600/60 to-purple-600/60 backdrop-blur-2xl border border-purple-400/30 rounded-2xl px-4 py-2 hover:scale-105 transition-all duration-500 group overflow-hidden">
              {/* Shimmer effect */}
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000 skew-x-12"></div>

              <span className="text-purple-200 text-xs font-medium mr-2 relative z-10">TOTAL</span>
              <div className="w-px h-4 bg-white/30 relative z-10"></div>
              <span className="text-white text-lg font-black ml-2 relative z-10 tracking-wider">{overallStats.total}</span>
            </div>
          </div>

          {/* Mobile Stats - Below Overview Chart */}
          <div className="sm:hidden mt-6 space-y-2">
            {getOverviewChartData().map((entry, index) => (
              <div
                key={index}
                className="flex items-center justify-between bg-card/30 backdrop-blur-sm border border-border/30 rounded-lg px-3 py-2"
              >
                <div className="flex items-center space-x-2">
                  <div
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: entry.color }}
                  />
                  <span className="text-sm font-medium text-foreground">{entry.name}</span>
                </div>
                <div className="flex items-center space-x-2">
                  <span className="text-sm font-bold text-foreground">{entry.value}</span>
                  <span className="text-xs text-muted-foreground">({entry.percentage}%)</span>
                </div>
              </div>
            ))}
            <div className="flex items-center justify-between bg-gradient-to-r from-purple-600/20 to-blue-600/20 border border-purple-400/30 rounded-lg px-3 py-2 mt-3">
              <span className="text-sm font-medium text-purple-200">Total</span>
              <span className="text-lg font-bold text-white">{overallStats.total}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
} 