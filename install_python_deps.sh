#!/bin/bash

# Install Python Dependencies for MentiBy Attendance Processor
# Run this script to set up the Python environment for attendance processing

echo "🚀 Setting up Python dependencies for MentiBy Attendance Processor..."

# Check if Python is installed
if ! command -v python3 &> /dev/null; then
    echo "❌ Python 3 is not installed. Please install Python 3.7+ first."
    echo "   Visit: https://python.org/downloads/"
    exit 1
fi

# Check Python version
python_version=$(python3 --version 2>&1 | cut -d' ' -f2)
echo "✅ Found Python $python_version"

# Check if pip is installed
if ! command -v pip3 &> /dev/null; then
    echo "❌ pip3 is not installed. Installing pip..."
    python3 -m ensurepip --upgrade
fi

# Create virtual environment (optional but recommended)
if [ ! -d "venv" ]; then
    echo "📦 Creating virtual environment..."
    python3 -m venv venv
    echo "✅ Virtual environment created"
fi

# Activate virtual environment
echo "🔧 Activating virtual environment..."
source venv/bin/activate

# Upgrade pip
echo "📦 Upgrading pip..."
pip install --upgrade pip

# Install dependencies
echo "📦 Installing Python dependencies..."
pip install -r requirements.txt

echo ""
echo "✅ Python dependencies installed successfully!"
echo ""
echo "📋 Setup Summary:"
echo "   - Python version: $python_version"
echo "   - Virtual environment: venv/"
echo "   - Dependencies: supabase, pandas, python-dotenv, requests"
echo ""
echo "🔧 To use the attendance processor:"
echo "   1. Activate virtual environment: source venv/bin/activate"
echo "   2. Run: python attendance_processor.py <csv_file> <course_type> <cohort_number> <date>"
echo ""
echo "🌐 Or use the web interface in the Attendance Upload tab"
echo ""
echo "🎉 Ready to process attendance data!" 