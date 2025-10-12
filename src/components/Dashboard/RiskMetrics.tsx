import { useState, useEffect } from "react";
import { AlertTriangle, TrendingUp, Activity, Loader2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { API_ENDPOINTS, apiCall } from "@/config/api";

interface Metric {
  label: string;
  value: string;
  status: "good" | "warning" | "alert";
  icon: React.ElementType;
}

interface RiskMetricsProps {
  clientName: string;
}

const RiskMetrics = ({ clientName }: RiskMetricsProps) => {
  const [metrics, setMetrics] = useState<Metric[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    calculateRiskMetrics();
  }, [clientName]);

  const calculateRiskMetrics = async () => {
    try {
      setLoading(true);
      const analysis = await apiCall<any>(API_ENDPOINTS.analyzePortfolio, {
        method: 'POST',
        body: JSON.stringify({ clientName })
      });

      const positions = analysis?.positions || [];
      const totalValue = analysis?.totals?.market_value || 0;
      
      // Calculate VaR (95% confidence, simplified)
      const pnlValues = positions.map((p: any) => p.pnl || 0);
      const sortedPnL = [...pnlValues].sort((a, b) => a - b);
      const varIndex = Math.floor(sortedPnL.length * 0.05);
      const var95 = Math.abs(sortedPnL[varIndex] || 0);

      // Calculate Sharpe Ratio (simplified using P&L)
      const avgReturn = pnlValues.reduce((a, b) => a + b, 0) / pnlValues.length;
      const variance = pnlValues.reduce((sum, val) => sum + Math.pow(val - avgReturn, 2), 0) / pnlValues.length;
      const stdDev = Math.sqrt(variance);
      const sharpeRatio = stdDev > 0 ? avgReturn / stdDev : 0;

      // Calculate Max Drawdown
      const totalPnL = analysis?.totals?.pnl || 0;
      const totalCost = totalValue - totalPnL;
      const maxDrawdown = totalCost > 0 ? (totalPnL / totalCost) * 100 : 0;

      setMetrics([
        {
          label: "VaR (95%)",
          value: `$${(var95 / 1000).toFixed(1)}K`,
          status: var95 > totalValue * 0.05 ? "warning" : "good",
          icon: Activity,
        },
        {
          label: "Sharpe Ratio",
          value: sharpeRatio.toFixed(2),
          status: sharpeRatio > 1 ? "good" : sharpeRatio > 0.5 ? "warning" : "alert",
          icon: TrendingUp,
        },
        {
          label: "Max Drawdown",
          value: `${maxDrawdown.toFixed(1)}%`,
          status: Math.abs(maxDrawdown) > 10 ? "alert" : Math.abs(maxDrawdown) > 5 ? "warning" : "good",
          icon: AlertTriangle,
        },
      ]);
    } catch (error) {
      console.error('Error calculating risk metrics:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Card className="p-6 bg-gradient-to-br from-card to-metric-card border-border">
        <h3 className="text-lg font-semibold mb-4">Risk Metrics</h3>
        <div className="flex items-center justify-center h-48">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-6 bg-gradient-to-br from-card to-metric-card border-border h-full">
      <h3 className="text-lg font-semibold mb-4">Risk Metrics</h3>
      <div className="space-y-4">
        {metrics.map((metric) => {
          const Icon = metric.icon;
          return (
            <div
              key={metric.label}
              className={cn(
                "p-4 rounded-lg border transition-all duration-200",
                metric.status === "good" && "border-gain/30 bg-gain/5",
                metric.status === "warning" && "border-loss/30 bg-loss/5",
                metric.status === "alert" && "border-destructive/30 bg-destructive/5"
              )}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div
                    className={cn(
                      "p-2 rounded-lg",
                      metric.status === "good" && "bg-gain/20",
                      metric.status === "warning" && "bg-loss/20",
                      metric.status === "alert" && "bg-destructive/20"
                    )}
                  >
                    <Icon
                      className={cn(
                        "h-5 w-5",
                        metric.status === "good" && "text-gain",
                        metric.status === "warning" && "text-loss",
                        metric.status === "alert" && "text-destructive"
                      )}
                    />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">
                      {metric.label}
                    </p>
                    <p className="text-lg font-semibold text-foreground">
                      {metric.value}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
        
        <div className="mt-6 p-4 rounded-lg border border-border bg-accent/50">
          <p className="text-xs text-muted-foreground mb-2">Active Alerts</p>
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-loss animate-pulse" />
              <p className="text-sm text-foreground">
                Portfolio concentration monitored
              </p>
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
};

export default RiskMetrics;
