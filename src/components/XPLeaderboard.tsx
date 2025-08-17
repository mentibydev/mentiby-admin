'use client'

import { useState, useEffect, useCallback } from 'react'
import { Trophy, RefreshCw, Crown, Medal, Award, Zap, Clock, Users, Search, Filter, Phone, Copy, X } from 'lucide-react'
import { createClient } from '@supabase/supabase-js'
import { LeaderboardEntry } from '@/types'
import { cn } from '@/lib/utils'

interface FilterOptions {
  cohortType: string
  cohortNumber: string
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export default function XPLeaderboard() {
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([])
  const [filteredLeaderboard, setFilteredLeaderboard] = useState<LeaderboardEntry[]>([])
  const [filters, setFilters] = useState<FilterOptions>({
    cohortType: '',
    cohortNumber: ''
  })
  const [searchTerm, setSearchTerm] = useState('')
  const [showFilters, setShowFilters] = useState(false)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [lastUpdated, setLastUpdated] = useState<string>('')
  const [error, setError] = useState<string>('')
  const [updateProgress, setUpdateProgress] = useState({ current: 0, total: 0 })
  const [autoRetryStatus, setAutoRetryStatus] = useState<{
    active: boolean
    nextRetryMinutes: number
    processed: number
    remaining: number
    total: number
    countdownSeconds: number
  } | null>(null)
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
      setSelectedRows(new Set(filteredLeaderboard.map(row => row.enrollment_id)))
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

  const fetchLeaderboard = useCallback(async (showLoading = true) => {
    try {
      if (showLoading) setLoading(true)
      setError('')

      console.log('🔍 Fetching XP leaderboard...')
      const { data, error: supabaseError } = await supabase
        .from('student_xp')
        .select('*')
        .order('xp', { ascending: false })
        .order('last_updated', { ascending: true }) // Secondary sort by update time

      if (supabaseError) {
        console.error('❌ Supabase error:', supabaseError)
        throw supabaseError
      }

      console.log('📊 Fetched XP data:', data)
      console.log(`📈 Records count: ${data?.length || 0}`)

      const formattedData: LeaderboardEntry[] = (data || []).map((entry, index) => ({
        rank: index + 1,
        enrollment_id: entry.enrollment_id,
        full_name: entry.full_name,
        email: entry.email,
        cohort_type: entry.cohort_type,
        cohort_number: entry.cohort_number,
        xp: entry.xp,
        last_updated: entry.last_updated
      }))

      console.log('✅ Setting leaderboard data:', formattedData)
      setLeaderboard(formattedData)
      if (data && data.length > 0) {
        setLastUpdated(new Date().toLocaleString())
      }
    } catch (err) {
      console.error('❌ Error fetching leaderboard:', err)
      setError(err instanceof Error ? err.message : 'Failed to fetch leaderboard')
    } finally {
      setLoading(false)
    }
  }, [])

  // Apply filters and search to leaderboard data
  useEffect(() => {
    let filtered = [...leaderboard]

    // Apply cohort type filter
    if (filters.cohortType) {
      filtered = filtered.filter(entry => entry.cohort_type === filters.cohortType)
    }

    // Apply cohort number filter
    if (filters.cohortNumber) {
      filtered = filtered.filter(entry =>
        entry.cohort_number.includes(filters.cohortNumber)
      )
    }

    // Apply search filter
    if (searchTerm) {
      filtered = filtered.filter(entry =>
        Object.values(entry).some(value =>
          String(value).toLowerCase().includes(searchTerm.toLowerCase())
        )
      )
    }

    setFilteredLeaderboard(filtered)
  }, [leaderboard, filters, searchTerm])

  // Real-time subscription with debouncing
  useEffect(() => {
    let debounceTimer: NodeJS.Timeout
    let isSubscribed = true

    const channel = supabase
      .channel('student_xp_changes')
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'student_xp' },
        (payload) => {
          console.log('📡 Real-time update received:', payload.eventType)
          // Only refresh if component is still mounted and not already loading
          if (isSubscribed && !loading) {
            clearTimeout(debounceTimer)
            debounceTimer = setTimeout(() => {
              if (isSubscribed) {
                fetchLeaderboard(false)
              }
            }, 2000) // Increased debounce time to 2 seconds
          }
        }
      )
      .subscribe()

    return () => {
      isSubscribed = false
      clearTimeout(debounceTimer)
      supabase.removeChannel(channel)
    }
  }, [fetchLeaderboard, loading])

  const updateXPData = useCallback(async () => {
    try {
      setRefreshing(true)
      setError('')
      setUpdateProgress({ current: 0, total: 0 })

      const response = await fetch('/api/update-xp?secret=mb_xp_update_secret_2025')

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const result = await response.json()

      if (result.success) {
        // Update progress display
        setUpdateProgress({ 
          current: result.results.processed, 
          total: result.results.totalUsers 
        })

        // Handle auto-retry status
        if (result.autoRetry && result.autoRetry.scheduled) {
          const delayMs = result.autoRetry.delayMinutes * 60 * 1000
          
          setAutoRetryStatus({
            active: true,
            nextRetryMinutes: result.autoRetry.delayMinutes,
            processed: result.results.processed,
            remaining: result.autoRetry.remainingUsers,
            total: result.results.totalUsers,
            countdownSeconds: result.autoRetry.delayMinutes * 60
          })
          
          // Auto-trigger retry after delay
          console.log(`🔗 Auto-retry URL will be: /api/update-xp?secret=mb_xp_update_secret_2025&startFrom=${result.autoRetry.nextStartIndex}`)
          
          setTimeout(async () => {
            console.log(`🔄 Auto-retry triggered for remaining ${result.autoRetry.remainingUsers} users from index ${result.autoRetry.nextStartIndex}`)
            try {
              setRefreshing(true)
              setAutoRetryStatus(null) // Clear status during retry
              
              const nextIndex = result.autoRetry.nextStartIndex
              console.log(`🔍 DEBUG: nextStartIndex = ${nextIndex} (type: ${typeof nextIndex})`)
              
              if (nextIndex === null || nextIndex === undefined || isNaN(nextIndex)) {
                throw new Error(`Invalid nextStartIndex: ${nextIndex}`)
              }
              
              const retryUrl = `/api/update-xp?secret=mb_xp_update_secret_2025&startFrom=${nextIndex}`
              console.log(`🌐 Fetching: ${retryUrl}`)
              
              const retryResponse = await fetch(retryUrl)
              
              if (retryResponse.ok) {
                const retryResult = await retryResponse.json()
                console.log('Auto-retry completed:', retryResult)
                
                // Update progress
                setUpdateProgress({ 
                  current: retryResult.results.processed, 
                  total: retryResult.results.totalUsers 
                })
                
                // Refresh leaderboard
                await fetchLeaderboard(false)
                setLastUpdated(new Date().toLocaleString())
                
                // If there are still remaining users, show manual option
                if (retryResult.results.remaining > 0) {
                  setError(`Processed ${retryResult.results.processed}/${retryResult.results.totalUsers} users. ${retryResult.results.remaining} remaining. Click Refresh XP again to continue.`)
                }
              } else {
                throw new Error(`Auto-retry failed with status ${retryResponse.status}`)
              }
            } catch (error) {
              console.error('Auto-retry failed:', error)
              setError('Auto-retry failed: ' + (error instanceof Error ? error.message : 'Unknown error'))
            } finally {
              setRefreshing(false)
            }
          }, delayMs)
        } else {
          setAutoRetryStatus(null)
        }

        // Refresh leaderboard after update
        await fetchLeaderboard(false)
        setLastUpdated(new Date().toLocaleString())
        
        // Show success message with progress info
        if (result.results.remaining > 0) {
          setError('') // Clear any previous errors
          console.log(result.message)
        }
      } else {
        throw new Error(result.error || 'XP update failed')
      }
    } catch (err) {
      console.error('Error updating XP:', err)
      setError(err instanceof Error ? err.message : 'Failed to update XP data')
    } finally {
      setRefreshing(false)
      setUpdateProgress({ current: 0, total: 0 })
    }
  }, [fetchLeaderboard])

  // Initial load
  useEffect(() => {
    fetchLeaderboard()
  }, [fetchLeaderboard])

  // Separate effect for 24h auto-update check (only runs once after initial load)
  useEffect(() => {
    if (leaderboard.length === 0) return // Wait for data to load

    const checkAutoUpdate = () => {
      const lastUpdate = new Date(leaderboard[0]?.last_updated || 0)
      const now = new Date()
      const hoursSinceUpdate = (now.getTime() - lastUpdate.getTime()) / (1000 * 60 * 60)

      if (hoursSinceUpdate >= 24) {
        updateXPData()
      }
    }

    // Only check once, 3 seconds after data loads
    const timer = setTimeout(checkAutoUpdate, 3000)
    return () => clearTimeout(timer)
  }, [leaderboard.length > 0 ? leaderboard[0]?.last_updated : null, updateXPData])

  const getRankIcon = (rank: number) => {
    switch (rank) {
      case 1:
        return <Crown className="w-6 h-6 text-yellow-400" />
      case 2:
        return <Medal className="w-6 h-6 text-gray-400" />
      case 3:
        return <Award className="w-6 h-6 text-amber-600" />
      default:
        return <Trophy className="w-5 h-5 text-muted-foreground" />
    }
  }

  const getRankStyle = (rank: number) => {
    switch (rank) {
      case 1:
        return "gradient-gold glow-gold text-white"
      case 2:
        return "gradient-silver glow-silver text-white"
      case 3:
        return "gradient-bronze glow-bronze text-white"
      default:
        return "bg-muted/30 hover:bg-muted/50 text-foreground"
    }
  }

  const formatXP = (xp: number) => {
    if (xp >= 1000000) return `${(xp / 1000000).toFixed(1)}M`
    if (xp >= 1000) return `${(xp / 1000).toFixed(1)}K`
    return xp.toString()
  }

  const LoadingAnimation = () => (
    <div className="flex flex-col items-center justify-center py-16 space-y-6">
      <div className="relative">
        <div className="w-16 h-16 border-4 border-purple-200 border-t-purple-500 rounded-full animate-spin" />
        <Zap className="w-6 h-6 text-purple-500 absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2" />
      </div>
      <div className="text-center space-y-2">
        <p className="text-lg font-semibold gradient-text">Fetching XP Data</p>
        <p className="text-sm text-muted-foreground">Loading student leaderboard...</p>
        {updateProgress.total > 0 && (
          <p className="text-xs text-purple-400">
            Processing {updateProgress.current} of {updateProgress.total} students
          </p>
        )}
      </div>
    </div>
  )

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl sm:text-3xl font-bold gradient-text flex items-center gap-3">
            <Trophy className="w-8 h-8 text-yellow-400" />
            Student XP Leaderboard
          </h1>
          <p className="text-sm text-muted-foreground">
            Rankings based on Codedamn platform experience points
          </p>
        </div>

        <div className="flex items-center gap-3">
          {lastUpdated && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Clock className="w-4 h-4" />
              <span>Updated: {lastUpdated}</span>
            </div>
          )}
          
          {/* Auto-retry Status */}
          {autoRetryStatus && (
            <div className="flex items-center gap-2 text-xs bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 px-3 py-1 rounded-full border border-amber-200 dark:border-amber-800">
              <RefreshCw className="w-3 h-3 animate-spin" />
              <span>
                Auto-retry in {Math.ceil(autoRetryStatus.countdownSeconds / 60)}min ({autoRetryStatus.processed}/{autoRetryStatus.total} users, {autoRetryStatus.remaining} remaining)
              </span>
            </div>
          )}

          {/* Progress Display */}
          {updateProgress.total > 0 && updateProgress.current < updateProgress.total && !refreshing && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Users className="w-4 h-4" />
              <span>Progress: {updateProgress.current}/{updateProgress.total} users</span>
            </div>
          )}
          
          <div className="flex gap-2">
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={cn(
                "flex items-center gap-2 px-3 py-2 rounded-lg transition-colors font-medium text-sm",
                showFilters
                  ? "bg-purple-600 text-white"
                  : "bg-muted/50 hover:bg-muted/70 text-foreground"
              )}
            >
              <Filter className="w-4 h-4" />
              Filters
            </button>
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
            <button
              onClick={() => fetchLeaderboard(true)}
              disabled={loading}
              className="flex items-center gap-2 px-3 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded-lg transition-colors font-medium text-sm"
            >
              <RefreshCw className={cn("w-4 h-4", loading && "animate-spin")} />
              Reload
            </button>
            <button
              onClick={updateXPData}
              disabled={refreshing || loading || autoRetryStatus?.active}
              className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:bg-purple-400 text-white rounded-lg transition-colors font-medium"
            >
              <RefreshCw className={cn("w-4 h-4", (refreshing || autoRetryStatus?.active) && "animate-spin")} />
              {refreshing 
                ? updateProgress.total > 0 
                  ? `Updating... (${updateProgress.current}/${updateProgress.total})`
                  : 'Updating...'
                : autoRetryStatus?.active 
                  ? 'Auto-retry scheduled'
                  : 'Refresh XP'
              }
            </button>
          </div>
        </div>
      </div>

      {/* Filters */}
      {showFilters && (
        <div className="bg-card/50 backdrop-blur-xl border border-border/50 rounded-xl sm:rounded-2xl p-4 sm:p-6 space-y-4">
          <h3 className="text-lg font-semibold gradient-text">Filters</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Cohort Type
              </label>
              <select
                value={filters.cohortType}
                onChange={(e) => setFilters(prev => ({ ...prev, cohortType: e.target.value }))}
                className="w-full px-4 py-3 bg-input/50 backdrop-blur-sm border border-border/50 rounded-xl text-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
              >
                <option value="">All Types</option>
                {cohortTypes.map(type => (
                  <option key={type} value={type}>{type}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Cohort Number
              </label>
              <input
                type="text"
                placeholder="e.g., 1.0, 2.0"
                value={filters.cohortNumber}
                onChange={(e) => setFilters(prev => ({ ...prev, cohortNumber: e.target.value }))}
                className="w-full px-4 py-3 bg-input/50 backdrop-blur-sm border border-border/50 rounded-xl text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Search
              </label>
              <div className="relative">
                <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Search all fields..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-12 pr-4 py-3 bg-input/50 backdrop-blur-sm border border-border/50 rounded-xl text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Stats Cards */}
      {!loading && filteredLeaderboard.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
          <div className="bg-muted/30 rounded-xl p-4">
            <div className="flex items-center gap-3">
              <Users className="w-5 h-5 text-blue-400" />
              <div>
                <p className="text-sm text-muted-foreground">
                  {filters.cohortType || filters.cohortNumber || searchTerm ? 'Filtered' : 'Total'} Students
                </p>
                <p className="text-2xl font-bold text-blue-400">{filteredLeaderboard.length}</p>
                {(filters.cohortType || filters.cohortNumber || searchTerm) && (
                  <p className="text-xs text-muted-foreground">of {leaderboard.length} total</p>
                )}
              </div>
            </div>
          </div>
          <div className="bg-muted/30 rounded-xl p-4">
            <div className="flex items-center gap-3">
              <Crown className="w-5 h-5 text-yellow-400" />
              <div>
                <p className="text-sm text-muted-foreground">Top XP</p>
                <p className="text-2xl font-bold text-yellow-400">
                  {filteredLeaderboard[0] ? formatXP(filteredLeaderboard[0].xp) : '0'}
                </p>
              </div>
            </div>
          </div>
          <div className="bg-muted/30 rounded-xl p-4">
            <div className="flex items-center gap-3">
              <Zap className="w-5 h-5 text-purple-400" />
              <div>
                <p className="text-sm text-muted-foreground">Avg XP</p>
                <p className="text-2xl font-bold text-purple-400">
                  {filteredLeaderboard.length > 0
                    ? formatXP(Math.round(filteredLeaderboard.reduce((sum, entry) => sum + entry.xp, 0) / filteredLeaderboard.length))
                    : '0'
                  }
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4">
          <p className="text-red-400 text-sm">{error}</p>
        </div>
      )}

      {/* Loading State */}
      {loading && <LoadingAnimation />}

      {/* Leaderboard */}
      {!loading && filteredLeaderboard.length > 0 && (
        <div className="bg-card/50 backdrop-blur-xl rounded-2xl border border-border/50 overflow-hidden">
          <div className="overflow-x-auto">
            <div className="min-w-full">
              {/* Header */}
              <div className="flex items-center gap-4 p-4 border-b border-border/50 bg-muted/20 text-sm font-semibold text-muted-foreground">
                {showPhoneCopyMode && (
                  <div className="w-8 flex-shrink-0 flex items-center">
                    <input
                      type="checkbox"
                      checked={selectedRows.size === filteredLeaderboard.length && filteredLeaderboard.length > 0}
                      onChange={(e) => handleSelectAll(e.target.checked)}
                      className="w-4 h-4 text-primary bg-transparent border-border rounded focus:ring-primary focus:ring-2"
                    />
                  </div>
                )}
                <div className="w-16 flex-shrink-0">Rank</div>
                <div className="w-32 flex-shrink-0">ID</div>
                <div className="flex-1 min-w-0">Name</div>
                <div className="w-24 flex-shrink-0">Cohort</div>
                <div className="w-20 flex-shrink-0">Batch</div>
                <div className="w-24 flex-shrink-0 text-right">XP</div>
              </div>

              {/* Leaderboard Entries */}
              <div className="space-y-1 p-2">
                {filteredLeaderboard.map((entry, index) => (
                  <div
                    key={entry.email}
                    className={cn(
                      "flex items-center gap-4 p-4 rounded-xl transition-all duration-300 hover:scale-[1.01]",
                      getRankStyle(index + 1)
                    )}
                  >
                    {showPhoneCopyMode && (
                      <div className="w-8 flex-shrink-0 flex items-center">
                        <input
                          type="checkbox"
                          checked={selectedRows.has(entry.enrollment_id)}
                          onChange={(e) => handleRowSelect(entry.enrollment_id, e.target.checked)}
                          className="w-4 h-4 text-primary bg-transparent border-border rounded focus:ring-primary focus:ring-2"
                        />
                      </div>
                    )}
                    <div className="w-16 flex-shrink-0 flex items-center gap-2">
                      {getRankIcon(index + 1)}
                      <span className="font-bold">{index + 1}</span>
                    </div>

                    <div className="w-32 flex-shrink-0 font-mono text-sm">
                      {entry.enrollment_id}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="font-semibold truncate">{entry.full_name}</div>
                      <div className="text-xs opacity-70 truncate">{entry.email}</div>
                    </div>

                    <div className="w-24 flex-shrink-0">
                      <span className="px-2 py-1 bg-background/20 rounded-lg text-xs font-medium">
                        {entry.cohort_type}
                      </span>
                    </div>

                    <div className="w-20 flex-shrink-0">
                      <span className="px-2 py-1 bg-background/20 rounded-lg text-xs font-medium">
                        {entry.cohort_number}
                      </span>
                    </div>

                    <div className="w-24 flex-shrink-0 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Zap className="w-4 h-4 text-yellow-400" />
                        <span className="font-bold text-lg">{formatXP(entry.xp)}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Empty State */}
      {!loading && leaderboard.length === 0 && !error && (
        <div className="text-center py-16 space-y-4">
          <Trophy className="w-16 h-16 text-muted-foreground mx-auto" />
          <div>
            <h3 className="text-lg font-semibold text-muted-foreground">No XP Data Available</h3>
            <p className="text-sm text-muted-foreground mt-2">
              Click &quot;Refresh XP&quot; to fetch the latest data from Codedamn.
            </p>
          </div>
        </div>
      )}

      {/* No Results State */}
      {!loading && leaderboard.length > 0 && filteredLeaderboard.length === 0 && (
        <div className="text-center py-16 space-y-4">
          <Search className="w-16 h-16 text-muted-foreground mx-auto" />
          <div>
            <h3 className="text-lg font-semibold text-muted-foreground">No Results Found</h3>
            <p className="text-sm text-muted-foreground mt-2">
              Try adjusting your filters or search term to find students.
            </p>
            <div className="flex justify-center gap-2 mt-4">
              <button
                onClick={() => {
                  setFilters({ cohortType: '', cohortNumber: '' })
                  setSearchTerm('')
                }}
                className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors font-medium text-sm"
              >
                Clear All Filters
              </button>
            </div>
          </div>
        </div>
      )}

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