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
        
        self.supabase: Client = create_client(self.supabase_url, self.supabase_service_key)
        logger.info("Supabase client initialized successfully")
    
    def create_table_name(self, cohort_type: str, cohort_number: str) -> str:
        """Create table name from cohort type and number"""
        # Convert to lowercase and take only integer part of version
        cohort_clean = cohort_type.lower().replace(' ', '')
        number_clean = cohort_number.split('.')[0]  # Take only integer part (3.0 -> 3)
        table_name = f"{cohort_clean}{number_clean}_logs"
        logger.info(f"Generated table name: {table_name}")
        return table_name
    
    def ensure_cohort_table_exists(self, table_name: str) -> bool:
        """Ensure the cohort log table exists, create if not"""
        try:
            create_table_sql = f"""
            CREATE TABLE IF NOT EXISTS {table_name} (
                log_id SERIAL PRIMARY KEY,
                enrollment_id TEXT,
                cohort_type TEXT,
                cohort_number TEXT,
                subject TEXT,
                class_date DATE,
                teacher_name TEXT,
                attendance BOOLEAN,
                logged_at TIMESTAMP DEFAULT now()
            );
            """
            
            # Create table using RPC
            self.supabase.rpc("exec_sql", {"sql": create_table_sql}).execute()
            logger.info(f"Ensured table {table_name} exists")
            return True
            
        except Exception as e:
            logger.error(f"Error ensuring table exists: {str(e)}")
            return False
    
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
        
        # Parse participants
        for i in range(participant_section_start, len(lines)):
            line = lines[i].strip()
            if not line or 'In-Meeting Activities' in line:
                break
            
            parts = [part.strip() for part in line.split('\t')]
            if len(parts) >= 13 and parts[0]:  # Need at least 13 columns to have Roll Number
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
                
                participants.append({
                    'name': clean_name,
                    'enrollment_id': enrollment_id,
                    'duration_minutes': duration_minutes
                })
        
        logger.info(f"Found {len(participants)} participants with enrollment IDs")
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
        name = re.sub(r'\[.*?\]', '', name)
        name = re.sub(r'-\[.*?\]', '', name)
        name = re.sub(r'^\d{2}MBY\d{4}[-\s]*', '', name)  # Remove enrollment ID from start
        
        # Clean up spaces
        name = re.sub(r'\s+', ' ', name).strip()
        name = name.strip('-').strip()
        
        return name
    
    def parse_duration(self, duration_str: str) -> int:
        """Parse duration string and return total minutes"""
        if not duration_str or duration_str.strip() == '':
            return 0
        
        duration_str = duration_str.strip()
        total_minutes = 0
        
        # Pattern for "1h 30m 20s" or "59m 25s" or "2m 11s"
        hour_match = re.search(r'(\d+)h', duration_str)
        minute_match = re.search(r'(\d+)m', duration_str)
        second_match = re.search(r'(\d+)s', duration_str)
        
        if hour_match:
            total_minutes += int(hour_match.group(1)) * 60
        if minute_match:
            total_minutes += int(minute_match.group(1))
        if second_match:
            # Round up seconds to nearest minute
            total_minutes += (int(second_match.group(1)) + 59) // 60
        
        return total_minutes
    
    def log_attendance(self, table_name: str, participants: List[Dict], 
                      cohort_type: str, cohort_number: str, subject: str, 
                      class_date: str, teacher_name: str, meeting_duration_minutes: int) -> Dict:
        """Log attendance for all participants"""
        logger.info(f"Logging attendance for {len(participants)} participants")
        
        # Get the last log_id from the table
        try:
            last_log_result = self.supabase.table(table_name).select('log_id').order('log_id', desc=True).limit(1).execute()
            last_log_id = last_log_result.data[0]['log_id'] if last_log_result.data else 0
            logger.info(f"Last log_id in {table_name}: {last_log_id}")
        except Exception as e:
            logger.warning(f"Could not get last log_id from {table_name}: {str(e)}, starting from 0")
            last_log_id = 0
        
        inserted_count = 0
        present_count = 0
        absent_count = 0
        current_log_id = last_log_id + 1
        
        try:
            for participant in participants:
                # Calculate attendance (present if >= 10% of meeting duration)
                attendance = participant['duration_minutes'] >= (meeting_duration_minutes * 0.1)
                
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
                
                self.supabase.table(table_name).insert(insert_data).execute()
                current_log_id += 1
                
                inserted_count += 1
                if attendance:
                    present_count += 1
                else:
                    absent_count += 1
                
                logger.info(f"Logged: {participant['enrollment_id']} - {'Present' if attendance else 'Absent'}")
            
            logger.info(f"Successfully logged {inserted_count} attendance records")
            return {
                'inserted': inserted_count,
                'present': present_count,
                'absent': absent_count
            }
            
        except Exception as e:
            logger.error(f"Error logging attendance: {str(e)}")
            raise
    
    def update_stu_table(self, cohort_type: str, cohort_number: str, class_date: str, table_name: str) -> Dict:
        """Update the stu table with cumulative attendance stats"""
        logger.info(f"Updating stu table for {cohort_type} {cohort_number}")
        
        try:
            # Get all students from onboarding table for this cohort
            onboarding_result = self.supabase.table('onboarding').select('EnrollmentID, "Full Name"').eq('"Cohort Type"', cohort_type).eq('"Cohort Number"', cohort_number).execute()
            
            if not onboarding_result.data:
                logger.warning(f"No students found in onboarding for {cohort_type} {cohort_number}")
                return {'updated': 0, 'errors': ['No students found in onboarding table']}
            
            # Get today's attendance logs
            attendance_result = self.supabase.table(table_name).select('enrollment_id, attendance').eq('class_date', class_date).execute()
            
            # Create attendance lookup
            attendance_lookup = {}
            if attendance_result.data:
                for record in attendance_result.data:
                    attendance_lookup[record['enrollment_id']] = record['attendance']
            
            updated_count = 0
            errors = []
            
            # Update each student in stu table
            for student in onboarding_result.data:
                enrollment_id = student['EnrollmentID']
                name = student['Full Name']
                
                try:
                    # Check if student exists in stu table
                    stu_result = self.supabase.table('stu').select('*').eq('enrollment_id', enrollment_id).execute()
                    
                    if stu_result.data:
                        # Student exists, update
                        current_data = stu_result.data[0]
                        new_total_classes = current_data['total_classes'] + 1
                        
                        # Check if student was present today
                        was_present = attendance_lookup.get(enrollment_id, False)
                        new_present_classes = current_data['present_classes'] + (1 if was_present else 0)
                        
                        # Calculate new overall attendance
                        new_overall_attendance = (new_present_classes / new_total_classes) * 100 if new_total_classes > 0 else 0
                        
                        # Update record
                        self.supabase.table('stu').update({
                            'total_classes': new_total_classes,
                            'present_classes': new_present_classes,
                            'overall_attendance': round(new_overall_attendance, 2),
                            'updated_at': datetime.now().isoformat()
                        }).eq('enrollment_id', enrollment_id).execute()
                        
                    else:
                        # Student doesn't exist, create new record
                        was_present = attendance_lookup.get(enrollment_id, False)
                        present_classes = 1 if was_present else 0
                        overall_attendance = (present_classes / 1) * 100
                        
                        self.supabase.table('stu').insert({
                            'enrollment_id': enrollment_id,
                            'name': name,
                            'cohort_type': cohort_type,
                            'cohort_number': cohort_number,
                            'total_classes': 1,
                            'present_classes': present_classes,
                            'overall_attendance': round(overall_attendance, 2)
                        }).execute()
                    
                    updated_count += 1
                    logger.info(f"Updated stu record for: {enrollment_id}")
                    
                except Exception as e:
                    error_msg = f"Error updating {enrollment_id}: {str(e)}"
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
            # Create table name
            table_name = self.create_table_name(cohort_type, cohort_number)
            
            # Ensure table exists (create if not)
            if not self.ensure_cohort_table_exists(table_name):
                return {
                    'success': False,
                    'error': f'Failed to create table: {table_name}'
                }
            
            # Parse CSV file
            meeting_info, participants = self.parse_csv_file(csv_file_path)
            
            if not participants:
                return {
                    'success': False,
                    'error': 'No valid participants found in CSV file'
                }
            
            # Log attendance
            attendance_result = self.log_attendance(
                table_name, participants, cohort_type, cohort_number, 
                subject, class_date, teacher_name, meeting_info.get('duration_minutes', 90)
            )
            
            # Update stu table
            stu_result = self.update_stu_table(cohort_type, cohort_number, class_date, table_name)
            
            # Return success result
            return {
                'success': True,
                'message': 'Attendance processed successfully',
                'table_name': table_name,
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