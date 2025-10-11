import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, Sparkles, RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";

interface AIInsightsProps {
  clientName: string;
}

const AIInsights = ({ clientName }: AIInsightsProps) => {
  const [analysis, setAnalysis] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadInsights();
  }, [clientName]);

  const loadInsights = async () => {
    try {
      setLoading(true);

      // First get portfolio data
      const { data: portfolioData, error: portfolioError } = await supabase.functions.invoke(
        "analyze-portfolio",
        {
          body: { clientName },
        }
      );

      if (portfolioError) throw portfolioError;

      if (!portfolioData?.positions || portfolioData.positions.length === 0) {
        setAnalysis("No positions available for analysis. Please upload portfolio data.");
        return;
      }

      // Then get AI insights
      const { data: insightsData, error: insightsError } = await supabase.functions.invoke(
        "analyze-portfolio-insights",
        {
          body: {
            portfolioData,
            clientName,
          },
        }
      );

      if (insightsError) {
        if (insightsError.message?.includes("429")) {
          toast.error("Rate limit reached", {
            description: "Please wait a moment before refreshing analysis.",
          });
          setAnalysis("⏳ Rate limit reached. Please wait before requesting another analysis.");
          return;
        }
        if (insightsError.message?.includes("402")) {
          toast.error("AI credits exhausted", {
            description: "Please add funds to continue using AI analysis.",
          });
          setAnalysis("💳 AI credits exhausted. Please top up your workspace credits.");
          return;
        }
        throw insightsError;
      }

      setAnalysis(insightsData.analysis || "No insights generated.");
    } catch (error) {
      console.error("Error loading AI insights:", error);
      toast.error("Failed to load AI insights", {
        description: error instanceof Error ? error.message : "Unknown error occurred",
      });
      setAnalysis("❌ Failed to generate insights. Please try again.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    loadInsights();
  };

  if (loading) {
    return (
      <Card className="p-6 bg-gradient-to-br from-card to-metric-card border-border">
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
    <Card className="p-6 bg-gradient-to-br from-card to-metric-card border-border">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-primary" />
          <h3 className="text-lg font-semibold">AI Portfolio Insights</h3>
        </div>
        <Button
          onClick={handleRefresh}
          disabled={refreshing}
          variant="outline"
          size="sm"
          className="gap-2"
        >
          {refreshing ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="h-4 w-4" />
          )}
          Refresh
        </Button>
      </div>
      <div className="prose prose-sm dark:prose-invert max-w-none">
        <ReactMarkdown
          components={{
            h1: ({ children }) => (
              <h1 className="text-xl font-bold text-foreground mt-4 mb-2">{children}</h1>
            ),
            h2: ({ children }) => (
              <h2 className="text-lg font-semibold text-foreground mt-3 mb-2">{children}</h2>
            ),
            h3: ({ children }) => (
              <h3 className="text-base font-medium text-foreground mt-2 mb-1">{children}</h3>
            ),
            p: ({ children }) => (
              <p className="text-sm text-muted-foreground mb-2 leading-relaxed">{children}</p>
            ),
            ul: ({ children }) => (
              <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground mb-2">
                {children}
              </ul>
            ),
            ol: ({ children }) => (
              <ol className="list-decimal list-inside space-y-1 text-sm text-muted-foreground mb-2">
                {children}
              </ol>
            ),
            strong: ({ children }) => (
              <strong className="font-semibold text-foreground">{children}</strong>
            ),
          }}
        >
          {analysis}
        </ReactMarkdown>
      </div>
    </Card>
  );
};

export default AIInsights;
