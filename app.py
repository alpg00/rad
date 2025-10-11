# RAD backend (Snowflake storage + Alpaca realtime)
from __future__ import annotations
import os, io, json, time, asyncio, pandas as pd
from datetime import datetime, timezone
from dotenv import load_dotenv
from fastapi import FastAPI, UploadFile, File, Query, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import snowflake.connector as sf
import websockets

load_dotenv()

# ----------- ENV -----------
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
ALPACA_FEED       = os.getenv("ALPACA_FEED", "iex")
ALPACA_DEMO       = os.getenv("ALPACA_DEMO", "1") == "1"
ALPACA_WS_URL     = f"wss://stream.data.alpaca.markets/v2/{ALPACA_FEED}"

# ----------- APP -----------
app = FastAPI(title="RAD — Snowflake Backend", version="1.0.0")
app.add_middleware(
    CORSMiddleware, allow_origins=["*"], allow_credentials=True,
    allow_methods=["*"], allow_headers=["*"]
)

# ----------- SNOWFLAKE HELPERS -----------
def sf_conn():
    return sf.connect(
        user=SF_USER, password=SF_PASSWORD, account=SF_ACCOUNT,
        role=SF_ROLE, warehouse=SF_WAREHOUSE, database=SF_DATABASE, schema=SF_SCHEMA
    )

def run_sql(sql: str, params=None, fetch=True):
    with sf_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(sql, params or {})
            if fetch:
                try: return cur.fetchall()
                except Exception: return []
            return []

def init_schema_if_needed():
    ddl = open("rad_schema.sql","r").read()
    for stmt in [s.strip() for s in ddl.split(";") if s.strip()]:
        run_sql(stmt, fetch=False)

# ----------- LLM STANDARDIZE (rules stub) -----------
CANON_COLS = ["ACCOUNT","SYMBOL","QTY","CURRENCY","COST_BASIS","SOD_PRICE"]
ALIASES = {
    "ACCOUNT":    ["account","acct","account_id","portfolio","fund_account"],
    "SYMBOL":     ["symbol","ticker","secid","ric"],
    "QTY":        ["qty","quantity","position","shares","units"],
    "CURRENCY":   ["currency","ccy","curr"],
    "COST_BASIS": ["cost_basis","avg_cost","average_cost","cost"],
    "SOD_PRICE":  ["sod_price","prev_close","close_price","prior_close"],
}
def standardize_df(df: pd.DataFrame) -> pd.DataFrame:
    lower = {c.lower(): c for c in df.columns}
    colmap = {}
    for canon, opts in ALIASES.items():
        for opt in opts:
            if opt in lower:
                colmap[canon] = lower[opt]
                break
    out = pd.DataFrame()
    for c in CANON_COLS:
        out[c] = df[colmap[c]] if c in colmap else None
    out["QTY"] = pd.to_numeric(out["QTY"], errors="coerce").fillna(0)
    for c in ["COST_BASIS","SOD_PRICE"]:
        out[c] = pd.to_numeric(out[c], errors="coerce")
    out["CURRENCY"] = out["CURRENCY"].fillna("USD")
    out = out[out["SYMBOL"].notna() & (out["QTY"].astype(float) != 0)]
    out["SYMBOL"] = out["SYMBOL"].astype(str).str.upper().str.strip()
    out["ACCOUNT"] = out["ACCOUNT"].astype(str).str.strip().fillna("ACCT")
    return out.reset_index(drop=True)

