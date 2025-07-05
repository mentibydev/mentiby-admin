import { NextRequest, NextResponse } from 'next/server'
import { writeFile, unlink } from 'fs/promises'
import { join } from 'path'
import { spawn } from 'child_process'

export async function POST(request: NextRequest) {
  try {
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
      // Create a temporary file
      const bytes = await file.arrayBuffer()
      const buffer = Buffer.from(bytes)
      
      // Generate a unique filename
      const timestamp = Date.now()
      const tempFileName = `attendance_${timestamp}.csv`
      const tempFilePath = join(process.cwd(), 'temp', tempFileName)
      
      // Ensure temp directory exists
      const { mkdir } = await import('fs/promises')
      try {
        await mkdir(join(process.cwd(), 'temp'), { recursive: true })
      } catch (e) {
        // Directory might already exist
      }
      
      // Write the file
      await writeFile(tempFilePath, buffer)

      // Call the Python script
      const pythonScriptPath = join(process.cwd(), 'attendance_processor.py')
      
      const result = await new Promise<string>((resolve, reject) => {
        const python = spawn('python3', [
          pythonScriptPath,
          tempFilePath,
          cohortType,
          cohortNumber,
          subject,
          date,
          teacherName
        ])

        let output = ''
        let errorOutput = ''

        python.stdout.on('data', (data) => {
          output += data.toString()
        })

        python.stderr.on('data', (data) => {
          errorOutput += data.toString()
        })

        python.on('close', (code) => {
          if (code === 0) {
            resolve(output)
          } else {
            reject(new Error(`Python script failed with code ${code}: ${errorOutput}`))
          }
        })

        python.on('error', (error) => {
          reject(new Error(`Failed to start Python script: ${error.message}`))
        })
      })

      // Clean up the temporary file
      try {
        await unlink(tempFilePath)
      } catch (e) {
        console.warn('Failed to delete temporary file:', e)
      }

      // Parse the result
      let processResult
      try {
        processResult = JSON.parse(result)
      } catch (e) {
        throw new Error(`Invalid JSON response from Python script: ${result}`)
      }

      // Check if there was an error in processing
      if (processResult.error) {
        return NextResponse.json(
          { error: processResult.error },
          { status: 400 }
        )
      }

      // Return success result
      return NextResponse.json({
        success: true,
        message: 'Attendance processed successfully',
        ...processResult
      })

    } catch (error) {
      console.error('Processing error:', error)
      return NextResponse.json(
        { 
          error: error instanceof Error ? error.message : 'Unknown processing error',
          details: 'Failed to process attendance file'
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