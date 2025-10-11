import { Card } from "@/components/ui/card";
import { AlertTriangle, Shield, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";

interface Metric {
  label: string;
  value: string;
  status: "good" | "warning" | "alert";
  icon: typeof Shield;
}

const metrics: Metric[] = [
  {
    label: "VaR (95%)",
    value: "$125K",
    status: "good",
    icon: Shield,
  },
  {
    label: "Sharpe Ratio",
    value: "1.82",
    status: "good",
    icon: TrendingUp,
  },
  {
    label: "Max Drawdown",
    value: "-8.4%",
    status: "warning",
    icon: AlertTriangle,
  },
];

const RiskMetrics = () => {
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
                Portfolio concentration exceeds 15%
              </p>
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
};

export default RiskMetrics;
