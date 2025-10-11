import { useState } from "react";
import DashboardSidebar from "@/components/Dashboard/DashboardSidebar";
import PLTracker from "@/components/Dashboard/PLTracker";
import PositionChart from "@/components/Dashboard/PositionChart";
import RiskMetrics from "@/components/Dashboard/RiskMetrics";
import AIInsights from "@/components/Dashboard/AIInsights";
import ExcelUpload from "@/components/Dashboard/ExcelUpload";
import { Button } from "@/components/ui/button";
import { Menu } from "lucide-react";
import type { ClientSummary } from "@/types/portfolio";

const Index = () => {
  const [selectedClient, setSelectedClient] = useState("Quantum Capital Fund");
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [clients, setClients] = useState<ClientSummary[]>([]);

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="flex items-center justify-between px-6 py-4">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="lg:hidden"
            >
              <Menu className="h-5 w-5" />
            </Button>
            <h1 className="text-2xl font-bold bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
              RAD
            </h1>
            <span className="text-sm text-muted-foreground hidden sm:inline">
              Real-time Asset Dashboard
            </span>
          </div>
          <div className="text-sm text-muted-foreground">
            {selectedClient}
          </div>
        </div>
      </header>

      <div className="flex">
        {/* Sidebar */}
        <DashboardSidebar
          selectedClient={selectedClient}
          onSelectClient={setSelectedClient}
          isOpen={sidebarOpen}
          onClientsLoaded={setClients}
        />

        {/* Main Content */}
        <main className="flex-1 p-6 space-y-6">
          {/* P&L Tracker */}
          <PLTracker clientName={selectedClient} />

          {/* Chart and Risk Metrics */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2">
              <PositionChart clientName={selectedClient} />
            </div>
            <div>
              <RiskMetrics clientName={selectedClient} />
            </div>
          </div>

          {/* AI Insights */}
          <AIInsights clientName={selectedClient} />

          {/* Excel Upload */}
          <ExcelUpload 
            onClientChange={setSelectedClient} 
            clients={clients}
          />
        </main>
      </div>
    </div>
  );
};

export default Index;
