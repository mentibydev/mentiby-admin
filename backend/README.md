# MentiBy Admin Backend

Flask backend service for processing attendance CSV files.

## Setup

1. Install dependencies:
```bash
pip install -r requirements.txt
```

2. Set environment variables:
```bash
export NEXT_PUBLIC_SUPABASE_URL=your_supabase_url_here
export SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here
export FLASK_DEBUG=false
export PORT=5000
```

3. Run the service:
```bash
python app.py
```

## API Endpoints

- `GET /health` - Health check
- `POST /process-attendance` - Process attendance CSV file
- `GET /test-db` - Test database connection

## Deployment on Render

1. Connect your repository to Render
2. Create a new Web Service
3. Set the following:
   - **Build Command:** `pip install -r requirements.txt`
   - **Start Command:** `python app.py`
   - **Environment Variables:**
     - `NEXT_PUBLIC_SUPABASE_URL`
     - `SUPABASE_SERVICE_ROLE_KEY`
     - `FLASK_DEBUG=false`
     - `PORT=10000` (Render's default)

## Frontend Configuration

Update your frontend's environment variables:
```bash
BACKEND_URL=https://mentiby-admin.onrender.com
``` 