import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { TrendingUp, TrendingDown } from "lucide-react";
import { cn } from "@/lib/utils";

const PLTracker = () => {
  const [pnl, setPnl] = useState(45230.5);
  const [percentage, setPercentage] = useState(2.4);
  const [isPositive, setIsPositive] = useState(true);

  useEffect(() => {
    const interval = setInterval(() => {
      // Simulate real-time updates
      const change = (Math.random() - 0.5) * 500;
      const newPnl = pnl + change;
      const newPercentage = (change / 100000) * 100;
      
      setPnl(newPnl);
      setPercentage(Math.abs(newPercentage));
      setIsPositive(change > 0);
    }, 2000);

    return () => clearInterval(interval);
  }, [pnl]);

  return (
    <Card className="p-6 bg-gradient-to-br from-card to-metric-card border-border">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-muted-foreground mb-1">
            Today's P&L
          </p>
          <div className="flex items-baseline gap-3">
            <h2
              className={cn(
                "text-4xl font-bold transition-all duration-300",
                isPositive ? "text-gain" : "text-loss"
              )}
            >
              ${pnl.toLocaleString("en-US", {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </h2>
            <div
              className={cn(
                "flex items-center gap-1 text-lg font-semibold transition-all duration-300",
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
          </div>
        </div>
        <div className="flex flex-col items-end gap-2">
          <div className="flex items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-gain animate-pulse" />
            <span className="text-xs text-muted-foreground">Live</span>
          </div>
          <p className="text-xs text-muted-foreground">
            Last update: {new Date().toLocaleTimeString()}
          </p>
        </div>
      </div>
    </Card>
  );
};

export default PLTracker;
