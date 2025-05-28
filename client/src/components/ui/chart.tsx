import React, { createContext, useContext } from 'react';
import { ChartProps } from 'recharts';
import { cn } from '@/lib/utils';

const THEMES = {
  primary: 'var(--primary)',
  secondary: 'var(--secondary)',
  success: 'var(--success)',
  warning: 'var(--warning)',
  danger: 'var(--danger)',
  info: 'var(--info)',
};

export type ChartConfig = {
  [k in string]: {
    label?: React.ReactNode
    icon?: React.ComponentType
  } & (
    | { color?: string; theme?: never }
    | { color?: never; theme: Record<keyof typeof THEMES, string> }
  )
}

type ChartContextProps = {
  config: ChartConfig
}

const ChartContext = createContext<ChartContextProps | null>(null);

function useChart() {
  const context = useContext(ChartContext);
  if (!context) {
    throw new Error('useChart must be used within a ChartProvider');
  }
  return context;
}

// Generate styles for chart lines
const ChartStyle = ({ id, config }: { id: string; config: ChartConfig }) => {
  // Generate a unique ID for each chart line to use as a CSS target
  const styles = Object.entries(config)
    .map(([key, value]) => {
      const colorValue = value.color ?? value.theme?.primary ?? 'currentColor';
      return `
        #${id} .recharts-line.${key} path.recharts-curve {
          stroke: ${colorValue};
        }
        #${id} .recharts-bar.${key} path.recharts-rectangle {
          fill: ${colorValue};
        }
        #${id} .recharts-scatter.${key} path.recharts-polygon {
          fill: ${colorValue};
        }
        #${id} .recharts-pie.${key} .recharts-sector {
          fill: ${colorValue};
        }
      `;
    })
    .join('\n');

  return <style>{styles}</style>;
};

// Helper function to extract config for a tooltip item
function getPayloadConfigFromPayload(
  config: ChartConfig,
  payload: any,
) {
  const dataKey = payload?.dataKey;
  if (!dataKey) return undefined;
  
  return Object.entries(config).find(([_, value]) => {
    if (value.label === dataKey) return true;
    return false;
  })?.[1];
}

export const ChartContainer = ({
  config,
  variant = "line",
  className,
  children,
  ...props
}: {
  config: ChartConfig;
  variant?: "line" | "bar" | "area" | "pie" | "scatter";
  className?: string;
  children: React.ReactNode;
} & Omit<ChartProps, "ref">) => {
  // Generate a random ID for the chart
  const id = React.useMemo(() => `chart-${Math.random().toString(36).substring(2, 9)}`, []);
  
  return (
    <ChartContext.Provider value={{ config }}>
      <ChartStyle id={id} config={config} />
      <div id={id} className={cn("w-full", className)} {...props}>
        {children}
      </div>
    </ChartContext.Provider>
  );
};

// Custom chart tooltip component
export const ChartTooltip = React.forwardRef<
  HTMLDivElement,
  React.ComponentPropsWithoutRef<"div">
>(({ className, ...props }, ref) => {
  return (
    <div
      ref={ref}
      className={cn(
        "recharts-tooltip",
        className
      )}
      {...props}
    />
  );
});
ChartTooltip.displayName = "ChartTooltip";

export const ChartTooltipContent = React.forwardRef<
  HTMLDivElement,
  React.ComponentPropsWithoutRef<"div">
>(({ className, ...props }, ref) => {
  const { payload, label } = props as any;
  const { config } = useChart();
  
  if (!payload || !payload.length) {
    return null;
  }

  return (
    <div
      ref={ref}
      className={cn(
        "bg-white shadow-md p-2 border rounded-md text-xs",
        className
      )}
    >
      <div className="font-semibold mb-1">{label}</div>
      <div className="space-y-1">
        {payload.map((item: any, i: number) => {
          // Find config for this payload
          const itemConfig = Object.entries(config).find(
            ([_, cfg]) => cfg.label === item.name
          )?.[1];
          
          const colorValue = itemConfig?.color ?? itemConfig?.theme?.primary ?? '#888';
          
          return (
            <div key={i} className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5">
                <div className="h-2 w-2 rounded-full" style={{ backgroundColor: colorValue }} />
                <span className="font-medium">{item.name}</span>
              </div>
              <span className="text-muted-foreground">{item.value}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
});
ChartTooltipContent.displayName = "ChartTooltipContent";

export const ChartLegend: React.FC = () => {
  const { config } = useChart();
  
  return (
    <div className="recharts-legend recharts-default-legend">
      <ul className="flex flex-wrap gap-4 mt-2 px-2">
        {Object.entries(config).map(([key, value]) => {
          const colorValue = value.color ?? value.theme?.primary ?? '#888';
          return (
            <li key={key} className="flex items-center gap-1.5 text-xs">
              <div className="h-2 w-2 rounded-full" style={{ backgroundColor: colorValue }} />
              <span>{value.label}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
};