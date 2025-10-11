# RAD Portfolio Management System

A modern portfolio management dashboard with React frontend connected to a Python backend.

## Architecture

- **Frontend**: React + TypeScript + Vite (Lovable)
- **Backend**: Python + FastAPI (VSCode - `backend/backend.py`)

## Quick Start

### Backend Setup
```bash
cd backend
pip install -r requirements.txt
python backend.py
```

Configure `.env` with your Snowflake, Alpaca, and OpenAI credentials (see `backend/README.md`).

### Frontend Setup
Create `.env.local`:
```env
VITE_BACKEND_URL=http://localhost:8000
```

## API Endpoints

Your Python backend should implement:
- `POST /api/ingest-positions` - Upload Excel/CSV
- `POST /api/analyze-portfolio` - Portfolio analysis
- `POST /api/portfolio-insights` - AI insights
- `GET /api/clients` - List clients
- `GET /api/positions` - Get positions
- `GET /api/market-data` - Real-time data

Full implementation guide in `backend/README.md`.

## Deployment

Deploy your Python backend to AWS/GCP/Azure, then update `VITE_BACKEND_URL` to your production URL.

---

Original Lovable setup guide: [Lovable Project](https://lovable.dev/projects/2635891c-56d6-4c5d-a462-2771ef681c46)
