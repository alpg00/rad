import { useEffect, useState } from 'react';
import { Badge } from "@/components/ui/badge";
import { useWebSocket } from '@/hooks/useWebSocket';

interface ConnectionStatusProps {
  symbols: string[];
}

export function ConnectionStatus({ symbols }: ConnectionStatusProps) {
  const { connected, priceUpdates, error } = useWebSocket(symbols);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  useEffect(() => {
    if (Object.keys(priceUpdates).length > 0) {
      setLastUpdate(new Date());
    }
  }, [priceUpdates]);

  return (
    <div className="flex items-center gap-2">
      <Badge 
        variant={connected ? "success" : "destructive"}
        className="h-4 px-2"
      >
        {connected ? 'Connected' : 'Disconnected'}
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