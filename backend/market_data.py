import json
import os
import asyncio
import snowflake.connector as sf
import websockets
from dotenv import load_dotenv

load_dotenv()

def get_snowflake_connection():
    """Get a connection to Snowflake"""
    # connects to snowflake
    return sf.connect(
        user=os.getenv('SF_USER'),
        password=os.getenv('SF_PASSWORD'),
        account=os.getenv('SF_ACCOUNT'),
        role=os.getenv('SF_ROLE', 'ACCOUNTADMIN'),
        warehouse=os.getenv('SF_WAREHOUSE', 'COMPUTE_WH'),
        database=os.getenv('SF_DATABASE', 'RAD_DB'),
        schema=os.getenv('SF_SCHEMA', 'PUBLIC')
    )

def get_tracked_symbols():
    """Get all symbols from the positions table in Snowflake"""
    # fetch the symbols app needs to track
    conn = get_snowflake_connection()
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT DISTINCT SYMBOL FROM RAD_DB.PUBLIC.POSITIONS WHERE SYMBOL IS NOT NULL")
            return [row[0] for row in cur.fetchall()]
    finally:
        conn.close()

# core data functions

async def update_price_in_snowflake(symbol: str, price: float, bid: float = None, ask: float = None):
    """Update price data for a given symbol in the Snowflake database."""
    try:
        conn = get_snowflake_connection()
        with conn.cursor() as cur:
            # merge statement for the prices table
            sql_merge_prices = """
                MERGE INTO RAD_DB.PUBLIC.PRICES p
                USING (SELECT %s AS SYMBOL, %s AS BID, %s AS ASK, %s AS PRICE) s
                ON p.SYMBOL = s.SYMBOL
                WHEN MATCHED THEN
                    UPDATE SET BID = s.BID, ASK = s.ASK, P = s.PRICE, TS = CURRENT_TIMESTAMP()
                WHEN NOT MATCHED THEN
                    INSERT (SYMBOL, BID, ASK, P, TS)
                    VALUES (s.SYMBOL, s.BID, s.ASK, s.PRICE, CURRENT_TIMESTAMP())
            """
            cur.execute(sql_merge_prices, (symbol, bid or price, ask or price, price))
            
            # update corresponding position's LAST_PRICE and LAST_TS
            sql_update_positions = """
                UPDATE RAD_DB.PUBLIC.POSITIONS
                SET LAST_PRICE = %s, LAST_TS = CURRENT_TIMESTAMP()
                WHERE SYMBOL = %s
            """
            cur.execute(sql_update_positions, (price, symbol))
        
        conn.commit()
    except Exception as e:
        print(f"Snowflake update error for symbol {symbol}: {e}")
    finally:
        if 'conn' in locals() and conn:
            conn.close()

async def start_market_data_stream():
    """
    Connects to Alpaca's WebSocket, authenticates, subscribes to symbols,
    and updates Snowflake with the real-time data.
    """
    url = "wss://stream.data.alpaca.markets/v2/iex"
    print(f"Connecting to Alpaca WebSocket at {url}")

    default_symbols = ['AAPL', 'MSFT', 'GOOGL']

    while True: # main reconnection loop
        try:
            symbols = get_tracked_symbols() or default_symbols
            if not symbols:
                print("No symbols to track. Waiting...")
                await asyncio.sleep(20)
                continue

            print(f"Attempting to stream market data for symbols: {symbols}")

            async with websockets.connect(url, ping_interval=20) as ws:
                # authenticate with Alpaca
                print("Authenticating with Alpaca...")
                await ws.send(json.dumps({
                    "action": "auth",
                    "key": os.getenv('ALPACA_KEY_ID'),
                    "secret": os.getenv('ALPACA_SECRET_KEY')
                }))
                auth_resp = json.loads(await ws.recv())
                if not (isinstance(auth_resp, list) and any(m.get("T") == "success" for m in auth_resp)):
                    raise Exception(f"Alpaca authentication failed: {auth_resp}")

                # subscribe to trades and quotes for the symbols
                print("Subscribing to symbols...")
                await ws.send(json.dumps({
                    "action": "subscribe",
                    "trades": symbols,
                    "quotes": symbols
                }))
                
                # main message processing loop
                while True:
                    msg = await ws.recv()
                    updates = json.loads(msg)
                    
                    for update in updates:
                        msg_type = update.get("T")
                        symbol = update.get("S")
                        price, bid, ask = None, None, None

                        if msg_type == "q": # quote update
                            bid = update.get("bp")
                            ask = update.get("ap")
                            if bid and ask:
                                price = (bid + ask) / 2
                        elif msg_type == "t": # trade update
                            price = update.get("p")
                        
                        if price and symbol:
                            # update the database
                            # broadcasting handled by app.py
                            await update_price_in_snowflake(symbol=symbol, price=price, bid=bid, ask=ask)

        except Exception as e:
            print(f"Market data stream error: {e}. Retrying in 10 seconds...")
            await asyncio.sleep(10)

async def start_position_tracking():
    """Periodically updates all positions from the latest prices in the PRICES table."""
    while True:
        try:
            conn = get_snowflake_connection()
            with conn.cursor() as cur:
                cur.execute("""
                    UPDATE RAD_DB.PUBLIC.POSITIONS p
                    SET LAST_PRICE = pr.P,
                        LAST_TS = pr.TS
                    FROM RAD_DB.PUBLIC.PRICES pr
                    WHERE p.SYMBOL = pr.SYMBOL
                      AND p.LAST_PRICE IS DISTINCT FROM pr.P
                """)
            conn.commit()
        except Exception as e:
            print(f"Error in periodic position tracking: {e}")
        finally:
            if 'conn' in locals() and conn:
                conn.close()
        
        # this runs every minute to catch updates
        await asyncio.sleep(20)