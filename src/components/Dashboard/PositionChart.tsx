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

interface DataPoint {
  time: string;
  value: number;
}

interface PositionChartProps {
  clientName: string;
}

const PositionChart = ({ clientName }: PositionChartProps) => {
  const [data, setData] = useState<DataPoint[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadInitialData();
    
    const interval = setInterval(() => {
      updateData();
    }, 30000); // Update every 30 seconds

    return () => clearInterval(interval);
  }, [clientName]);

  const loadInitialData = async () => {
    setLoading(true);
    const initialData: DataPoint[] = [];
    const now = new Date();
    
    // Get current portfolio value
    try {
      const analysis = await apiCall<any>(API_ENDPOINTS.analyzePortfolio, {
        method: 'POST',
        body: JSON.stringify({ clientName })
      });

      const currentValue = analysis?.totals?.market_value || 0;
      
      // Generate historical data points (simulated for demo)
      for (let i = 30; i >= 0; i--) {
        const time = new Date(now.getTime() - i * 60000);
        const variance = (Math.random() - 0.5) * 0.02; // ±2% variance
        initialData.push({
          time: time.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          value: currentValue * (1 + variance),
        });
      }
      
      setData(initialData);
    } catch (error) {
      console.error('Error loading chart data:', error);
    } finally {
      setLoading(false);
    }
  };

  const updateData = async () => {
    try {
      const analysis = await apiCall<any>(API_ENDPOINTS.analyzePortfolio, {
        method: 'POST',
        body: JSON.stringify({ clientName })
      });

      const currentValue = analysis?.totals?.market_value || 0;
      
      setData((prevData) => {
        const newData = [...prevData.slice(1)];
        newData.push({
          time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          value: currentValue,
        });
        return newData;
      });
    } catch (error) {
      console.error('Error updating chart:', error);
    }
  };

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
