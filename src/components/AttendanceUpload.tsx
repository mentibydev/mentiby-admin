'use client'

import React, { useState, useEffect, useRef } from 'react'
import { Upload, Calendar, Book, Users, Play, CheckCircle, XCircle, AlertCircle, FileText, Download } from 'lucide-react'

interface UploadResult {
  success: boolean
  message: string
  data?: any
  error?: string
}

export default function AttendanceUpload() {
  const [cohortType, setCohortType] = useState('')
  const [cohortNumber, setCohortNumber] = useState('')
  const [subject, setSubject] = useState('')
  const [date, setDate] = useState('')
  const [teacherName, setTeacherName] = useState('')
  const [csvFile, setCsvFile] = useState<File | null>(null)
  const [isUploading, setIsUploading] = useState(false)
  const [uploadResult, setUploadResult] = useState<UploadResult | null>(null)
  const [dragActive, setDragActive] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)

  // Ref for auto-scroll to results
  const resultsRef = useRef<HTMLDivElement>(null)

  // Auto-scroll to results when upload is successful
  useEffect(() => {
    if (uploadResult?.success && resultsRef.current) {
      // Add a small delay to ensure the DOM is updated
      setTimeout(() => {
        resultsRef.current?.scrollIntoView({
          behavior: 'smooth',
          block: 'start'
        })
      }, 300)
    }
  }, [uploadResult])

  // Simulate progress animation during upload
  useEffect(() => {
    if (isUploading) {
      setUploadProgress(0)
      const interval = setInterval(() => {
        setUploadProgress(prev => {
          if (prev >= 80 && prev < 95) {
            // After 80%, increment by +1 gradually
            return prev + 1
          } else if (prev >= 95) {
            clearInterval(interval)
            return prev // Stop at current value until actual upload completes
          }
          // Simulate realistic progress with slower speeds to reach 80%
          const increment = Math.random() * 8 + 2 // Random increment between 2-10 (slower)
          return Math.min(prev + increment, 80)
        })
      }, 300) // Update every 400ms for slower animation

      return () => clearInterval(interval)
    } else {
      setUploadProgress(0)
    }
  }, [isUploading])

  const cohortTypes = [
    'Basic',
    'Placement',
    'MERN',
    'Full Stack'
  ]

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true)
    } else if (e.type === 'dragleave') {
      setDragActive(false)
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)

    const files = e.dataTransfer.files
    if (files && files[0]) {
      const file = files[0]
      if (file.type === 'text/csv' || file.name.endsWith('.csv')) {
        setCsvFile(file)
      } else {
        alert('Please upload a CSV file only')
      }
    }
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (files && files[0]) {
      const file = files[0]
      if (file.type === 'text/csv' || file.name.endsWith('.csv')) {
        setCsvFile(file)
      } else {
        alert('Please upload a CSV file only')
      }
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    // Validation
    if (!cohortType || !cohortNumber || !subject || !date || !teacherName || !csvFile) {
      alert('Please fill in all fields and select a CSV file')
      return
    }

    setIsUploading(true)
    setUploadResult(null)
    setUploadProgress(0)

    try {
      // Create FormData for file upload
      const formData = new FormData()
      formData.append('csv_file', csvFile)
      formData.append('cohort_type', cohortType)
      formData.append('cohort_number', cohortNumber)
      formData.append('subject', subject)
      formData.append('date', date)
      formData.append('teacher_name', teacherName)

      // Call the backend API endpoint (you'll need to create this)
      const response = await fetch('/api/attendance/upload', {
        method: 'POST',
        body: formData
      })

      const result = await response.json()

      // Complete the progress animation
      setUploadProgress(100)

      // Small delay to show 100% before showing results
      await new Promise(resolve => setTimeout(resolve, 500))

      if (response.ok) {
        setUploadResult({
          success: true,
          message: 'Attendance uploaded successfully!',
          data: result
        })

        // Reset form
        setCohortType('')
        setCohortNumber('')
        setSubject('')
        setDate('')
        setTeacherName('')
        setCsvFile(null)

        // Reset file input
        const fileInput = document.getElementById('csvFile') as HTMLInputElement
        if (fileInput) fileInput.value = ''

      } else {
        setUploadResult({
          success: false,
          message: 'Upload failed',
          error: result.error || 'Unknown error occurred',
          data: result // Include the result data which may contain SQL and instructions
        })
      }
    } catch (error) {
      setUploadResult({
        success: false,
        message: 'Upload failed',
        error: error instanceof Error ? error.message : 'Network error occurred'
      })
    } finally {
      setIsUploading(false)
      setUploadProgress(0)
    }
  }

  const resetForm = () => {
    setCohortType('')
    setCohortNumber('')
    setSubject('')
    setDate('')
    setTeacherName('')
    setCsvFile(null)
    setUploadResult(null)

    const fileInput = document.getElementById('csvFile') as HTMLInputElement
    if (fileInput) fileInput.value = ''
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="p-3 bg-gradient-to-br from-blue-500/20 to-purple-500/20 rounded-xl">
          <Upload className="w-6 h-6 text-blue-400" />
        </div>
        <div>
          <h2 className="text-2xl font-bold bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
            Attendance Upload
          </h2>
          <p className="text-gray-400 text-sm">
            Upload meeting attendance CSV files to track student participation
          </p>
        </div>
      </div>

      {/* Upload Form */}
      <div className="bg-black/40 backdrop-blur-xl border border-white/10 rounded-3xl p-8">
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Course Information Row */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Cohort Type */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                <Book className="w-4 h-4 inline mr-2" />
                Cohort Type
              </label>
              <select
                value={cohortType}
                onChange={(e) => setCohortType(e.target.value)}
                required
                className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500/50 transition-all duration-200"
              >
                <option value="">Select cohort type</option>
                {cohortTypes.map(type => (
                  <option key={type} value={type} className="bg-gray-800">
                    {type}
                  </option>
                ))}
              </select>
            </div>

            {/* Cohort Number */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                <Users className="w-4 h-4 inline mr-2" />
                Cohort Number
              </label>
              <input
                type="text"
                value={cohortNumber}
                onChange={(e) => setCohortNumber(e.target.value)}
                placeholder="e.g., 1.0, 2.0, 3.0"
                required
                className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500/50 transition-all duration-200"
              />
            </div>

            {/* Subject */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                <FileText className="w-4 h-4 inline mr-2" />
                Subject
              </label>
              <input
                type="text"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="e.g., Data Structures, Python"
                required
                className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500/50 transition-all duration-200"
              />
            </div>
          </div>

          {/* Date and Teacher Name Row */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Date */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                <Calendar className="w-4 h-4 inline mr-2" />
                Class Date
              </label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                required
                className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500/50 transition-all duration-200"
              />
            </div>

            {/* Teacher Name */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                <Users className="w-4 h-4 inline mr-2" />
                Teacher Name
              </label>
              <input
                type="text"
                value={teacherName}
                onChange={(e) => setTeacherName(e.target.value)}
                placeholder="e.g., Swaroop"
                required
                className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500/50 transition-all duration-200"
              />
            </div>
          </div>

          {/* File Upload Area */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              <Upload className="w-4 h-4 inline mr-2" />
              Attendance CSV File
            </label>

            <div
              className={`border-2 border-dashed rounded-2xl p-8 text-center transition-all duration-200 ${dragActive
                  ? 'border-purple-500 bg-purple-500/10'
                  : 'border-white/20 hover:border-purple-500/50 hover:bg-white/5'
                }`}
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
            >
              {csvFile ? (
                <div className="space-y-2">
                  <FileText className="w-12 h-12 text-green-400 mx-auto" />
                  <p className="text-green-400 font-medium">{csvFile.name}</p>
                  <p className="text-gray-400 text-sm">
                    {(csvFile.size / 1024).toFixed(1)} KB
                  </p>
                  <button
                    type="button"
                    onClick={() => setCsvFile(null)}
                    className="text-red-400 hover:text-red-300 text-sm underline"
                  >
                    Remove file
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  <Upload className="w-12 h-12 text-gray-400 mx-auto" />
                  <div>
                    <p className="text-gray-300 font-medium mb-1">
                      Drag and drop your CSV file here
                    </p>
                    <p className="text-gray-400 text-sm mb-4">
                      or click to browse files
                    </p>
                    <input
                      id="csvFile"
                      type="file"
                      accept=".csv"
                      onChange={handleFileChange}
                      className="hidden"
                    />
                    <label
                      htmlFor="csvFile"
                      className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white font-medium rounded-xl cursor-pointer transition-all duration-200 transform hover:scale-105"
                    >
                      <Upload className="w-4 h-4" />
                      Choose File
                    </label>
                  </div>
                  <p className="text-gray-500 text-xs">
                    Supported format: CSV files only
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-4 pt-6">
            <button
              type="submit"
              disabled={!cohortType || !cohortNumber || !subject || !date || !teacherName || !csvFile}
              className={`flex-1 max-w-xs bg-gradient-to-r from-purple-600 via-blue-600 to-teal-600 text-white font-semibold py-3 px-6 rounded-xl transition-all duration-200 transform shadow-lg flex items-center justify-center gap-2 ${isUploading
                  ? 'animate-pulse shadow-2xl shadow-purple-500/25'
                  : 'hover:from-purple-700 hover:via-blue-700 hover:to-teal-700 hover:scale-[1.02] hover:shadow-xl disabled:from-gray-600 disabled:via-gray-600 disabled:to-gray-600 disabled:scale-100 disabled:cursor-not-allowed disabled:shadow-none'
                }`}
            >
              {isUploading ? (
                <div className="flex items-center gap-3">
                  {/* Circular Progress Indicator */}
                  <div className="relative w-8 h-8">
                    {/* Background Circle */}
                    <svg className="w-8 h-8 transform -rotate-90" viewBox="0 0 32 32">
                      <circle
                        cx="16"
                        cy="16"
                        r="12"
                        fill="none"
                        stroke="rgba(255,255,255,0.2)"
                        strokeWidth="3"
                      />
                      {/* Progress Circle */}
                      <circle
                        cx="16"
                        cy="16"
                        r="12"
                        fill="none"
                        stroke="rgba(255,255,255,0.9)"
                        strokeWidth="3"
                        strokeLinecap="round"
                        strokeDasharray={`${2 * Math.PI * 12}`}
                        strokeDashoffset={`${2 * Math.PI * 12 * (1 - uploadProgress / 100)}`}
                        className="transition-all duration-300 ease-out drop-shadow-sm"
                        style={{
                          filter: 'drop-shadow(0 0 4px rgba(255,255,255,0.4))'
                        }}
                      />
                    </svg>

                    {/* Percentage Text */}
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className="text-xs font-bold text-white/90 leading-none">
                        {Math.round(uploadProgress)}
                      </span>
                    </div>
                  </div>

                  {/* Loading Text */}
                  <span className="relative">
                    Processing
                    <span className="absolute -right-4 flex">
                      <span className="animate-pulse delay-0">.</span>
                      <span className="animate-pulse delay-150">.</span>
                      <span className="animate-pulse delay-300">.</span>
                    </span>
                  </span>
                </div>
              ) : (
                <>
                  <Play className="w-5 h-5" />
                  Process Attendance
                </>
              )}
            </button>

            <button
              type="button"
              onClick={resetForm}
              className="px-6 py-3 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 text-gray-300 hover:text-white font-medium rounded-xl transition-all duration-200"
            >
              Reset
            </button>
          </div>
        </form>
      </div>

      {/* Upload Result */}
      {uploadResult && (
        <div className={`bg-black/40 backdrop-blur-xl border rounded-2xl p-6 ${uploadResult.success
            ? 'border-green-500/20'
            : 'border-red-500/20'
          }`} ref={resultsRef}>
          <div className="flex items-start gap-3">
            {uploadResult.success ? (
              <CheckCircle className="w-6 h-6 text-green-400 flex-shrink-0 mt-0.5" />
            ) : (
              <XCircle className="w-6 h-6 text-red-400 flex-shrink-0 mt-0.5" />
            )}

            <div className="flex-1">
              <h3 className={`font-semibold mb-2 ${uploadResult.success ? 'text-green-400' : 'text-red-400'
                }`}>
                {uploadResult.message}
              </h3>

              {uploadResult.error && (
                <div className="text-red-300 text-sm mb-3">
                  <p className="mb-2">{uploadResult.error}</p>
                  {/* Show SQL creation command if available from the backend */}
                  {uploadResult.data?.create_sql && (
                    <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4 mt-3">
                      <div className="flex items-center gap-2 mb-3">
                        <div className="w-8 h-8 bg-blue-500/20 rounded-lg flex items-center justify-center">
                          <span className="text-blue-400 text-lg">🔧</span>
                        </div>
                        <div>
                          <p className="text-blue-400 font-medium">Table Creation Required</p>
                          <p className="text-blue-300 text-xs">{uploadResult.data.instructions}</p>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <p className="text-blue-300 text-xs font-medium">
                          Copy this SQL and run it in Supabase Dashboard → SQL Editor:
                        </p>
                        <div className="relative">
                          <code className="block bg-black/70 p-3 rounded text-xs text-green-400 whitespace-pre-wrap border border-green-500/20">
                            {uploadResult.data.create_sql}
                          </code>
                          <button
                            onClick={() => navigator.clipboard?.writeText(uploadResult.data.create_sql)}
                            className="absolute top-2 right-2 px-2 py-1 bg-green-500/20 hover:bg-green-500/30 border border-green-500/30 rounded text-xs text-green-400 transition-colors"
                          >
                            Copy SQL
                          </button>
                        </div>

                        <div className="flex items-center gap-2 text-xs text-blue-300 mt-2">
                          <span>💡</span>
                          <span>After creating the table, try uploading again. The system will automatically add date columns.</span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Fallback for generic table errors */}
                  {uploadResult.error.includes('table') && uploadResult.error.includes('does not exist') && !uploadResult.data?.create_sql && (
                    <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 mt-2">
                      <p className="text-red-400 font-medium mb-2">🔧 Quick Fix:</p>
                      <p className="text-red-300 text-xs mb-2">
                        The course table doesn&apos;t exist. Create it in Supabase SQL Editor:
                      </p>
                      <code className="block bg-black/50 p-2 rounded text-xs text-green-400 whitespace-pre-wrap">
                        {`CREATE TABLE IF NOT EXISTS ${cohortType.toLowerCase()}${cohortNumber.replace('.', '_')} (
    id SERIAL PRIMARY KEY,
    enrollmentid VARCHAR(50) NOT NULL,
    name VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(enrollmentid)
);

ALTER TABLE ${cohortType.toLowerCase()}${cohortNumber.replace('.', '_')} DISABLE ROW LEVEL SECURITY;`}
                      </code>
                    </div>
                  )}
                </div>
              )}

              {uploadResult.success && uploadResult.data && (
                <div className="space-y-2 text-sm">
                  <div className="grid grid-cols-2 md:grid-cols-6 gap-4 p-4 bg-white/5 rounded-xl">
                    <div>
                      <p className="text-gray-400">Total Processed</p>
                      <p className="text-white font-medium">{uploadResult.data.processed || 0}</p>
                    </div>
                    <div>
                      <p className="text-gray-400">Present</p>
                      <p className="text-green-400 font-medium">{uploadResult.data.present || 0}</p>
                    </div>
                    <div>
                      <p className="text-gray-400">Absent</p>
                      <p className="text-red-400 font-medium">{uploadResult.data.absent || 0}</p>
                    </div>
                    <div>
                      <p className="text-gray-400">Subject</p>
                      <p className="text-purple-400 font-medium">{uploadResult.data.subject || 'N/A'}</p>
                    </div>
                    <div>
                      <p className="text-gray-400">Batch</p>
                      <p className="text-blue-400 font-medium">{uploadResult.data.batch || 'N/A'}</p>
                    </div>
                    <div>
                      <p className="text-gray-400">Date</p>
                      <p className="text-cyan-400 font-medium">{uploadResult.data.class_date || 'N/A'}</p>
                    </div>
                  </div>

                  {uploadResult.data.errors && uploadResult.data.errors.length > 0 && (
                    <div className="mt-4">
                      <div className="flex items-center gap-2 mb-2">
                        <AlertCircle className="w-4 h-4 text-yellow-400" />
                        <span className="text-yellow-400 text-sm font-medium">
                          Warnings ({uploadResult.data.errors.length})
                        </span>
                      </div>
                      <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-xl p-3 max-h-32 overflow-y-auto">
                        {uploadResult.data.errors.map((error: string, index: number) => (
                          <p key={index} className="text-yellow-300 text-xs mb-1">
                            {error}
                          </p>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Instructions */}
      <div className="bg-blue-500/10 border border-blue-500/20 rounded-2xl p-6">
        <div className="flex items-start gap-3">
          <AlertCircle className="w-6 h-6 text-blue-400 flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="text-blue-400 font-semibold mb-2">CSV Format Instructions</h3>
            <ul className="text-blue-300 text-sm space-y-1">
              <li>• Upload meeting attendance export CSV from Teams/Zoom</li>
              <li>• File should contain Roll Numbers and meeting duration</li>
              <li>• Ensure that you are entering the correct details in the above fields</li>
              <li>• Students with ≥10% attendance time will be marked as present</li>
              <li>• Enrollment ID == Roll Number</li>
              <li>• Roll Number should be in the format 2XMBYXXX (e.g., 25MBY3001)</li>
              <li>• If Roll Number is not present in the onboarding data, it will be skipped</li>
              <li>• Enrollment IDs and Names will be extracted automatically from onboarding data</li>
              <li>• If Roll Number is absent in roll num column or names column or not in the format, it will be skipped</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
} 