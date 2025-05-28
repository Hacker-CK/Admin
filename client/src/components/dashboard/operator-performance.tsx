import React from 'react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Operator } from '@shared/schema';
import { ArrowRight } from 'lucide-react';

interface OperatorPerformanceItem extends Operator {
  successRate: number;
}

interface OperatorPerformanceProps {
  operators: OperatorPerformanceItem[];
  isLoading?: boolean;
  onViewAll: () => void;
}

export default function OperatorPerformance({ operators, isLoading = false, onViewAll }: OperatorPerformanceProps) {
  if (isLoading) {
    return (
      <div className="bg-white rounded-xl shadow-sm p-6 animate-pulse">
        <div className="flex items-center justify-between pb-5">
          <div className="h-6 w-44 bg-gray-200 rounded"></div>
          <div className="h-4 w-20 bg-gray-200 rounded"></div>
        </div>
        <div className="space-y-5 pt-2">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="flex items-center">
              <div className="w-8 h-8 bg-gray-200 rounded-full mr-3"></div>
              <div className="h-4 w-24 bg-gray-200 rounded"></div>
              <div className="flex-1 mx-4">
                <div className="w-full bg-gray-200 rounded-full h-2"></div>
              </div>
              <div className="h-4 w-10 bg-gray-200 rounded"></div>
            </div>
          ))}
        </div>
      </div>
    );
  }
  
  // Display only top 5 operators sorted by success rate
  const topOperators = [...operators]
    .sort((a, b) => b.successRate - a.successRate)
    .slice(0, 5);
  
  return (
    <div className="bg-white rounded-xl shadow-sm p-6">
      <div className="flex items-center justify-between pb-5">
        <h2 className="text-lg font-medium text-gray-800">Operator Performance</h2>
        <Button
          variant="link" 
          size="sm" 
          onClick={onViewAll}
          className="text-sm text-blue-600 font-medium px-0 hover:no-underline group"
        >
          View All
          <ArrowRight className="h-3.5 w-3.5 ml-1 inline transition-transform group-hover:translate-x-0.5" />
        </Button>
      </div>
      
      <div className="space-y-5 pt-2">
        {topOperators.length > 0 ? (
          topOperators.map((operator) => (
            <div key={operator.id} className="flex items-center">
              <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center mr-3 text-blue-600">
                <span className="text-xs font-medium">{operator.name.substring(0, 2).toUpperCase()}</span>
              </div>
              <span className="text-sm font-medium text-gray-800 w-24 truncate">{operator.name}</span>
              <div className="flex-1 mx-4">
                <Progress 
                  value={operator.successRate} 
                  className="h-2 rounded-full overflow-hidden"
                  indicatorColor="bg-blue-500"
                />
              </div>
              <span className="text-sm font-medium text-gray-800">{operator.successRate}%</span>
            </div>
          ))
        ) : (
          <div className="text-center text-gray-500 py-4">
            No operator data available
          </div>
        )}
      </div>
    </div>
  );
}
