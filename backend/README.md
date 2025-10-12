# RAD Portfolio Management - Python Backend

RAD (Real time Aggregated Data) gives hedge funds a live, unified view of their true positions and risk across multiple custodians, eliminating stale Excel reports and enabling instant, data-driven decisions when markets move fast.

This backend handles all data operations for the RAD Portfolio Management system.

## Features

- **Excel/CSV Ingestion**: Upload and parse portfolio position files
- **Snowflake Integration**: Store and query portfolio data
- **Alpaca API**: Real-time market data and pricing
- **LLM Analysis**: AI-powered portfolio insights and recommendations
- **RESTful API**: Clean endpoints for frontend integration

## Setup

1. Install dependencies:
```bash
pip install -r requirements.txt
```

2. Configure environment variables:
```bash
cp .env.example .env
# Edit .env with your actual Snowflake and Alpaca credentials
```

3. Run the server (requires app.py in the same directory):
```bash
uvicorn app:app --reload --port 8000
```

## API Endpoints

### Upload Portfolio Data
```
POST /api/ingest-positions
Content-Type: multipart/form-data
Body: file (Excel/CSV), clientName
```

### Analyze Portfolio
```
POST /api/analyze-portfolio
Content-Type: application/json
Body: { "clientName": "string" }
```

### Get AI Insights
```
POST /api/portfolio-insights
Content-Type: application/json
Body: { "clientName": "string" }
```

### Get Clients
```
GET /api/clients
```

### Get Positions
```
GET /api/positions?client_id=string
```

### Get Market Data
```
GET /api/market-data?ticker=string
```

## Frontend Configuration

Update the frontend to point to your backend:

1. Create `.env.local` in your Lovable project:
```
VITE_BACKEND_URL=http://localhost:8000
```

2. For production, update to your deployed backend URL

## Implementation Checklist

- [ ] Set up Snowflake connection
- [ ] Implement Excel/CSV parsing logic
- [ ] Integrate Alpaca API for market data
- [ ] Set up LLM for portfolio analysis
- [ ] Implement data models and schemas
- [ ] Add authentication/authorization
- [ ] Deploy backend to cloud (AWS/GCP/Azure)
- [ ] Update CORS settings for production
