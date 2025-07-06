'use client'

import { useState } from 'react'
import { Search, Filter, ArrowLeft, ClipboardList, Users, BookOpen } from 'lucide-react'
import { StuData } from '@/types'

export default function AttendanceRecords() {
  const [currentView, setCurrentView] = useState<'filter' | 'records'>('filter')
  const [cohortType, setCohortType] = useState('')
  const [cohortNumber, setCohortNumber] = useState('')
  const [attendanceData, setAttendanceData] = useState<StuData[]>([])
  const [filteredData, setFilteredData] = useState<StuData[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const cohortTypes = ['Basic', 'Placement', 'MERN', 'Full Stack']

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!cohortType || !cohortNumber) return

    setIsLoading(true)
    setError(null)

    try {
      const response = await fetch(
        `/api/attendance-records?cohort_type=${encodeURIComponent(cohortType)}&cohort_number=${encodeURIComponent(cohortNumber)}`
      )

      if (!response.ok) {
        throw new Error('Failed to fetch attendance records')
      }

      const result = await response.json()

      if (result.success) {
        setAttendanceData(result.data)
        setFilteredData(result.data)
        setCurrentView('records')
      } else {
        throw new Error(result.error || 'Failed to fetch records')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setIsLoading(false)
    }
  }

  const handleSearch = (searchValue: string) => {
    setSearchTerm(searchValue)
    if (!searchValue.trim()) {
      setFilteredData(attendanceData)
      return
    }

    const filtered = attendanceData.filter(record =>
      Object.values(record).some(value =>
        String(value || '').toLowerCase().includes(searchValue.toLowerCase())
      )
    )
    setFilteredData(filtered)
  }

  const handleViewDifferentBatch = () => {
    setCurrentView('filter')
    setCohortType('')
    setCohortNumber('')
    setAttendanceData([])
    setFilteredData([])
    setSearchTerm('')
    setError(null)
  }

  if (currentView === 'filter') {
    return (
      <div className="h-full flex flex-col">
        {/* Header */}
        <div className="flex items-center space-x-4 mb-8">
          <div className="w-12 h-12 gradient-blue rounded-xl flex items-center justify-center glow-blue">
            <ClipboardList className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-bold gradient-text">Attendance Records</h1>
            <p className="text-muted-foreground">Filter and view student attendance statistics</p>
          </div>
        </div>

        {/* Filter Form */}
        <div className="max-w-2xl mx-auto w-full">
          <div className="bg-card/50 backdrop-blur-xl border border-border/50 rounded-2xl p-8">
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="text-center mb-6">
                <Filter className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
                <h2 className="text-2xl font-bold text-foreground mb-2">Select Cohort</h2>
                <p className="text-muted-foreground">Choose the cohort to view attendance records</p>
              </div>

              {/* Cohort Type */}
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  <BookOpen className="w-4 h-4 inline mr-2" />
                  Cohort Type
                </label>
                <select
                  value={cohortType}
                  onChange={(e) => setCohortType(e.target.value)}
                  required
                  className="w-full px-4 py-3 bg-input/50 backdrop-blur-sm border border-border/50 rounded-xl text-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                >
                  <option value="">Select cohort type</option>
                  {cohortTypes.map(type => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
                </select>
              </div>

              {/* Cohort Number */}
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  <Users className="w-4 h-4 inline mr-2" />
                  Cohort Number
                </label>
                <input
                  type="text"
                  value={cohortNumber}
                  onChange={(e) => setCohortNumber(e.target.value)}
                  placeholder="e.g., 1.0, 2.0, 3.0"
                  required
                  className="w-full px-4 py-3 bg-input/50 backdrop-blur-sm border border-border/50 rounded-xl text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                />
              </div>

              {/* Error Display */}
              {error && (
                <div className="p-4 bg-destructive/10 border border-destructive/20 rounded-xl">
                  <p className="text-destructive text-sm">{error}</p>
                </div>
              )}

              {/* Submit Button */}
              <button
                type="submit"
                disabled={isLoading || !cohortType || !cohortNumber}
                className="w-full px-6 py-3 gradient-blue text-white rounded-xl font-medium transition-all duration-300 hover:scale-105 glow-blue disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
              >
                {isLoading ? (
                  <div className="flex items-center justify-center space-x-2">
                    <div className="w-4 h-4 animate-spin border-2 border-white border-t-transparent rounded-full" />
                    <span>Loading Records...</span>
                  </div>
                ) : (
                  'View Attendance Records'
                )}
              </button>
            </form>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-4">
          <div className="w-12 h-12 gradient-blue rounded-xl flex items-center justify-center glow-blue">
            <ClipboardList className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-bold gradient-text">Attendance Records</h1>
            <p className="text-muted-foreground">
              {cohortType} {cohortNumber} - {filteredData.length} students
            </p>
          </div>
        </div>

        {/* View Different Batch Button */}
        <button
          onClick={handleViewDifferentBatch}
          className="px-4 py-2 bg-muted/50 hover:bg-muted/70 text-foreground rounded-xl font-medium transition-all duration-300 flex items-center space-x-2 hover:scale-105"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>View Different Batch</span>
        </button>
      </div>

      {/* Search Bar */}
      <div className="mb-6">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => handleSearch(e.target.value)}
            placeholder="Search attendance records..."
            className="w-full pl-10 pr-4 py-3 bg-input/50 backdrop-blur-sm border border-border/50 rounded-xl text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
          />
        </div>
      </div>

      {/* Records Table */}
      <div className="flex-1 overflow-hidden">
        <div className="bg-card/30 backdrop-blur-xl border border-border/50 rounded-2xl overflow-hidden h-full">
          <div className="overflow-auto h-full">
            {filteredData.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center p-8">
                <ClipboardList className="w-16 h-16 text-muted-foreground mb-4" />
                <h3 className="text-xl font-semibold text-foreground mb-2">No Records Found</h3>
                <p className="text-muted-foreground">
                  {searchTerm ? 'No records match your search criteria.' : 'No attendance records found for this cohort.'}
                </p>
              </div>
            ) : (
              <table className="w-full">
                <thead className="bg-muted/30 sticky top-0 z-10">
                  <tr>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-foreground whitespace-nowrap">Enrollment ID</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-foreground whitespace-nowrap">Name</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-foreground whitespace-nowrap">Total Classes</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-foreground whitespace-nowrap">Present</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-foreground whitespace-nowrap">Attendance %</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-foreground whitespace-nowrap">Last Updated</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/30">
                  {filteredData.map((record) => (
                    <tr key={record.enrollment_id} className="hover:bg-muted/20 transition-colors">
                      <td className="px-4 py-3 text-sm font-medium text-purple-400 font-mono font-semibold">
                        {record.enrollment_id}
                      </td>
                      <td className="px-4 py-3 text-sm text-foreground">
                        {record.name}
                      </td>
                      <td className="px-4 py-3 text-sm text-muted-foreground">
                        {record.total_classes}
                      </td>
                      <td className="px-4 py-3 text-sm text-green-400">
                        {record.present_classes}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        <span
                          className={`font-medium ${record.overall_attendance >= 75
                              ? 'text-green-400'
                              : record.overall_attendance >= 50
                                ? 'text-yellow-400'
                                : 'text-red-400'
                            }`}
                        >
                          {record.overall_attendance.toFixed(1)}%
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-muted-foreground">
                        {record.updated_at
                          ? new Date(record.updated_at).toLocaleDateString()
                          : 'N/A'
                        }
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </div>
  )
} 