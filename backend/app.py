# RAD backend - FINAL CORRECTED VERSION
from __future__ import annotations
import os, io, json, time, asyncio, pandas as pd
import traceback
from datetime import datetime, timezone, date
from decimal import Decimal
from dotenv import load_dotenv
from fastapi import FastAPI, UploadFile, File, Query, WebSocket, WebSocketDisconnect, Form, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import snowflake.connector as sf
from typing import List, Dict, Optional
from pathlib import Path

from market_data import start_market_data_stream, start_position_tracking

# --- Load Environment Variables ---
env_path = Path(__file__).resolve().parent / ".env"
load_dotenv(env_path)

# --- Environment Configuration ---
SF_ACCOUNT   = os.getenv("SF_ACCOUNT")
SF_USER      = os.getenv("SF_USER")
SF_PASSWORD  = os.getenv("SF_PASSWORD")
SF_ROLE      = os.getenv("SF_ROLE", "ACCOUNTADMIN")
SF_WAREHOUSE = os.getenv("SF_WAREHOUSE", "COMPUTE_WH")
SF_DATABASE  = os.getenv("SF_DATABASE", "RAD_DB")
SF_SCHEMA    = os.getenv("SF_SCHEMA", "PUBLIC")
DROP_THRESHOLD_PCT = float(os.getenv("DROP_THRESHOLD_PCT", "0.05"))
ALPACA_KEY_ID     = os.getenv("ALPACA_KEY_ID")
ALPACA_SECRET_KEY = os.getenv("ALPACA_SECRET_KEY")
ALPACA_DEMO       = os.getenv("ALPACA_DEMO", "1") == "1"

# --- Main FastAPI App Instance ---
app = FastAPI(title="RAD — Snowflake Backend", version="1.0.0")
origins = ["http://localhost:8080", "http://localhost:8000"]
app.add_middleware(
    CORSMiddleware, allow_origins=origins, allow_credentials=True,
    allow_methods=["*"], allow_headers=["*"]
)

# --- WebSocket Connection Manager ---
class ConnectionManager:
    def __init__(self):
        self.active_connections: Dict[str, List[WebSocket]] = {}
        print("ConnectionManager initialized")
    async def connect(self, websocket: WebSocket, client_id: str):
        await websocket.accept()
        if client_id not in self.active_connections: self.active_connections[client_id] = []
        self.active_connections[client_id].append(websocket)
        print(f"Connection accepted for client {client_id}")
    def disconnect(self, websocket: WebSocket, client_id: str):
        if client_id in self.active_connections:
            try:
                self.active_connections[client_id].remove(websocket)
                if not self.active_connections[client_id]: del self.active_connections[client_id]
            except ValueError: pass
    async def broadcast_snapshot(self, snapshot_data: dict, flags_data: dict):
        if not self.active_connections: return
        # The data is now pre-serialized, so we can use the default encoder
        message = json.dumps({"type": "live_update", "snapshot": snapshot_data, "flags": flags_data}, default=str)
        all_websockets = [ws for conn_list in self.active_connections.values() for ws in conn_list]
        if not all_websockets: return
        await asyncio.gather(*(ws.send_text(message) for ws in all_websockets), return_exceptions=True)

manager = ConnectionManager()

# --- Snowflake & Data Helpers ---
def sf_conn():
    return sf.connect(user=SF_USER, password=SF_PASSWORD, account=SF_ACCOUNT, role=SF_ROLE, warehouse=SF_WAREHOUSE, database=SF_DATABASE, schema=SF_SCHEMA)
def run_sql(sql: str, params=None, fetch=True):
    try:
        with sf_conn() as conn:
            with conn.cursor() as cur:
                cur.execute(sql, params or {});
                if fetch: return cur.fetchall()
    except Exception as e:
        print(f"[sf] query error: {e}"); return [] if fetch else None
