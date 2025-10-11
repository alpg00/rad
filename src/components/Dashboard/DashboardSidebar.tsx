import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { TrendingUp, TrendingDown, Loader2 } from "lucide-react";
import type { ClientSummary } from "@/types/portfolio";
import { API_ENDPOINTS, apiCall } from "@/config/api";

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
      
      const demoNames = [
        "Quantum Capital Fund",
        "Apex Growth Partners",
        "Horizon Ventures",
        "Custodian 1",
        "Custodian 2",
      ];

      // Try to fetch clients from backend
      let baseClients;
      try {
        baseClients = await apiCall<any[]>(API_ENDPOINTS.getClients, {
          method: 'GET'
        });
      } catch {
        // Fallback to demo data
        baseClients = demoNames.map((name, idx) => ({
          id: `demo-${idx}`,
          name,
          email: undefined,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }));
      }

      // Fetch portfolio analysis for each client
      const clientSummaries: ClientSummary[] = await Promise.all(
        baseClients.map(async (client) => {
          try {
            const analysis = await apiCall<any>(API_ENDPOINTS.analyzePortfolio, {
              method: 'POST',
              body: JSON.stringify({ clientName: client.name })
            });

            const totalValue = analysis?.totals?.market_value || 0;
            const totalPnL = analysis?.totals?.pnl || 0;
            const totalCost = totalValue - totalPnL;
            const performance = totalCost > 0 ? (totalPnL / totalCost) * 100 : 0;

            return {
              ...client,
              performance: parseFloat(performance.toFixed(2)),
              value: `$${(totalValue / 1_000_000).toFixed(1)}M`,
            } as ClientSummary;
          } catch (error) {
            console.error(`Error loading portfolio for ${client.name}:`, error);
            return {
              ...client,
              performance: 0,
              value: "$0.0M",
            } as ClientSummary;
          }
        })
      );

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
