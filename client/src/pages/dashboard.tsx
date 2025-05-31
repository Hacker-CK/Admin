import React, { useState, useCallback, useMemo, lazy, Suspense, memo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocation } from 'wouter';
import { DateRange } from 'react-day-picker';
import { addDays, startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfYear, endOfYear } from 'date-fns';

// Regular import for the critical component
import KPIMetricsRow from '@/components/dashboard/kpi-cards';

// Lazy load non-critical components
const TransactionTrendsChart = lazy(() => import('@/components/dashboard/transaction-trends-chart'));
const TransactionTypesChart = lazy(() => import('@/components/dashboard/transaction-types-chart'));
const RecentTransactions = lazy(() => import('@/components/dashboard/recent-transactions'));
const TopUsers = lazy(() => import('@/components/dashboard/top-users'));
const OperatorPerformance = lazy(() => import('@/components/dashboard/operator-performance'));

import { Button } from '@/components/ui/button';
import { DateRangePicker } from '@/components/ui/date-range-picker';
import { SyncIndicator } from '@/components/ui/sync-indicator';
import toast from 'react-hot-toast';

// Loading placeholder component
const LoadingPlaceholder = memo(() => (
  <div className="w-full h-60 bg-gray-100 animate-pulse rounded-lg flex items-center justify-center">
    <div className="text-gray-400">Loading...</div>
  </div>
));

