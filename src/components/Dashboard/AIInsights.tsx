import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, Sparkles, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";
import { API_ENDPOINTS, apiCall } from "@/config/api";

interface AIInsightsProps {
  clientName: string;
}

const DEMO_INSIGHTS = {
  "Quantum Capital Fund": `## Risk Assessment & Recommendations

**Risk Level:** Moderate to High  
**Concentration Risk:** Portfolio shows significant concentration in large-cap tech stocks (AAPL, MSFT, GOOGL, AMZN, TSLA), representing nearly 100% of holdings. This creates substantial sector-specific risk.

**Recommendations:**
- Diversify across sectors (healthcare, financials, consumer staples) to reduce tech exposure
- Consider adding bonds or fixed-income securities for stability
- Implement stop-loss orders on high-volatility positions like TSLA

## Market Sentiment Analysis

Current market conditions favor large-cap technology stocks with strong fundamentals. The portfolio is well-positioned for continued AI and cloud computing growth. However, recent Fed policy shifts and inflation concerns create near-term volatility risk.

**Key Factors:**
- Tech sector momentum remains strong but overbought signals emerging
- TSLA showing higher volatility due to EV market competition
- AAPL and MSFT demonstrating resilient earnings despite macro headwinds

## Diversification Assessment

**Current Status:** Poor diversification  
**Sector Allocation:** 100% Technology  
**Geographic Exposure:** Primarily US-based companies

**Suggestions:**
- Add international exposure (emerging markets, European equities)
- Include defensive sectors (utilities, healthcare, consumer staples)
- Consider REITs or commodities for inflation protection
- Target allocation: 60% Tech, 20% Healthcare, 10% Financials, 10% Other

## Performance Commentary

Portfolio demonstrates strong year-to-date performance with positive P&L across most positions. The tech-heavy allocation has benefited from AI-driven growth narratives and strong earnings.

**Position Analysis:**
- AAPL: Solid performer with consistent dividend income
- MSFT: Benefiting from Azure cloud growth and AI integration
- GOOGL: Search dominance but facing regulatory headwinds
- AMZN: E-commerce recovery and AWS strength
- TSLA: High beta position with significant upside/downside potential

## Predictions & Trend Analysis

**Short-term (3-6 months):**
- Expect continued volatility as markets digest economic data
- Tech sector may consolidate gains before next leg higher
- TSLA faces increased competition risk

**Medium-term (6-12 months):**
- AI adoption will continue driving MSFT, GOOGL performance
- AAPL likely to maintain premium valuation
- Consider rotating some gains into value sectors

**Key Risks to Monitor:**
- Rising interest rates impacting growth stock valuations
- Regulatory challenges for big tech
- Geopolitical tensions affecting supply chains`,

  "Apex Growth Partners": `## Risk Assessment & Recommendations

**Risk Level:** High  
**Concentration Risk:** Extremely concentrated in semiconductor and mega-cap tech stocks (NVDA, META, AMD, INTC). This creates severe sector correlation risk.

**Recommendations:**
- Urgent diversification needed beyond semiconductors
- Reduce exposure to chip cycle volatility by adding stable dividend payers
- Consider hedging strategies given high portfolio beta

## Market Sentiment Analysis

Semiconductor sector experiencing robust demand driven by AI infrastructure buildout. However, cyclical nature of chip industry presents downside risk if demand softens.

**Key Factors:**
- NVDA trading at premium valuations due to AI GPU dominance
- META recovering from metaverse pivot with strong ad revenue
- AMD gaining market share but facing NVDA competition
- INTC struggling with execution and market share losses

## Diversification Assessment

**Current Status:** Very Poor - Critical Issue  
**Sector Allocation:** 80% Semiconductors, 20% Social Media  
**Concentration Risk:** Extremely high

**Urgent Suggestions:**
- Immediately diversify into non-tech sectors
- Add healthcare and financial services exposure
- Include fixed-income allocation for downside protection
- Target allocation: 40% Tech, 25% Healthcare, 20% Financials, 15% Bonds

## Performance Commentary

Portfolio shows strong performance driven by AI boom and semiconductor demand. However, this concentration creates significant volatility and drawdown risk.

**Position Analysis:**
- NVDA: Exceptional performer but valuation stretched
- META: Successful cost-cutting and AI product integration
- NFLX: Benefiting from password sharing crackdown
- AMD: Growing but facing competitive pressure
- INTC: Turnaround story with execution risks

## Predictions & Trend Analysis

**Short-term (3-6 months):**
- Semiconductor stocks may face profit-taking after massive run
- META momentum likely to continue with AI integration
- High volatility expected across all positions

**Medium-term (6-12 months):**
- AI infrastructure spending remains strong tailwind
- Chip cycle concerns may emerge in H2
- Diversification critical before potential correction

**Key Risks to Monitor:**
- Semiconductor inventory cycles
- China-Taiwan geopolitical tensions
- AI infrastructure spending slowdown
- Competition in GPU market intensifying`,

  "Horizon Ventures": `## Risk Assessment & Recommendations

**Risk Level:** Moderate  
**Concentration Risk:** Portfolio concentrated in financial services sector (100% allocation). While more defensive than tech, this creates sector-specific risk exposure.

**Recommendations:**
- Add growth sector exposure (technology, healthcare)
- Consider geographic diversification beyond US banks
- Monitor interest rate sensitivity across all positions

## Market Sentiment Analysis

Financial sector facing mixed conditions: higher interest rates boost net interest margins, but recession concerns threaten loan quality. Current positioning benefits from yield curve normalization.

**Key Factors:**
- Rising rates supporting bank profitability
- Credit quality concerns emerging in commercial real estate
- Investment banking revenue under pressure
- Strong capital positions across major banks

## Diversification Assessment

**Current Status:** Poor - Sector Concentration  
**Sector Allocation:** 100% Financials  
**Sub-sector:** 100% Traditional Banking & Investment Banking

**Suggestions:**
- Add technology exposure for growth potential
- Include consumer staples for defensive positioning
- Consider international banks for geographic diversification
- Target allocation: 40% Financials, 30% Tech, 20% Healthcare, 10% Other

## Performance Commentary

Portfolio demonstrates moderate performance with stable dividend income. Financial sector positioning provides defensive characteristics with reasonable upside potential.

**Position Analysis:**
- JPM: Diversified business model, strong risk management
- BAC: Benefiting from rate environment, consumer banking strength
- WFC: Turnaround story progressing, regulatory constraints easing
- GS: Investment banking cyclical headwinds
- MS: Wealth management providing stability

## Predictions & Trend Analysis

**Short-term (3-6 months):**
- Banks to benefit from sustained higher rates
- Credit quality monitoring critical
- Regional bank concerns may impact sector sentiment

**Medium-term (6-12 months):**
- M&A activity may pick up, benefiting investment banks
- Dividend growth expected as capital requirements stabilize
- Regulatory environment remains supportive

**Key Risks to Monitor:**
- Commercial real estate loan exposure
- Recession probability and impact on credit losses
- Regulatory changes affecting capital requirements
- Competition from fintech and digital banking`
};

