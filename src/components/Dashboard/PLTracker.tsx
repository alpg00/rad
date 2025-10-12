import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { TrendingUp, TrendingDown, Loader2 } from "lucide-react";

// Define the shape of a single position object that this component receives
interface Position {
  SYMBOL: string;
  QTY: number;
  LAST_PRICE: number | null;
  SOD_PRICE: number | null; // Start of Day Price
  COST_BASIS: number | null;
}

// The component now only needs one prop: the live data array
interface PLTrackerProps {
  data: Position[];
}

const PLTracker = ({ data }: PLTrackerProps) => {
  // --- 1. Guard Clause ---
  // If the data hasn't arrived yet from the parent, show a loading state.
  // This prevents the component from crashing with empty data.
  if (!data || data.length === 0) {
    return (
      <Card className="p-6 bg-gradient-to-br from-card to-metric-card border-border">
        <div className="flex items-center justify-center h-24">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <span className="ml-4 text-muted-foreground">Loading P&L Data...</span>
        </div>
      </Card>
    );
  }

  // --- 2. Calculate P&L Directly from Props ---
  // All calculations are done on every render. No complex useEffect or useState needed.
  const totals = data.reduce(
    (acc, position) => {
      const price = position.LAST_PRICE ?? position.SOD_PRICE ?? 0;
      const marketValue = (position.QTY || 0) * price;

      // Use cost basis if available, otherwise fall back to SOD value
      const costBasis = position.COST_BASIS ?? (position.QTY || 0) * (position.SOD_PRICE ?? 0);
      
      acc.totalMarketValue += marketValue;
      acc.totalCostBasis += costBasis;
      
      return acc;
    },
    { totalMarketValue: 0, totalCostBasis: 0 }
  );

  const totalPnl = totals.totalMarketValue - totals.totalCostBasis;
  const percentage = totals.totalCostBasis > 0 ? (totalPnl / totals.totalCostBasis) * 100 : 0;
  const isPositive = totalPnl >= 0;

  // --- 3. Render the UI ---
  // The JSX now uses the calculated constants directly.
  return (
    <Card className="p-6 bg-gradient-to-br from-card to-metric-card border-border">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-muted-foreground mb-2">Total P&L</p>
          <p
            className={cn(
              "text-4xl font-bold",
              isPositive ? "text-green-500" : "text-red-500" // Using clearer colors
            )}
          >
            {isPositive ? "+" : "-"}${Math.abs(totalPnl).toLocaleString(undefined, {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}
          </p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <div
            className={cn(
              "flex items-center gap-2 text-lg font-semibold",
              isPositive ? "text-green-500" : "text-red-500"
            )}
          >
            {isPositive ? (
              <TrendingUp className="h-5 w-5" />
            ) : (
              <TrendingDown className="h-5 w-5" />
            )}
            {percentage.toFixed(2)}%
          </div>
          {/* You can add a connection status indicator here if needed */}
        </div>
      </div>
    </Card>
  );
};

export default PLTracker;