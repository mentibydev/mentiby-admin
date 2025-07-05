#!/usr/bin/env python3

import json
import os
import sys
import re
import csv
import logging
from datetime import datetime
from typing import Dict, List, Tuple, Optional
from supabase import create_client, Client
import tempfile

def handler(request):
    """Vercel serverless function handler"""
    
    if request.method != 'POST':
        return {
            'statusCode': 405,
            'body': json.dumps({'error': 'Method not allowed'})
        }
    
    try:
        # Parse request body
        body = json.loads(request.body) if hasattr(request, 'body') else request
        
        csv_content = body.get('csv_content', '')
        cohort_type = body.get('cohort_type', '')
        cohort_number = body.get('cohort_number', '')
        subject = body.get('subject', '')
        class_date = body.get('class_date', '')
        teacher_name = body.get('teacher_name', '')
        
        # Initialize processor
        processor = AttendanceProcessor()
        
        # Process attendance using content directly
        result = processor.process_attendance_content(
            csv_content, cohort_type, cohort_number, subject, class_date, teacher_name
        )
        
        return {
            'statusCode': 200,
            'body': json.dumps(result)
        }
        
    except Exception as e:
        return {
            'statusCode': 500,
            'body': json.dumps({
                'success': False,
                'error': str(e)
            })
        }

