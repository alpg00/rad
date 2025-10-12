# RAD (Risk Analysis Dashboard)

A real-time portfolio management and risk analysis platform built with React, FastAPI, and Snowflake.

![RAD Dashboard](public/dashboard.png)

## 🚀 Quick Start

```bash
# Clone the repository
git clone https://github.com/alpg00/rad.git
cd rad

# Set up Python virtual environment
python -m venv venv
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt
npm install

# Set up environment variables (see Configuration section)

# Initialize database
cd backend
python init_db.py

# Start backend (Terminal 1)
uvicorn app:app --reload --port 8001

# Start frontend (Terminal 2)
npm run dev
```

Visit `http://localhost:8080` to access the application.

## 🏗️ Architecture

### Frontend (TypeScript + React + Vite)
- Modern React with TypeScript
- Vite for fast development
- ShadcnUI components
- Real-time data visualization

### Backend (Python + FastAPI)
- FastAPI for high-performance API
- Real-time WebSocket connections
- Snowflake database integration
- Alpaca market data integration

### Database (Snowflake)
- Scalable data warehouse
- Real-time position tracking
- Historical data analysis
- Multi-tenant architecture

## 📋 Features

- ✅ Real-time portfolio tracking
- ✅ Risk metrics visualization
- ✅ AI-powered insights
- ✅ Excel position upload
- ✅ Multi-custodian support
- ✅ Live market data integration

## 🔌 API Endpoints

### Authentication
\`\`\`
GET /api/auth/status
- Check authentication status
- Response: { "authenticated": boolean }
\`\`\`

### Client Management
\`\`\`
GET /api/clients
- List all clients
- Response: [{ "id": string, "name": string, "email": string, "type": string }]

POST /api/clients
- Create new client
- Body: { "name": string, "email": string, "type": "demo" | "custodian" }
\`\`\`

### Portfolio Management
\`\`\`
GET /api/positions
- Get portfolio positions
- Query: ?account=<account_id>
- Response: [{ 
    "symbol": string,
    "quantity": number,
    "price": number,
    "value": number 
  }]

POST /api/ingest-positions
- Upload positions via Excel
- Body: FormData with Excel file
- Response: { "status": "success", "count": number }

GET /api/analyze-portfolio
- Get portfolio analysis
- Response: {
    "total_value": number,
    "daily_pnl": number,
    "risk_metrics": {...},
    "exposures": {...}
  }
\`\`\`

### Market Data
\`\`\`
GET /api/market-data
- Get real-time market data
- Query: ?symbols=AAPL,MSFT
- Response: [{
    "symbol": string,
    "price": number,
    "change": number,
    "volume": number
  }]

WS /ws/market-data
- WebSocket for live market data
- Subscribe: { "action": "subscribe", "symbols": [...] }
\`\`\`

### AI Insights
\`\`\`
GET /api/portfolio-insights
- Get AI analysis of portfolio
- Response: {
    "recommendations": [...],
    "risk_alerts": [...],
    "opportunities": [...]
  }
\`\`\`

## 🗄️ Database Schema

### POSITIONS Table
\`\`\`sql
CREATE TABLE POSITIONS (
  ACCOUNT      STRING,
  SYMBOL       STRING,
  QTY          FLOAT,
  CURRENCY     STRING,
  COST_BASIS   FLOAT,
  SOD_PRICE    FLOAT,
  LAST_PRICE   FLOAT,
  LAST_TS      TIMESTAMP_NTZ
);
\`\`\`

### PRICES Table
\`\`\`sql
CREATE TABLE PRICES (
  SYMBOL   STRING PRIMARY KEY,
  BID      FLOAT,
  ASK      FLOAT,
  P        FLOAT,
  TS       TIMESTAMP_NTZ
);
\`\`\`

### CLIENTS Table
\`\`\`sql
CREATE TABLE CLIENTS (
  ID         STRING PRIMARY KEY,
  NAME       STRING,
  EMAIL      STRING,
  TYPE       STRING,
  CREATED_AT TIMESTAMP_NTZ
);
\`\`\`

## 🔧 Configuration

### Backend (.env)
```env
# Snowflake
SF_ACCOUNT=your_account
SF_USER=your_username
SF_PASSWORD=your_password
SF_ROLE=ACCOUNTADMIN
SF_WAREHOUSE=COMPUTE_WH
SF_DATABASE=RAD_DB
SF_SCHEMA=PUBLIC

# Alpaca
ALPACA_KEY_ID=your_key_id
ALPACA_SECRET_KEY=your_secret_key
ALPACA_FEED=iex
ALPACA_DEMO=1

# Risk Parameters
DROP_THRESHOLD_PCT=0.05
```

### Frontend (.env)
```env
VITE_BACKEND_URL=http://localhost:8001
```

## 📱 Components

### Dashboard Components
- `DashboardSidebar`: Navigation and client selection
- `PLTracker`: Real-time P&L visualization
- `PositionChart`: Portfolio position breakdown
- `RiskMetrics`: Key risk indicators
- `AIInsights`: AI-powered analysis
- `ExcelUpload`: Position file upload

### Pages
- `RoleSelection`: Initial role selection
- `CustodianDashboard`: Main dashboard
- `PortfolioManager`: Position management

## 🚀 Usage Examples

### 1. Upload Positions
```typescript
const uploadPositions = async (file: File) => {
  const formData = new FormData();
  formData.append('file', file);
  
  await fetch('/api/ingest-positions', {
    method: 'POST',
    body: formData
  });
};
```

### 2. Get Portfolio Analysis
```typescript
const getAnalysis = async () => {
  const response = await fetch('/api/analyze-portfolio');
  const analysis = await response.json();
  
  console.log('Total Value:', analysis.total_value);
  console.log('Daily P&L:', analysis.daily_pnl);
};
```

### 3. Subscribe to Market Data
```typescript
const ws = new WebSocket('ws://localhost:8001/ws/market-data');

ws.send(JSON.stringify({
  action: 'subscribe',
  symbols: ['AAPL', 'MSFT', 'GOOGL']
}));

ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  console.log('Market Update:', data);
};
```

## 🔒 Security

- ✅ Environment variables for sensitive data
- ✅ CORS protection
- ✅ Input validation
- ✅ Rate limiting
- ✅ Secure WebSocket connections

## 📈 Performance

- Frontend optimized with React.memo and useMemo
- FastAPI async endpoints
- WebSocket for real-time updates
- Efficient Snowflake queries
- Proper indexing on all tables

## 🐛 Troubleshooting

### Backend Issues
1. Check Snowflake connection:
```bash
python -c "import snowflake.connector; print('Connected!')"
```

2. Verify Alpaca credentials:
```bash
curl -H "APCA-API-KEY-ID: $ALPACA_KEY_ID" \
     -H "APCA-API-SECRET-KEY: $ALPACA_SECRET_KEY" \
     https://paper-api.alpaca.markets/v2/account
```

### Frontend Issues
1. Clear browser cache
2. Check Network tab for API errors
3. Verify WebSocket connection

## 📚 Resources

- [FastAPI Documentation](https://fastapi.tiangolo.com/)
- [Snowflake Python Connector](https://docs.snowflake.com/en/user-guide/python-connector.html)
- [Alpaca API Docs](https://alpaca.markets/docs/api-documentation/)
- [React Documentation](https://react.dev/)

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Commit changes
4. Push to the branch
5. Open a pull request

## 📄 License

MIT License - see LICENSE file for details