def init_schema_if_needed():
    schema_path = Path(__file__).resolve().parent / "rad_schema.sql"
    if not schema_path.exists(): return
    ddl = schema_path.read_text()
    for stmt in [s.strip() for s in ddl.split(";") if s.strip()]: run_sql(stmt, fetch=False)
def seed_clients_log():
    rows = run_sql(f"SELECT ID, NAME, TYPE FROM {SF_DATABASE}.{SF_SCHEMA}.CLIENTS")
    print(f"[sf] seeded clients: {len(rows) if rows else 0}")
    for r in (rows or []): print("  -", r[0], r[1], r[2])

# --- FIX #1: Robust Data Serialization ---
# This function now handles special database types AT THE SOURCE.
def serialize_rows(rows: list, cols: list) -> List[Dict]:
    """Converts DB rows into clean, JSON-serializable dicts."""
    result = []
    for row in rows:
        row_dict = {}
        for i, val in enumerate(row):
            col_name = cols[i]
            if isinstance(val, (datetime, date)):
                row_dict[col_name] = val.isoformat()
            elif isinstance(val, Decimal):
                row_dict[col_name] = float(val)
            else:
                row_dict[col_name] = val
        result.append(row_dict)
    return result

async def _snapshot_data():
    rows = run_sql(f"SELECT * FROM {SF_DATABASE}.{SF_SCHEMA}.SNAPSHOT ORDER BY SYMBOL")
    cols = ["ACCOUNT","SYMBOL","QTY","CURRENCY","COST_BASIS","SOD_PRICE","LAST_PRICE","LAST_TS","PCT_CHANGE_VS_SOD"]
    return serialize_rows(rows, cols)

async def _flags_data():
    rows = run_sql(f"SELECT * FROM {SF_DATABASE}.{SF_SCHEMA}.FLAGS ORDER BY TS DESC")
    cols = ["SYMBOL","PCT_CHANGE","SOD_PRICE","LAST_PRICE","THRESHOLD_PCT","TS"]
    return serialize_rows(rows, cols)

CANON_COLS=["ACCOUNT","SYMBOL","QTY","CURRENCY","COST_BASIS","SOD_PRICE"]
ALIASES={"ACCOUNT":["account","acct","account_id","portfolio","fund_account","account id / portfolio id"],"SYMBOL":["symbol","ticker","secid","ric"],"QTY":["qty","quantity","position","shares","units","quantity / position size"],"CURRENCY":["currency","ccy","curr"],"COST_BASIS":["cost_basis","avg_cost","average_cost","cost"],"SOD_PRICE":["sod_price","prev_close","close_price","prior_close","sod price (start of day)"]}
def standardize_df(df:pd.DataFrame)->pd.DataFrame:
    lower={c.lower():c for c in df.columns};colmap={}
    for canon,opts in ALIASES.items():
        for opt in opts:
            if opt in lower:colmap[canon]=lower[opt];break
    out=pd.DataFrame()
    for c in CANON_COLS:out[c]=df[colmap[c]] if c in colmap else None
    out["QTY"]=pd.to_numeric(out["QTY"],errors="coerce").fillna(0)
    for c in["COST_BASIS","SOD_PRICE"]:out[c]=pd.to_numeric(out[c],errors="coerce")
    out["CURRENCY"]=out["CURRENCY"].fillna("USD")
    out=out[out["SYMBOL"].notna()&(out["QTY"].astype(float)!=0)]
    out["SYMBOL"]=out["SYMBOL"].astype(str).str.upper().str.strip()
    out["ACCOUNT"]=out["ACCOUNT"].fillna("ACCT").astype(str).str.strip()
    return out.reset_index(drop=True)
