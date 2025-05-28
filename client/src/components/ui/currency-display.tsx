import { formatCurrency, formatCurrencyFull } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface CurrencyDisplayProps {
  amount: number | string;
  className?: string;
}

export function CurrencyDisplay({ amount, className }: CurrencyDisplayProps) {
  const abbreviatedAmount = formatCurrency(amount);
  const fullAmount = formatCurrencyFull(amount);

  // Always show tooltip for better user experience
  return (
    <TooltipProvider delayDuration={300}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span
            className={`cursor-help inline-flex items-center transition-all duration-200 hover:scale-105 hover:shadow-sm rounded-sm px-1 py-0.5 hover:bg-black/5 dark:hover:bg-white/10 ${className || ""}`}
          >
            {abbreviatedAmount}
          </span>
        </TooltipTrigger>
        <TooltipContent
          side="top"
          align="center"
          className="bg-black/90 backdrop-blur-sm text-white border-0 shadow-xl rounded-lg px-3 py-2 text-sm font-medium max-w-xs z-[999] fixed"
          sideOffset={12}
          avoidCollisions={true}
        >
          <div className="flex flex-col items-center gap-1">
            <span className="text-xs opacity-80">Full Amount</span>
            <span className="text-base font-semibold">{fullAmount}</span>
          </div>
          <div className="absolute bottom-0 left-1/2 transform -translate-x-1/2 translate-y-full">
            <div className="w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-black/90"></div>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
