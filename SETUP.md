# RAD (Risk Analysis Dashboard)

A modern web application for portfolio management, risk analysis, and AI-powered insights.

## System Overview

RAD is a full-stack application that combines:
- Frontend: React + TypeScript + Vite
- Backend: FastAPI (Python)
- Database: Snowflake
- Market Data: Alpaca API

### Key Features
- Real-time portfolio tracking
- Risk metrics visualization
- AI-powered market insights
- Multi-custodian support
- Excel-based position ingestion
- Interactive dashboards

## Prerequisites

- Python 3.8+
- Node.js 18+ (for Lovable)
- Snowflake account with credentials
- Alpaca API account (for market data)

## Backend Setup

1. **Navigate to backend directory:**
   ```bash
   cd backend
   ```

2. **Create and configure environment variables:**
   ```bash
   cp .env.example .env
   ```
   
   Edit `.env` with your actual credentials:
   - Snowflake: Account, User, Password, Warehouse, Database, Schema
   - Alpaca: API Key and Secret Key

3. **Install Python dependencies:**
   ```bash
   pip install -r requirements.txt
   ```

4. **Run the backend server:**
   ```bash
   # Make sure you have app.py in the backend directory
   uvicorn app:app --reload --port 8000
   ```

   The backend should now be running at `http://localhost:8000`

## Frontend Setup

1. **Create frontend environment file:**
   ```bash
   cp .env.local.example .env.local
   ```

2. **Configure backend URL in `.env.local`:**
   ```
   VITE_BACKEND_URL=http://localhost:8000
   ```

3. **The Lovable preview will automatically connect to your backend!**

## Verify Connection

1. Open the Lovable preview
2. Click "I am a Portfolio Manager" or "I am a Custodian"
3. Try uploading an Excel file (for Custodian view)
4. Check that data loads correctly in the dashboard

## Troubleshooting

### Backend not responding (404 errors)
- Ensure the backend is running: `uvicorn app:app --reload --port 8000`
- Check that `app.py` exists in the backend directory
- Verify the backend is running on port 8000

### CORS errors
- Make sure your backend has CORS configured to allow requests from the Lovable domain
- Check that `main_app` in your `app.py` has CORS middleware configured

### Data not loading
- Check browser console for errors
- Verify your Snowflake credentials in `.env`
- Ensure tables exist in Snowflake (POSITIONS, CLIENTS, PRICES)

## API Endpoints Reference

The frontend calls these backend endpoints:

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/ingest-positions` | POST | Upload Excel/CSV files |
| `/api/analyze-portfolio` | POST | Get portfolio analysis |
| `/api/portfolio-insights` | POST | Get AI insights |
| `/api/clients` | GET | List clients |
| `/api/clients` | POST | Create client |
| `/api/positions` | GET | Get positions |
| `/api/market-data` | GET | Get market data |
