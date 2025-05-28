import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
} from '@/components/ui/chart';
import { 
  LineChart, Line, BarChart, Bar, 
  XAxis, YAxis, CartesianGrid, 
  ResponsiveContainer, Legend, Tooltip, 
  PieChart, Pie, Cell, Sector,
  ScatterChart, Scatter, ZAxis
} from 'recharts';
import { Button } from '@/components/ui/button';
import { 
  Card, 
  CardContent, 
  CardHeader, 
  CardTitle,
  CardDescription  
} from '@/components/ui/card';
import { 
  ZoomIn, ZoomOut, 
  Calendar, DownloadIcon, 
  ArrowUpDown, Filter 
} from 'lucide-react';
import { cn } from '@/lib/utils';

type ChartType = 'line' | 'bar' | 'pie' | 'scatter';
type DateRange = 'day' | 'week' | 'month' | 'year' | 'all';

interface InteractiveChartProps {
  title: string;
  description?: string;
  data: any[];
  type: ChartType;
  xDataKey: string;
  yDataKey: string;
  secondaryYDataKey?: string;
  className?: string;
  height?: number | string;
  loading?: boolean;
  config?: Record<string, any>;
  colors?: string[];
  allowZoom?: boolean;
  allowDateRangeSelection?: boolean;
  allowExport?: boolean;
  allowFiltering?: boolean;
  allowSorting?: boolean;
  additionalControls?: React.ReactNode;
  onFilterChange?: (filters: Record<string, any>) => void;
  onDateRangeChange?: (range: DateRange) => void;
  onExport?: (format: 'csv' | 'png' | 'json') => void;
  onSortChange?: (key: string, direction: 'asc' | 'desc') => void;
  onDataPointClick?: (data: Record<string, any>) => void;
  emptyState?: React.ReactNode;
  subtitle?: string;
}

