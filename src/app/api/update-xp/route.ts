import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { CodedamnXPResponse } from '@/types'

// Set maximum duration for this function (5 minutes)
export const maxDuration = 300; // 300 seconds = 5 minutes

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// Rate limiting state
let lastFetchTime = 0
const RATE_LIMIT_DELAY = 5 * 60 * 1000 // 5 minutes in milliseconds
const REQUEST_DELAY = 1000 // 1 second to avoid Codedamn API rate limits

export async function GET(request: NextRequest) {
  try {
    // Check authentication: either secret or Vercel cron
    const { searchParams } = new URL(request.url)
    const secret = searchParams.get('secret')
    const userAgent = request.headers.get('user-agent') || ''
    const isVercelCron = userAgent.includes('vercel-cron')
    const startFromParam = searchParams.get('startFrom')
    let startFrom = 0
    
    if (startFromParam && startFromParam !== 'null' && startFromParam !== 'undefined') {
      const parsed = parseInt(startFromParam)
      if (!isNaN(parsed) && parsed >= 0) {
        startFrom = parsed
      }
    }

    // Allow if it's a Vercel cron request OR if secret matches
    if (!isVercelCron && secret !== process.env.CRON_SECRET) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const isRetry = startFrom > 0
    console.log(`🔍 DEBUG: Raw startFrom = "${startFromParam}", parsed = ${startFrom}, isNaN = ${isNaN(startFrom)}`)
    console.log(isVercelCron ? 'Starting XP update (Vercel Cron)...' : 
               isRetry ? `Starting XP update (Auto-retry from user ${startFrom + 1})...` : 
               'Starting XP update (Manual)...')

    // Fetch all users from onboarding table
    const { data: users, error: usersError } = await supabase
      .from('onboarding')
      .select('EnrollmentID, "Full Name", Email, "Cohort Type", "Cohort Number"')

    if (usersError) {
      console.error('Error fetching users:', usersError)
      throw usersError
    }

    if (!users || users.length === 0) {
      return NextResponse.json({ message: 'No users found' }, { status: 200 })
    }

    const totalUsers = users.length
    const usersToProcess = users.slice(startFrom) // Start from specified index
    console.log(`Found ${totalUsers} total users, processing ${usersToProcess.length} users (starting from user ${startFrom + 1})`)
    console.log(`🔍 DEBUG: users.slice(${startFrom}) = ${usersToProcess.length} users`)
    if (startFrom > 0 && usersToProcess.length > 0) {
      console.log(`🔍 DEBUG: First user to process: ${usersToProcess[0].Email}`)
    }

    const results = {
      success: 0,
      failed: 0,
      rateLimited: 0,
      errors: [] as string[],
      processed: startFrom, // Start from previous progress
      remaining: totalUsers - startFrom,
      totalUsers,
      startedFrom: startFrom,
      rateLimitReached: false
    }

    const startTime = Date.now()

    // Process users with rate limiting
    for (let i = 0; i < usersToProcess.length; i++) {
      const user = usersToProcess[i]
      const globalIndex = startFrom + i // Global user index

      try {
        // Log progress every 10 users and first/last user
        if (i % 10 === 0 || i === usersToProcess.length - 1) {
          console.log(`Processing user ${globalIndex + 1}/${totalUsers}: ${user.Email}`)
        }

        // Fetch XP from Codedamn API with timeout
        const controller = new AbortController()
        const timeout = setTimeout(() => controller.abort(), 30000) // 30 second timeout

        const xpResponse = await fetch('https://backend.codedamn.com/api/public/get-user-xp', {
          method: 'POST',
          headers: {
            'FERMION-API-KEY': process.env.FERMION_API_KEY!,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            data: [{
              data: {
                identifier: {
                  type: 'user-email',
                  userEmail: user.Email
                }
              }
            }]
          }),
          signal: controller.signal
        })
        
        clearTimeout(timeout)

        if (!xpResponse.ok) {
          const errorText = await xpResponse.text()
          console.error(`Codedamn API error for ${user.Email}: ${xpResponse.status} - ${errorText}`)
          throw new Error(`HTTP error! status: ${xpResponse.status} - ${errorText}`)
        }

        const xpData: CodedamnXPResponse[] = await xpResponse.json()

        if (!xpData || !xpData[0] || xpData[0].output.status !== 'ok') {
          const errorMessage = xpData?.[0]?.output?.errorMessage || 'User not found on Codedamn'
          
          // Check for rate limit error
          if (errorMessage.includes('Too many requests') || errorMessage.includes('rate limit')) {
            console.log(`🚨 Rate limit detected at user ${globalIndex + 1}/${totalUsers}. Exiting gracefully to cool down.`)
            results.rateLimited++
            results.rateLimitReached = true
            results.errors.push(`Rate limit reached at user ${globalIndex + 1}. Processed ${results.processed}/${totalUsers} users.`)
            break // Exit immediately to allow cooldown
          }
          
          console.warn(`No XP data for ${user.Email}:`, errorMessage)
          // Skip this user - don't count as failed since they might not have a Codedamn account
          console.log(`Skipping ${user.Email} - no Codedamn account or XP data`)
          results.processed++
          results.remaining--
          continue
        }

        const xp = xpData[0].output.data?.cumulativeXpAllTime || 0

        // Upsert XP data to Supabase
        const { error: upsertError } = await supabase
          .from('student_xp')
          .upsert(
            {
              enrollment_id: user.EnrollmentID,
              email: user.Email,
              full_name: user['Full Name'],
              cohort_type: user['Cohort Type'],
              cohort_number: user['Cohort Number'],
              xp: xp,
              last_updated: new Date().toISOString()
            },
            {
              onConflict: 'email',
              ignoreDuplicates: false
            }
          )

        if (upsertError) {
          console.error(`Error upserting XP for ${user.Email}:`, upsertError)
          results.failed++
          results.errors.push(`${user.Email}: Database error`)
          continue
        }

        console.log(`Successfully updated XP for ${user.Email}: ${xp}`)
        results.success++
        results.processed++
        results.remaining--

        // Check if we're approaching timeout (leave 30 seconds buffer)
        const elapsed = (Date.now() - startTime) / 1000
        if (elapsed > 270) { // 4.5 minutes
          console.log(`Approaching timeout, processed ${results.processed}/${totalUsers} users`)
          break
        }

        // Add delay between requests to avoid rate limiting
        if (i < usersToProcess.length - 1) {
          await new Promise(resolve => setTimeout(resolve, REQUEST_DELAY))
        }

      } catch (error) {
        console.error(`Error processing ${user.Email}:`, error)
        results.failed++
        results.processed++
        results.remaining--
        
        // Handle abort timeout
        if (error instanceof Error && error.name === 'AbortError') {
          results.errors.push(`${user.Email}: Request timeout (30s)`)
          console.log('Request timeout detected, continuing with next user...')
          continue
        }
        
        // Handle 529 errors specifically
        if (error instanceof Error && error.message.includes('529')) {
          results.errors.push(`${user.Email}: Codedamn API 529 error`)
          console.log('529 error detected, waiting 2 minutes before continuing...')
          await new Promise(resolve => setTimeout(resolve, 120000)) // 2 minutes
          continue
        }
        
        results.errors.push(`${user.Email}: ${error instanceof Error ? error.message : 'Unknown error'}`)

        // If it's a rate limit error, wait longer
        if (error instanceof Error && error.message.includes('rate limit')) {
          console.log('Rate limit detected, waiting 5 minutes...')
          results.rateLimited++
          await new Promise(resolve => setTimeout(resolve, RATE_LIMIT_DELAY))
        }

        // Check timeout after error handling too
        const elapsed = (Date.now() - startTime) / 1000
        if (elapsed > 270) { // 4.5 minutes
          console.log(`Approaching timeout after error, processed ${results.processed}/${totalUsers} users`)
          break
        }
      }
    }

    // Update last fetch time
    lastFetchTime = Date.now()

    const executionTime = (lastFetchTime - startTime) / 1000 // Convert to seconds

    console.log(`XP update process completed in ${executionTime}s:`, results)

    const hasRemainingUsers = results.remaining > 0
    const needsRetry = hasRemainingUsers && (results.rateLimitReached || results.processed < totalUsers)
    
    // Schedule auto-retry if needed (5-minute cooldown for rate limits, 1 minute for timeouts)
    const retryDelay = results.rateLimitReached ? 5 * 60 * 1000 : 60 * 1000 // 5 min or 1 min
    let retryScheduled = false
    
    if (needsRetry) {
      const nextStartIndex = results.processed
      
      console.log(`📅 Auto-retry needed for remaining ${results.remaining} users (starting from user ${nextStartIndex + 1})`)
      console.log(`🔗 Retry URL: ${request.nextUrl.origin}/api/update-xp?secret=${secret}&startFrom=${nextStartIndex}`)
      console.log(`🔍 DEBUG: nextStartIndex = ${nextStartIndex} (type: ${typeof nextStartIndex})`)
      
      retryScheduled = true
    }

    const message = hasRemainingUsers 
      ? results.rateLimitReached 
        ? `XP update paused due to rate limit. Processed ${results.processed}/${totalUsers} users. Auto-retry will continue from user ${results.processed + 1}.`
        : `XP update partially completed. Processed ${results.processed}/${totalUsers} users. Auto-retry will continue from user ${results.processed + 1}.`
      : 'XP update completed successfully'

    return NextResponse.json({
      success: true,
      message,
      results,
      executionTimeSeconds: executionTime,
      timestamp: new Date().toISOString(),
      autoRetry: {
        scheduled: retryScheduled,
        delayMinutes: retryDelay / 60000,
        nextStartIndex: needsRetry && results.processed !== undefined ? results.processed : null,
        remainingUsers: results.remaining
      }
    })

  } catch (error) {
    console.error('XP update process failed:', error)
    return NextResponse.json(
      {
        error: 'Failed to update XP',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  return GET(request)
} 