const AIInsights = ({ clientName }: AIInsightsProps) => {
  const [analysis, setAnalysis] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadInsights();
  }, [clientName]);

  const loadInsights = async () => {
    // Use setLoading for the initial load, setRefreshing for subsequent clicks
    if (!refreshing) setLoading(true);

    try {
      if (clientName in DEMO_INSIGHTS) {
        setAnalysis(DEMO_INSIGHTS[clientName as keyof typeof DEMO_INSIGHTS]);
        return; // Exit early for demo clients
      }

      // For real custodians, call the Python backend
      const data = await apiCall<{ insights: { comment: string } }>(API_ENDPOINTS.getAIInsights, {
        method: 'POST',
        body: JSON.stringify({ clientName })
      });

      // **THE FIX**: Correctly extract the 'comment' property from the 'insights' object.
      setAnalysis(data.insights?.comment || "No insights available at this time.");

    } catch (error) {
      console.error("Error loading AI insights:", error);
      toast.error("Failed to load AI insights");
      setAnalysis("❌ Failed to generate insights. Please try again.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = () => {
    if (!(clientName in DEMO_INSIGHTS)) {
      setRefreshing(true);
      loadInsights();
    }
  };

  if (loading) {
    return (
      <Card className="p-6">
        <div className="flex items-center gap-2 mb-4">
          <Sparkles className="h-5 w-5 text-primary" />
          <h3 className="text-lg font-semibold">AI Portfolio Insights</h3>
        </div>
        <div className="flex items-center justify-center h-48">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-primary" />
          <h3 className="text-lg font-semibold">AI Portfolio Insights</h3>
        </div>
        {!(clientName in DEMO_INSIGHTS) && (
          <Button onClick={handleRefresh} disabled={refreshing} variant="outline" size="sm" className="gap-2">
            {refreshing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            Refresh
          </Button>
        )}
      </div>
      <div className="prose prose-sm dark:prose-invert max-w-none">
        {/* ReactMarkdown components remain unchanged */}
        <ReactMarkdown
          components={{
            h2: ({ children }) => <h2 className="text-lg font-semibold text-foreground mt-3 mb-2">{children}</h2>,
            p: ({ children }) => <p className="text-sm text-muted-foreground mb-2 leading-relaxed">{children}</p>,
            ul: ({ children }) => <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground mb-2">{children}</ul>,
            strong: ({ children }) => <strong className="font-semibold text-foreground">{children}</strong>,
          }}
        >
          {analysis}
        </ReactMarkdown>
      </div>
    </Card>
  );
};

export default AIInsights;