class AttendanceProcessor:
    def __init__(self):
        """Initialize Supabase client"""
        self.supabase_url = os.environ.get('NEXT_PUBLIC_SUPABASE_URL')
        self.supabase_service_key = os.environ.get('SUPABASE_SERVICE_ROLE_KEY')
        
        if not self.supabase_url or not self.supabase_service_key:
            raise ValueError("Missing Supabase configuration")
        
        self.supabase: Client = create_client(self.supabase_url, self.supabase_service_key)

    def create_table_name(self, cohort_type: str, cohort_number: str) -> str:
        """Create table name from cohort type and number"""
        cohort_clean = cohort_type.lower().replace(' ', '')
        number_clean = cohort_number.split('.')[0]  # Take only integer part (3.0 -> 3)
        table_name = f"{cohort_clean}{number_clean}_logs"
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
            
            self.supabase.rpc("exec_sql", {"sql": create_table_sql}).execute()
            return True
            
        except Exception as e:
            return False

    def parse_csv_content(self, csv_content: str) -> Tuple[Dict, List[Dict]]:
        """Parse CSV content and extract meeting info and participants"""
        meeting_info = {}
        participants = []
        
        lines = csv_content.strip().split('\n')
        
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
            if len(parts) >= 13 and parts[0]:
                name = parts[0]
                in_meeting_duration = parts[3]
                roll_number = parts[12].strip() if len(parts) > 12 else ""
                
                enrollment_id = None
                if roll_number and self.is_valid_enrollment_id(roll_number):
                    enrollment_id = roll_number
                else:
                    enrollment_id = self.extract_enrollment_id(name)
                
                if not enrollment_id:
                    continue
                
                clean_name = self.clean_name(name, enrollment_id)
                duration_minutes = self.parse_duration(in_meeting_duration)
                
                participants.append({
                    'name': clean_name,
                    'enrollment_id': enrollment_id,
                    'duration_minutes': duration_minutes
                })
        
        return meeting_info, participants

    def is_valid_enrollment_id(self, enrollment_id: str) -> bool:
        """Validate enrollment ID format"""
        if not enrollment_id or not enrollment_id.strip():
            return False
        pattern = r'^\d{2}MBY\d{4}$'
        return bool(re.match(pattern, enrollment_id.strip()))

    def extract_enrollment_id(self, name: str) -> Optional[str]:
        """Extract enrollment ID from name field"""
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
        
        if enrollment_id:
            name = re.sub(rf'\b{re.escape(enrollment_id)}\b', '', name)
        
        name = re.sub(r'\(Unverified\)', '', name)
        name = re.sub(r'\[.*?\]', '', name)
        name = re.sub(r'-\[.*?\]', '', name)
        name = re.sub(r'^\d{2}MBY\d{4}[-\s]*', '', name)
        name = re.sub(r'\s+', ' ', name).strip()
        name = name.strip('-').strip()
        
        return name

    def parse_duration(self, duration_str: str) -> int:
        """Parse duration string and return total minutes"""
        if not duration_str or duration_str.strip() == '':
            return 0
        
        duration_str = duration_str.strip()
        total_minutes = 0
        
        hour_match = re.search(r'(\d+)h', duration_str)
        minute_match = re.search(r'(\d+)m', duration_str)
        second_match = re.search(r'(\d+)s', duration_str)
        
        if hour_match:
            total_minutes += int(hour_match.group(1)) * 60
        if minute_match:
            total_minutes += int(minute_match.group(1))
        if second_match:
            total_minutes += (int(second_match.group(1)) + 59) // 60
        
        return total_minutes

    def log_attendance(self, table_name: str, participants: List[Dict], 
                      cohort_type: str, cohort_number: str, subject: str, 
                      class_date: str, teacher_name: str, meeting_duration_minutes: int) -> Dict:
        """Log attendance for all participants"""
        
        # Get the last log_id from the table
        try:
            last_log_result = self.supabase.table(table_name).select('log_id').order('log_id', desc=True).limit(1).execute()
            last_log_id = last_log_result.data[0]['log_id'] if last_log_result.data else 0
        except Exception as e:
            last_log_id = 0
        
        inserted_count = 0
        present_count = 0
        absent_count = 0
        current_log_id = last_log_id + 1
        
        try:
            for participant in participants:
                attendance = participant['duration_minutes'] >= (meeting_duration_minutes * 0.1)
                
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
            
            return {
                'inserted': inserted_count,
                'present': present_count,
                'absent': absent_count
            }
            
        except Exception as e:
            raise

    def update_stu_table(self, cohort_type: str, cohort_number: str, class_date: str, table_name: str) -> Dict:
        """Update the stu table with cumulative attendance stats"""
        try:
            onboarding_result = self.supabase.table('onboarding').select('EnrollmentID, "Full Name"').eq('"Cohort Type"', cohort_type).eq('"Cohort Number"', cohort_number).execute()
            
            if not onboarding_result.data:
                return {'updated': 0, 'errors': ['No students found in onboarding table']}
            
            attendance_result = self.supabase.table(table_name).select('enrollment_id, attendance').eq('class_date', class_date).execute()
            
            attendance_lookup = {}
            if attendance_result.data:
                for record in attendance_result.data:
                    attendance_lookup[record['enrollment_id']] = record['attendance']
            
            updated_count = 0
            errors = []
            
            for student in onboarding_result.data:
                enrollment_id = student['EnrollmentID']
                name = student['Full Name']
                
                try:
                    stu_result = self.supabase.table('stu').select('*').eq('enrollment_id', enrollment_id).execute()
                    
                    if stu_result.data:
                        current_data = stu_result.data[0]
                        new_total_classes = current_data['total_classes'] + 1
                        
                        was_present = attendance_lookup.get(enrollment_id, False)
                        new_present_classes = current_data['present_classes'] + (1 if was_present else 0)
                        
                        new_overall_attendance = (new_present_classes / new_total_classes) * 100 if new_total_classes > 0 else 0
                        
                        self.supabase.table('stu').update({
                            'total_classes': new_total_classes,
                            'present_classes': new_present_classes,
                            'overall_attendance': round(new_overall_attendance, 2),
                            'updated_at': datetime.now().isoformat()
                        }).eq('enrollment_id', enrollment_id).execute()
                        
                    else:
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
                    
                except Exception as e:
                    error_msg = f"Error updating {enrollment_id}: {str(e)}"
                    errors.append(error_msg)
            
            return {
                'updated': updated_count,
                'errors': errors
            }
            
        except Exception as e:
            raise

    def process_attendance_content(self, csv_content: str, cohort_type: str, cohort_number: str, 
                               subject: str, class_date: str, teacher_name: str) -> Dict:
        """Main function to process attendance from CSV content"""
        try:
            table_name = self.create_table_name(cohort_type, cohort_number)
            
            if not self.ensure_cohort_table_exists(table_name):
                return {
                    'success': False,
                    'error': f'Failed to create table: {table_name}'
                }
            
            meeting_info, participants = self.parse_csv_content(csv_content)
            
            if not participants:
                return {
                    'success': False,
                    'error': 'No valid participants found in CSV file'
                }
            
            attendance_result = self.log_attendance(
                table_name, participants, cohort_type, cohort_number, 
                subject, class_date, teacher_name, meeting_info.get('duration_minutes', 90)
            )
            
            stu_result = self.update_stu_table(cohort_type, cohort_number, class_date, table_name)
            
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
            return {
                'success': False,
                'error': str(e)
            }

# For local testing
if __name__ == "__main__":
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
        # Read CSV file content
        with open(csv_file_path, 'r', encoding='utf-16') as file:
            csv_content = file.read()
        
        processor = AttendanceProcessor()
        result = processor.process_attendance_content(
            csv_content, cohort_type, cohort_number, subject, class_date, teacher_name
        )
        print(json.dumps(result))
        
    except Exception as e:
        print(json.dumps({
            'success': False,
            'error': str(e)
        }))
        sys.exit(1) 