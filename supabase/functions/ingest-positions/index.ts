import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import * as XLSX from "https://esm.sh/xlsx@0.18.5";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function guessColumns(headers: string[]) {
  const lc = headers.map((h) => h.toLowerCase());
  const find = (cands: string[]) => headers[lc.findIndex((h) => cands.some((c) => h.includes(c)))] ?? null;
  return {
    ticker: find(["ticker", "symbol", "security", "isin"]),
    quantity: find(["qty", "quantity", "shares", "position"]),
    cost_basis: find(["cost basis", "cost", "avg", "average"]),
  } as { ticker: string | null; quantity: string | null; cost_basis: string | null };
}

async function aiMapColumns({ headers, sampleRows }: { headers: string[]; sampleRows: any[] }) {
  try {
    const key = Deno.env.get("LOVABLE_API_KEY");
    if (!key) return null;
    const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: "You map spreadsheet headers to: ticker, quantity, cost_basis. Return strict JSON with those keys whose values are EXACT header strings from `headers`. No commentary." },
          { role: "user", content: `Headers: ${JSON.stringify(headers)}\nSamples: ${JSON.stringify(sampleRows.slice(0, 5))}` },
        ],
      }),
    });
    const data = await resp.json();
    const content = data.choices?.[0]?.message?.content;
    if (!content) return null;
    const jsonMatch = content.match(/\{[\s\S]*\}$/);
    if (!jsonMatch) return null;
    const parsed = JSON.parse(jsonMatch[0]);
    if (parsed && parsed.ticker && parsed.quantity && parsed.cost_basis) return parsed;
    return null;
  } catch (_e) {
    return null;
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_PUBLISHABLE_KEY")!;
    const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const authHeader = req.headers.get("Authorization") ?? "";
    const jwt = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : undefined;

    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: jwt ? { Authorization: `Bearer ${jwt}` } : {} },
    });
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

    const { storagePath, clientName } = await req.json();
    if (!storagePath || !clientName) {
      return new Response(JSON.stringify({ error: "storagePath and clientName are required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Identify user
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData?.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = userData.user.id;

    // Role check: must be custodian
    const { data: roleRows, error: roleErr } = await admin
      .from("user_roles")
      .select("role")
      .eq("user_id", userId);
    if (roleErr || !roleRows?.some((r) => r.role === "custodian" || r.role === "admin")) {
      return new Response(JSON.stringify({ error: "Forbidden: custodian role required" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Ensure client exists
    let { data: client, error: clientErr } = await admin
      .from("clients")
      .select("id")
      .ilike("name", clientName)
      .maybeSingle();

    if (clientErr && clientErr.code !== "PGRST116") {
      console.error("client select error", clientErr);
    }
    if (!client) {
      const { data: ins, error: insErr } = await admin
        .from("clients")
        .insert({ name: clientName })
        .select("id")
        .single();
      if (insErr) throw insErr;
      client = ins;
    }

    // Download file from Storage
    const { data: fileBlob, error: dlErr } = await admin.storage
      .from("portfolio-uploads")
      .download(storagePath);
    if (dlErr || !fileBlob) throw dlErr ?? new Error("File not found");

    const ab = await fileBlob.arrayBuffer();
    const ext = storagePath.split(".").pop()?.toLowerCase();

    let headers: string[] = [];
    let rows: any[] = [];
    if (ext === "csv") {
      const txt = new TextDecoder().decode(new Uint8Array(ab));
      const lines = txt.split(/\r?\n/).filter(Boolean);
      headers = lines[0].split(",").map((h) => h.trim());
      rows = lines.slice(1).map((l) => {
        const parts = l.split(",");
        const obj: Record<string, string> = {};
        headers.forEach((h, i) => (obj[h] = (parts[i] ?? "").trim()));
        return obj;
      });
    } else {
      const wb = XLSX.read(ab, { type: "array" });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const aoa = XLSX.utils.sheet_to_json(ws, { header: 1 }) as any[][];
      headers = (aoa[0] ?? []).map((h) => String(h));
      rows = aoa.slice(1).map((arr) => {
        const obj: Record<string, string> = {};
        headers.forEach((h, i) => (obj[h] = String(arr[i] ?? "")));
        return obj;
      });
    }

    if (headers.length === 0 || rows.length === 0) {
      return new Response(JSON.stringify({ error: "Empty file or unrecognized format" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Map columns via AI (fallback to heuristics)
    const aiMap = await aiMapColumns({ headers, sampleRows: rows.slice(0, 10) });
    const guessed = guessColumns(headers);
    const map = {
      ticker: aiMap?.ticker ?? guessed.ticker,
      quantity: aiMap?.quantity ?? guessed.quantity,
      cost_basis: aiMap?.cost_basis ?? guessed.cost_basis,
    };

    if (!map.ticker || !map.quantity || !map.cost_basis) {
      return new Response(JSON.stringify({ error: "Could not identify required columns (ticker, quantity, cost_basis)" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Prepare inserts
    const inserts = rows
      .map((r) => ({
        client_id: client!.id,
        ticker: String(r[map.ticker!]).trim().toUpperCase(),
        quantity: Number(String(r[map.quantity!]).replace(/[^0-9.\-]/g, "")),
        cost_basis: Number(String(r[map.cost_basis!]).replace(/[^0-9.\-]/g, "")),
        uploaded_by: userId,
      }))
      .filter((x) => x.ticker && isFinite(x.quantity) && isFinite(x.cost_basis));

    // Insert in chunks
    let inserted = 0;
    for (let i = 0; i < inserts.length; i += 100) {
      const chunk = inserts.slice(i, i + 100);
      const { error: insErr2 } = await admin.from("positions").insert(chunk);
      if (insErr2) throw insErr2;
      inserted += chunk.length;
    }

    return new Response(
      JSON.stringify({
        ok: true,
        clientId: client!.id,
        inserted,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("ingest-positions error", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});