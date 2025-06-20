#!/usr/bin/env python3
"""
Attendance Processor for MentiBy Admin
Processes CSV attendance files and updates Supabase database
"""

import os
import sys
import csv
import re
import json
import requests
from datetime import datetime
from typing import Dict, List, Tuple, Optional
import pandas as pd
from supabase import create_client, Client
from dotenv import load_dotenv

# Load environment variables from .env.local (used by Next.js)
load_dotenv('.env.local')
# Also try the default .env file as fallback
load_dotenv()

class AttendanceProcessor:
    def __init__(self):
        """Initialize the attendance processor with Supabase client"""
        self.supabase_url = os.getenv('NEXT_PUBLIC_SUPABASE_URL')
        self.supabase_key = os.getenv('NEXT_PUBLIC_SUPABASE_ANON_KEY')
        
        if not self.supabase_url or not self.supabase_key:
            raise ValueError("Missing Supabase credentials in environment variables")
        
        self.supabase: Client = create_client(self.supabase_url, self.supabase_key)
        
        # For direct SQL execution, we'll use the service role key if available
        self.service_role_key = os.getenv('SUPABASE_SERVICE_ROLE_KEY')
        if self.service_role_key:
            self.admin_supabase = create_client(self.supabase_url, self.service_role_key)
        else:
            self.admin_supabase = None
        
    def parse_duration(self, duration_str: str) -> int:
        """Parse duration string and return total minutes"""
        if not duration_str or duration_str.strip() == '':
            return 0
        
        # Handle different duration formats
        duration_str = duration_str.strip()
        total_minutes = 0
        
        # Pattern for "1h 26m 27s" or "59m 25s" or "2m 11s"
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
    
    def extract_enrollment_id(self, name: str) -> Optional[str]:
        """Extract enrollment ID from name field"""
        # Pattern for enrollment IDs like 25MBY2012, 24MBY2068
        enrollment_pattern = r'\b(\d{2}MBY\d{4})\b'
        match = re.search(enrollment_pattern, name)
        if match:
            return match.group(1)
        
        # Handle special cases like "25MBY025" -> "25MBY2025"
        special_pattern = r'\b(\d{2}MBY)(\d{1,3})\b'
        match = re.search(special_pattern, name)
        if match:
            prefix = match.group(1)
            number = match.group(2).zfill(4)  # Pad with zeros
            return f"{prefix}{number}"
        
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
        name = re.sub(r'\[.*?\]', '', name)  # Remove text in brackets
        name = re.sub(r'-\[.*?\]', '', name)  # Remove text after dash
        
        # Clean up spaces and special characters
        name = re.sub(r'\s+', ' ', name).strip()
        name = name.strip('-').strip()
        
        return name
    
    def parse_csv_file(self, csv_file_path: str) -> Tuple[Dict, List[Dict]]:
        """Parse the CSV file and extract meeting info and participants"""
        with open(csv_file_path, 'r', encoding='utf-8') as file:
            content = file.read()
        
        lines = content.strip().split('\n')
        
        # Extract meeting information
        meeting_info = {}
        participants = []
        
        # Find meeting title to extract course info
        for line in lines:
            if 'Meeting title' in line:
                parts = line.split(',')
                if len(parts) > 1:
                    meeting_info['title'] = parts[1].strip()
                break
        
        # Extract meeting duration
        for line in lines:
            if 'Meeting duration' in line:
                parts = line.split(',')
                if len(parts) > 1:
                    meeting_info['duration'] = parts[1].strip()
                break
        
        # Find participants section
        participant_section_start = -1
        for i, line in enumerate(lines):
            if 'Name,First Join,Last Leave,In-Meeting Duration' in line:
                participant_section_start = i + 1
                break
        
        if participant_section_start == -1:
            raise ValueError("Could not find participants section in CSV")
        
        # Parse participants
        for i in range(participant_section_start, len(lines)):
            line = lines[i].strip()
            if not line or line.startswith('3.') or 'In-Meeting Activities' in line:
                break
            
            parts = [part.strip() for part in line.split(',')]
            if len(parts) >= 4 and parts[0]:  # Must have name and duration
                name = parts[0]
                duration = parts[3]  # In-Meeting Duration
                
                enrollment_id = self.extract_enrollment_id(name)
                clean_name = self.clean_name(name, enrollment_id)
                
                if enrollment_id or clean_name:  # Only process if we have ID or name
                    participants.append({
                        'name': clean_name,
                        'enrollment_id': enrollment_id,
                        'duration': duration,
                        'duration_minutes': self.parse_duration(duration)
                    })
        
        return meeting_info, participants
    
    def create_table_name(self, course_type: str, cohort_number: str) -> str:
        """Create table name from course type and cohort number"""
        # Convert to lowercase and replace spaces/dots with underscores
        course_clean = re.sub(r'[^\w]', '_', course_type.lower())
        cohort_clean = re.sub(r'[^\w]', '_', cohort_number.lower())
        return f"{course_clean}{cohort_clean}"
    
    def create_table_with_sql(self, table_name: str) -> bool:
        """Create table - for now, return error message for manual creation"""
        create_table_sql = f"""CREATE TABLE IF NOT EXISTS {table_name} (
    id SERIAL PRIMARY KEY,
    enrollmentid VARCHAR(50) NOT NULL,
    name VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(enrollmentid)
);

ALTER TABLE {table_name} DISABLE ROW LEVEL SECURITY;"""
        return False
    
    def add_date_column(self, table_name: str, date_column: str) -> bool:
        """Add date column to existing table"""
        add_column_sql = f'ALTER TABLE {table_name} ADD COLUMN IF NOT EXISTS "{date_column}" VARCHAR(10) DEFAULT \'absent\';'
        
        try:
            # Method 1: Try with admin client
            if self.admin_supabase:
                try:
                    result = self.admin_supabase.rpc('exec_sql', {'sql': add_column_sql}).execute()
                    return True
                except Exception:
                    pass
            
            # Method 2: Use direct API
            headers = {
                'Authorization': f'Bearer {self.service_role_key or self.supabase_key}',
                'Content-Type': 'application/json',
                'apikey': self.service_role_key or self.supabase_key
            }
            
            rpc_url = f"{self.supabase_url}/rest/v1/rpc/exec_sql"
            response = requests.post(rpc_url, 
                                   json={'sql': add_column_sql}, 
                                   headers=headers)
            
            if response.status_code == 200:
                return True
            else:
                return False
                
        except Exception as e:
            return False
    
    def ensure_table_exists(self, table_name: str, date_column: str) -> bool:
        """Ensure the course table exists and has the required date column"""
        # First, check if table exists
        try:
            result = self.supabase.table(table_name).select("*").limit(1).execute()
            table_exists = True
            print(f"✅ Table {table_name} already exists")
        except Exception as e:
            table_exists = False
            print(f"❌ Table {table_name} does not exist: {e}")
            
            # Try to create the table
            if self.create_table_with_sql(table_name):
                table_exists = True
            else:
                print(f"❌ Could not create table {table_name}")
                return False
        
        # Now ensure the date column exists
        if table_exists:
            return self.add_date_column(table_name, date_column)
        
        return False
    
    def update_attendance(self, table_name: str, date_column: str, participants: List[Dict], meeting_duration_minutes: int) -> Dict:
        """Update attendance in the course table"""
        attendance_threshold = 0.6  # 60% threshold
        results = {
            'processed': 0,
            'present': 0,
            'absent': 0,
            'errors': [],
            'column_added': False
        }
        
        # First, try to add the date column by testing with a dummy record
        try:
            test_data = {
                'enrollmentid': 'TEST_COLUMN_CHECK',
                'name': 'Test',
                date_column: 'absent'
            }
            
            result = self.supabase.table(table_name).upsert(test_data, on_conflict='enrollmentid').execute()
            # If successful, delete the test record
            self.supabase.table(table_name).delete().eq('enrollmentid', 'TEST_COLUMN_CHECK').execute()
            results['column_added'] = True
            
        except Exception as e:
            if 'column' in str(e).lower():
                results['errors'].append(f"Date column {date_column} does not exist. Please add it manually: ALTER TABLE {table_name} ADD COLUMN \"{date_column}\" VARCHAR(10) DEFAULT 'absent';")
            else:
                pass  # Column check failed, but continuing
        
        for participant in participants:
            try:
                enrollment_id = participant['enrollment_id']
                name = participant['name']
                duration_minutes = participant['duration_minutes']
                
                # Skip if no enrollment ID and no name
                if not enrollment_id and not name:
                    continue
                
                # Calculate attendance status
                attendance_percentage = duration_minutes / meeting_duration_minutes if meeting_duration_minutes > 0 else 0
                status = 'present' if attendance_percentage >= attendance_threshold else 'absent'
                
                # Prepare data for upsert
                update_data = {
                    'enrollmentid': enrollment_id or f'UNKNOWN_{results["processed"]}',
                    'name': name or 'Unknown',
                    'updated_at': datetime.now().isoformat()
                }
                
                # Only add date column if it exists
                if results['column_added']:
                    update_data[date_column] = status
                
                # Try to find existing student in onboarding table for matching
                if not enrollment_id and name:
                    # Try to find enrollment ID by name matching
                    try:
                        onboarding_result = self.supabase.table('onboarding')\
                            .select('EnrollmentID, Name')\
                            .ilike('Name', f'%{name}%')\
                            .execute()
                        
                        if onboarding_result.data:
                            enrollment_id = onboarding_result.data[0]['EnrollmentID']
                            update_data['enrollmentid'] = enrollment_id
                    except Exception:
                        pass
                
                # Upsert attendance record
                result = self.supabase.table(table_name)\
                    .upsert(update_data, on_conflict='enrollmentid')\
                    .execute()
                
                results['processed'] += 1
                if status == 'present':
                    results['present'] += 1
                else:
                    results['absent'] += 1
                    
            except Exception as e:
                error_msg = f"Error processing {participant.get('name', 'Unknown')}: {str(e)}"
                results['errors'].append(error_msg)
        
        return results
    
    def update_overall_attendance(self) -> Dict:
        """Update overall attendance in stu table"""
        try:
            # This would require getting all course tables and calculating overall stats
            # For now, return a placeholder
            return {'message': 'Overall attendance update not implemented yet'}
        except Exception as e:
            return {'error': str(e)}
    
    def process_attendance_file(self, csv_file_path: str, course_type: str, cohort_number: str, date: str) -> Dict:
        """Main function to process attendance file"""
        try:
            # Parse CSV file
            meeting_info, participants = self.parse_csv_file(csv_file_path)
            
            # Extract meeting duration
            meeting_duration_str = meeting_info.get('duration', '0m')
            meeting_duration_minutes = self.parse_duration(meeting_duration_str)
            
            # Create table name
            table_name = self.create_table_name(course_type, cohort_number)
            
            # Check if table exists first
            try:
                result = self.supabase.table(table_name).select("*").limit(1).execute()
                table_exists = True
            except Exception as e:
                table_exists = False
                error_msg = str(e)
                
                if 'does not exist' in error_msg:
                    # Return a helpful error message with SQL to create the table
                    create_sql = f"""CREATE TABLE IF NOT EXISTS {table_name} (
    id SERIAL PRIMARY KEY,
    enrollmentid VARCHAR(50) NOT NULL,
    name VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(enrollmentid)
);

ALTER TABLE {table_name} DISABLE ROW LEVEL SECURITY;"""
                    
                    return {
                        'error': f'Table {table_name} does not exist',
                        'table_name': table_name,
                        'create_sql': create_sql,
                        'course_type': course_type,
                        'cohort_number': cohort_number,
                        'instructions': f'Please create the table {table_name} in Supabase SQL Editor using the provided SQL, then try uploading again.'
                    }
                else:
                    return {'error': f'Could not access table {table_name}: {error_msg}'}
            
            if not table_exists:
                return {'error': f'Could not create or access table {table_name}'}
            
            # Update attendance
            results = self.update_attendance(table_name, date, participants, meeting_duration_minutes)
            
            # Add summary information
            results.update({
                'table_name': table_name,
                'date': date,
                'meeting_duration_minutes': meeting_duration_minutes,
                'total_participants': len(participants),
                'course_type': course_type,
                'cohort_number': cohort_number
            })
            
            return results
            
        except Exception as e:
            return {'error': f'Processing failed: {str(e)}'}

def main():
    """Command line interface for the attendance processor"""
    if len(sys.argv) != 5:
        print("Usage: python attendance_processor.py <csv_file> <course_type> <cohort_number> <date>")
        print("Example: python attendance_processor.py attendance.csv 'Basic' '2.0' '2025-05-06'")
        sys.exit(1)
    
    csv_file = sys.argv[1]
    course_type = sys.argv[2]
    cohort_number = sys.argv[3]
    date = sys.argv[4]
    
    # Validate inputs
    if not os.path.exists(csv_file):
        print(f"Error: CSV file {csv_file} not found")
        sys.exit(1)
    
    try:
        datetime.strptime(date, '%Y-%m-%d')
    except ValueError:
        print("Error: Date must be in YYYY-MM-DD format")
        sys.exit(1)
    
    # Process attendance
    processor = AttendanceProcessor()
    result = processor.process_attendance_file(csv_file, course_type, cohort_number, date)
    
    # Output result as JSON
    print(json.dumps(result, indent=2))

if __name__ == "__main__":
    main() 