def upsert_positions(std: pd.DataFrame):
    # aggregate by symbol (MVP)
    agg = std.groupby("SYMBOL", as_index=False).agg({
        "ACCOUNT": "first",
        "QTY": "sum",
        "CURRENCY": "first",
        "COST_BASIS": "first",
        "SOD_PRICE": "first",   # or "mean" if you prefer qty-weighted later
    })
    if agg.empty:
        return

    def esc(s: str) -> str:
        # escape single quotes for SQL literals
        return str(s).replace("'", "''")

    values_rows = []
    for _, row in agg.iterrows():
        sym  = esc(row["SYMBOL"])
        acct = esc(row["ACCOUNT"])
        curr = esc(row["CURRENCY"])
        qty  = float(row["QTY"]) if pd.notna(row["QTY"]) else 0.0
        cb   = "NULL" if pd.isna(row["COST_BASIS"]) else f"{float(row['COST_BASIS'])}"
        sod  = "NULL" if pd.isna(row["SOD_PRICE"])  else f"{float(row['SOD_PRICE'])}"
        values_rows.append(
            f"('{sym}','{acct}',{qty},'{curr}',{cb},{sod})"
        )

    values_sql = ",".join(values_rows) or "(NULL,NULL,NULL,NULL,NULL,NULL)"

    sql = f"""
    MERGE INTO {SF_DATABASE}.{SF_SCHEMA}.POSITIONS t
    USING (
      SELECT COLUMN1 SYMBOL, COLUMN2 ACCOUNT, COLUMN3 QTY, COLUMN4 CURRENCY, COLUMN5 COST_BASIS, COLUMN6 SOD_PRICE
      FROM VALUES {values_sql}
    ) s
    ON t.SYMBOL = s.SYMBOL
    WHEN MATCHED THEN UPDATE SET
      t.ACCOUNT    = s.ACCOUNT,
      t.QTY        = t.QTY + s.QTY,
      t.CURRENCY   = COALESCE(t.CURRENCY, s.CURRENCY),
      t.COST_BASIS = COALESCE(t.COST_BASIS, s.COST_BASIS),
      t.SOD_PRICE  = COALESCE(t.SOD_PRICE,  s.SOD_PRICE)
    WHEN NOT MATCHED THEN INSERT (SYMBOL, ACCOUNT, QTY, CURRENCY, COST_BASIS, SOD_PRICE)
      VALUES (s.SYMBOL, s.ACCOUNT, s.QTY, s.CURRENCY, s.COST_BASIS, s.SOD_PRICE);
    """
    run_sql(sql, fetch=False)

def evaluate_flags_sql():
    # 1) clear current flags
    run_sql(f"DELETE FROM {SF_DATABASE}.{SF_SCHEMA}.FLAGS;", fetch=False)

    # 2) recompute flags
    insert_sql = f"""
    INSERT INTO {SF_DATABASE}.{SF_SCHEMA}.FLAGS
      (SYMBOL, PCT_CHANGE, SOD_PRICE, LAST_PRICE, THRESHOLD_PCT, TS)
    SELECT
      p.SYMBOL,
      CASE WHEN p.SOD_PRICE IS NOT NULL AND p.LAST_PRICE IS NOT NULL AND p.SOD_PRICE <> 0
           THEN (p.LAST_PRICE - p.SOD_PRICE) / p.SOD_PRICE END AS PCT_CHANGE,
      p.SOD_PRICE,
      p.LAST_PRICE,
      {DROP_THRESHOLD_PCT},
      p.LAST_TS
    FROM {SF_DATABASE}.{SF_SCHEMA}.POSITIONS p
    WHERE p.SOD_PRICE IS NOT NULL
      AND p.LAST_PRICE IS NOT NULL
      AND p.LAST_PRICE <= p.SOD_PRICE * (1 - {DROP_THRESHOLD_PCT});
    """
    run_sql(insert_sql, fetch=False)


def get_symbols():
    rows = run_sql(f"SELECT DISTINCT SYMBOL FROM {SF_DATABASE}.{SF_SCHEMA}.POSITIONS WHERE SYMBOL IS NOT NULL")
    return [r[0] for r in rows] if rows else []

# ----------- MODELS -----------
class SearchResult(BaseModel):
    snapshot_hits: list[dict]
    flag_hits: list[dict]

# ----------- ROUTES -----------
@app.on_event("startup")
def _startup():
    init_schema_if_needed()
    # start price loop
    asyncio.create_task(mock_price_loop() if (ALPACA_DEMO or not (ALPACA_KEY_ID and ALPACA_SECRET_KEY)) else alpaca_price_loop())

@app.get("/health")
def health():
    flags = run_sql(f"SELECT COUNT(*) FROM {SF_DATABASE}.{SF_SCHEMA}.FLAGS")
    return {"ok": True, "flags": int(flags[0][0]) if flags else 0, "demo": ALPACA_DEMO}