def upsert_positions(std:pd.DataFrame):
    # This function is now correct and doesn't need changes.
    agg=std.groupby("SYMBOL",as_index=False).agg({"ACCOUNT":"first","QTY":"sum","CURRENCY":"first","COST_BASIS":"first","SOD_PRICE":"first"})
    if agg.empty:return
    def esc(s:str)->str:return str(s).replace("'","''")
    values_rows=[]
    for _,row in agg.iterrows():
        sym=esc(row["SYMBOL"]);acct=esc(row["ACCOUNT"]);curr=esc(row["CURRENCY"])
        qty=float(row["QTY"])if pd.notna(row["QTY"])else 0.0
        cb="NULL"if pd.isna(row["COST_BASIS"])else f"{float(row['COST_BASIS'])}"
        sod="NULL"if pd.isna(row["SOD_PRICE"])else f"{float(row['SOD_PRICE'])}"
        run_sql(f"INSERT INTO {SF_DATABASE}.{SF_SCHEMA}.CLIENTS (ID,NAME,TYPE) SELECT '{acct}','{acct}','custodian' WHERE NOT EXISTS (SELECT 1 FROM {SF_DATABASE}.{SF_SCHEMA}.CLIENTS WHERE ID='{acct}')",fetch=False)
        values_rows.append(f"('{sym}','{acct}',{qty},'{curr}',{cb},{sod})")
    values_sql=",".join(values_rows)or"(NULL,NULL,NULL,NULL,NULL,NULL)"
    sql=f"MERGE INTO {SF_DATABASE}.{SF_SCHEMA}.POSITIONS t USING (SELECT COLUMN1 SYMBOL, COLUMN2 ACCOUNT, COLUMN3 QTY, COLUMN4 CURRENCY, COLUMN5 COST_BASIS, COLUMN6 SOD_PRICE FROM VALUES {values_sql}) s ON t.SYMBOL = s.SYMBOL WHEN MATCHED THEN UPDATE SET t.ACCOUNT=s.ACCOUNT, t.QTY=t.QTY+s.QTY, t.CURRENCY=COALESCE(t.CURRENCY,s.CURRENCY), t.COST_BASIS=COALESCE(t.COST_BASIS,s.COST_BASIS), t.SOD_PRICE=COALESCE(t.SOD_PRICE,s.SOD_PRICE) WHEN NOT MATCHED THEN INSERT (SYMBOL,ACCOUNT,QTY,CURRENCY,COST_BASIS,SOD_PRICE) VALUES (s.SYMBOL,s.ACCOUNT,s.QTY,s.CURRENCY,s.COST_BASIS,s.SOD_PRICE);"
    run_sql(sql,fetch=False)
def get_symbols():
    rows=run_sql(f"SELECT DISTINCT SYMBOL FROM {SF_DATABASE}.{SF_SCHEMA}.POSITIONS WHERE SYMBOL IS NOT NULL")
    return [r[0] for r in rows] if rows else []
def evaluate_flags_sql():
    run_sql(f"DELETE FROM {SF_DATABASE}.{SF_SCHEMA}.FLAGS;", fetch=False)
    insert_sql=f"INSERT INTO {SF_DATABASE}.{SF_SCHEMA}.FLAGS (SYMBOL,PCT_CHANGE,SOD_PRICE,LAST_PRICE,THRESHOLD_PCT,TS) SELECT p.SYMBOL, CASE WHEN p.SOD_PRICE IS NOT NULL AND p.LAST_PRICE IS NOT NULL AND p.SOD_PRICE<>0 THEN (p.LAST_PRICE-p.SOD_PRICE)/p.SOD_PRICE END AS PCT_CHANGE, p.SOD_PRICE, p.LAST_PRICE, {DROP_THRESHOLD_PCT}, p.LAST_TS FROM {SF_DATABASE}.{SF_SCHEMA}.POSITIONS p WHERE p.SOD_PRICE IS NOT NULL AND p.LAST_PRICE IS NOT NULL AND p.LAST_PRICE <= p.SOD_PRICE * (1 - {DROP_THRESHOLD_PCT});"
    run_sql(insert_sql, fetch=False)