export function InteractiveChart({
  title,
  description,
  data,
  type,
  xDataKey,
  yDataKey,
  secondaryYDataKey,
  className,
  height = 400,
  loading = false,
  config,
  colors = ['#0ea5e9', '#f59e0b', '#10b981', '#8b5cf6', '#ec4899'],
  allowZoom = true,
  allowDateRangeSelection = true,
  allowExport = true,
  allowFiltering = false,
  allowSorting = false,
  additionalControls,
  onFilterChange,
  onDateRangeChange,
  onExport,
  onSortChange,
  onDataPointClick,
  emptyState,
  subtitle,
}: InteractiveChartProps) {
  const [dateRange, setDateRange] = useState<DateRange>('month');
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const [zoom, setZoom] = useState(1);
  const [sort, setSort] = useState<{ key: string, direction: 'asc' | 'desc' } | null>(null);
  
  const handleDateRangeChange = (range: DateRange) => {
    setDateRange(range);
    if (onDateRangeChange) {
      onDateRangeChange(range);
    }
  };
  
  const handleZoom = (direction: 'in' | 'out') => {
    if (direction === 'in' && zoom < 2) {
      setZoom(prev => prev + 0.1);
    } else if (direction === 'out' && zoom > 0.5) {
      setZoom(prev => prev - 0.1);
    }
  };
  
  const handleExport = (format: 'csv' | 'png' | 'json') => {
    if (onExport) {
      onExport(format);
    } else {
      if (format === 'csv') {
        // Basic CSV export
        let csvContent = "data:text/csv;charset=utf-8,";
        
        // Headers
        const headers = [xDataKey, yDataKey];
        if (secondaryYDataKey) headers.push(secondaryYDataKey);
        csvContent += headers.join(",") + "\\r\\n";
        
        // Data
        data.forEach(item => {
          const row = [item[xDataKey], item[yDataKey]];
          if (secondaryYDataKey) row.push(item[secondaryYDataKey]);
          csvContent += row.join(",") + "\\r\\n";
        });
        
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `${title.toLowerCase().replace(/\\s+/g, '-')}-export.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }
    }
  };
  
  const handleSort = (key: string) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sort?.key === key) {
      direction = sort.direction === 'asc' ? 'desc' : 'asc';
    }
    setSort({ key, direction });
    if (onSortChange) {
      onSortChange(key, direction);
    }
  };
  
  const handlePieEnter = (_: any, index: number) => {
    setActiveIndex(index);
  };
  
  const renderActiveShape = (props: any) => {
    const { cx, cy, innerRadius, outerRadius, startAngle, endAngle, fill, payload, percent, value } = props;
  
    return (
      <g>
        <Sector
          cx={cx}
          cy={cy}
          innerRadius={innerRadius}
          outerRadius={outerRadius + 5}
          startAngle={startAngle}
          endAngle={endAngle}
          fill={fill}
        />
        <Sector
          cx={cx}
          cy={cy}
          startAngle={startAngle}
          endAngle={endAngle}
          innerRadius={outerRadius + 6}
          outerRadius={outerRadius + 10}
          fill={fill}
        />
        <text x={cx} y={cy - 10} dy={8} textAnchor="middle" fill="#333">
          {payload.name}
        </text>
        <text x={cx} y={cy + 10} dy={8} textAnchor="middle" fill="#333">
          {value} ({(percent * 100).toFixed(0)}%)
        </text>
      </g>
    );
  };
  
  const sortedData = useMemo(() => {
    if (!sort) return data;
    
    return [...data].sort((a, b) => {
      if (sort.direction === 'asc') {
        return a[sort.key] - b[sort.key];
      } else {
        return b[sort.key] - a[sort.key];
      }
    });
  }, [data, sort]);
  
  const renderChart = () => {
    if (loading) {
      return (
        <div className="flex items-center justify-center h-full">
          <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
        </div>
      );
    }
    
    if (!data || data.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center h-full p-8 text-center">
          {emptyState || (
            <>
              <div className="text-muted-foreground mb-2">No data available</div>
              <p className="text-sm text-muted-foreground">Try adjusting your filters or date range to see data.</p>
            </>
          )}
        </div>
      );
    }
    
    const chartConfig = {
      line: {
        label: yDataKey,
        color: colors[0]
      },
      ...(secondaryYDataKey && {
        line2: {
          label: secondaryYDataKey,
          color: colors[1]
        }
      }),
      ...config
    };
    
    switch (type) {
      case 'line':
        return (
          <ChartContainer config={chartConfig} className="h-full">
            <LineChart 
              data={sortedData} 
              margin={{ top: 20, right: 30, left: 20, bottom: 10 }}
              style={{ transform: `scale(${zoom})` }}
              onClick={(e) => onDataPointClick && e?.activePayload?.[0]?.payload && onDataPointClick(e.activePayload[0].payload)}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis 
                dataKey={xDataKey} 
                tick={{ fontSize: 12 }}
              />
              <YAxis tick={{ fontSize: 12 }} />
              <ChartTooltip 
                content={<ChartTooltipContent />}
                cursor={{ stroke: '#d1d5db', strokeWidth: 1 }}
              />
              <ChartLegend />
              <Line 
                type="monotone" 
                dataKey={yDataKey} 
                name={chartConfig.line.label} 
                strokeWidth={2}
                dot={{ r: 3 }}
                activeDot={{ r: 6, onClick: (data: Record<string, any>) => onDataPointClick && onDataPointClick(data.payload) }}
                isAnimationActive={true}
                animationDuration={500}
              />
              {secondaryYDataKey && (
                <Line 
                  type="monotone" 
                  dataKey={secondaryYDataKey} 
                  name={chartConfig.line2?.label} 
                  stroke={colors[1]} 
                  strokeWidth={2}
                  dot={{ r: 3 }}
                  activeDot={{ r: 6 }}
                  isAnimationActive={true}
                  animationDuration={700}
                />
              )}
            </LineChart>
          </ChartContainer>
        );
      
      case 'bar':
        return (
          <ChartContainer config={chartConfig} className="h-full">
            <BarChart 
              data={sortedData} 
              margin={{ top: 20, right: 30, left: 20, bottom: 10 }}
              style={{ transform: `scale(${zoom})` }}
              onClick={(e) => onDataPointClick && e?.activePayload?.[0]?.payload && onDataPointClick(e.activePayload[0].payload)}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis 
                dataKey={xDataKey} 
                tick={{ fontSize: 12 }}
              />
              <YAxis tick={{ fontSize: 12 }} />
              <ChartTooltip content={<ChartTooltipContent />} />
              <ChartLegend />
              <Bar 
                dataKey={yDataKey} 
                name={chartConfig.line.label} 
                fill={colors[0]}
                isAnimationActive={true}
                animationDuration={500}
                onClick={(data) => onDataPointClick && onDataPointClick(data)}
                radius={[4, 4, 0, 0]}
              />
              {secondaryYDataKey && (
                <Bar 
                  dataKey={secondaryYDataKey} 
                  name={chartConfig.line2?.label} 
                  fill={colors[1]}
                  isAnimationActive={true}
                  animationDuration={700}
                  radius={[4, 4, 0, 0]}
                />
              )}
            </BarChart>
          </ChartContainer>
        );
      
      case 'pie':
        return (
          <ChartContainer config={chartConfig} className="h-full">
            <PieChart margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
              <Pie
                activeIndex={activeIndex !== null ? activeIndex : undefined}
                activeShape={renderActiveShape}
                data={sortedData}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={80}
                dataKey={yDataKey}
                nameKey={xDataKey}
                onMouseEnter={handlePieEnter}
                onClick={(_, index) => onDataPointClick && onDataPointClick(sortedData[index])}
                isAnimationActive={true}
                animationDuration={800}
              >
                {sortedData.map((_, index) => (
                  <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />
                ))}
              </Pie>
              <ChartTooltip content={<ChartTooltipContent />} />
            </PieChart>
          </ChartContainer>
        );
        
      case 'scatter':
        return (
          <ChartContainer config={chartConfig} className="h-full">
            <ScatterChart
              margin={{ top: 20, right: 30, left: 20, bottom: 10 }}
              style={{ transform: `scale(${zoom})` }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis 
                dataKey={xDataKey} 
                type="number" 
                name={xDataKey} 
                tick={{ fontSize: 12 }} 
              />
              <YAxis 
                dataKey={yDataKey} 
                type="number" 
                name={yDataKey} 
                tick={{ fontSize: 12 }} 
              />
              {secondaryYDataKey && (
                <ZAxis 
                  dataKey={secondaryYDataKey} 
                  range={[60, 400]} 
                  name={secondaryYDataKey} 
                />
              )}
              <ChartTooltip content={<ChartTooltipContent />} />
              <ChartLegend />
              <Scatter 
                name={chartConfig.line.label} 
                data={sortedData} 
                fill={colors[0]}
                isAnimationActive={true}
                onClick={(data) => onDataPointClick && onDataPointClick(data)}
              />
            </ScatterChart>
          </ChartContainer>
        );
        
      default:
        return null;
    }
  };
  
  return (
    <Card className={cn("overflow-hidden", className)}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>{title}</CardTitle>
            {subtitle && <div className="text-sm text-muted-foreground">{subtitle}</div>}
            {description && <CardDescription>{description}</CardDescription>}
          </div>
          
          <div className="flex gap-1">
            {allowZoom && (
              <div className="flex rounded-md overflow-hidden border border-border">
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="h-8 w-8 rounded-none border-r border-border"
                  onClick={() => handleZoom('out')}
                  disabled={zoom <= 0.5}
                >
                  <ZoomOut size={14} />
                </Button>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="h-8 w-8 rounded-none"
                  onClick={() => handleZoom('in')}
                  disabled={zoom >= 2}
                >
                  <ZoomIn size={14} />
                </Button>
              </div>
            )}
            
            {allowDateRangeSelection && (
              <div className="flex rounded-md overflow-hidden border border-border">
                {['day', 'week', 'month', 'year'].map((range) => (
                  <Button
                    key={range}
                    variant="ghost"
                    size="sm"
                    className={cn(
                      "h-8 px-2 rounded-none border-r border-border",
                      dateRange === range && "bg-muted"
                    )}
                    onClick={() => handleDateRangeChange(range as DateRange)}
                  >
                    {range.charAt(0).toUpperCase()}
                  </Button>
                ))}
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 rounded-none"
                  onClick={() => handleDateRangeChange('all')}
                >
                  <Calendar size={14} />
                </Button>
              </div>
            )}
            
            {allowSorting && (
              <Button 
                variant="ghost" 
                size="icon" 
                className="h-8 w-8"
                onClick={() => handleSort(yDataKey)}
                title="Sort data"
              >
                <ArrowUpDown size={14} />
              </Button>
            )}
            
            {allowFiltering && (
              <Button 
                variant="ghost" 
                size="icon" 
                className="h-8 w-8"
                onClick={() => onFilterChange && onFilterChange({})}
                title="Filter data"
              >
                <Filter size={14} />
              </Button>
            )}
            
            {allowExport && (
              <Button 
                variant="ghost" 
                size="icon" 
                className="h-8 w-8"
                onClick={() => handleExport('csv')}
                title="Export data"
              >
                <DownloadIcon size={14} />
              </Button>
            )}
            
            {additionalControls}
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0 pt-4">
        <div style={{ height, width: '100%' }} className="transition-all duration-300">
          {renderChart()}
        </div>
      </CardContent>
    </Card>
  );
}