@app.post("/ingest")
async def ingest(file: UploadFile = File(...)):
    content = await file.read()
    name = (file.filename or "").lower()
    if name.endswith(".csv"):
        df = pd.read_csv(io.BytesIO(content))
    else:
        df = pd.read_excel(io.BytesIO(content))
    std = standardize_df(df)
    upsert_positions(std)
    evaluate_flags_sql()
    return {"ok": True, "rows": len(std), "symbols": std["SYMBOL"].nunique()}

@app.get("/snapshot")
def snapshot():
    rows = run_sql(f"SELECT * FROM {SF_DATABASE}.{SF_SCHEMA}.SNAPSHOT ORDER BY SYMBOL")
    cols = ["ACCOUNT","SYMBOL","QTY","CURRENCY","COST_BASIS","SOD_PRICE","LAST_PRICE","LAST_TS","PCT_CHANGE_VS_SOD"]
    return {"positions": [dict(zip(cols, r)) for r in rows]}

@app.get("/flags")
def flags():
    rows = run_sql(f"SELECT * FROM {SF_DATABASE}.{SF_SCHEMA}.FLAGS ORDER BY TS DESC")
    cols = ["SYMBOL","PCT_CHANGE","SOD_PRICE","LAST_PRICE","THRESHOLD_PCT","TS"]
    return {"flags": [dict(zip(cols, r)) for r in rows], "threshold_pct": DROP_THRESHOLD_PCT}

@app.get("/search", response_model=SearchResult)
def search(q: str = Query(..., min_length=1)):
    ql = q.strip().upper()
    rows1 = run_sql(f"""
        SELECT * FROM {SF_DATABASE}.{SF_SCHEMA}.SNAPSHOT
        WHERE UPPER(SYMBOL) LIKE '%{ql}%' OR UPPER(ACCOUNT) LIKE '%{ql}%'
        ORDER BY SYMBOL
    """)
    rows2 = run_sql(f"""
        SELECT * FROM {SF_DATABASE}.{SF_SCHEMA}.FLAGS
        WHERE UPPER(SYMBOL) LIKE '%{ql}%'
        ORDER BY TS DESC
    """)
    cols1 = ["ACCOUNT","SYMBOL","QTY","CURRENCY","COST_BASIS","SOD_PRICE","LAST_PRICE","LAST_TS","PCT_CHANGE_VS_SOD"]
    cols2 = ["SYMBOL","PCT_CHANGE","SOD_PRICE","LAST_PRICE","THRESHOLD_PCT","TS"]
    return SearchResult(
        snapshot_hits=[dict(zip(cols1, r)) for r in rows1],
        flag_hits=[dict(zip(cols2, r)) for r in rows2],
    )

# ----------- WS (LIVE SNAPSHOT) -----------
WS_CLIENTS: list[WebSocket] = []

async def push_snapshot():
    if not WS_CLIENTS: return
    data = {"snapshot": (await _snapshot_data()), "flags": (await _flags_data())}
    msg = json.dumps(data, default=str)
    dead = []
    for ws in WS_CLIENTS:
        try: await ws.send_text(msg)
        except Exception: dead.append(ws)
    for ws in dead:
        try: WS_CLIENTS.remove(ws)
        except ValueError: pass

async def _snapshot_data():
    rows = run_sql(f"SELECT * FROM {SF_DATABASE}.{SF_SCHEMA}.SNAPSHOT ORDER BY SYMBOL")
    cols = ["ACCOUNT","SYMBOL","QTY","CURRENCY","COST_BASIS","SOD_PRICE","LAST_PRICE","LAST_TS","PCT_CHANGE_VS_SOD"]
    return [dict(zip(cols, r)) for r in rows]

async def _flags_data():
    rows = run_sql(f"SELECT * FROM {SF_DATABASE}.{SF_SCHEMA}.FLAGS ORDER BY TS DESC")
    cols = ["SYMBOL","PCT_CHANGE","SOD_PRICE","LAST_PRICE","THRESHOLD_PCT","TS"]
    return [dict(zip(cols, r)) for r in rows]