# --- FIX #2: Robust WebSocket Endpoint ---
@app.websocket("/ws/{client_id}")
async def websocket_endpoint(websocket: WebSocket, client_id: str):
    await manager.connect(websocket, client_id)
    receiver_task = None
    try:
        async def receiver():
            try:
                while True: await websocket.receive_text()
            except WebSocketDisconnect: pass
        
        receiver_task = asyncio.create_task(receiver())
        
        print(f"Sending initial state to client {client_id}")
        payload = {"type": "initial_state", "snapshot": await _snapshot_data(), "flags": await _flags_data()}
        
        # Because the data is now pre-serialized by serialize_rows, this call is safe.
        await websocket.send_json(payload)
        
        await asyncio.Future()
    except WebSocketDisconnect:
        print(f"Client {client_id} disconnected.")
    except Exception as e:
        print(f"!!! WebSocket Error for client {client_id}: {e}")
        traceback.print_exc()
    finally:
        if receiver_task: receiver_task.cancel()
        manager.disconnect(websocket, client_id)

# --- HTTP API Routes ---
class ClientRequest(BaseModel): clientName: Optional[str] = None
@app.get("/api/clients")
async def get_clients_api():
    rows = run_sql(f"SELECT ID, NAME, EMAIL, TYPE, CREATED_AT FROM {SF_DATABASE}.{SF_SCHEMA}.CLIENTS ORDER BY NAME")
    return serialize_rows(rows, ["id", "name", "email", "type", "created_at"])
@app.post("/api/analyze-portfolio")
async def analyze_portfolio_api(request: ClientRequest):
    snapshot = await _snapshot_data()
    if request.clientName: snapshot = [p for p in snapshot if p.get("ACCOUNT") == request.clientName]
    return {"positions": snapshot, "totals": {}}
@app.post("/api/portfolio-insights")
async def get_portfolio_insights(request: ClientRequest):
    return {"insights": {"comment": "AI insights are not fully configured yet."}}
@app.post("/api/ingest-positions")
async def ingest_positions(file: UploadFile = File(...), clientName: str = Form(None)):
    content = await file.read()
    df = pd.read_csv(io.BytesIO(content), skipinitialspace=True) if (file.filename or "").lower().endswith(".csv") else pd.read_excel(io.BytesIO(content))
    std = standardize_df(df)
    ingested_account_id = std['ACCOUNT'].unique()[0] if not std.empty and 'ACCOUNT' in std.columns else None
    print(f"\n--- INGESTION DEBUG: Standardized DataFrame Head ---\n{std.head()}\n--------------------------------------------------\n")
    upsert_positions(std)
    evaluate_flags_sql()
    return {"ok": True, "rows": len(std), "ingestedAccountId": ingested_account_id}

# --- Price Update Loop (Corrected) ---
async def mock_price_loop():
    while True:
        await asyncio.sleep(1)
        now_ts = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S")
        symbols = get_symbols()
        if not symbols: continue
        for sym in symbols:
            run_sql(f"UPDATE {SF_DATABASE}.{SF_SCHEMA}.POSITIONS SET LAST_PRICE=(SOD_PRICE * (1 + (CAST(UNIFORM(1, 100, RANDOM()) AS INT) - 50) / 1000.0)), LAST_TS=TO_TIMESTAMP_NTZ('{now_ts}') WHERE SYMBOL='{sym}';", fetch=False)
        evaluate_flags_sql()
        await manager.broadcast_snapshot(await _snapshot_data(), await _flags_data())

# --- Application Startup ---
@app.on_event("startup")
async def startup_event():
    print("[app] Starting up...")
    init_schema_if_needed()
    seed_clients_log()
    print("--- REAL MARKET DATA STREAM IS DISABLED ---")
    # asyncio.create_task(start_market_data_stream())
    asyncio.create_task(start_position_tracking())
    print("[app] Connection monitor is DISABLED.")
    if os.getenv("SKIP_PRICE_LOOP", "0") != "1":
        print("[app] Starting mock price loop...")
        asyncio.create_task(mock_price_loop())