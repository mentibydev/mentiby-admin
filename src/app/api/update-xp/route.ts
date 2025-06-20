import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { CodedamnXPResponse } from '@/types'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// Rate limiting state
let lastFetchTime = 0
const RATE_LIMIT_DELAY = 5 * 60 * 1000 // 5 minutes in milliseconds
const REQUEST_DELAY = 1000 // 1 second delay between API calls to avoid rate limiting

export async function GET(request: NextRequest) {
  try {
    // Check for secret if provided
    const { searchParams } = new URL(request.url)
    const secret = searchParams.get('secret')
    
    if (secret && secret !== process.env.CRON_SECRET) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    console.log('Starting XP update process...')

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

    console.log(`Found ${users.length} users to update`)

    const results = {
      success: 0,
      failed: 0,
      rateLimited: 0,
      errors: [] as string[]
    }

    // Process users with rate limiting
    for (let i = 0; i < users.length; i++) {
      const user = users[i]
      
      try {
        console.log(`Processing user ${i + 1}/${users.length}: ${user.Email}`)

        // Fetch XP from Codedamn API
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
          })
        })

        if (!xpResponse.ok) {
          throw new Error(`HTTP error! status: ${xpResponse.status}`)
        }

        const xpData: CodedamnXPResponse[] = await xpResponse.json()
        
        if (!xpData || !xpData[0] || xpData[0].output.status !== 'ok') {
          console.warn(`No XP data for ${user.Email}:`, xpData?.[0]?.output?.errorMessage || 'User not found on Codedamn')
          // Skip this user - don't count as failed since they might not have a Codedamn account
          console.log(`Skipping ${user.Email} - no Codedamn account or XP data`)
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

        // Add delay between requests to avoid rate limiting
        if (i < users.length - 1) {
          await new Promise(resolve => setTimeout(resolve, REQUEST_DELAY))
        }

      } catch (error) {
        console.error(`Error processing ${user.Email}:`, error)
        results.failed++
        results.errors.push(`${user.Email}: ${error instanceof Error ? error.message : 'Unknown error'}`)
        
        // If it's a rate limit error, wait longer
        if (error instanceof Error && error.message.includes('rate limit')) {
          console.log('Rate limit detected, waiting 5 minutes...')
          results.rateLimited++
          await new Promise(resolve => setTimeout(resolve, RATE_LIMIT_DELAY))
        }
      }
    }

    // Update last fetch time
    lastFetchTime = Date.now()

    console.log('XP update process completed:', results)

    return NextResponse.json({
      success: true,
      message: 'XP update completed',
      results,
      timestamp: new Date().toISOString()
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