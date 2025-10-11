import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY not configured");
    }

    const { portfolioData, clientName } = await req.json();

    if (!portfolioData || !clientName) {
      return new Response(JSON.stringify({ error: "Missing required data" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { positions, totals } = portfolioData;

    // Build analysis prompt
    const prompt = `You are a financial analyst providing comprehensive portfolio insights. Analyze this portfolio data:

Client: ${clientName}
Total Market Value: $${totals.market_value.toLocaleString()}
Total P&L: $${totals.pnl.toLocaleString()}

Positions:
${positions.map((p: any) => `- ${p.ticker}: ${p.quantity} shares @ $${p.price}, Value: $${p.market_value.toFixed(2)}, P&L: $${p.pnl.toFixed(2)}`).join('\n')}

Provide a detailed analysis covering:
1. **Risk Assessment & Recommendations**: Evaluate portfolio risk level, concentration risks, and provide actionable recommendations
2. **Market Sentiment**: Analyze current market conditions affecting these positions
3. **Diversification**: Assess diversification quality and suggest improvements
4. **Performance Commentary**: Evaluate returns and position performance
5. **Predictions & Trends**: Provide forward-looking analysis and trend predictions

Format your response in markdown with clear sections. Be specific, data-driven, and actionable.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content: "You are an expert financial analyst specializing in portfolio analysis, risk management, and investment strategy. Provide detailed, actionable insights based on portfolio data.",
          },
          {
            role: "user",
            content: prompt,
          },
        ],
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded, please try again later." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted, please add funds to your workspace." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const data = await response.json();
    const analysis = data.choices?.[0]?.message?.content;

    if (!analysis) {
      throw new Error("No analysis generated");
    }

    return new Response(
      JSON.stringify({ analysis }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("analyze-portfolio-insights error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
