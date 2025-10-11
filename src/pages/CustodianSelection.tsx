import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ArrowLeft, Building2, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface Client {
  id: string;
  name: string;
}

const CustodianSelection = () => {
  const navigate = useNavigate();
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadClients();
  }, []);

  const loadClients = async () => {
    try {
      const { data, error } = await supabase
        .from("clients")
        .select("id, name")
        .order("name");

      if (error) throw error;

      // If no clients in DB, show default custodian options
      if (!data || data.length === 0) {
        setClients([
          { id: "custodian-1", name: "Custodian 1" },
          { id: "custodian-2", name: "Custodian 2" },
        ]);
      } else {
        // Filter to only show "Custodian" clients
        const custodianClients = data.filter(c => 
          c.name.toLowerCase().includes("custodian")
        );
        setClients(custodianClients.length > 0 ? custodianClients : data);
      }
    } catch (error) {
      console.error("Error loading clients:", error);
      // Fallback to default custodians
      setClients([
        { id: "custodian-1", name: "Custodian 1" },
        { id: "custodian-2", name: "Custodian 2" },
      ]);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-4xl mx-auto space-y-8">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate("/")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
              Select Your Custodian Account
            </h1>
            <p className="text-muted-foreground mt-1">
              Choose your custodian account to manage your portfolio
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {clients.map((client) => (
            <Card
              key={client.id}
              className="p-6 hover:border-primary/50 transition-colors cursor-pointer group"
              onClick={() => navigate(`/custodian/${encodeURIComponent(client.name)}`)}
            >
              <div className="space-y-4">
                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                  <Building2 className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <h2 className="text-xl font-semibold">{client.name}</h2>
                  <p className="text-sm text-muted-foreground mt-1">
                    Access your portfolio dashboard
                  </p>
                </div>
                <Button className="w-full">
                  Access Dashboard
                </Button>
              </div>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
};

export default CustodianSelection;
