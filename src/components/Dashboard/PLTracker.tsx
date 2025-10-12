import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { TrendingUp, TrendingDown, Loader2 } from "lucide-react";
import { API_ENDPOINTS, apiCall } from "@/config/api";
import { useWebSocket } from "@/hooks/useWebSocket";
import { ConnectionStatus } from "@/components/Dashboard/ConnectionStatus";

interface PLTrackerProps {
  clientName: string;
  symbols?: string[];
}

const PLTracker = ({ clientName, symbols = [] }: PLTrackerProps) => {
  const [pnl, setPnl] = useState(0);
  const [percentage, setPercentage] = useState(0);
  const [isPositive, setIsPositive] = useState(true);
  const [loading, setLoading] = useState(true);
  const { connected, priceUpdates } = useWebSocket(symbols);

  // Initial load and setup WebSocket subscription
  useEffect(() => {
    loadPortfolio();
  }, [clientName]);

  // Handle real-time price updates
  useEffect(() => {
    if (Object.keys(priceUpdates).length > 0) {
      loadPortfolio();
    }
  }, [priceUpdates]);

  const loadPortfolio = async () => {
    try {
      setLoading(true);
      const data = await apiCall<any>(API_ENDPOINTS.analyzePortfolio, {
        method: 'POST',
        body: JSON.stringify({ clientName })
      });

      const totalPnL = data?.totals?.pnl || 0;
      const totalValue = data?.totals?.market_value || 0;
      const totalCost = totalValue - totalPnL;
      const performancePercent = totalCost > 0 ? (totalPnL / totalCost) * 100 : 0;

      setPnl(totalPnL);
      setPercentage(Math.abs(performancePercent));
      setIsPositive(totalPnL >= 0);
    } catch (error) {
      console.error('Error loading P&L:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Card className="p-6 bg-gradient-to-br from-card to-metric-card border-border">
        <div className="flex items-center justify-center h-24">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-6 bg-gradient-to-br from-card to-metric-card border-border">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-muted-foreground mb-2">Total P&L</p>
          <p
            className={cn(
              "text-4xl font-bold",
              isPositive ? "text-gain" : "text-loss"
            )}
          >
            {isPositive ? "+" : "-"}${Math.abs(pnl).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <div
            className={cn(
              "flex items-center gap-2 text-lg font-semibold",
              isPositive ? "text-gain" : "text-loss"
            )}
          >
            {isPositive ? (
              <TrendingUp className="h-5 w-5" />
            ) : (
              <TrendingDown className="h-5 w-5" />
            )}
            {percentage.toFixed(2)}%
          </div>
          <ConnectionStatus symbols={symbols} />
        </div>
      </div>
    </Card>
  );
};

export default PLTracker;
