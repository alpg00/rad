import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { TrendingUp, TrendingDown, Loader2 } from "lucide-react";
import { supabase } from "@/lib/supabase";

interface PLTrackerProps {
  clientName: string;
}

const PLTracker = ({ clientName }: PLTrackerProps) => {
  const [pnl, setPnl] = useState(0);
  const [percentage, setPercentage] = useState(0);
  const [isPositive, setIsPositive] = useState(true);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadPortfolio();
    
    // Refresh every 30 seconds
    const interval = setInterval(() => {
      loadPortfolio();
    }, 30000);

    return () => clearInterval(interval);
  }, [clientName]);

  const loadPortfolio = async () => {
    try {
      setLoading(true);
      
      // Get client by name
      const { data: clients } = await supabase
        .from('clients')
        .select('id')
        .eq('name', clientName)
        .single();

      if (!clients) {
        setLoading(false);
        return;
      }

      // Get positions for client
      const { data: positions } = await supabase
        .from('positions')
        .select('*')
        .eq('client_id', clients.id);

      // Get market data
      const { data: marketData } = await supabase
        .from('market_data')
        .select('*');

      let totalValue = 0;
      let totalCost = 0;

      positions?.forEach(position => {
        const price = marketData?.find(m => m.ticker === position.ticker);
        const currentPrice = price?.current_price || 0;
        const marketValue = Number(position.quantity) * Number(currentPrice);
        const costBasis = Number(position.quantity) * Number(position.cost_basis);
        
        totalValue += marketValue;
        totalCost += costBasis;
      });

      const totalPnL = totalValue - totalCost;
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
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-success animate-pulse" />
            <span className="text-xs text-muted-foreground">Live</span>
          </div>
        </div>
      </div>
    </Card>
  );
};

export default PLTracker;
