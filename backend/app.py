#!/usr/bin/env python3
"""
Flask Backend Service for MentiBy Admin
Provides API endpoints for attendance processing
"""

import os
import tempfile
import json
import logging
import threading
import time
from datetime import datetime
from flask import Flask, request, jsonify
from flask_cors import CORS
from werkzeug.utils import secure_filename
from attendance_processor import AttendanceProcessor

# Setup logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

app = Flask(__name__)

# Configure CORS to allow localhost and Vercel domains
# Using permissive CORS for now since regex patterns can be problematic
CORS(app, origins="*", supports_credentials=False)

# Configure upload settings
UPLOAD_FOLDER = tempfile.gettempdir()
ALLOWED_EXTENSIONS = {'csv'}
MAX_CONTENT_LENGTH = 16 * 1024 * 1024  # 16MB max file size

app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER
app.config['MAX_CONTENT_LENGTH'] = MAX_CONTENT_LENGTH

# Global flags for keep-alive mechanism
keep_alive_active = True
keep_alive_paused = False

def keep_alive_task():
    """Background task that runs every 5 minutes to keep the backend alive"""
    global keep_alive_active, keep_alive_paused
    
    while keep_alive_active:
        # Wait for 5 minutes (300 seconds)
        for _ in range(300):  # Check every second for pause/stop signals
            if not keep_alive_active:
                return
            time.sleep(1)
        
        # If not paused, log current time to keep backend alive
        if not keep_alive_paused:
            current_time = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
            logger.info(f"Keep-alive heartbeat: {current_time}")

def start_keep_alive():
    """Start the keep-alive background thread"""
    global keep_alive_active
    keep_alive_active = True
    thread = threading.Thread(target=keep_alive_task, daemon=True)
    thread.start()
    logger.info("Keep-alive mechanism started - will log heartbeat every 5 minutes")

def pause_keep_alive():
    """Pause the keep-alive mechanism"""
    global keep_alive_paused
    keep_alive_paused = True
    logger.info("Keep-alive mechanism paused")

def resume_keep_alive():
    """Resume the keep-alive mechanism"""
    global keep_alive_paused
    keep_alive_paused = False
    logger.info("Keep-alive mechanism resumed")

def allowed_file(filename):
    """Check if file extension is allowed"""
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

@app.route('/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    return jsonify({
        'status': 'healthy',
        'service': 'MentiBy Attendance Backend',
        'version': '1.0.0'
    })

