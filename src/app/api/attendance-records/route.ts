import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const cohortType = searchParams.get('cohort_type')
    const cohortNumber = searchParams.get('cohort_number')

    if (!cohortType || !cohortNumber) {
      return NextResponse.json(
        { error: 'cohort_type and cohort_number are required' },
        { status: 400 }
      )
    }

    // Fetch attendance records from stu table
    const { data: stuData, error } = await supabase
      .from('stu')
      .select('*')
      .eq('cohort_type', cohortType)
      .eq('cohort_number', cohortNumber)
      .order('enrollment_id', { ascending: true })

    if (error) {
      console.error('Database error:', error)
      return NextResponse.json(
        { error: 'Failed to fetch attendance records' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      data: stuData || [],
      count: stuData?.length || 0
    })

  } catch (error) {
    console.error('API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
} 