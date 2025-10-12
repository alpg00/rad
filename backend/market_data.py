import json
from alpaca.trading.client import TradingClient
from alpaca.data.historical import StockHistoricalDataClient
from alpaca.data.requests import StockBarsRequest
from alpaca.data.timeframe import TimeFrame
from alpaca.trading.requests import GetAssetsRequest
from alpaca.trading.enums import AssetClass
import os
import asyncio
from datetime import datetime
import snowflake.connector as sf
from dotenv import load_dotenv
from typing import Dict, Any
from fastapi import WebSocket

# Global WebSocket clients dictionary
websocket_clients = set()

async def register_websocket(websocket: WebSocket):
    """Register a new WebSocket client"""
    await websocket.accept()
    websocket_clients.add(websocket)
    print(f"New WebSocket client connected. Total clients: {len(websocket_clients)}")

async def unregister_websocket(websocket: WebSocket):
    """Unregister a WebSocket client"""
    websocket_clients.remove(websocket)
    print(f"WebSocket client disconnected. Remaining clients: {len(websocket_clients)}")

async def broadcast_price_update(symbol: str, data: Dict[str, Any]):
    """Broadcast price updates to all connected WebSocket clients"""
    if not websocket_clients:
        # No clients connected, no need to broadcast
        return
        
    message = {
        "type": "price_update",
        "symbol": symbol,
        "data": data
    }
    
    # Make a copy of the set to avoid modification during iteration
    clients = websocket_clients.copy()
    for websocket in clients:
        try:
            if websocket in websocket_clients:  # Double check it's still registered
                await websocket.send_json(message)
        except Exception as e:
            print(f"Error sending to WebSocket client: {e}")
            try:
                websocket_clients.remove(websocket)
            except KeyError:
                pass  # Already removed

load_dotenv()

# Initialize Alpaca API clients
trading_client = TradingClient(
    api_key=os.getenv('ALPACA_KEY_ID'),
    secret_key=os.getenv('ALPACA_SECRET_KEY'),
    paper=os.getenv('ALPACA_DEMO', '1') == '1'
)

data_client = StockHistoricalDataClient(
    api_key=os.getenv('ALPACA_KEY_ID'),
    secret_key=os.getenv('ALPACA_SECRET_KEY')
)

def get_snowflake_connection():
    """Get a connection to Snowflake"""
    return sf.connect(
        user=os.getenv('SF_USER'),
        password=os.getenv('SF_PASSWORD'),
        account=os.getenv('SF_ACCOUNT'),
        role=os.getenv('SF_ROLE', 'ACCOUNTADMIN'),
        warehouse=os.getenv('SF_WAREHOUSE', 'COMPUTE_WH'),
        database=os.getenv('SF_DATABASE', 'RAD_DB'),
        schema=os.getenv('SF_SCHEMA', 'PUBLIC')
    )

async def update_price_in_snowflake(symbol: str, price: float, bid: float = None, ask: float = None):
    """Update price data in Snowflake"""
    try:
        conn = get_snowflake_connection()
        cur = conn.cursor()
        sql = """
            MERGE INTO RAD_DB.PUBLIC.PRICES p
            USING (SELECT %s AS SYMBOL, %s AS BID, %s AS ASK, %s AS PRICE) s
            ON p.SYMBOL = s.SYMBOL
            WHEN MATCHED THEN
                UPDATE SET
                    BID = s.BID,
                    ASK = s.ASK,
                    LAST_PRICE = s.PRICE,
                    UPDATED_AT = CURRENT_TIMESTAMP()
            WHEN NOT MATCHED THEN
                INSERT (SYMBOL, BID, ASK, LAST_PRICE, CREATED_AT, UPDATED_AT)
                VALUES (s.SYMBOL, s.BID, s.ASK, s.PRICE, CURRENT_TIMESTAMP(), CURRENT_TIMESTAMP())
        """
        cur.execute(sql, (symbol, bid or price, ask or price, price))
        
        # Update position LAST_PRICE and LAST_TS
        cur.execute("""
            UPDATE RAD_DB.PUBLIC.POSITIONS
            SET LAST_PRICE = %s,
                LAST_TS = CURRENT_TIMESTAMP()
            WHERE SYMBOL = %s
        """, (price, symbol))
        
        # Check for significant price changes and add to FLAGS table
        threshold_pct = float(os.getenv('DROP_THRESHOLD_PCT', '0.05'))
        cur.execute("""
            INSERT INTO RAD_DB.PUBLIC.FLAGS (
                SYMBOL, PCT_CHANGE, SOD_PRICE, LAST_PRICE, THRESHOLD_PCT, TS
            )
            SELECT 
                p.SYMBOL,
                (p.LAST_PRICE - p.SOD_PRICE) / p.SOD_PRICE as PCT_CHANGE,
                p.SOD_PRICE,
                p.LAST_PRICE,
                %s as THRESHOLD_PCT,
                CURRENT_TIMESTAMP()
            FROM RAD_DB.PUBLIC.POSITIONS p
            WHERE p.SYMBOL = %s
            AND p.SOD_PRICE IS NOT NULL
            AND ABS((p.LAST_PRICE - p.SOD_PRICE) / p.SOD_PRICE) >= %s
            AND NOT EXISTS (
                SELECT 1 FROM RAD_DB.PUBLIC.FLAGS f
                WHERE f.SYMBOL = p.SYMBOL
                AND DATE_TRUNC('DAY', f.TS) = DATE_TRUNC('DAY', CURRENT_TIMESTAMP())
            )
        """, (threshold_pct, symbol, threshold_pct))
        
        conn.commit()
    finally:
        conn.close()

