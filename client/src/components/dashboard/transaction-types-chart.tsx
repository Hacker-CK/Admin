import React from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { MoreHorizontal } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface TransactionTypeData {
  name: string;
  value: number;
  color: string;
}

interface TransactionTypesChartProps {
  data: TransactionTypeData[];
  isLoading?: boolean;
}

export default function TransactionTypesChart({ data, isLoading = false }: TransactionTypesChartProps) {
  if (isLoading) {
    return (
      <div className="bg-white rounded-xl shadow-sm p-6 animate-pulse">
        <div className="flex items-center justify-between mb-6">
          <div className="h-6 w-40 bg-gray-200 rounded"></div>
          <div className="h-6 w-6 bg-gray-200 rounded-full"></div>
        </div>
        <div className="chart-container flex items-center justify-center">
          <div className="w-32 h-32 rounded-full bg-gray-200"></div>
        </div>
        <div className="pt-4 space-y-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="flex items-center justify-between">
              <div className="flex items-center">
                <div className="w-3 h-3 rounded-full bg-gray-200"></div>
                <div className="ml-2 h-4 w-16 bg-gray-200 rounded"></div>
              </div>
              <div className="h-4 w-8 bg-gray-200 rounded"></div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  const totalValue = data.reduce((sum, item) => sum + item.value, 0);
  
  return (
    <div className="bg-white rounded-xl shadow-sm p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="font-inter font-semibold">Transaction Types</h2>
        <Button variant="ghost" size="icon" className="text-gray-400 hover:text-primary">
          <MoreHorizontal className="h-5 w-5" />
        </Button>
      </div>
      
      <div className="chart-container">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={60}
              outerRadius={80}
              paddingAngle={2}
              dataKey="value"
            >
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip
              formatter={(value) => [`${((value as number) / totalValue * 100).toFixed(0)}%`, 'Percentage']}
              contentStyle={{ 
                backgroundColor: 'white', 
                borderColor: '#e2e8f0',
                borderRadius: '6px',
                boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
              }}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>
      
      <div className="pt-4 space-y-3">
        {data.map((item, index) => (
          <div key={index} className="flex items-center justify-between">
            <div className="flex items-center">
              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }}></div>
              <span className="ml-2 text-sm">{item.name}</span>
            </div>
            <span className="text-sm font-medium">{((item.value / totalValue) * 100).toFixed(0)}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}
