import { cn } from "@/lib/utils";
import { TrendingUp, TrendingDown } from "lucide-react";

interface Client {
  name: string;
  performance: number;
  value: string;
}

const clients: Client[] = [
  { name: "Quantum Capital Fund", performance: 2.4, value: "$12.4M" },
  { name: "Apex Growth Partners", performance: -0.8, value: "$8.2M" },
  { name: "Horizon Ventures", performance: 1.2, value: "$15.6M" },
  { name: "Sterling Asset Management", performance: 3.1, value: "$22.8M" },
  { name: "Pinnacle Investment Group", performance: -1.5, value: "$9.7M" },
];

interface DashboardSidebarProps {
  selectedClient: string;
  onSelectClient: (client: string) => void;
  isOpen: boolean;
}

const DashboardSidebar = ({
  selectedClient,
  onSelectClient,
  isOpen,
}: DashboardSidebarProps) => {
  return (
    <aside
      className={cn(
        "w-80 border-r border-border bg-card/30 backdrop-blur-sm transition-all duration-300",
        "lg:translate-x-0",
        isOpen ? "translate-x-0" : "-translate-x-full absolute lg:relative h-full z-40"
      )}
    >
      <div className="p-6 space-y-4">
        <h2 className="text-lg font-semibold text-foreground">Client Portfolios</h2>
        <div className="space-y-2">
          {clients.map((client) => (
            <button
              key={client.name}
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
