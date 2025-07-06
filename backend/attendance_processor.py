#!/usr/bin/env python3
"""
Attendance Processor for MentiBy Admin
Processes CSV attendance files and updates Supabase database with comprehensive logging and student tracking
"""

import os
import sys
import csv
import re
import json
import logging
from datetime import datetime
from typing import Dict, List, Optional, Tuple
from supabase import create_client, Client
from dotenv import load_dotenv

# Setup logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# Load environment variables
load_dotenv('.env.local')
load_dotenv()

class AttendanceProcessor:
    def __init__(self):
        """Initialize the attendance processor with Supabase client"""
        self.supabase_url = os.getenv('NEXT_PUBLIC_SUPABASE_URL')
        self.supabase_service_key = os.getenv('SUPABASE_SERVICE_ROLE_KEY')
        
        if not self.supabase_url or not self.supabase_service_key:
            raise ValueError("Missing Supabase credentials. Need NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY")
        
        # Initialize Supabase client with explicit options to avoid proxy issues
        try:
            self.supabase: Client = create_client(
                self.supabase_url, 
                self.supabase_service_key,
                options={
                    'schema': 'public',
                    'headers': {},
                    'auto_refresh_token': True,
                    'persist_session': True
                }
            )
            logger.info("Supabase client initialized successfully")
        except Exception as e:
            logger.error(f"Failed to initialize Supabase client: {str(e)}")
            # Fallback to basic initialization
            self.supabase: Client = create_client(self.supabase_url, self.supabase_service_key)
            logger.info("Supabase client initialized with fallback method")
    

    
    def parse_csv_file(self, csv_file_path: str) -> Tuple[Dict, List[Dict]]:
        """Parse the CSV file and extract meeting info and participants"""
        logger.info(f"Parsing CSV file: {csv_file_path}")
        
        meeting_info = {}
        participants = []
        
        # Try different encodings
        encodings = ['utf-8', 'utf-16', 'latin-1', 'cp1252']
        content = None
        
        for encoding in encodings:
            try:
                with open(csv_file_path, 'r', encoding=encoding) as file:
                    content = file.read()
                    logger.info(f"Successfully read file with {encoding} encoding")
                    break
            except UnicodeDecodeError:
                continue
        
        if content is None:
            raise ValueError("Could not read CSV file with any supported encoding")
        
        lines = content.strip().split('\n')
        
        # Extract meeting duration
        for line in lines:
            if 'Meeting duration' in line:
                parts = line.split('\t')
                if len(parts) > 1:
                    meeting_info['duration'] = parts[1].strip()
                    meeting_info['duration_minutes'] = self.parse_duration(parts[1].strip())
                break
        
        # Find participants section
        participant_section_start = -1
        for i, line in enumerate(lines):
            if 'Name' in line and 'In-Meeting Duration' in line:
                participant_section_start = i + 1
                break
        
        if participant_section_start == -1:
            raise ValueError("Could not find participants section in CSV")
        
        # Parse participants and aggregate durations by enrollment ID
        participant_durations = {}  # enrollment_id -> {'name': str, 'total_duration': int}
        
        for i in range(participant_section_start, len(lines)):
            line = lines[i].strip()
            if not line or 'In-Meeting Activities' in line:
                break
            
            parts = [part.strip() for part in line.split('\t')]
            # Only require name (index 0) and duration (index 3) - Roll Number is optional
            if len(parts) >= 4 and parts[0] and parts[3]:  
                name = parts[0]
                in_meeting_duration = parts[3]
                roll_number = parts[12].strip() if len(parts) > 12 else ""  # Roll Number is column 13 (index 12)
                
                # Use Roll Number first, fallback to extracting from name
                enrollment_id = None
                if roll_number and self.is_valid_enrollment_id(roll_number):
                    enrollment_id = roll_number
                else:
                    # Try to extract from name as fallback
                    enrollment_id = self.extract_enrollment_id(name)
                
                # Skip if no valid enrollment ID found
                if not enrollment_id:
                    logger.warning(f"No valid enrollment ID found for: {name} (Roll Number: '{roll_number}')")
                    continue
                
                clean_name = self.clean_name(name, enrollment_id)
                duration_minutes = self.parse_duration(in_meeting_duration)
                
                # Aggregate durations for same enrollment ID
                if enrollment_id in participant_durations:
                    old_duration = participant_durations[enrollment_id]['total_duration']
                    participant_durations[enrollment_id]['total_duration'] += duration_minutes
                    new_total = participant_durations[enrollment_id]['total_duration']
                    logger.info(f"AGGREGATING {enrollment_id}: {old_duration}m + {duration_minutes}m = {new_total}m total")
                else:
                    participant_durations[enrollment_id] = {
                        'name': clean_name,
                        'total_duration': duration_minutes
                    }
                    logger.info(f"NEW RECORD {enrollment_id}: {duration_minutes}m from '{in_meeting_duration}'")
        
        # Convert aggregated data to participants list
        participants = []
        for enrollment_id, data in participant_durations.items():
            participants.append({
                'name': data['name'],
                'enrollment_id': enrollment_id,
                'duration_minutes': data['total_duration']
            })
        
        logger.info(f"Found {len(participants)} unique participants with enrollment IDs (after aggregating durations)")
        return meeting_info, participants
    
    def is_valid_enrollment_id(self, enrollment_id: str) -> bool:
        """Validate enrollment ID format (2XMBYXXX like 25MBY3001)"""
        if not enrollment_id or not enrollment_id.strip():
            return False
        
        # Pattern for enrollment IDs like 25MBY3001, 24MBY2068, etc.
        pattern = r'^\d{2}MBY\d{4}$'
        return bool(re.match(pattern, enrollment_id.strip()))
    
    def extract_enrollment_id(self, name: str) -> Optional[str]:
        """Extract enrollment ID from name field"""
        # Pattern for enrollment IDs like 25MBY3004, 25MBY3031, etc.
        enrollment_pattern = r'\b(\d{2}MBY\d{4})\b'
        match = re.search(enrollment_pattern, name)
        if match:
            extracted_id = match.group(1)
            if self.is_valid_enrollment_id(extracted_id):
                return extracted_id
        return None
    
    def clean_name(self, name: str, enrollment_id: str = None) -> str:
        """Clean name by removing enrollment ID and extra text"""
        if not name:
            return ""
        
        # Remove enrollment ID from name
        if enrollment_id:
            name = re.sub(rf'\b{re.escape(enrollment_id)}\b', '', name)
        
        # Remove common patterns
        name = re.sub(r'\(Unverified\)', '', name)
        name = re.sub(r'\s+', ' ', name)
        name = name.strip()
        
        return name
    
    def parse_duration(self, duration_str: str) -> int:
        """Parse duration string and convert to minutes"""
        if not duration_str:
            return 0
        
        # Remove any extra whitespace
        duration_str = duration_str.strip()
        logger.debug(f"Parsing duration: '{duration_str}'")
        
        # Pattern for "1h 30m 20s" or "30m 15s" or "1h" or "45s" formats
        pattern = r'(?:(\d+)h)?\s*(?:(\d+)m)?\s*(?:(\d+)s)?'
        match = re.match(pattern, duration_str)
        
        if match:
            hours = int(match.group(1)) if match.group(1) else 0
            minutes = int(match.group(2)) if match.group(2) else 0
            seconds = int(match.group(3)) if match.group(3) else 0
            
            # Convert everything to minutes (with decimal precision)
            total_minutes = hours * 60 + minutes + (seconds / 60.0)
            result = round(total_minutes, 2)  # Round to 2 decimal places
            logger.debug(f"Parsed '{duration_str}' as {hours}h {minutes}m {seconds}s = {result} minutes")
            return result
        
        # If no match, try to extract any number as minutes (fallback)
        number_match = re.search(r'(\d+)', duration_str)
        if number_match:
            result = int(number_match.group(1))
            logger.debug(f"Fallback parsing '{duration_str}' as {result} minutes")
            return result
        
        logger.warning(f"Could not parse duration: '{duration_str}'")
        return 0
    
    def log_attendance(self, participants: List[Dict], 
                      cohort_type: str, cohort_number: str, subject: str, 
                      class_date: str, teacher_name: str, meeting_duration_minutes: int) -> Dict:
        """Log attendance for all participants in the attendance_logs table"""
        logger.info(f"Logging attendance for {len(participants)} participants")
        
        # Get the last log_id from the attendance_logs table
        try:
            last_log_result = self.supabase.table('attendance_logs').select('log_id').order('log_id', desc=True).limit(1).execute()
            last_log_id = last_log_result.data[0]['log_id'] if last_log_result.data else 0
            logger.info(f"Last log_id in attendance_logs: {last_log_id}")
        except Exception as e:
            logger.warning(f"Could not get last log_id from attendance_logs: {str(e)}, starting from 0")
            last_log_id = 0
        
        inserted_count = 0
        present_count = 0
        absent_count = 0
        current_log_id = last_log_id + 1
        
        try:
            # Log meeting duration and threshold
            threshold_minutes = meeting_duration_minutes * 0.1
            logger.info(f"Meeting duration: {meeting_duration_minutes}m, Attendance threshold: {threshold_minutes}m (10%)")
            
            for participant in participants:
                # Calculate attendance (present if >= 10% of meeting duration)
                duration = participant['duration_minutes']
                attendance = duration >= threshold_minutes
                status = 'Present' if attendance else 'Absent'
                
                logger.info(f"ATTENDANCE CHECK {participant['enrollment_id']}: {duration}m >= {threshold_minutes}m = {status}")
                
                # Insert attendance record
                insert_data = {
                    'log_id': current_log_id,
                    'enrollment_id': participant['enrollment_id'],
                    'cohort_type': cohort_type,
                    'cohort_number': cohort_number,
                    'subject': subject,
                    'class_date': class_date,
                    'teacher_name': teacher_name,
                    'attendance': attendance
                }
                
                self.supabase.table('attendance_logs').insert(insert_data).execute()
                current_log_id += 1
                
                inserted_count += 1
                if attendance:
                    present_count += 1
                else:
                    absent_count += 1
                
                logger.info(f"Logged: {participant['enrollment_id']} - {status}")
            
            logger.info(f"Successfully logged {inserted_count} attendance records")
            return {
                'inserted': inserted_count,
                'present': present_count,
                'absent': absent_count
            }
            
        except Exception as e:
            logger.error(f"Error logging attendance: {str(e)}")
            raise
    
    def update_stu_table(self, cohort_type: str, cohort_number: str, class_date: str) -> Dict:
        """Update the stu table with cumulative attendance stats"""
        logger.info(f"Updating stu table for {cohort_type} {cohort_number}")
        
        try:
            # Get all students from onboarding table for this cohort
            onboarding_result = self.supabase.table('onboarding').select('EnrollmentID, "Full Name"').eq('"Cohort Type"', cohort_type).eq('"Cohort Number"', cohort_number).execute()
            
            if not onboarding_result.data:
                logger.warning(f"No students found in onboarding for {cohort_type} {cohort_number}")
                return {'updated': 0, 'errors': ['No students found in onboarding table']}
            
            # Get today's attendance logs from attendance_logs table
            attendance_result = self.supabase.table('attendance_logs').select('enrollment_id, attendance').eq('class_date', class_date).eq('cohort_type', cohort_type).eq('cohort_number', cohort_number).execute()
            
            # Create attendance lookup
            attendance_lookup = {}
            if attendance_result.data:
                for record in attendance_result.data:
                    attendance_lookup[record['enrollment_id']] = record['attendance']
            
            # Get all existing students from stu table in one query (BATCH OPTIMIZATION)
            enrollment_ids = [student['EnrollmentID'] for student in onboarding_result.data]
            existing_stu_result = self.supabase.table('stu').select('*').in_('enrollment_id', enrollment_ids).execute()
            
            # Create lookup for existing students
            existing_students = {}
            if existing_stu_result.data:
                for record in existing_stu_result.data:
                    existing_students[record['enrollment_id']] = record
            
            updated_count = 0
            errors = []
            updates_to_make = []
            inserts_to_make = []
            
            # Process each student
            for student in onboarding_result.data:
                enrollment_id = student['EnrollmentID']
                name = student['Full Name']
                
                try:
                    if enrollment_id in existing_students:
                        # Student exists, prepare update
                        current_data = existing_students[enrollment_id]
                        new_total_classes = current_data['total_classes'] + 1
                        
                        # Check if student was present today
                        was_present = attendance_lookup.get(enrollment_id, False)
                        new_present_classes = current_data['present_classes'] + (1 if was_present else 0)
                        
                        # Calculate new overall attendance
                        new_overall_attendance = (new_present_classes / new_total_classes) * 100 if new_total_classes > 0 else 0
                        
                        # Add to updates batch
                        updates_to_make.append({
                            'enrollment_id': enrollment_id,
                            'total_classes': new_total_classes,
                            'present_classes': new_present_classes,
                            'overall_attendance': round(new_overall_attendance, 2),
                            'updated_at': datetime.now().isoformat()
                        })
                        
                    else:
                        # Student doesn't exist, prepare insert
                        was_present = attendance_lookup.get(enrollment_id, False)
                        present_classes = 1 if was_present else 0
                        overall_attendance = (present_classes / 1) * 100
                        
                        inserts_to_make.append({
                            'enrollment_id': enrollment_id,
                            'name': name,
                            'cohort_type': cohort_type,
                            'cohort_number': cohort_number,
                            'total_classes': 1,
                            'present_classes': present_classes,
                            'overall_attendance': round(overall_attendance, 2)
                        })
                    
                    updated_count += 1
                    
                except Exception as e:
                    error_msg = f"Error preparing update for {enrollment_id}: {str(e)}"
                    errors.append(error_msg)
                    logger.error(error_msg)
            
            # Execute batch operations
            try:
                # Handle inserts first
                if inserts_to_make:
                    logger.info(f"Inserting {len(inserts_to_make)} new student records")
                    self.supabase.table('stu').insert(inserts_to_make).execute()
                
                # Handle updates individually (Supabase doesn't support bulk updates easily)
                if updates_to_make:
                    logger.info(f"Updating {len(updates_to_make)} existing student records")
                    for update_data in updates_to_make:
                        enrollment_id = update_data.pop('enrollment_id')
                        self.supabase.table('stu').update(update_data).eq('enrollment_id', enrollment_id).execute()
                        logger.info(f"Updated stu record for: {enrollment_id}")
                
            except Exception as e:
                error_msg = f"Error executing batch operations: {str(e)}"
                errors.append(error_msg)
                logger.error(error_msg)
            
            logger.info(f"Updated {updated_count} student records in stu table")
            return {
                'updated': updated_count,
                'errors': errors
            }
            
        except Exception as e:
            logger.error(f"Error updating stu table: {str(e)}")
            raise
    
    def process_attendance_file(self, csv_file_path: str, cohort_type: str, cohort_number: str, 
                               subject: str, class_date: str, teacher_name: str) -> Dict:
        """Main function to process attendance file"""
        logger.info(f"Processing attendance file: {csv_file_path}")
        logger.info(f"Cohort: {cohort_type} {cohort_number}, Subject: {subject}, Date: {class_date}, Teacher: {teacher_name}")
        
        try:
            # Parse CSV file
            meeting_info, participants = self.parse_csv_file(csv_file_path)
            
            if not participants:
                return {
                    'success': False,
                    'error': 'No valid participants found in CSV file'
                }
            
            # Log attendance
            attendance_result = self.log_attendance(
                participants, cohort_type, cohort_number, 
                subject, class_date, teacher_name, meeting_info.get('duration_minutes', 90)
            )
            
            # Update stu table
            stu_result = self.update_stu_table(cohort_type, cohort_number, class_date)
            
            # Return success result
            return {
                'success': True,
                'message': 'Attendance processed successfully',
                'subject': subject,
                'batch': f"{cohort_type} {cohort_number}",
                'class_date': class_date,
                'processed': attendance_result['inserted'],
                'present': attendance_result['present'],
                'absent': attendance_result['absent'],
                'stu_updated': stu_result['updated'],
                'errors': stu_result.get('errors', [])
            }
            
        except Exception as e:
            logger.error(f"Error processing attendance file: {str(e)}")
            return {
                'success': False,
                'error': str(e)
            }

def main():
    """Main function to handle command line arguments and process attendance"""
    if len(sys.argv) != 7:
        print(json.dumps({
            'success': False,
            'error': 'Invalid arguments. Usage: python attendance_processor.py <csv_file> <cohort_type> <cohort_number> <subject> <date> <teacher_name>'
        }))
        sys.exit(1)
    
    csv_file_path = sys.argv[1]
    cohort_type = sys.argv[2]
    cohort_number = sys.argv[3]
    subject = sys.argv[4]
    class_date = sys.argv[5]
    teacher_name = sys.argv[6]
    
    try:
        processor = AttendanceProcessor()
        result = processor.process_attendance_file(
            csv_file_path, cohort_type, cohort_number, subject, class_date, teacher_name
        )
        print(json.dumps(result))
        
    except Exception as e:
        print(json.dumps({
            'success': False,
            'error': str(e)
        }))
        sys.exit(1)

if __name__ == "__main__":
    main() 