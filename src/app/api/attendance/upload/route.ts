import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    console.log('Environment variables:', {
      BACKEND_URL: process.env.BACKEND_URL,
      NODE_ENV: process.env.NODE_ENV,
      VERCEL_ENV: process.env.VERCEL_ENV
    })

    const formData = await request.formData()

    const file = formData.get('csv_file') as File
    const cohortType = formData.get('cohort_type') as string
    const cohortNumber = formData.get('cohort_number') as string
    const subject = formData.get('subject') as string
    const date = formData.get('date') as string
    const teacherName = formData.get('teacher_name') as string

    // Validate inputs
    if (!file || !cohortType || !cohortNumber || !subject || !date || !teacherName) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    // Validate file type
    if (!file.name.endsWith('.csv')) {
      return NextResponse.json(
        { error: 'Only CSV files are allowed' },
        { status: 400 }
      )
    }

    // Validate date format
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/
    if (!dateRegex.test(date)) {
      return NextResponse.json(
        { error: 'Date must be in YYYY-MM-DD format' },
        { status: 400 }
      )
    }

    try {
      // Get backend URL from environment variable
      const backendUrl = process.env.BACKEND_URL || 'http://localhost:5000'

      console.log('Backend URL:', backendUrl)
      console.log('Processing file:', file.name)

      // Create FormData for the backend request
      const backendFormData = new FormData()
      backendFormData.append('csv_file', file)
      backendFormData.append('cohort_type', cohortType)
      backendFormData.append('cohort_number', cohortNumber)
      backendFormData.append('subject', subject)
      backendFormData.append('class_date', date)
      backendFormData.append('teacher_name', teacherName)

      console.log('Calling backend with params:', {
        cohortType, cohortNumber, subject, date, teacherName
      })

      // Call the Flask backend
      const response = await fetch(`${backendUrl}/process-attendance`, {
        method: 'POST',
        body: backendFormData,
      })

      console.log('Backend response status:', response.status)
      console.log('Backend response headers:', Object.fromEntries(response.headers.entries()))

      // Check if response is ok before trying to parse JSON
      if (!response.ok) {
        const errorText = await response.text()
        console.error('Backend error response:', errorText)
        return NextResponse.json(
          {
            error: 'Backend processing failed',
            details: errorText || `HTTP ${response.status}`
          },
          { status: response.status }
        )
      }

      const responseText = await response.text()
      console.log('Backend response text:', responseText)

      let result
      try {
        result = JSON.parse(responseText)
      } catch (jsonError) {
        console.error('JSON parse error:', jsonError)
        return NextResponse.json(
          {
            error: 'Invalid JSON response from backend',
            details: `Response: ${responseText.substring(0, 200)}...`
          },
          { status: 500 }
        )
      }

      console.log('Backend response parsed successfully:', result)

      // Return success result
      return NextResponse.json(result)

    } catch (error) {
      console.error('Backend communication error:', error)
      return NextResponse.json(
        {
          error: error instanceof Error ? error.message : 'Unknown backend error',
          details: 'Failed to communicate with backend service'
        },
        { status: 500 }
      )
    }

  } catch (error) {
    console.error('Upload error:', error)
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Unknown upload error',
        details: 'Failed to handle file upload'
      },
      { status: 500 }
    )
  }
}

// Handle other HTTP methods
export async function GET() {
  return NextResponse.json(
    { message: 'Attendance upload endpoint. Use POST to upload CSV files.' },
    { status: 200 }
  )
} 