export default function Dashboard() {
  const [, setLocation] = useLocation();
  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);
  const [selectedPeriod, setSelectedPeriod] = useState<'today' | 'week' | 'month' | 'year' | 'all' | 'custom'>('all');
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [syncError, setSyncError] = useState<boolean>(false);
  const [lastSynced, setLastSynced] = useState<Date | null>(null);
  const queryClient = useQueryClient();

  // Calculate date range based on selected period
  const getActiveeDateRange = useCallback(() => {
    const now = new Date();
    
    switch (selectedPeriod) {
      case 'today':
        return {
          from: startOfDay(now),
          to: endOfDay(now)
        };
      case 'week':
        return {
          from: startOfWeek(now, { weekStartsOn: 1 }),
          to: endOfWeek(now, { weekStartsOn: 1 })
        };
      case 'month':
        return {
          from: startOfMonth(now),
          to: endOfMonth(now)
        };
      case 'year':
        return {
          from: startOfYear(now),
          to: endOfYear(now)
        };
      case 'custom':
        return dateRange;
      case 'all':
      default:
        return undefined;
    }
  }, [selectedPeriod, dateRange]);

  // Get current active date range
  const activeDateRange = useMemo(() => {
    return getActiveeDateRange();
  }, [getActiveeDateRange]);

  // Build query parameters for API calls
  const queryParams = useMemo(() => {
    if (!activeDateRange?.from) return '';
    
    const fromDate = new Date(activeDateRange.from);
    fromDate.setHours(0, 0, 0, 0);
    
    const toDate = activeDateRange.to ? new Date(activeDateRange.to) : new Date();
    toDate.setHours(23, 59, 59, 999);
    
    return `?startDate=${fromDate.toISOString()}&endDate=${toDate.toISOString()}`;
  }, [activeDateRange]);

  // Fetch dashboard data with filters
  const { data: dashboardData, isLoading: isLoadingDashboard, refetch: refetchDashboard } = useQuery({
    queryKey: ['/api/dashboard/summary', queryParams],
    queryFn: async () => {
      const response = await fetch(`/api/dashboard/summary${queryParams}`);
      if (!response.ok) {
        throw new Error('Network response was not ok');
      }
      return response.json();
    },
    staleTime: 30000,
    refetchOnWindowFocus: false,
  });

  // Fetch transactions data with filters
  const { data: transactionsData, isLoading: isLoadingTransactions, refetch: refetchTransactions } = useQuery({
    queryKey: ['/api/transactions/recent', queryParams],
    queryFn: async () => {
      const response = await fetch(`/api/transactions/recent${queryParams}`);
      if (!response.ok) {
        throw new Error('Network response was not ok');
      }
      return response.json();
    },
    staleTime: 30000,
    refetchOnWindowFocus: false,
  });

  // Fetch users data with filters
  const { data: usersData, isLoading: isLoadingTopUsers, refetch: refetchTopUsers } = useQuery({
    queryKey: ['/api/users/top', queryParams],
    queryFn: async () => {
      const response = await fetch(`/api/users/top${queryParams}`);
      if (!response.ok) {
        throw new Error('Network response was not ok');
      }
      return response.json();
    },
    staleTime: 30000,
    refetchOnWindowFocus: false,
  });

  // Fetch operators data with filters
  const { data: operatorsData, isLoading: isLoadingOperators, refetch: refetchOperators } = useQuery({
    queryKey: ['/api/operators/performance', queryParams],
    queryFn: async () => {
      const response = await fetch(`/api/operators/performance${queryParams}`);
      if (!response.ok) {
        throw new Error('Network response was not ok');
      }
      return response.json();
    },
    staleTime: 30000,
    refetchOnWindowFocus: false,
  });

  // Handle period change
  const handlePeriodChange = useCallback((period: typeof selectedPeriod) => {
    setSelectedPeriod(period);
    if (period !== 'custom') {
      setDateRange(undefined);
    }
  }, []);

  // Handle custom date range change
  const handleDateRangeChange = useCallback((range: DateRange | undefined) => {
    setDateRange(range);
    if (range?.from) {
      setSelectedPeriod('custom');
    }
  }, []);

  // Sync all data
  const handleSync = useCallback(async () => {
    setIsSyncing(true);
    setSyncError(false);
    
    try {
      await Promise.all([
        refetchDashboard(),
        refetchTransactions(),
        refetchTopUsers(),
        refetchOperators(),
      ]);
      
      setLastSynced(new Date());
      toast.success('Dashboard data refreshed successfully!');
    } catch (error) {
      setSyncError(true);
      toast.error('Failed to refresh dashboard data');
      console.error('Sync error:', error);
    } finally {
      setIsSyncing(false);
    }
  }, [refetchDashboard, refetchTransactions, refetchTopUsers, refetchOperators]);

  // Calculate if any data is loading
  const isLoading = isLoadingDashboard || isLoadingTransactions || isLoadingTopUsers || isLoadingOperators;

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <p className="text-gray-600">Monitor your business performance</p>
        </div>
        
        <div className="flex items-center gap-3">
          <SyncIndicator 
            isLoading={isSyncing} 
            hasError={syncError} 
            lastSynced={lastSynced} 
            onRefresh={handleSync}
          />
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <Button
          variant={selectedPeriod === 'today' ? 'default' : 'outline'}
          onClick={() => handlePeriodChange('today')}
          size="sm"
          className="rounded-full"
        >
          Today
        </Button>
        <Button
          variant={selectedPeriod === 'week' ? 'default' : 'outline'}
          onClick={() => handlePeriodChange('week')}
          size="sm"
          className="rounded-full"
        >
          This Week
        </Button>
        <Button
          variant={selectedPeriod === 'month' ? 'default' : 'outline'}
          onClick={() => handlePeriodChange('month')}
          size="sm"
          className="rounded-full"
        >
          This Month
        </Button>
        <Button
          variant={selectedPeriod === 'year' ? 'default' : 'outline'}
          onClick={() => handlePeriodChange('year')}
          size="sm"
          className="rounded-full"
        >
          This Year
        </Button>
        <Button
          variant={selectedPeriod === 'all' ? 'default' : 'outline'}
          onClick={() => handlePeriodChange('all')}
          size="sm"
          className="rounded-full"
        >
          All Time
        </Button>
        <DateRangePicker
          dateRange={dateRange}
          onDateRangeChange={handleDateRangeChange}
          className="ml-2"
        />
      </div>

      {/* KPI Cards */}
      <KPIMetricsRow 
        data={dashboardData} 
        isLoading={isLoadingDashboard}
        dateRange={activeDateRange}
      />

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Suspense fallback={<LoadingPlaceholder />}>
          <TransactionTrendsChart 
            data={dashboardData} 
            isLoading={isLoadingDashboard}
            dateRange={activeDateRange}
          />
        </Suspense>

        <Suspense fallback={<LoadingPlaceholder />}>
          <TransactionTypesChart 
            data={dashboardData} 
            isLoading={isLoadingDashboard}
            dateRange={activeDateRange}
          />
        </Suspense>
      </div>

      {/* Tables Grid */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2">
          <Suspense fallback={<LoadingPlaceholder />}>
            <RecentTransactions 
              data={transactionsData} 
              isLoading={isLoadingTransactions}
              dateRange={activeDateRange}
            />
          </Suspense>
        </div>

        <div className="space-y-6">
          <Suspense fallback={<LoadingPlaceholder />}>
            <TopUsers 
              data={usersData} 
              isLoading={isLoadingTopUsers}
              dateRange={activeDateRange}
            />
          </Suspense>

          <Suspense fallback={<LoadingPlaceholder />}>
            <OperatorPerformance 
              data={operatorsData} 
              isLoading={isLoadingOperators}
              dateRange={activeDateRange}
            />
          </Suspense>
        </div>
      </div>
    </div>
  );
}