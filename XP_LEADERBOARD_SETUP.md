# XP Leaderboard System Setup Guide

## Overview
The XP Leaderboard system fetches student experience points from Codedamn and displays them in a ranked leaderboard within the MentiBY admin panel.

## Features
- **Real-time Leaderboard**: Shows students ranked by XP with live updates
- **Automatic Updates**: Updates XP data every 24 hours automatically
- **Manual Refresh**: Refresh button to update XP data on demand
- **Rate Limiting**: Handles API rate limits gracefully with 5-minute delays
- **Beautiful UI**: Trophy icons, gradients, and animations for top performers
- **Responsive Design**: Works on all screen sizes

## Components

### 1. XP Leaderboard Tab
- Added new "XP Leaderboard" tab in the sidebar
- Real-time data subscription via Supabase
- Loading animations and progress indicators
- Statistics cards showing total students, top XP, and average XP

### 2. API Route (`/api/update-xp`)
- Fetches all students from onboarding table
- Calls Codedamn API for each student's XP
- Updates/inserts data in student_xp table
- Handles rate limiting and errors gracefully
- Secured with CRON_SECRET

### 3. Database Schema
The `student_xp` table stores:
- `enrollment_id`: Student enrollment ID
- `email`: Student email (unique)
- `full_name`: Student name
- `cohort_type`: Cohort type (Basic, Placement, MERN, Full Stack)
- `cohort_number`: Cohort number
- `xp`: Experience points from Codedamn
- `last_updated`: Timestamp of last XP update
- `created_at`: Record creation timestamp

## Setup Instructions

### 1. Database Setup
Run the SQL schema in your Supabase dashboard:
```sql
-- See student_xp_schema.sql file for complete schema
```

### 2. Environment Variables
Add to `.env.local`:
```env
FERMION_API_KEY=your_codedamn_api_key
CRON_SECRET=mb_xp_update_secret_2025
```

### 3. Automatic Updates (Cron Job)
Set up a cron job at [cron-job.org](https://cron-job.org) or similar service:

**URL**: `https://your-vercel-domain.vercel.app/api/update-xp?secret=mb_xp_update_secret_2025`
**Method**: GET or POST
**Schedule**: Every 24 hours (e.g., daily at 2 AM)

Example cron expression: `0 2 * * *` (runs at 2:00 AM daily)

### 4. Manual Triggers
XP data is automatically updated when:
1. **Opening XP tab**: First time loading the leaderboard
2. **24h auto-check**: If last update was >24 hours ago
3. **Manual refresh**: Clicking the "Refresh XP" button
4. **Cron job**: Daily automated update via external cron service

## API Integration

### Codedamn API
- **Endpoint**: `https://backend.codedamn.com/api/public/get-user-xp`
- **Method**: POST
- **Headers**:
  - `FERMION-API-KEY`: Your API key
  - `Content-Type`: application/json
- **Body**:
  ```json
  {
    "data": [{
      "data": {
        "identifier": {
          "type": "user-email",
          "userEmail": "student@email.com"
        }
      }
    }]
  }
  ```

### Response Format
```json
[{
  "output": {
    "status": "ok",
    "data": {
      "cumulativeXpAllTime": 418
    }
  }
}]
```

## Rate Limiting Handling
- 1-second delay between API requests
- If rate limited, waits 5 minutes before continuing
- Shows partial leaderboard with successfully fetched data
- Automatically retries failed requests after delay

## Security
- API route secured with CRON_SECRET
- Row Level Security (RLS) enabled on student_xp table
- Service role key used for database operations
- Upsert operations prevent duplicate records

## Monitoring
- Console logs for debugging
- Error handling with user-friendly messages
- Progress indicators during bulk updates
- Success/failure statistics in API responses

## Troubleshooting

### Common Issues
1. **"No data returned"**: Check if student_xp table exists and RLS policies allow access
2. **API errors**: Verify FERMION_API_KEY is correct and has sufficient quota
3. **Rate limiting**: Normal behavior, system will wait and retry automatically
4. **Cron not working**: Check URL is correct and includes secret parameter

### Debugging
- Check browser console for API call logs
- Monitor Supabase logs for database errors
- Verify environment variables are set correctly
- Test API endpoint manually: `/api/update-xp?secret=mb_xp_update_secret_2025`

## Performance
- Indexed database queries for fast leaderboard loading
- Efficient upsert operations prevent duplicates
- Real-time subscriptions for instant updates
- Background API calls don't block UI

## Future Enhancements
- Filter leaderboard by cohort type/number
- Historical XP tracking and charts
- Achievements and badges system
- Export leaderboard data
- Email notifications for rank changes 