@app.websocket("/stream/snapshot")
async def stream_snapshot(ws: WebSocket):
    await ws.accept()
    WS_CLIENTS.append(ws)
    try:
        await ws.send_text(json.dumps({"snapshot": await _snapshot_data(), "flags": await _flags_data()}, default=str))
        while True:
            await asyncio.sleep(30)
    except WebSocketDisconnect:
        pass
    finally:
        try: WS_CLIENTS.remove(ws)
        except ValueError: pass

# ----------- PRICE LOOPS -----------
async def mock_price_loop():
    while True:
        now = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S")
        for sym in get_symbols():
            row = run_sql(f"SELECT LAST_PRICE,SOD_PRICE FROM {SF_DATABASE}.{SF_SCHEMA}.POSITIONS WHERE SYMBOL='{sym}'")
            lp = row[0][0] if row else None
            sp = row[0][1] if row and row[0][1] is not None else 100.0
            price = (lp or sp or 100.0) * (1.001 if int(time.time())%2==0 else 0.999)
            run_sql(f"""
            UPDATE {SF_DATABASE}.{SF_SCHEMA}.POSITIONS
            SET LAST_PRICE={price}, LAST_TS=TO_TIMESTAMP_NTZ('{now}')
            WHERE SYMBOL='{sym}';
            """, fetch=False)
            run_sql(f"""
            MERGE INTO {SF_DATABASE}.{SF_SCHEMA}.PRICES t
            USING (SELECT '{sym}' SYMBOL, {price} P, {price-0.01} BID, {price+0.01} ASK, TO_TIMESTAMP_NTZ('{now}') TS) s
              ON t.SYMBOL=s.SYMBOL
            WHEN MATCHED THEN UPDATE SET t.P=s.P,t.BID=s.BID,t.ASK=s.ASK,t.TS=s.TS
            WHEN NOT MATCHED THEN INSERT (SYMBOL,P,BID,ASK,TS) VALUES (s.SYMBOL,s.P,s.BID,s.ASK,s.TS);
            """, fetch=False)
        evaluate_flags_sql()
        await push_snapshot()
        await asyncio.sleep(1)

async def alpaca_price_loop():
    url = f"wss://stream.data.alpaca.markets/v2/{ALPACA_FEED}"
    async with websockets.connect(url, extra_headers={"Content-Type":"application/json"}, ping_interval=20) as ws:
        await ws.send(json.dumps({"action":"auth","key":ALPACA_KEY_ID,"secret":ALPACA_SECRET_KEY}))
        resp = json.loads(await ws.recv())
        if not (isinstance(resp, list) and any(m.get("T")=="success" for m in resp)):
            print("[ALPACA] auth failed:", resp); return
        syms = get_symbols()
        if syms: await ws.send(json.dumps({"action":"subscribe","quotes":syms}))
        while True:
            data = json.loads(await ws.recv())
            now = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S")
            for ev in data:
                if ev.get("T") == "q":
                    sym = ev.get("S"); ap=ev.get("ap"); bp=ev.get("bp")
                    lp = ap or bp
                    if lp:
                        run_sql(f"""
                        UPDATE {SF_DATABASE}.{SF_SCHEMA}.POSITIONS
                        SET LAST_PRICE={lp}, LAST_TS=TO_TIMESTAMP_NTZ('{now}')
                        WHERE SYMBOL='{sym}';
                        """, fetch=False)
                        run_sql(f"""
                        MERGE INTO {SF_DATABASE}.{SF_SCHEMA}.PRICES t
                        USING (SELECT '{sym}' SYMBOL, {lp} P, {bp or 'NULL'} BID, {ap or 'NULL'} ASK, TO_TIMESTAMP_NTZ('{now}') TS) s
                          ON t.SYMBOL=s.SYMBOL
                        WHEN MATCHED THEN UPDATE SET t.P=s.P,t.BID=s.BID,t.ASK=s.ASK,t.TS=s.TS
                        WHEN NOT MATCHED THEN INSERT (SYMBOL,P,BID,ASK,TS) VALUES (s.SYMBOL,s.P,s.BID,s.ASK,s.TS);
                        """, fetch=False)
            evaluate_flags_sql()
            await push_snapshot()
