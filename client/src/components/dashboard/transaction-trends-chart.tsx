import { useState, useMemo } from 'react';
import { 
  BarChart, 
  Bar,
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  Legend
} from 'recharts';
import { Button } from '@/components/ui/button';
import { formatCurrency } from '@/lib/utils';
import { CurrencyDisplay } from '@/components/ui/currency-display';

interface TransactionData {
  name: string;
  amount: number;
  successAmount?: number;
  pendingAmount?: number;
  failedAmount?: number;
  refundAmount?: number;
}

interface TransactionTrendsChartProps {
  data: {
    daily: TransactionData[];
    weekly: TransactionData[];
    monthly: TransactionData[];
  };
  totalVolume: number;
  successRate: number;
  avgTransaction: number;
  isLoading?: boolean;
}

// Custom tooltip component
const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    // Get the data point for this specific bar
    const dataPoint = payload[0]?.payload;
    
    if (!dataPoint) return null;
    
    // Define all transaction types with their colors
    const transactionTypes = [
      { key: 'successAmount', name: 'Success', color: '#22C55E' },
      { key: 'pendingAmount', name: 'Pending', color: '#F59E0B' },
      { key: 'failedAmount', name: 'Failed', color: '#EF4444' },
      { key: 'refundAmount', name: 'Refund', color: '#6366F1' }
    ];
    
    return (
      <div className="bg-white p-3 border border-gray-200 shadow-lg rounded-lg text-sm min-w-[200px]">
        <p className="font-semibold mb-2 text-gray-800">{label}</p>
        <div className="space-y-1">
          {transactionTypes.map((type) => {
            const value = dataPoint[type.key] || 0;
            return (
              <div key={type.key} className="flex items-center justify-between">
                <div className="flex items-center">
                  <div 
                    className="w-3 h-3 rounded-full mr-2" 
                    style={{ backgroundColor: type.color }}
                  />
                  <span className="text-gray-600 text-xs">{type.name}:</span>
                </div>
                <span 
                  className="text-xs font-medium ml-3" 
                  style={{ color: type.color }}
                >
                  ₹{parseFloat(value.toString()).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
            );
          })}
        </div>
        <div className="mt-2 pt-2 border-t border-gray-100">
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-500">Total:</span>
            <span className="text-xs font-semibold text-gray-800">
              ₹{parseFloat(((parseFloat(dataPoint.successAmount?.toString() || '0')) + 
                (parseFloat(dataPoint.pendingAmount?.toString() || '0')) + 
                (parseFloat(dataPoint.failedAmount?.toString() || '0')) + 
                (parseFloat(dataPoint.refundAmount?.toString() || '0'))).toString()).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>
        </div>
      </div>
    );
  }
  return null;
};

