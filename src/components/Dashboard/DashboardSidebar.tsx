import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { TrendingUp, TrendingDown, Loader2 } from "lucide-react";
import type { ClientSummary } from "@/types/portfolio";
import { supabase } from "@/lib/supabase";

interface DashboardSidebarProps {
  selectedClient: string;
  onSelectClient: (client: string) => void;
  isOpen: boolean;
  onClientsLoaded: (clients: ClientSummary[]) => void;
}

const DashboardSidebar = ({
  selectedClient,
  onSelectClient,
  isOpen,
  onClientsLoaded,
}: DashboardSidebarProps) => {
  const [clients, setClients] = useState<ClientSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadClients();
  }, []);

  const loadClients = async () => {
    try {
      setLoading(true);
      
      // Fetch clients from Supabase
      const { data: clients, error: clientsError } = await supabase
        .from('clients')
        .select('*')
        .order('name');

      if (clientsError) throw clientsError;

      // Fetch all positions and market data
      const { data: positions, error: positionsError } = await supabase
        .from('positions')
        .select('*');

      if (positionsError) throw positionsError;

      const { data: marketData, error: marketError } = await supabase
        .from('market_data')
        .select('*');

      if (marketError) throw marketError;

      // Calculate portfolio summaries for each client
      const clientSummaries: ClientSummary[] = clients.map((client) => {
        const clientPositions = positions.filter(p => p.client_id === client.id);
        
        let totalValue = 0;
        let totalCost = 0;

        clientPositions.forEach(position => {
          const price = marketData.find(m => m.ticker === position.ticker);
          const currentPrice = price?.current_price || 0;
          const marketValue = Number(position.quantity) * Number(currentPrice);
          const costBasis = Number(position.quantity) * Number(position.cost_basis);
          
          totalValue += marketValue;
          totalCost += costBasis;
        });

        const totalPnL = totalValue - totalCost;
        const performance = totalCost > 0 ? (totalPnL / totalCost) * 100 : 0;

        return {
          ...client,
          performance: parseFloat(performance.toFixed(2)),
          value: `$${(totalValue / 1_000_000).toFixed(1)}M`,
        } as ClientSummary;
      });

      setClients(clientSummaries);
      onClientsLoaded(clientSummaries);
    } catch (error) {
      console.error('Error loading clients:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <aside
        className={cn(
          "w-80 border-r border-border bg-card/30 backdrop-blur-sm transition-all duration-300",
          "lg:translate-x-0 flex items-center justify-center",
          isOpen ? "translate-x-0" : "-translate-x-full absolute lg:relative h-full z-40"
        )}
      >
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </aside>
    );
  }

  return (
    <aside
      className={cn(
        "w-80 border-r border-border bg-card/30 backdrop-blur-sm transition-all duration-300",
        "lg:translate-x-0",
        isOpen ? "translate-x-0" : "-translate-x-full absolute lg:relative h-full z-40"
      )}
    >
      <div className="p-6 space-y-4">
        <h2 className="text-lg font-semibold text-foreground">Custodian Portfolios</h2>
        <div className="space-y-2">
          {clients.map((client) => (
            <button
              key={client.id}
              onClick={() => onSelectClient(client.name)}
              className={cn(
                "w-full p-4 rounded-lg border transition-all duration-200",
                "hover:border-primary/50 hover:bg-accent/50",
                selectedClient === client.name
                  ? "border-primary bg-accent shadow-glow-primary"
                  : "border-border bg-card"
              )}
            >
              <div className="flex items-start justify-between">
                <div className="text-left flex-1">
                  <p className="font-medium text-sm text-foreground">
                    {client.name}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {client.value}
                  </p>
                </div>
                <div className="flex flex-col items-end ml-2">
                  <div
                    className={cn(
                      "flex items-center gap-1 text-sm font-semibold",
                      client.performance > 0
                        ? "text-gain"
                        : "text-loss"
                    )}
                  >
                    {client.performance > 0 ? (
                      <TrendingUp className="h-4 w-4" />
                    ) : (
                      <TrendingDown className="h-4 w-4" />
                    )}
                    {Math.abs(client.performance)}%
                  </div>
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>
    </aside>
  );
};

export default DashboardSidebar;
