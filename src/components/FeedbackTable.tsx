'use client'

import { useState, useEffect } from 'react'
import { Search } from 'lucide-react'
import { supabase } from '@/lib/supabase'

// FeedbackData type for feedback table
export interface FeedbackData {
  EnrollmentID: string
  Mentor1Feedback: string
  Mentor2Feedback: string
  OverallFeedback: string
  ChallengesFaced: string
  SuggestionsToImprove: string
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
  const [editingCell, setEditingCell] = useState<EditingCell | null>(null)
  const [isSaving, setIsSaving] = useState(false)

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
    filtered.sort(sortByEnrollmentId)
    if (searchTerm) {
      filtered = filtered.filter(item =>
        Object.values(item).some(value =>
          String(value || '').toLowerCase().includes(searchTerm.toLowerCase())
        )
      )
    }
    setFilteredData(filtered)
  }, [data, searchTerm])

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
    return <span className="truncate">{value || '-'}</span>
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
      </div>

      <div className="flex-1 bg-card/50 backdrop-blur-xl border border-border/50 rounded-xl sm:rounded-2xl overflow-hidden">
        <div className="h-full overflow-auto">
          <table className="w-full table-auto">
            <thead className="bg-muted/30 sticky top-0 z-10">
              <tr>
                {[
                  { key: 'EnrollmentID', label: 'Enrollment ID' },
                  { key: 'FullName', label: 'Full Name' },
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
                  <th key={field.key} className="px-4 py-3 text-left text-sm font-semibold whitespace-nowrap">
                    {field.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border/30">
              {filteredData.map((row) => (
                <tr key={row.EnrollmentID} className="hover:bg-muted/20">
                  {Object.entries(row).map(([key, value]) => (
                    <td key={key} className="px-4 py-3 text-sm cursor-pointer"
                      onDoubleClick={() => handleCellDoubleClick(row.EnrollmentID, key as keyof FeedbackData, value)}>
                      {renderCell(row, key as keyof FeedbackData, value)}
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
    </div>
  )
}