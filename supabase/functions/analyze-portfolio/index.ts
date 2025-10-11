import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
    const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const ALPACA_KEY = Deno.env.get("ALPACA_API_KEY");
    const ALPACA_SECRET = Deno.env.get("ALPACA_API_SECRET");

    if (!ALPACA_KEY || !ALPACA_SECRET) {
      return new Response(JSON.stringify({ error: "Missing Alpaca API credentials" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const authHeader = req.headers.get("Authorization") ?? "";
    const jwt = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : undefined;

    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: jwt ? { Authorization: `Bearer ${jwt}` } : {} },
    });
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

    const { clientName } = await req.json();
    if (!clientName) {
      return new Response(JSON.stringify({ error: "clientName is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Resolve client
    const { data: client, error: cErr } = await admin
      .from("clients")
      .select("id, created_at")
      .ilike("name", clientName)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (cErr || !client) {
      return new Response(JSON.stringify({ error: "Client not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Load positions
    const { data: positions, error: pErr } = await admin
      .from("positions")
      .select("id,ticker,quantity,cost_basis")
      .eq("client_id", client.id);
    if (pErr) throw pErr;
    if (!positions || positions.length === 0) {
      return new Response(JSON.stringify({ positions: [], totals: { market_value: 0, pnl: 0 } }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const tickers = [...new Set(positions.map((p) => p.ticker))];

    // Fetch latest trade price per ticker from Alpaca (batch by 50)
    async function fetchPrices(symbols: string[]): Promise<Record<string, number>> {
      const result: Record<string, number> = {};
      for (let i = 0; i < symbols.length; i += 50) {
        const batch = symbols.slice(i, i + 50).join(",");
        const url = `https://data.alpaca.markets/v2/stocks/trades/latest?symbols=${encodeURIComponent(batch)}`;
        const resp = await fetch(url, {
          headers: {
            "APCA-API-KEY-ID": ALPACA_KEY!,
            "APCA-API-SECRET-KEY": ALPACA_SECRET!,
          },
        });
        if (!resp.ok) throw new Error(`Alpaca error: ${resp.status}`);
        const data = await resp.json();
        // data: { trades: { AAPL: { T: 't', p: 175.5, ... }, ... } }
        const trades = data.trades || {};
        for (const sym of Object.keys(trades)) {
          const price = Number(trades[sym]?.p);
          if (isFinite(price)) result[sym.toUpperCase()] = price;
        }
      }
      return result;
    }

    const prices = await fetchPrices(tickers);

    // Compute values
    const detailed = positions.map((p) => {
      const price = prices[p.ticker.toUpperCase()] ?? 0;
      const market_value = price * Number(p.quantity);
      const pnl = (price - Number(p.cost_basis)) * Number(p.quantity);
      return { ...p, price, market_value, pnl };
    });

    const totals = detailed.reduce(
      (acc, d) => {
        acc.market_value += d.market_value;
        acc.pnl += d.pnl;
        return acc;
      },
      { market_value: 0, pnl: 0 }
    );

    // Optionally upsert market_data cache
    for (const [ticker, price] of Object.entries(prices)) {
      await admin.from("market_data").upsert({ ticker, current_price: price, updated_at: new Date().toISOString() }, { onConflict: "ticker" });
    }

    return new Response(
      JSON.stringify({ positions: detailed, totals }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("analyze-portfolio error", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});