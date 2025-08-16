'use client'

import { useState } from 'react'
import { Search, Filter, ArrowLeft, ClipboardList, Users, BookOpen, Phone, Copy, X } from 'lucide-react'
import { StuData } from '@/types'
import { cn } from '@/lib/utils'
import { supabase } from '@/lib/supabase'

export default function AttendanceRecords() {
  const [currentView, setCurrentView] = useState<'filter' | 'records'>('filter')
  const [cohortType, setCohortType] = useState('')
  const [cohortNumber, setCohortNumber] = useState('')
  const [attendanceData, setAttendanceData] = useState<StuData[]>([])
  const [filteredData, setFilteredData] = useState<StuData[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set())
  const [showPhoneCopyMode, setShowPhoneCopyMode] = useState(false)
  const [toastNotification, setToastNotification] = useState<{
    show: boolean
    message: string
    type: 'success' | 'error'
  }>({ show: false, message: '', type: 'success' })

  const cohortTypes = ['Basic', 'Placement', 'MERN', 'Full Stack']

  // Toast notification function
  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToastNotification({ show: true, message, type })
    setTimeout(() => {
      setToastNotification({ show: false, message: '', type: 'success' })
    }, 2000)
  }

  const handleRowSelect = (enrollmentId: string, isSelected: boolean) => {
    setSelectedRows(prev => {
      const newSet = new Set(prev)
      if (isSelected) {
        newSet.add(enrollmentId)
      } else {
        newSet.delete(enrollmentId)
      }
      return newSet
    })
  }

  const handleSelectAll = (isSelected: boolean) => {
    if (isSelected) {
      setSelectedRows(new Set(filteredData.map(row => row.enrollment_id)))
    } else {
      setSelectedRows(new Set())
    }
  }

  const handleCopyPhoneNumbers = async () => {
    if (selectedRows.size === 0) return

    try {
      // Fetch phone numbers from onboarding table using enrollment IDs
      const { data: onboardingData, error } = await supabase
        .from('onboarding')
        .select('EnrollmentID, "Phone Number"')
        .in('EnrollmentID', Array.from(selectedRows))
      
      if (error) {
        throw new Error(`Failed to fetch phone numbers: ${error.message}`)
      }

      if (!onboardingData || onboardingData.length === 0) {
        showToast('No phone numbers found for selected records!', 'error')
        return
      }

      // Extract phone numbers (filter out empty/invalid ones)
      const phoneNumbers = onboardingData
        .map(row => row['Phone Number'])
        .filter(phone => phone && phone.trim() !== '' && phone !== '-' && !phone.includes('undefined'))
      
      if (phoneNumbers.length === 0) {
        showToast('No valid phone numbers found in selected rows!', 'error')
        return
      }

      // Join with newlines
      const phoneText = phoneNumbers.join('\n')
      
      // Copy to clipboard
      await navigator.clipboard.writeText(phoneText)
      
      // Clear selection and hide checkboxes
      setSelectedRows(new Set())
      setShowPhoneCopyMode(false)
      
      // Show success message
      showToast(`📋 Copied ${phoneNumbers.length} phone numbers to clipboard!`)
      
    } catch (error) {
      console.error('❌ Copy failed:', error)
      showToast(`Failed to copy phone numbers: ${error instanceof Error ? error.message : 'Unknown error'}`, 'error')
    }
  }

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

      {/* Search Bar and Actions */}
      <div className="mb-6 flex items-center justify-between gap-4">
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

        {/* Action Buttons */}
        <div className="flex gap-2">
          <button
            onClick={() => {
              setShowPhoneCopyMode(!showPhoneCopyMode)
              if (!showPhoneCopyMode) {
                setSelectedRows(new Set())
              }
            }}
            className={cn(
              "px-3 py-2 sm:px-4 sm:py-2 rounded-lg text-xs sm:text-sm font-medium transition-all duration-300 flex items-center space-x-1 sm:space-x-2",
              showPhoneCopyMode
                ? "bg-gradient-to-r from-purple-600 via-blue-600 to-purple-700 text-white shadow-lg shadow-purple-500/50 hover:shadow-purple-500/70 animate-pulse"
                : "bg-gradient-to-r from-purple-500/20 via-blue-500/20 to-purple-600/20 hover:from-purple-500/30 hover:via-blue-500/30 hover:to-purple-600/30 text-purple-300 hover:text-purple-100 border border-purple-500/30 hover:border-purple-400/50"
            )}
          >
            <Phone className="w-3 h-3 sm:w-4 sm:h-4" />
            <span className="hidden sm:inline">Copy Phone</span>
          </button>
          
          {showPhoneCopyMode && selectedRows.size > 0 && (
            <button
              onClick={handleCopyPhoneNumbers}
              className="px-3 py-2 sm:px-4 sm:py-2 bg-gradient-to-r from-purple-600 via-blue-600 to-purple-700 text-white rounded-lg text-xs sm:text-sm font-medium transition-all duration-300 flex items-center space-x-1 sm:space-x-2 hover:scale-105 shadow-lg shadow-purple-500/50 hover:shadow-purple-500/70"
            >
              <Copy className="w-3 h-3 sm:w-4 sm:h-4" />
              <span>Copy ({selectedRows.size})</span>
            </button>
          )}
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
                    {showPhoneCopyMode && (
                      <th className="px-2 py-3 text-left text-sm font-semibold text-foreground whitespace-nowrap w-8 sm:w-12">
                        <input
                          type="checkbox"
                          checked={selectedRows.size === filteredData.length && filteredData.length > 0}
                          onChange={(e) => handleSelectAll(e.target.checked)}
                          className="w-3 h-3 sm:w-4 sm:h-4 text-primary bg-transparent border-border rounded focus:ring-primary focus:ring-2"
                        />
                      </th>
                    )}
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
                      {showPhoneCopyMode && (
                        <td className="px-2 py-3 text-xs sm:text-sm whitespace-nowrap w-8 sm:w-12">
                          <input
                            type="checkbox"
                            checked={selectedRows.has(record.enrollment_id)}
                            onChange={(e) => handleRowSelect(record.enrollment_id, e.target.checked)}
                            className="w-3 h-3 sm:w-4 sm:h-4 text-primary bg-transparent border-border rounded focus:ring-primary focus:ring-2"
                          />
                        </td>
                      )}
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

      {/* Toast Notification */}
      {toastNotification.show && (
        <div
          className={cn(
            "fixed bottom-6 left-1/2 transform -translate-x-1/2 z-50 px-6 py-4 rounded-xl backdrop-blur-lg border transition-all duration-500 ease-out",
            "animate-in slide-in-from-bottom-4 fade-in-0",
            toastNotification.type === 'success'
              ? "bg-green-500/20 border-green-500/30 text-green-300 shadow-lg shadow-green-500/20"
              : "bg-red-500/20 border-red-500/30 text-red-300 shadow-lg shadow-red-500/20"
          )}
        >
          <div className="flex items-center space-x-3">
            {toastNotification.type === 'success' ? (
              <div className="w-5 h-5 rounded-full bg-green-500/30 flex items-center justify-center">
                <Copy className="w-3 h-3 text-green-400" />
              </div>
            ) : (
              <div className="w-5 h-5 rounded-full bg-red-500/30 flex items-center justify-center">
                <X className="w-3 h-3 text-red-400" />
              </div>
            )}
            <span className="text-sm font-medium">{toastNotification.message}</span>
          </div>
        </div>
      )}
    </div>
  )
} 