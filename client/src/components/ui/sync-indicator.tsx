import React, { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { RefreshCw, CheckCircle, AlertCircle } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

export interface SyncIndicatorProps {
  isSyncing: boolean;
  isError: boolean;
  lastSynced: Date | null;
  className?: string;
}

export function SyncIndicator({ 
  isSyncing = false, 
  isError = false, 
  lastSynced = null,
  className 
}: SyncIndicatorProps) {
  const [timeAgo, setTimeAgo] = useState<string>('');
  
  // Update the time ago text every minute
  useEffect(() => {
    const updateTimeAgo = () => {
      if (!lastSynced) {
        setTimeAgo('Never');
        return;
      }
      
      const now = new Date();
      const diff = now.getTime() - lastSynced.getTime();
      
      // Format the time difference
      if (diff < 1000) {
        setTimeAgo('Just now');
      } else if (diff < 60000) {
        setTimeAgo(`${Math.floor(diff / 1000)}s ago`);
      } else if (diff < 3600000) {
        setTimeAgo(`${Math.floor(diff / 60000)}m ago`);
      } else if (diff < 86400000) {
        setTimeAgo(`${Math.floor(diff / 3600000)}h ago`);
      } else {
        setTimeAgo(`${Math.floor(diff / 86400000)}d ago`);
      }
    };
    
    // Update immediately
    updateTimeAgo();
    
    // Then update every 10 seconds
    const interval = setInterval(updateTimeAgo, 10000);
    
    return () => clearInterval(interval);
  }, [lastSynced]);
  
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className={cn(
            "flex items-center gap-2 text-sm font-medium transition-opacity",
            className
          )}>
            {isSyncing ? (
              <>
                <RefreshCw className="h-4 w-4 animate-spin text-primary" />
                <span className="text-muted-foreground">Syncing...</span>
              </>
            ) : isError ? (
              <>
                <AlertCircle className="h-4 w-4 text-destructive" />
                <span className="text-destructive">Sync failed</span>
              </>
            ) : (
              <>
                <CheckCircle className="h-4 w-4 text-green-500" />
                <span className="text-muted-foreground">
                  Last updated: {timeAgo}
                </span>
              </>
            )}
          </div>
        </TooltipTrigger>
        <TooltipContent side="bottom">
          {isSyncing 
            ? "Syncing real-time data with the server..."
            : isError
              ? "Failed to sync data. Will retry automatically."
              : lastSynced
                ? `Last successful sync: ${lastSynced.toLocaleTimeString()}`
                : "Data has not been synced yet."
          }
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}