export default function TransactionTrendsChart({ 
  data, 
  totalVolume, 
  successRate, 
  avgTransaction, 
  isLoading = false 
}: TransactionTrendsChartProps) {
  const [period, setPeriod] = useState<'daily' | 'weekly' | 'monthly'>('daily');
  
  // Optimize with useMemo to prevent unnecessary recalculations
  const currentData = useMemo(() => data[period], [data, period]);
  
  if (isLoading) {
    return (
      <div className="bg-white rounded-xl shadow-sm p-6 lg:col-span-2 animate-pulse">
        <div className="flex items-center justify-between mb-6">
          <div className="h-6 w-40 bg-gray-200 rounded"></div>
          <div className="flex space-x-2">
            <div className="h-6 w-16 bg-gray-200 rounded"></div>
            <div className="h-6 w-16 bg-gray-200 rounded"></div>
            <div className="h-6 w-16 bg-gray-200 rounded"></div>
          </div>
        </div>
        <div className="h-72 bg-gray-100 rounded"></div>
        <div className="pt-4 border-t border-gray-100 mt-4">
          <div className="grid grid-cols-3 gap-4">
            <div>
              <div className="h-4 w-20 bg-gray-200 rounded mb-2"></div>
              <div className="h-5 w-16 bg-gray-200 rounded"></div>
            </div>
            <div>
              <div className="h-4 w-20 bg-gray-200 rounded mb-2"></div>
              <div className="h-5 w-16 bg-gray-200 rounded"></div>
            </div>
            <div>
              <div className="h-4 w-20 bg-gray-200 rounded mb-2"></div>
              <div className="h-5 w-16 bg-gray-200 rounded"></div>
            </div>
          </div>
        </div>
      </div>
    );
  }
  
  return (
    <div className="bg-white rounded-xl shadow-sm p-6 lg:col-span-2">
      <div className="flex items-center justify-between mb-6">
        <h2 className="font-semibold">Transaction Trends</h2>
        <div className="flex space-x-2">
          <Button 
            size="sm" 
            variant={period === 'daily' ? 'default' : 'outline'} 
            onClick={() => setPeriod('daily')}
            className="text-xs px-3 py-1"
          >
            Daily
          </Button>
          <Button 
            size="sm" 
            variant={period === 'weekly' ? 'default' : 'outline'} 
            onClick={() => setPeriod('weekly')}
            className="text-xs px-3 py-1"
          >
            Weekly
          </Button>
          <Button 
            size="sm" 
            variant={period === 'monthly' ? 'default' : 'outline'} 
            onClick={() => setPeriod('monthly')}
            className="text-xs px-3 py-1"
          >
            Monthly
          </Button>
        </div>
      </div>
      
      <div className="h-72">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={currentData}
            margin={{ top: 10, right: 25, left: 0, bottom: 20 }}
          >
            <CartesianGrid 
              stroke="#eee" 
              strokeDasharray="5 5" 
              vertical={false}
            />
            <XAxis 
              dataKey="name" 
              fontSize={12}
              axisLine={false}
              tickLine={false}
              tick={{ fill: '#6B7280' }}
              tickMargin={10}
              height={40}
              minTickGap={5}
              interval="preserveStartEnd"
            />
            <YAxis 
              tickFormatter={(value) => {
                // Better handling of different value ranges
                if (value === 0) return '₹0';
                if (value >= 10000000) return `₹${(value/10000000).toFixed(1)}Cr`;
                if (value >= 1000000) return `₹${(value/1000000).toFixed(1)}M`;
                if (value >= 100000) return `₹${(value/100000).toFixed(1)}L`;
                if (value >= 1000) return `₹${(value/1000).toFixed(0)}K`;
                return `₹${value}`;
              }}
              fontSize={12}
              axisLine={false}
              tickLine={false}
              tick={{ fill: '#6B7280' }}
              domain={[
                0, 
                (dataMax: number) => {
                  // For very large values, provide more headroom
                  if (dataMax > 1000000) return Math.ceil(dataMax * 1.15 / 500000) * 500000;
                  if (dataMax > 100000) return Math.ceil(dataMax * 1.15 / 50000) * 50000;
                  if (dataMax > 10000) return Math.ceil(dataMax * 1.15 / 5000) * 5000;
                  if (dataMax > 1000) return Math.ceil(dataMax * 1.15 / 500) * 500;
                  // For smaller values
                  return Math.max(500, Math.ceil(dataMax * 1.2 / 100) * 100);
                }
              ]}
              allowDataOverflow={false}
              padding={{ top: 30 }}
              width={60}
              // Set tick count for better spacing
              tickCount={5}
            />
            <Tooltip 
              content={<CustomTooltip allData={currentData} />}
              cursor={{ fill: 'rgba(200, 200, 255, 0.1)' }}
            />
            <Legend 
              iconType="circle" 
              iconSize={8}
              formatter={(value) => {
                switch(value) {
                  case 'successAmount': return 'Success';
                  case 'pendingAmount': return 'Pending';
                  case 'failedAmount': return 'Failed';
                  case 'refundAmount': return 'Refund';
                  default: return value;
                }
              }}
              wrapperStyle={{ fontSize: 12, paddingTop: 10 }}
            />
            <Bar 
              dataKey="successAmount" 
              fill="#22C55E" 
              name="successAmount"
              radius={[2, 2, 0, 0]}
              maxBarSize={25}
              isAnimationActive={false}
            />
            <Bar 
              dataKey="pendingAmount" 
              fill="#F59E0B" 
              name="pendingAmount"
              radius={[2, 2, 0, 0]}
              maxBarSize={25}
              isAnimationActive={false}
            />
            <Bar 
              dataKey="failedAmount" 
              fill="#EF4444" 
              name="failedAmount"
              radius={[2, 2, 0, 0]}
              maxBarSize={25}
              isAnimationActive={false}
            />
            <Bar 
              dataKey="refundAmount" 
              fill="#6366F1" 
              name="refundAmount"
              radius={[2, 2, 0, 0]}
              maxBarSize={25}
              isAnimationActive={false}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
      
      <div className="pt-4 border-t border-gray-100 mt-4">
        <div className="grid grid-cols-3 gap-4">
          <div>
            <p className="text-xs text-gray-500">Total Volume</p>
            <CurrencyDisplay amount={totalVolume} className="font-semibold" />
          </div>
          <div>
            <p className="text-xs text-gray-500">Success Rate</p>
            <p className="font-semibold">{successRate.toFixed(2)}%</p>
          </div>
          <div>
            <p className="text-xs text-gray-500">Avg. Transaction</p>
            <CurrencyDisplay amount={avgTransaction} className="font-semibold" />
          </div>
        </div>
      </div>
    </div>
  );
}