@app.route('/process-attendance', methods=['POST'])
def process_attendance():
    """Process attendance CSV file"""
    try:
        # Pause keep-alive during CSV processing
        pause_keep_alive()
        logger.info("CSV processing started - keep-alive paused")
        
        # Validate request
        if 'csv_file' not in request.files:
            resume_keep_alive()  # Resume on error
            return jsonify({'error': 'No CSV file provided'}), 400
        
        file = request.files['csv_file']
        if file.filename == '':
            resume_keep_alive()  # Resume on error
            return jsonify({'error': 'No file selected'}), 400
        
        if not allowed_file(file.filename):
            resume_keep_alive()  # Resume on error
            return jsonify({'error': 'Only CSV files are allowed'}), 400
        
        # Get form parameters
        cohort_type = request.form.get('cohort_type', '').strip()
        cohort_number = request.form.get('cohort_number', '').strip()
        subject = request.form.get('subject', '').strip()
        class_date = request.form.get('class_date', '').strip()
        teacher_name = request.form.get('teacher_name', '').strip()
        
        # Validate required parameters
        if not all([cohort_type, cohort_number, subject, class_date, teacher_name]):
            resume_keep_alive()  # Resume on error
            return jsonify({
                'error': 'Missing required parameters',
                'required': ['cohort_type', 'cohort_number', 'subject', 'class_date', 'teacher_name']
            }), 400
        
        # Validate date format
        import re
        date_pattern = r'^\d{4}-\d{2}-\d{2}$'
        if not re.match(date_pattern, class_date):
            resume_keep_alive()  # Resume on error
            return jsonify({'error': 'Date must be in YYYY-MM-DD format'}), 400
        
        # Save uploaded file temporarily
        filename = secure_filename(file.filename)
        import time
        timestamp = int(time.time() * 1000)
        temp_filename = f"attendance_{timestamp}_{filename}"
        temp_file_path = os.path.join(app.config['UPLOAD_FOLDER'], temp_filename)
        
        file.save(temp_file_path)
        logger.info(f"Saved uploaded file to: {temp_file_path}")
        
        try:
            # Process the attendance file
            processor = AttendanceProcessor()
            result = processor.process_attendance_file(
                csv_file_path=temp_file_path,
                cohort_type=cohort_type,
                cohort_number=cohort_number,
                subject=subject,
                class_date=class_date,
                teacher_name=teacher_name
            )
            
            # Clean up temporary file
            try:
                os.remove(temp_file_path)
                logger.info(f"Cleaned up temporary file: {temp_file_path}")
            except Exception as e:
                logger.warning(f"Failed to clean up temporary file: {e}")
            
            # Resume keep-alive after successful processing
            logger.info("CSV processing completed successfully")
            # Wait 1 minute before resuming keep-alive
            threading.Timer(60, resume_keep_alive).start()
            logger.info("Keep-alive will resume in 1 minute")
            
            return jsonify({
                'success': True,
                'message': 'Attendance processed successfully',
                **result
            })
            
        except Exception as e:
            # Clean up temporary file on error
            try:
                os.remove(temp_file_path)
            except:
                pass
            
            logger.error(f"Processing error: {str(e)}")
            # Resume keep-alive on error
            resume_keep_alive()
            return jsonify({
                'error': str(e),
                'details': 'Failed to process attendance file'
            }), 500
        
    except Exception as e:
        logger.error(f"Request handling error: {str(e)}")
        # Resume keep-alive on error
        resume_keep_alive()
        return jsonify({
            'error': 'Internal server error',
            'details': str(e)
        }), 500

@app.route('/test-db', methods=['GET'])
def test_database():
    """Test database connection"""
    try:
        processor = AttendanceProcessor()
        # Simple test query
        result = processor.supabase.table('onboarding').select('count', count='exact').execute()
        return jsonify({
            'status': 'Database connection successful',
            'records_count': result.count if hasattr(result, 'count') else 'unknown'
        })
    except Exception as e:
        logger.error(f"Database test failed: {str(e)}")
        return jsonify({
            'error': 'Database connection failed',
            'details': str(e)
        }), 500

@app.route('/debug', methods=['GET'])
def debug_info():
    """Debug endpoint to check environment and request info"""
    return jsonify({
        'environment': {
            'PORT': os.environ.get('PORT', 'not set'),
            'FLASK_DEBUG': os.environ.get('FLASK_DEBUG', 'not set'),
            'NEXT_PUBLIC_SUPABASE_URL': os.environ.get('NEXT_PUBLIC_SUPABASE_URL', 'not set')[:50] + '...' if os.environ.get('NEXT_PUBLIC_SUPABASE_URL') else 'not set',
            'SUPABASE_SERVICE_ROLE_KEY': 'set' if os.environ.get('SUPABASE_SERVICE_ROLE_KEY') else 'not set'
        },
        'request_info': {
            'origin': request.headers.get('Origin', 'not set'),
            'user_agent': request.headers.get('User-Agent', 'not set'),
            'method': request.method
        }
    })

@app.errorhandler(413)
def request_entity_too_large(error):
    """Handle file too large error"""
    return jsonify({
        'error': 'File too large',
        'details': 'Maximum file size is 16MB'
    }), 413

@app.errorhandler(500)
def internal_server_error(error):
    """Handle internal server errors"""
    logger.error(f"Internal server error: {str(error)}")
    return jsonify({
        'error': 'Internal server error',
        'details': 'Something went wrong on our end'
    }), 500

if __name__ == '__main__':
    # Start the keep-alive mechanism
    start_keep_alive()
    
    # Get port from environment variable or default to 5000
    port = int(os.environ.get('PORT', 5000))
    debug = os.environ.get('FLASK_DEBUG', 'False').lower() == 'true'
    
    logger.info(f"Starting Flask server on port {port}")
    app.run(host='0.0.0.0', port=port, debug=debug) 