# Python Backend Template for RAD Portfolio Management System
# This is a reference implementation - customize based on your needs

from fastapi import APIRouter, File, UploadFile, HTTPException
from pydantic import BaseModel
from typing import List, Dict, Optional
import importlib.util, importlib, os

# attempt to import helpers from app.py
try:
    from app import app as main_app, ingest as app_ingest, _snapshot_data, run_sql
except Exception:
    try:
        from .app import app as main_app, ingest as app_ingest, _snapshot_data, run_sql
    except Exception:
        mod_path = os.path.join(os.path.dirname(__file__), "app.py")
        spec = importlib.util.spec_from_file_location("rad_backend_app", mod_path)
        mod = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(mod)
        main_app = getattr(mod, "app")
        app_ingest = getattr(mod, "ingest")
        _snapshot_data = getattr(mod, "_snapshot_data")
        run_sql = getattr(mod, "run_sql")

router = APIRouter(prefix="/api")

# Request/Response Models
class ClientRequest(BaseModel):
    clientName: Optional[str] = None

class PortfolioAnalysis(BaseModel):
    positions: List[Dict]
    totals: Dict[str, float]

class AIInsightsResponse(BaseModel):
    insights: Dict

# Mock data for testing
DEMO_CLIENTS = [
    {"id": "1", "name": "Quantum Capital Fund", "email": "contact@quantum.com", "created_at": "2024-01-01", "updated_at": "2024-01-01"},
    {"id": "2", "name": "Apex Growth Partners", "email": "info@apex.com", "created_at": "2024-01-01", "updated_at": "2024-01-01"},
    {"id": "3", "name": "Horizon Ventures", "email": "hello@horizon.com", "created_at": "2024-01-01", "updated_at": "2024-01-01"},
]


@router.post("/ingest-positions")
async def ingest_positions(file: UploadFile = File(...), clientName: Optional[str] = None):
    """
    Ingest Excel/CSV position file and upsert into Snowflake via app.ingest
    """
    try:
        # If clientName is not provided directly, attempt to read it from the UploadFile metadata
        # (when called via HTTP from the frontend the backend route won't be used; this is defensive)
        if not clientName:
            try:
                # Some callers may attach the clientName as an attribute; try to fetch it
                clientName = getattr(file, 'clientName', None)
            except Exception:
                clientName = None
        # app_ingest accepts (file, clientName) via Form; call directly to forward clientName
        res = await app_ingest(file, clientName)
        return res
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/analyze-portfolio")
async def analyze_portfolio(request: ClientRequest):
    try:
        snapshot = await _snapshot_data()
        if request.clientName:
            snapshot = [p for p in snapshot if p.get("ACCOUNT") == request.clientName]

        positions = []
        totals = {"market_value": 0.0, "pnl": 0.0}
        for p in snapshot:
            qty = float(p.get("QTY") or 0)
            last = p.get("LAST_PRICE") if p.get("LAST_PRICE") is not None else p.get("SOD_PRICE") or 0.0
            try:
                price = float(last)
            except Exception:
                price = 0.0
            market_value = qty * price
            cost_basis = p.get("COST_BASIS")
            try:
                cb = float(cost_basis) if cost_basis is not None else 0.0
            except Exception:
                cb = 0.0
            if cb == 0.0 and p.get("SOD_PRICE"):
                try:
                    cb = qty * float(p.get("SOD_PRICE"))
                except Exception:
                    cb = 0.0

            pnl = market_value - cb
            positions.append({
                "ticker": p.get("SYMBOL"),
                "quantity": qty,
                "cost_basis": cb,
                "price": price,
                "market_value": market_value,
                "pnl": pnl,
            })
            totals["market_value"] += market_value
            totals["pnl"] += pnl

        return {"positions": positions, "totals": totals}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/portfolio-insights")
async def get_portfolio_insights(request: ClientRequest):
    try:
        snapshot = await _snapshot_data()
        if request.clientName:
            snapshot = [p for p in snapshot if p.get("ACCOUNT") == request.clientName]
        total_mv = 0.0
        by_symbol = {}
        for p in snapshot:
            qty = float(p.get("QTY") or 0)
            lp = p.get("LAST_PRICE") if p.get("LAST_PRICE") is not None else p.get("SOD_PRICE") or 0.0
            price = float(lp or 0)
            mv = qty * price
            total_mv += mv
            sym = p.get("SYMBOL")
            by_symbol[sym] = by_symbol.get(sym, 0.0) + mv

        top = sorted(by_symbol.items(), key=lambda x: x[1], reverse=True)[:3]
        insights = {
            "total_market_value": total_mv,
            "top_positions": top,
            "comment": "This is a rule-based insight (replace with LLM integration)."
        }
        return {"insights": insights}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/clients")
async def get_clients():
    try:
        # Prefer reading clients from Snowflake if available
        try:
            rows = run_sql(f"SELECT ID, NAME, EMAIL, TYPE, CREATED_AT FROM {os.environ.get('SF_DATABASE','RAD_DB')}.{os.environ.get('SF_SCHEMA','PUBLIC')}.CLIENTS ORDER BY NAME")
            if rows:
                clients = []
                for r in rows:
                    clients.append({
                        "id": r[0],
                        "name": r[1],
                        "email": r[2],
                        "type": r[3],
                        "created_at": str(r[4]) if r[4] is not None else None,
                        "updated_at": None,
                    })
                return clients
        except Exception:
            pass

        # Fallback to demo clients if DB not configured or empty
        return DEMO_CLIENTS
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/clients")
async def create_client(client: Dict):
    try:
        # Insert into Snowflake CLIENTS table when possible
        cid = client.get("id") or client.get("name")
        name = client.get("name") or cid
        email = client.get("email") or ''
        ctype = client.get("type") or 'custodian'
        try:
            sql = f"INSERT INTO {os.environ.get('SF_DATABASE','RAD_DB')}.{os.environ.get('SF_SCHEMA','PUBLIC')}.CLIENTS (ID,NAME,EMAIL,TYPE) SELECT '{cid}','{name}','{email}','{ctype}' WHERE NOT EXISTS (SELECT 1 FROM {os.environ.get('SF_DATABASE','RAD_DB')}.{os.environ.get('SF_SCHEMA','PUBLIC')}.CLIENTS WHERE ID='{cid}')"
            run_sql(sql, fetch=False)
            return {"message": "Client created", "client": {"id": cid, "name": name, "email": email, "type": ctype}}
        except Exception:
            return {"message": "Client created (local only)", "client": client}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/positions")
async def get_positions(client_id: Optional[str] = None):
    try:
        snapshot = await _snapshot_data()
        if client_id:
            snapshot = [p for p in snapshot if p.get("ACCOUNT") == client_id]
        return {"positions": snapshot}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/market-data")
async def get_market_data(ticker: str):
    try:
        sym = (ticker or "").upper()
        rows = run_sql(f"SELECT SYMBOL,P,BID,ASK,TS FROM {os.environ.get('SF_DATABASE','RAD_DB')}.{os.environ.get('SF_SCHEMA','PUBLIC')}.PRICES WHERE SYMBOL='{sym}'")
        if rows:
            r = rows[0]
            return {"symbol": r[0], "price": r[1], "bid": r[2], "ask": r[3], "ts": str(r[4])}
        return {"symbol": sym, "price": None}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# Register the router with the main app from app.py
main_app.include_router(router)

print("[backend] API router registered on main app under /api")
