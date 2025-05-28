import React, { useState } from 'react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Button } from '@/components/ui/button';
import { 
  Card, 
  CardContent, 
  CardFooter, 
  CardHeader, 
  CardTitle, 
  CardDescription 
} from '@/components/ui/card';
import { HelpCircle, Lightbulb, ExternalLink, ArrowRight } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface HelpTooltipProps {
  text: string;
  width?: string;
  position?: 'top' | 'right' | 'bottom' | 'left';
  className?: string;
  iconSize?: number;
  insight?: {
    title?: string;
    description: string;
    actionable?: string;
  };
}

export function HelpTooltip({ 
  text, 
  width = 'w-72', 
  position = 'top',
  className,
  iconSize = 16,
  insight
}: HelpTooltipProps) {
  const [expanded, setExpanded] = useState(false);
  
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button 
            variant="ghost" 
            size="icon" 
            className={cn("h-auto w-auto p-1 text-muted-foreground hover:text-foreground", className)}
          >
            <HelpCircle size={iconSize} />
          </Button>
        </TooltipTrigger>
        <TooltipContent 
          side={position} 
          align="center" 
          className={cn("p-0 overflow-hidden", width)}
        >
          {insight ? (
            <Card className="border-none shadow-none">
              <CardHeader className="p-3 pb-2">
                <CardTitle className="text-sm font-medium">
                  {insight.title || 'Helpful Insight'}
                </CardTitle>
                <CardDescription className="text-xs">
                  {text}
                </CardDescription>
              </CardHeader>
              <CardContent className={cn(
                "px-3 pb-1 pt-0 text-xs text-muted-foreground",
                expanded ? "block" : "hidden"
              )}>
                <div className="flex gap-2 items-start mb-2">
                  <Lightbulb size={14} className="text-amber-500 mt-0.5 flex-shrink-0" />
                  <p>{insight.description}</p>
                </div>
                {insight.actionable && (
                  <div className="mt-2 bg-muted p-2 rounded-md text-xs">
                    <Badge variant="outline" className="mb-1.5 text-[10px] font-normal">
                      Try This
                    </Badge>
                    <p className="text-foreground">{insight.actionable}</p>
                  </div>
                )}
              </CardContent>
              <CardFooter className="p-2 flex justify-between">
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="text-xs h-7 px-2"
                  onClick={() => setExpanded(!expanded)}
                >
                  {expanded ? 'Show Less' : 'Tell Me More'}
                  <ArrowRight size={12} className={cn(
                    "ml-1 transition-transform",
                    expanded ? "rotate-90" : ""
                  )} />
                </Button>
              </CardFooter>
            </Card>
          ) : (
            <div className="p-2 text-xs">{text}</div>
          )}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}