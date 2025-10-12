import { useState, useEffect, useMemo } from "react";
import { Card } from "@/components/ui/card";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
} from "recharts";
import { Loader2 } from "lucide-react";

// Define the shape of the data points for our chart's history
interface ChartDataPoint {
  time: string;
  value: number;
}

// Define the shape of a single position object received from the parent
interface Position {
  QTY: number;
  LAST_PRICE: number | null;
  SOD_PRICE: number | null;
}

// The component now only needs one prop: the live data array
interface PositionChartProps {
  data: Position[];
}

const PositionChart = ({ data }: PositionChartProps) => {
  // This state holds the historical data points for the line chart
  const [chartHistory, setChartHistory] = useState<ChartDataPoint[]>([]);

  // --- 1. Calculate the current portfolio value from props ---
  // useMemo prevents this expensive calculation from running on every single render,
  // only when the 'data' prop actually changes.
  const currentPortfolioValue = useMemo(() => {
    if (!data || data.length === 0) {
      return 0;
    }
    return data.reduce((total, position) => {
      const price = position.LAST_PRICE ?? position.SOD_PRICE ?? 0;
      const value = (position.QTY || 0) * price;
      return total + value;
    }, 0);
  }, [data]);

  // --- 2. Update the chart's history when the portfolio value changes ---
  useEffect(() => {
    // Don't update the chart if the value is zero (still loading)
    if (currentPortfolioValue === 0) {
      return;
    }

    const now = new Date();
    const newPoint: ChartDataPoint = {
      time: now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      value: currentPortfolioValue,
    };

    setChartHistory((prevHistory) => {
      // Keep the chart history at a fixed length (e.g., 30 points)
      const updatedHistory = [...prevHistory, newPoint];
      if (updatedHistory.length > 30) {
        return updatedHistory.slice(updatedHistory.length - 30);
      }
      return updatedHistory;
    });
  }, [currentPortfolioValue]);


  // --- 3. Guard Clause for Loading State ---
  // Show a loader if the parent hasn't sent any data yet.
  if (!data || data.length === 0 || chartHistory.length === 0) {
    return (
      <Card className="p-6 bg-gradient-to-br from-card to-metric-card border-border">
        <h3 className="text-lg font-semibold mb-4">Portfolio Value</h3>
        <div className="flex items-center justify-center h-[300px]">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </Card>
    );
  }

  // --- 4. Render the Chart ---
  return (
    <Card className="p-6 bg-gradient-to-br from-card to-metric-card border-border">
      <h3 className="text-lg font-semibold mb-4">Portfolio Value</h3>
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={chartHistory}>
          <XAxis
            dataKey="time"
            stroke="hsl(var(--muted-foreground))"
            tick={{ fontSize: 12 }}
          />
          <YAxis
            stroke="hsl(var(--muted-foreground))"
            tick={{ fontSize: 12 }}
            domain={['dataMin', 'dataMax']} // Makes the Y-axis scale dynamically
            tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: "hsl(var(--card))",
              border: "1px solid hsl(var(--border))",
            }}
            formatter={(value: number) =>
              `$${value.toLocaleString(undefined, {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}`
            }
          />
          <Line
            type="monotone"
            dataKey="value"
            stroke="hsl(var(--primary))"
            strokeWidth={2}
            dot={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </Card>
  );
};

export default PositionChart;