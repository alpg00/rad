import { useMemo } from "react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { AlertTriangle, TrendingUp, Activity, Loader2 } from "lucide-react";

// Define the shape of a single position object that this component receives
interface Position {
  QTY: number;
  LAST_PRICE: number | null;
  SOD_PRICE: number | null;
  COST_BASIS: number | null;
}

// The component now only needs one prop: the live data array
interface RiskMetricsProps {
  data: Position[];
}

// Define the structure for a single metric item for rendering
interface Metric {
  label: string;
  value: string;
  status: "good" | "warning" | "alert";
  icon: React.ElementType;
}

const RiskMetrics = ({ data }: RiskMetricsProps) => {
  
  // 1. Add a guard clause to show a loading state until data arrives.
  if (!data || data.length === 0) {
    return (
      <Card className="p-6 bg-gradient-to-br from-card to-metric-card border-border h-full">
        <h3 className="text-lg font-semibold mb-4">Risk Metrics</h3>
        <div className="flex items-center justify-center h-48">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </Card>
    );
  }

  // 2. Calculate all risk metrics directly from the 'data' prop.
  // useMemo ensures this only runs when the 'data' prop changes.
  const metrics: Metric[] = useMemo(() => {
    let totalMarketValue = 0;
    const pnlValues: number[] = [];

    data.forEach(position => {
      const price = position.LAST_PRICE ?? position.SOD_PRICE ?? 0;
      const marketValue = (position.QTY || 0) * price;
      const costBasis = position.COST_BASIS ?? (position.QTY || 0) * (position.SOD_PRICE ?? 0);
      
      totalMarketValue += marketValue;
      if (costBasis > 0) {
        pnlValues.push(marketValue - costBasis);
      }
    });

    // VaR Calculation (simplified)
    const sortedPnL = [...pnlValues].sort((a, b) => a - b);
    const varIndex = Math.floor(sortedPnL.length * 0.05);
    const var95 = Math.abs(sortedPnL[varIndex] || 0);

    // Sharpe Ratio Calculation (simplified)
    const avgReturn = pnlValues.length > 0 ? pnlValues.reduce((a, b) => a + b, 0) / pnlValues.length : 0;
    const stdDev = pnlValues.length > 0 ? Math.sqrt(pnlValues.map(x => Math.pow(x - avgReturn, 2)).reduce((a, b) => a + b) / pnlValues.length) : 0;
    const sharpeRatio = stdDev > 0 ? avgReturn / stdDev : 0;

    // Max Drawdown (using overall PnL)
    const totalPnl = pnlValues.reduce((a, b) => a + b, 0);
    const totalCostBasis = totalMarketValue - totalPnl;
    const maxDrawdown = totalCostBasis > 0 ? (totalPnl / totalCostBasis) * 100 : 0;

    return [
      {
        label: "VaR (95%)",
        value: `$${(var95 / 1000).toFixed(1)}K`,
        status: var95 > totalMarketValue * 0.05 ? "warning" : "good",
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
    ];
  }, [data]);

  // 3. Render the UI using the calculated metrics.
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
                metric.status === "good" && "border-green-500/30 bg-green-500/5",
                metric.status === "warning" && "border-yellow-500/30 bg-yellow-500/5",
                metric.status === "alert" && "border-red-500/30 bg-red-500/5"
              )}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div
                    className={cn(
                      "p-2 rounded-lg",
                      metric.status === "good" && "bg-green-500/20",
                      metric.status === "warning" && "bg-yellow-500/20",
                      metric.status === "alert" && "bg-red-500/20"
                    )}
                  >
                    <Icon
                      className={cn(
                        "h-5 w-5",
                        metric.status === "good" && "text-green-500",
                        metric.status === "warning" && "text-yellow-500",
                        metric.status === "alert" && "text-red-500"
                      )}
                    />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">{metric.label}</p>
                    <p className="text-lg font-semibold text-foreground">{metric.value}</p>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
};

export default RiskMetrics;