async def trade_updates(data):
    """Handle trade updates from Alpaca"""
    if data.price > 0:  # Ensure valid price
        await update_price_in_snowflake(
            symbol=data.symbol,
            price=data.price,
            bid=getattr(data, 'bid', None),
            ask=getattr(data, 'ask', None)
        )

async def quote_updates(data):
    """Handle quote updates from Alpaca"""
    if data.bid_price > 0 and data.ask_price > 0:
        mid_price = (data.bid_price + data.ask_price) / 2
        await update_price_in_snowflake(
            symbol=data.symbol,
            price=mid_price,
            bid=data.bid_price,
            ask=data.ask_price
        )

def get_tracked_symbols():
    """Get all symbols from positions table"""
    conn = get_snowflake_connection()
    try:
        cur = conn.cursor()
        cur.execute("SELECT DISTINCT SYMBOL FROM RAD_DB.PUBLIC.POSITIONS")
        return [row[0] for row in cur.fetchall()]
    finally:
        conn.close()

async def start_market_data_stream():
    """Start the real-time market data stream using Alpaca's WebSocket API"""
    import websockets

    url = f"wss://stream.data.alpaca.markets/v2/iex"
    print(f"Connecting to Alpaca WebSocket at {url}")

    # Default test symbols if Snowflake is not available
    default_symbols = ['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'META']

    while True:  # Keep trying to reconnect
        try:
            # Get symbols to track
            try:
                symbols = get_tracked_symbols()
            except Exception as e:
                print(f"Error getting symbols from Snowflake: {e}")
                print("Using default test symbols instead")
                symbols = default_symbols

            if not symbols:
                print("No symbols to track. Using default test symbols...")
                symbols = default_symbols

            print(f"Starting market data stream for symbols: {symbols}")
            
            # Connect to Alpaca WebSocket
            async with websockets.connect(url) as ws:
                print("Connected to Alpaca WebSocket, authenticating...")
                
                # Authenticate
                await ws.send(json.dumps({
                    "action": "auth",
                    "key": os.getenv('ALPACA_KEY_ID'),
                    "secret": os.getenv('ALPACA_SECRET_KEY'),
                    "data": {"source": "iex"}  # Explicitly specify IEX as the source
                }))
                
                auth_resp = json.loads(await ws.recv())
                print("Authentication response:", auth_resp)
                if not (isinstance(auth_resp, list) and any(m.get("T") == "success" for m in auth_resp)):
                    print("Authentication failed:", auth_resp)
                    raise Exception("Authentication failed")
                
                print("Authentication successful, subscribing to symbols...")

                # Subscribe to trades and quotes (IEX only)
                await ws.send(json.dumps({
                    "action": "subscribe",
                    "trades": symbols,
                    "quotes": symbols,
                    "bars": symbols,
                    "source": "iex"  # Explicitly specify IEX as the source
                }))
                
                sub_resp = json.loads(await ws.recv())
                print("Subscription response:", sub_resp)

                print(f"Successfully subscribed to {len(symbols)} symbols")
                
                # Process real-time updates
                while True:
                    try:
                        msg = await ws.recv()
                        updates = json.loads(msg)
                        
                        for update in updates:
                            if not isinstance(update, dict):
                                continue
                                
                            msg_type = update.get("T")
                            symbol = update.get("S")
                            
                            if msg_type == "q":  # Quote
                                bid = update.get("bp")
                                ask = update.get("ap")
                                if bid and ask:
                                    price = (bid + ask) / 2
                                    await update_price_in_snowflake(
                                        symbol=symbol,
                                        price=price,
                                        bid=bid,
                                        ask=ask
                                    )
                            elif msg_type == "t":  # Trade
                                price = update.get("p")
                                if price:
                                    await update_price_in_snowflake(
                                        symbol=symbol,
                                        price=price
                                    )
                            
                    except json.JSONDecodeError:
                        print("Error decoding message")
                        continue
                    except Exception as e:
                        print(f"Error processing message: {e}")
                        continue
                    
                    await broadcast_price_update(symbol, {
                        'price': price,
                        'bid': bid,
                        'ask': ask
                    })
                # Wait for 30 seconds before next update
                await asyncio.sleep(30)
                        
        except Exception as e:
            print(f"Market data stream error: {e}")
            await asyncio.sleep(30)  # Wait before retrying

async def start_position_tracking():
    """Track and update positions periodically"""
    while True:
        try:
            conn = get_snowflake_connection()
            cur = conn.cursor()
            
            # Update all positions with latest prices
            cur.execute("""
                UPDATE RAD_DB.PUBLIC.POSITIONS p
                SET LAST_PRICE = pr.P,
                    LAST_TS = CURRENT_TIMESTAMP()
                FROM RAD_DB.PUBLIC.PRICES pr
                WHERE p.SYMBOL = pr.SYMBOL
                AND pr.TS >= DATEADD(minute, -5, CURRENT_TIMESTAMP())
            """)
            
            conn.commit()
        except Exception as e:
            print(f"Error updating positions: {e}")
        finally:
            conn.close()
        
        # Wait for 1 minute before next update
        await asyncio.sleep(60)

async def main():
    """Main function to run all async tasks"""
    await asyncio.gather(
        start_market_data_stream(),
        start_position_tracking()
    )

if __name__ == "__main__":
    asyncio.run(main())