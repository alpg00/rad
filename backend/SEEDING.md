# Seeding Demo Data for RAD Portfolio Management

This guide explains how to populate your Snowflake database with demo data for the 3 custodians.

## Demo Custodians

The demo data includes:

1. **Quantum Capital Fund** - 5 tech positions (AAPL, MSFT, GOOGL, TSLA, NVDA)
2. **Apex Growth Partners** - 5 tech positions (AMZN, META, NFLX, NVDA, AAPL)
3. **Horizon Ventures** - 5 tech positions (TSLA, GOOGL, MSFT, AMZN, META)

## Option 1: Using Python Script (Recommended)

1. **Ensure dependencies are installed:**
   ```bash
   pip install -r requirements.txt
   ```

2. **Configure your Snowflake credentials in `.env`:**
   ```bash
   SF_ACCOUNT=your_account.region.cloud
   SF_USER=your_username
   SF_PASSWORD=your_password
   SF_ROLE=your_role
   SF_WAREHOUSE=your_warehouse
   SF_DATABASE=RAD_DB
   SF_SCHEMA=PUBLIC
   ```

3. **Run the seeding script:**
   ```bash
   python seed_demo_data.py
   ```

   This will:
   - Create necessary tables (CLIENTS, POSITIONS, PRICES)
   - Insert 3 demo clients
   - Insert 15 positions (5 per custodian)
   - Insert market prices for all symbols

## Option 2: Using SQL Directly

If you prefer to run SQL directly in Snowflake:

1. Open Snowflake UI and connect to your worksheet
2. Copy the contents of `demo_data.sql`
3. Execute the SQL statements

## Verifying the Data

After seeding, you can verify the data:

```sql
-- Check clients
SELECT * FROM RAD_DB.PUBLIC.CLIENTS;

-- Check positions by custodian
SELECT ACCOUNT, SYMBOL, QTY, LAST_PRICE 
FROM RAD_DB.PUBLIC.POSITIONS 
ORDER BY ACCOUNT, SYMBOL;

-- Check market prices
SELECT * FROM RAD_DB.PUBLIC.PRICES;
```

## Using Demo Data in the App

1. Start your backend: `uvicorn app:app --reload --port 8000`
2. Open the Lovable frontend
3. Click "I am a Portfolio Manager"
4. You should see all 3 custodians with their positions and real-time P&L

## Refreshing Demo Data

To refresh the demo data (useful for testing):

```bash
# Clear existing data
python -c "
import snowflake.connector, os
from dotenv import load_dotenv
load_dotenv()
conn = snowflake.connector.connect(
    account=os.getenv('SF_ACCOUNT'),
    user=os.getenv('SF_USER'),
    password=os.getenv('SF_PASSWORD'),
    warehouse=os.getenv('SF_WAREHOUSE'),
    database=os.getenv('SF_DATABASE')
)
cursor = conn.cursor()
cursor.execute('DELETE FROM RAD_DB.PUBLIC.POSITIONS WHERE ID LIKE \'%quantum%\' OR ID LIKE \'%apex%\' OR ID LIKE \'%horizon%\'')
cursor.execute('DELETE FROM RAD_DB.PUBLIC.CLIENTS WHERE ID IN (\'quantum-capital\', \'apex-growth\', \'horizon-ventures\')')
conn.close()
"

# Re-seed
python seed_demo_data.py
```

## Troubleshooting

### "Table does not exist" error
The script automatically creates tables. If you see this error, ensure your Snowflake user has CREATE TABLE permissions.

### "Connection timeout"
Check your Snowflake credentials in `.env` and ensure your IP is whitelisted in Snowflake.

### Data not showing in frontend
1. Verify backend is running: `curl http://localhost:8000/api/clients`
2. Check that `VITE_BACKEND_URL=http://localhost:8000` in `.env.local`
3. Ensure positions have `ACCOUNT` field matching the client `NAME` exactly
