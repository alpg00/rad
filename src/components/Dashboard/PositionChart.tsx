import { useState, useEffect } from "react";
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
import { API_ENDPOINTS, apiCall } from "@/config/api";
import { useWebSocket } from "@/hooks/useWebSocket";
import type { ReactElement } from 'react';

interface DataPoint {
  time: string;
  value: number;
}

interface PositionChartProps {
  clientName: string;
  symbols?: string[];  // Optional list of symbols to track
}

const PositionChart = ({ clientName, symbols = [] }: PositionChartProps) => {
  const [data, setData] = useState<DataPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [portfolioValue, setPortfolioValue] = useState<number>(0);
  const { connected, priceUpdates } = useWebSocket(symbols);

  // Load initial portfolio value and setup chart
  useEffect(() => {
    loadInitialData();
  }, [clientName]);

  const loadInitialData = async () => {
    setLoading(true);
    const initialData: DataPoint[] = [];
    const now = new Date();
    
    try {
      const analysis = await apiCall<any>(API_ENDPOINTS.analyzePortfolio, {
        method: 'POST',
        body: JSON.stringify({ clientName })
      });

      const currentValue = analysis?.totals?.market_value || 0;
      setPortfolioValue(currentValue);
      
      // Initialize with current value for the last 30 minutes
      for (let i = 30; i >= 0; i--) {
        const time = new Date(now.getTime() - i * 60000);
        initialData.push({
          time: time.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          value: currentValue,
        });
      }
      
      setData(initialData);
    } catch (error) {
      console.error('Error loading chart data:', error);
    } finally {
      setLoading(false);
    }
  };

  // Update data when we receive price updates
  useEffect(() => {
    if (Object.keys(priceUpdates).length === 0) return;

    const updatePortfolioValue = async () => {
      try {
        // Calculate new portfolio value based on price updates
        const analysis = await apiCall<any>(API_ENDPOINTS.analyzePortfolio, {
          method: 'POST',
          body: JSON.stringify({ clientName })
        });

        const newPortfolioValue = analysis?.totals?.market_value || portfolioValue;
        setPortfolioValue(newPortfolioValue);

        // Update chart with new value
        const now = new Date();
        setData((prevData) => {
          const newData = [...prevData.slice(1)];
          newData.push({
            time: now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
            value: newPortfolioValue,
          });
          return newData;
        });
      } catch (error) {
        console.error('Error updating portfolio value:', error);
      }
    };

    updatePortfolioValue();
  }, [priceUpdates, clientName, portfolioValue]);

  if (loading) {
    return (
      <Card className="p-6 bg-gradient-to-br from-card to-metric-card border-border">
        <h3 className="text-lg font-semibold mb-4">Portfolio Value</h3>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-6 bg-gradient-to-br from-card to-metric-card border-border">
      <h3 className="text-lg font-semibold mb-4">Portfolio Value</h3>
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={data}>
          <XAxis
            dataKey="time"
            stroke="hsl(var(--muted-foreground))"
            tick={{ fontSize: 12 }}
          />
          <YAxis
            stroke="hsl(var(--muted-foreground))"
            tick={{ fontSize: 12 }}
            tickFormatter={(value) => `$${(value / 1000000).toFixed(2)}M`}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: "hsl(var(--card))",
              border: "1px solid hsl(var(--border))",
              borderRadius: "8px",
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
            animationDuration={300}
          />
        </LineChart>
      </ResponsiveContainer>
    </Card>
  );
};

export default PositionChart;
