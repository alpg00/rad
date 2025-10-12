import { useEffect, useState } from 'react';
import { Badge } from "@/components/ui/badge";
import { useWebSocket } from '@/hooks/useWebSocket';

export function ConnectionStatus() {
  const { isConnected, portfolio, error } = useWebSocket();
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  useEffect(() => {
    if (portfolio.length > 0) {
      setLastUpdate(new Date());
    }
  }, [portfolio]);

  return (
    <div className="flex items-center gap-2">
      <Badge 
        variant={isConnected ? "success" : "destructive"}
        className="h-4 px-2"
      >
        {isConnected ? 'Connected' : 'Disconnected'}
      </Badge>
      {lastUpdate && (
        <span className="text-xs text-muted-foreground">
          Last update: {lastUpdate.toLocaleTimeString()}
        </span>
      )}
      {error && (
        <span className="text-xs text-destructive">
          Error: {error}
        </span>
      )}
    </div>
  );
}