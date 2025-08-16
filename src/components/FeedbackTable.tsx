'use client'

import { useState, useEffect } from 'react'
import { Search, Phone, Copy, X } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { cn } from '@/lib/utils'

// FeedbackData type for feedback table
export interface FeedbackData {
  EnrollmentID: string
  Mentor1Feedback: string
  Mentor2Feedback: string
  OverallFeedback: string
  ChallengesFaced: string
  SuggestionsToImprove: string
  OverallMentibyRating?: number
  OverallMentorRating?: number
}

interface FeedbackTableProps {
  data: FeedbackData[]
  isLoading: boolean
  onDataUpdate: () => void
}

interface EditingCell {
  rowId: string
  field: keyof FeedbackData
  value: string
  originalValue: string
}

export default function FeedbackTable({ data, isLoading, onDataUpdate }: FeedbackTableProps) {
  console.log('FeedbackTable rendered with data:', data)
  const [filteredData, setFilteredData] = useState<FeedbackData[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [filters, setFilters] = useState<{ cohort: string; batch: string }>({
    cohort: '',
    batch: ''
  })
  const [showFilters, setShowFilters] = useState(false)
  const [editingCell, setEditingCell] = useState<EditingCell | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  // Expanded cell state for universal cell expansion
  const [expandedCell, setExpandedCell] = useState<{ rowId: string; field: string } | null>(null)

  // Selection and delete mode state
  const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set())
  const [showDeleteMode, setShowDeleteMode] = useState(false)
  const [showPhoneCopyMode, setShowPhoneCopyMode] = useState(false)
  const [toastNotification, setToastNotification] = useState<{
    show: boolean
    message: string
    type: 'success' | 'error'
  }>({ show: false, message: '', type: 'success' })

  // Toast notification function
  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToastNotification({ show: true, message, type })
    setTimeout(() => {
      setToastNotification({ show: false, message: '', type: 'success' })
    }, 2000)
  }


  // Sorting function for EnrollmentID
  const sortByEnrollmentId = (a: FeedbackData, b: FeedbackData) => {
    const aMatch = a.EnrollmentID.match(/(\d{2})MBY(\d+)/)
    const bMatch = b.EnrollmentID.match(/(\d{2})MBY(\d+)/)
    if (!aMatch || !bMatch) return a.EnrollmentID.localeCompare(b.EnrollmentID)
    const aYear = parseInt(aMatch[1])
    const bYear = parseInt(bMatch[1])
    const aNum = parseInt(aMatch[2])
    const bNum = parseInt(bMatch[2])
    return aYear !== bYear ? aYear - bYear : aNum - bNum
  }

  useEffect(() => {
    let filtered = [...data]

    // Apply filters
    if (filters.cohort) {
      const inputValue = filters.cohort.trim().toLowerCase()
      filtered = filtered.filter(item => {
        const itemCohort = (item as any).Cohort?.toString().trim().toLowerCase()
        return itemCohort === inputValue || parseFloat(itemCohort) === parseFloat(inputValue)
      })
    }
    if (filters.batch) {
      const batchValue = filters.batch.toString().toLowerCase()
      filtered = filtered.filter(item => (item as any).Batch?.toString().toLowerCase().includes(batchValue))
    }
    // Apply search
    if (searchTerm) {
      filtered = filtered.filter(item =>
        Object.values(item).some(value =>
          String(value || '').toLowerCase().includes(searchTerm.toLowerCase())
        )
      )
    }

    // No manual sort by OverallMentibyRating and OverallMentorRating needed, as data is pre-sorted from Supabase query

    setFilteredData(filtered)
    // If delete mode is active, update selectedRows to remove any rows no longer present
    if (showDeleteMode) {
      setSelectedRows(prev => {
        const newSet = new Set(
          Array.from(prev).filter(id => filtered.some(row => row.EnrollmentID === id))
        )
        return newSet
      })
    }
  }, [data, searchTerm, filters, showDeleteMode])
  // Selection handlers
  const handleRowSelect = (id: string, isSelected: boolean) => {
    setSelectedRows(prev => {
      const newSet = new Set(prev)
      if (isSelected) newSet.add(id)
      else newSet.delete(id)
      return newSet
    })
  }

  const handleSelectAll = (isSelected: boolean) => {
    if (isSelected) setSelectedRows(new Set(filteredData.map(row => row.EnrollmentID)))
    else setSelectedRows(new Set())
  }

  const handleDeleteRows = async () => {
    if (selectedRows.size === 0) return
    const confirmed = confirm(`Delete ${selectedRows.size} selected record(s)?`)
    if (!confirmed) return
    try {
      const { error } = await supabase
        .from('mentibyFeedback')
        .delete()
        .in('EnrollmentID', Array.from(selectedRows))
      if (error) throw error
      setSelectedRows(new Set())
      onDataUpdate()
    } catch (error) {
      console.error('Delete failed:', error)
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

  const handleCellDoubleClick = (rowId: string, field: keyof FeedbackData, value: any) => {
    setEditingCell({
      rowId,
      field,
      value: String(value || ''),
      originalValue: String(value || '')
    })
  }

  const handleSaveEdit = async () => {
    if (!editingCell || isSaving) return
    try {
      setIsSaving(true)
      const updateValue = editingCell.value
      const { error } = await supabase
        .from('mentibyFeedback')
        .update({ [editingCell.field]: updateValue })
        .eq('EnrollmentID', editingCell.rowId)
      if (error) throw error
      setEditingCell(null)
      onDataUpdate()
    } catch (error) {
      console.error('Update failed:', error)
      if (editingCell) {
        setEditingCell(prev => prev ? { ...prev, value: prev.originalValue } : null)
      }
    } finally {
      setIsSaving(false)
    }
  }

  const handleCancelEdit = () => setEditingCell(null)

  const renderCell = (row: FeedbackData, field: keyof FeedbackData, value: any) => {
    const isEditing = editingCell?.rowId === row.EnrollmentID && editingCell?.field === field
    if (isEditing) {
      return (
        <div className="editing-cell">
          <input
            type="text"
            value={editingCell.value}
            onChange={(e) => setEditingCell(prev => prev ? { ...prev, value: e.target.value } : null)}
            onBlur={handleSaveEdit}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleSaveEdit()
              if (e.key === 'Escape') handleCancelEdit()
            }}
            autoFocus
            disabled={isSaving}
            className="w-full bg-transparent border-none outline-none text-foreground"
          />
          {isSaving && (
            <div className="absolute inset-0 bg-primary/20 rounded flex items-center justify-center">
              <div className="w-4 h-4 animate-spin border-2 border-primary border-t-transparent rounded-full" />
            </div>
          )}
        </div>
      )
    }
    return <span className="block truncate">{value || '-'}</span>
  }

  // Export data function with consistent quoting and escaping as specified
  const exportData = () => {
    if (!filteredData.length) return
    const headers = Object.keys(filteredData[0]).join(',')
    const rows = filteredData.map(row =>
      Object.values(row).map(val => `"${String(val || '').replace(/"/g, '""')}"`).join(',')
    )
    const csvContent = [headers, ...rows].join('\n')
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = 'mentiby-feedback.csv'
    link.click()
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full"></div>
      </div>
    )
  }

  return (
    <div className="space-y-4 sm:space-y-6 h-full flex flex-col">
      <div>
        <h2 className="text-xl sm:text-2xl lg:text-3xl font-bold gradient-text">Mentiby Feedback</h2>
        <p className="text-muted-foreground mt-1 text-sm">
          Showing {filteredData.length} of {data.length} feedback records
        </p>
        <div className="flex gap-2 mt-4">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`px-3 py-2 sm:px-4 sm:py-2 rounded-lg text-xs sm:text-sm font-medium transition-all duration-300 flex items-center space-x-1 sm:space-x-2 ${
              showFilters
                ? "gradient-green text-white shadow-lg glow-green"
                : "gradient-purple text-white shadow-lg glow-purple"
            }`}
          >
            Filters
          </button>
          <button
            onClick={() => {
              setShowPhoneCopyMode(!showPhoneCopyMode)
              setShowDeleteMode(false) // Hide delete mode when phone copy is active
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
          <button
            onClick={() => {
              setShowDeleteMode(!showDeleteMode)
              setShowPhoneCopyMode(false) // Hide phone copy mode when delete is active
              if (!showDeleteMode) setSelectedRows(new Set())
            }}
            className={`px-3 py-2 sm:px-4 sm:py-2 rounded-lg text-xs sm:text-sm font-medium transition-all duration-300 flex items-center space-x-1 sm:space-x-2 ${
              showDeleteMode ? "gradient-red text-white shadow-lg glow-red" : "bg-muted/50 hover:bg-muted/70 text-muted-foreground hover:text-foreground"
            }`}
          >
            Delete
          </button>
          {showPhoneCopyMode && selectedRows.size > 0 && (
            <button
              onClick={handleCopyPhoneNumbers}
              disabled={isSaving}
              className="px-3 py-2 sm:px-4 sm:py-2 bg-gradient-to-r from-purple-600 via-blue-600 to-purple-700 text-white rounded-lg text-xs sm:text-sm font-medium transition-all duration-300 flex items-center space-x-1 sm:space-x-2 hover:scale-105 shadow-lg shadow-purple-500/50 hover:shadow-purple-500/70 disabled:opacity-50"
            >
              <Copy className="w-3 h-3 sm:w-4 sm:h-4" />
              <span>Copy ({selectedRows.size})</span>
            </button>
          )}
          {showDeleteMode && selectedRows.size > 0 && (
            <button
              onClick={handleDeleteRows}
              className="px-3 py-2 sm:px-4 sm:py-2 gradient-red text-white rounded-lg text-xs sm:text-sm font-medium hover:scale-105 glow-red"
            >
              Delete ({selectedRows.size})
            </button>
          )}
          <button
            onClick={exportData}
            className="px-3 py-2 sm:px-4 sm:py-2 rounded-lg text-xs sm:text-sm font-medium bg-blue-500 text-white hover:bg-blue-600 transition-all duration-300"
          >
            Export CSV
          </button>
        </div>
        {showFilters && (
          <div className="bg-card/50 backdrop-blur-xl border border-border/50 rounded-xl sm:rounded-2xl p-4 sm:p-6 space-y-4 mt-2">
            <h3 className="text-lg font-semibold gradient-text">Filters</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">Cohort</label>
                <input
                  type="text"
                  placeholder="e.g., 1, 2 or 3.0"
                  value={filters.cohort}
                  onChange={(e) => setFilters(prev => ({ ...prev, cohort: e.target.value }))}
                  className="w-full px-4 py-3 bg-input/50 backdrop-blur-sm border border-border/50 rounded-xl text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">Batch</label>
                <input
                  type="text"
                  placeholder="e.g., Basic or Placement"
                  value={filters.batch}
                  onChange={(e) => setFilters(prev => ({ ...prev, batch: e.target.value }))}
                  className="w-full px-4 py-3 bg-input/50 backdrop-blur-sm border border-border/50 rounded-xl text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                />
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="flex-1 bg-card/50 backdrop-blur-xl border border-border/50 rounded-xl sm:rounded-2xl overflow-hidden">
        <div className="h-full overflow-auto">
          <table className="w-full table-auto">
            <thead className="bg-muted/30 sticky top-0 z-10">
              <tr>
                {(showDeleteMode || showPhoneCopyMode) && (
                  <th className="px-2 py-3 text-left text-sm font-semibold">
                    <input
                      type="checkbox"
                      checked={selectedRows.size === filteredData.length && filteredData.length > 0}
                      onChange={(e) => handleSelectAll(e.target.checked)}
                    />
                  </th>
                )}
                {[
                  { key: 'EnrollmentID', label: 'Enrollment ID' },
                  { key: 'FullName', label: 'Student Name' },
                  { key: 'Mentor1Name', label: 'Mentor 1 Name' },
                  { key: 'Mentor2Name', label: 'Mentor 2 Name' },
                  { key: 'Batch', label: 'Batch' },
                  { key: 'Cohort', label: 'Cohort' },
                  { key: 'Mentor1Feedback', label: 'Mentor 1 Feedback' },
                  { key: 'Mentor2Feedback', label: 'Mentor 2 Feedback' },
                  { key: 'OverallFeedback', label: 'Overall Feedback' },
                  { key: 'ChallengesFaced', label: 'Challenges Faced' },
                  { key: 'SuggestionsToImprove', label: 'Suggestions to Improve' },
                  { key: 'OverallMentibyRating', label: 'Overall Mentiby Rating' },
                  { key: 'OverallMentorRating', label: 'Overall Teaching Style Rating' },
                ].map((field) => (
                  <th
                    key={field.key}
                    className="px-4 py-3 text-left text-sm font-semibold whitespace-nowrap"
                  >
                    {field.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border/30">
              {filteredData.map((row) => (
                <tr key={row.EnrollmentID} className="hover:bg-muted/20">
                  {(showDeleteMode || showPhoneCopyMode) && (
                    <td className="px-2 py-3">
                      <input
                        type="checkbox"
                        checked={selectedRows.has(row.EnrollmentID)}
                        onChange={(e) => handleRowSelect(row.EnrollmentID, e.target.checked)}
                      />
                    </td>
                  )}
                  {Object.entries(row).map(([key, value]) => (
                    <td
                      key={key}
                      className={`px-4 py-3 text-sm max-w-[200px] overflow-hidden text-ellipsis whitespace-nowrap ${
                        key === 'EnrollmentID' ? 'text-orange-400 font-mono font-semibold' : ''
                      } cursor-pointer`}
                      title={String(value || '')}
                      onClick={() =>
                        setExpandedCell(
                          expandedCell?.rowId === row.EnrollmentID && expandedCell?.field === key
                            ? null
                            : { rowId: row.EnrollmentID, field: key }
                        )
                      }
                      onDoubleClick={() => handleCellDoubleClick(row.EnrollmentID, key as keyof FeedbackData, value)}
                    >
                      {expandedCell?.rowId === row.EnrollmentID && expandedCell?.field === key ? (
                        <div className="p-2 bg-muted/30 rounded whitespace-pre-wrap">{value || '-'}</div>
                      ) : (
                        renderCell(row, key as keyof FeedbackData, value)
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          {filteredData.length === 0 && (
            <div className="text-center py-16">
              <Search className="w-8 h-8 mx-auto mb-4 text-muted-foreground" />
              <p className="text-muted-foreground text-lg">No feedback found.</p>
            </div>
          )}
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