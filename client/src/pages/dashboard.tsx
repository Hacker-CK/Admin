import React, { useState, useCallback, useEffect, useMemo, lazy, Suspense, memo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocation } from 'wouter';
import { DateRange } from 'react-day-picker';
import { addDays, startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfYear, endOfYear } from 'date-fns';

// Regular import for the critical component
import KPIMetricsRow from '@/components/dashboard/kpi-cards';

// Lazy load non-critical components with preload
const TransactionTrendsChart = lazy(() => import('@/components/dashboard/transaction-trends-chart'));
const TransactionTypesChart = lazy(() => import('@/components/dashboard/transaction-types-chart'));
const RecentTransactions = lazy(() => import('@/components/dashboard/recent-transactions'));
const TopUsers = lazy(() => import('@/components/dashboard/top-users'));
const OperatorPerformance = lazy(() => import('@/components/dashboard/operator-performance'));

// Preload components after initial render
const preloadComponents = () => {
  const timer = setTimeout(() => {
    import('@/components/dashboard/transaction-trends-chart');
    import('@/components/dashboard/transaction-types-chart');
    import('@/components/dashboard/recent-transactions');
    import('@/components/dashboard/top-users');
    import('@/components/dashboard/operator-performance');
  }, 1000);
  return () => clearTimeout(timer);
};

import { Button } from '@/components/ui/button';
import { DateRangePicker } from '@/components/ui/date-range-picker';
import { SyncIndicator } from '@/components/ui/sync-indicator';
import toast from 'react-hot-toast';

// Memoized Loading placeholder component
const LoadingPlaceholder = memo(() => (
  <div className="w-full h-60 bg-gray-100 animate-pulse rounded-lg flex items-center justify-center">
    <div className="text-gray-400">Loading...</div>
  </div>
));

export default function Dashboard() {
  const [, setLocation] = useLocation();
  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);
  const [selectedPeriod, setSelectedPeriod] = useState<'today' | 'week' | 'month' | 'year' | 'all' | 'custom'>('today');
  const [isSyncing, setIsSyncing] = useState<boolean>(false); // Start with not syncing for better UX
  const [syncError, setSyncError] = useState<boolean>(false);
  const [lastSynced, setLastSynced] = useState<Date | null>(null);
  const queryClient = useQueryClient();

  // Calculate date range based on selected period - memoized
  const getDateRangeForPeriod = useCallback((period: 'today' | 'week' | 'month' | 'year' | 'all') => {
    const now = new Date();
    
    switch (period) {
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
      case 'all':
        // Return null for both to indicate no date filtering
        return null;
      default:
        return undefined;
    }
  }, []);

  // Get effective date range based on selected period or custom range
  const effectiveDateRange = useMemo(() => {
    // For 'all' period, return undefined to indicate no filtering
    if (selectedPeriod === 'all') {
      return undefined;
    }
    
    // For custom period, use the provided date range
    if (selectedPeriod === 'custom') {
      if (!dateRange?.from) return undefined;
      
      const from = new Date(dateRange.from);
      from.setHours(0, 0, 0, 0);
      
      if (dateRange.to) {
        const to = new Date(dateRange.to);
        to.setHours(23, 59, 59, 999);
        return { from, to };
      } else {
        const to = addDays(dateRange.from, 1);
        to.setHours(23, 59, 59, 999);
        return { from, to };
      }
    }
    
    // For predefined periods, use the calculated range
    const range = getDateRangeForPeriod(selectedPeriod as 'today' | 'week' | 'month' | 'year');
    if (range) {
      // Ensure full-day ranges by setting hours
      const from = new Date(range.from);
      from.setHours(0, 0, 0, 0);
      
      const to = new Date(range.to);
      to.setHours(23, 59, 59, 999);
      
      return { from, to };
    }
    
    return undefined;
  }, [selectedPeriod, dateRange, getDateRangeForPeriod]);
  
  // Build query params with date range for data load - send to server
  const queryParams = useMemo(() => {
    // Only add date range params if we have a date range and it's not 'all'
    if (selectedPeriod !== 'all' && effectiveDateRange?.from) {
      const fromDateStr = effectiveDateRange.from.toISOString();
      const toDateStr = effectiveDateRange.to ? effectiveDateRange.to.toISOString() : new Date().toISOString();
      return `?startDate=${fromDateStr}&endDate=${toDateStr}`;
    }
    return '';
  }, [selectedPeriod, effectiveDateRange]);

  // Common query options for optimal performance
  const commonQueryOptions = useMemo(() => ({
    staleTime: 60000, // Consider data fresh for 60 seconds
    gcTime: 300000, // Keep data in cache for 5 minutes (replaces cacheTime in v5)
    refetchOnWindowFocus: false, // Don't refetch on window focus
    retry: 2, // Retry failed requests only twice
    refetchOnReconnect: false, // Don't automatically refetch on reconnect
    placeholderData: (oldData: any) => oldData, // Keep previous data while loading new data
  }), []);

  // Fetch dashboard summary data with date filters
  const { data: fullDashboardData, isLoading: isLoadingDashboard, refetch: refetchDashboard } = useQuery({
    // Include queryParams in the queryKey to refetch when filters change
    queryKey: ['/api/dashboard/summary', queryParams],
    // Custom query function to include the date parameters
    queryFn: async () => {
      const response = await fetch(`/api/dashboard/summary${queryParams}`);
      if (!response.ok) {
        throw new Error('Network response was not ok');
      }
      return response.json();
    },
    ...commonQueryOptions,
    // Reduce stale time to ensure fresh data when filters change
    staleTime: 60000, // 1 minute
  });

  // Fetch transactions data with date filters
  const { data: fullTransactionsData, isLoading: isLoadingTransactions, refetch: refetchTransactions } = useQuery({
    // Include queryParams in the queryKey to refetch when filters change
    queryKey: ['/api/transactions/recent', queryParams],
    // Custom query function to include the date parameters
    queryFn: async () => {
      const response = await fetch(`/api/transactions/recent${queryParams}`);
      if (!response.ok) {
        throw new Error('Network response was not ok');
      }
      return response.json();
    },
    ...commonQueryOptions,
    staleTime: 60000, // 1 minute
  });

  // Fetch ALL users data once and cache - we'll filter client-side
  const { data: fullUsersData, isLoading: isLoadingTopUsers, refetch: refetchTopUsers } = useQuery({
    queryKey: ['/api/users/top'],
    // Use the default query function from queryClient which is already set up properly
    ...commonQueryOptions,
    staleTime: 300000, // 5 minutes
    // Keep previous data during loading for smoother UX
    select: useCallback((data: any) => {
      // Add transaction and wallet metrics to users if not present
      if (data && data.users && Array.isArray(data.users)) {
        // Sort users by commission (cashback) in descending order
        const sortedUsers = [...data.users].sort(
          (a, b) => parseFloat(b.commission?.toString() || '0') - parseFloat(a.commission?.toString() || '0')
        );
        
        return {
          ...data,
          users: sortedUsers.map(user => ({
            ...user, 
            totalSpent: parseFloat(user.commission?.toString() || '0'), // Use commission as primary value
            cashback: parseFloat(user.commission?.toString() || '0'),   // Store the commission as cashback
            transactionCount: user.transactionCount || 0,
            growth: user.growth || 0
          }))
        };
      }
      return data;
    }, [])
  });

  // Fetch ALL operator data once and cache - we'll filter client-side
  const { data: fullOperatorData, isLoading: isLoadingOperators, refetch: refetchOperators } = useQuery({
    queryKey: ['/api/operators/performance'],
    // Use the default query function from queryClient which is already set up properly
    ...commonQueryOptions,
    staleTime: 300000, // 5 minutes
  });

  // Function to filter data based on date range - highly optimized
  const filterDataByDateRange = useCallback((items: any[], dateRange?: { from: Date, to: Date } | undefined) => {
    // If no date range, return all data
    if (!dateRange?.from) return items;
    
    const fromDate = new Date(dateRange.from);
    fromDate.setHours(0, 0, 0, 0);
    
    const toDate = dateRange.to ? new Date(dateRange.to) : new Date();
    toDate.setHours(23, 59, 59, 999);
    
    return items.filter(item => {
      if (!item.timestamp) return false;
      const itemDate = new Date(item.timestamp);
      return itemDate >= fromDate && itemDate <= toDate;
    });
  }, []);
  
  // Apply client-side filtering to each dataset based on effective date range
  // This is all done client-side for instant filtering
  const filteredTransactions = useMemo(() => {
    // Ensure we're working with an array
    if (!fullTransactionsData || !Array.isArray(fullTransactionsData.transactions)) {
      return [];
    }
    return filterDataByDateRange(fullTransactionsData.transactions, effectiveDateRange);
  }, [fullTransactionsData, effectiveDateRange, filterDataByDateRange]);
  
  const filteredUsers = useMemo(() => {
    const users = fullUsersData?.users || [];
    
    // Apply date filtering based on user's transactions if available
    if (effectiveDateRange?.from && users.length > 0) {
      const fromDate = new Date(effectiveDateRange.from);
      fromDate.setHours(0, 0, 0, 0);
      
      const toDate = effectiveDateRange.to ? new Date(effectiveDateRange.to) : new Date();
      toDate.setHours(23, 59, 59, 999);
      
      // For users, we need to filter based on their last transaction date
      // This is a simplification - ideally we would filter based on their transactions in the period
      return users.filter((user: any) => {
        if (user.lastTransactionDate) {
          const txDate = new Date(user.lastTransactionDate);
          return txDate >= fromDate && txDate <= toDate;
        }
        // Include users without transaction date when filtering by date
        return selectedPeriod === 'all';
      });
    }
    
    return users;
  }, [fullUsersData, effectiveDateRange, selectedPeriod]);
  
  const filteredOperators = useMemo(() => {
    // Always return all operators regardless of date range
    // Operators should always be visible regardless of date filter
    // Check that fullOperatorData is an object with operators property that is an array
    if (!fullOperatorData || !Array.isArray(fullOperatorData.operators)) {
      return [];
    }
    return fullOperatorData.operators;
  }, [fullOperatorData]);
  
  // Create a filtered dashboard data object with metrics calculated client-side from our filtered datasets
  const dashboardData = useMemo(() => {
    if (!fullDashboardData) return null;
    
    // Start with a deep copy of the full data
    const result = JSON.parse(JSON.stringify(fullDashboardData));
    
    // If we're not filtering by date, just return the full data
    if (selectedPeriod === 'all' || !effectiveDateRange) {
      return result;
    }
    
    // Filter transactions for metrics calculations
    const transactions = filteredTransactions;
    
    // Calculate transaction metrics from filtered transactions
    const successTransactions = transactions.filter(tx => 
      tx.status.toUpperCase() === 'SUCCESS' || tx.status.toUpperCase() === 'SUCCESSFUL'
    );
    
    const totalAmount = transactions.reduce((sum, tx) => 
      sum + parseFloat(tx.amount.toString()), 0
    );
    
    const successAmount = successTransactions.reduce((sum, tx) => 
      sum + parseFloat(tx.amount.toString()), 0
    );
    
    // Calculate cashback transactions
    const cashbackTransactions = transactions.filter(tx => 
      (tx.status.toUpperCase() === 'SUCCESS' || tx.status.toUpperCase() === 'SUCCESSFUL') && 
      (tx.type.toUpperCase() === 'CASHBACK' || tx.type.toUpperCase() === 'REFERRAL')
    );
    
    const cashbackAmount = cashbackTransactions.reduce((sum, tx) => 
      sum + parseFloat(tx.amount.toString()), 0
    );
    
    // Calculate transaction types
    const rechargeTransactions = transactions.filter(tx => 
      (tx.status.toUpperCase() === 'SUCCESS' || tx.status.toUpperCase() === 'SUCCESSFUL') && 
      tx.type.toUpperCase() === 'RECHARGE'
    );
    
    const addFundTransactions = transactions.filter(tx => 
      (tx.status.toUpperCase() === 'SUCCESS' || tx.status.toUpperCase() === 'SUCCESSFUL') && 
      tx.type.toUpperCase() === 'ADD_FUND'
    );
    
    const transferTransactions = transactions.filter(tx => 
      (tx.status.toUpperCase() === 'SUCCESS' || tx.status.toUpperCase() === 'SUCCESSFUL') && 
      tx.type.toUpperCase() === 'TRANSFER'
    );
    
    // Calculate pending, failed, and refund transactions
    const pendingTransactions = transactions.filter(tx => 
      tx.status.toUpperCase() === 'PENDING'
    );
    
    const failedTransactions = transactions.filter(tx => 
      tx.status.toUpperCase() === 'FAILED'
    );
    
    const refundTransactions = transactions.filter(tx => 
      tx.status.toUpperCase() === 'REFUND'
    );
    
    const pendingAmount = pendingTransactions.reduce((sum, tx) => 
      sum + parseFloat(tx.amount.toString()), 0
    );
    
    const failedAmount = failedTransactions.reduce((sum, tx) => 
      sum + parseFloat(tx.amount.toString()), 0
    );
    
    const refundAmount = refundTransactions.reduce((sum, tx) => 
      sum + parseFloat(tx.amount.toString()), 0
    );
    
    // Calculate user metrics from filtered transactions
    const userIdsSet = new Set<number>();
    transactions.forEach(tx => userIdsSet.add(tx.userId));
    const totalUsers = userIdsSet.size;
    
    // Calculate revenue
    const totalRevenue = successTransactions.reduce((sum, tx) => {
      // Revenue is from recharge, add_fund, and transfer
      if (['RECHARGE', 'ADD_FUND', 'TRANSFER'].includes(tx.type.toUpperCase())) {
        return sum + parseFloat(tx.amount.toString());
      }
      return sum;
    }, 0);
    
    // Calculate referral earnings
    const referralEarnings = successTransactions.reduce((sum, tx) => {
      if (tx.type.toUpperCase() === 'REFERRAL') {
        return sum + parseFloat(tx.amount.toString());
      }
      return sum;
    }, 0);
    
    // Update ALL metrics with our filtered calculations
    result.metrics = {
      ...result.metrics,
      users: {
        ...result.metrics.users,
        total: totalUsers, // Use count of unique users in filtered transactions
      },
      revenue: {
        ...result.metrics.revenue,
        total: totalRevenue,
      },
      transactions: {
        ...result.metrics.transactions,
        total: transactions.length,
        volume: totalAmount,
        successRate: transactions.length > 0 ? (successTransactions.length / transactions.length) * 100 : 0,
        pendingAmount: pendingAmount,
        failedAmount: failedAmount,
        refundAmount: refundAmount,
      },
      transactionTypes: {
        recharge: rechargeTransactions.reduce((sum, tx) => sum + parseFloat(tx.amount.toString()), 0),
        addFund: addFundTransactions.reduce((sum, tx) => sum + parseFloat(tx.amount.toString()), 0),
        transfer: transferTransactions.reduce((sum, tx) => sum + parseFloat(tx.amount.toString()), 0),
        cashback: cashbackAmount,
      },
      cashback: {
        ...result.metrics.cashback,
        total: cashbackAmount,
      },
      referrals: {
        ...result.metrics.referrals,
        earnings: referralEarnings,
      }
    };
    
    return result;
  }, [fullDashboardData, filteredTransactions, effectiveDateRange, selectedPeriod]);

  // Create processed transaction data based on filtered transactions
  const transactionsData = useMemo(() => {
    return { transactions: filteredTransactions };
  }, [filteredTransactions]);
  
  // Create processed user data based on filtered users
  const topUsersData = useMemo(() => {
    return { users: filteredUsers };
  }, [filteredUsers]);
  
  // Create processed operator data based on filtered operators
  const operatorData = useMemo(() => {
    return { operators: filteredOperators };
  }, [filteredOperators]);
  
  // Initial data load effect - update sync indicator when data is loaded for the first time
  // Also preload components after initial data is loaded
  useEffect(() => {
    if (!isLoadingDashboard && !isLoadingTransactions && !isLoadingTopUsers && !isLoadingOperators) {
      setIsSyncing(false);
      setLastSynced(new Date());
      
      // Preload components once data is loaded
      const cleanupPreload = preloadComponents();
      return cleanupPreload;
    }
  }, [isLoadingDashboard, isLoadingTransactions, isLoadingTopUsers, isLoadingOperators]);

  // Auto-refresh effect - Will update data every 60 seconds (increased from 30)
  useEffect(() => {
    // Subscribe to events that might indicate data changes
    const subscribeToEvents = () => {
      // Set up a listener for focus events to refresh when the user comes back to the tab
      const handleVisibilityChange = () => {
        if (document.visibilityState === 'visible' && 
            lastSynced && 
            (new Date().getTime() - lastSynced.getTime() > 60000)) {
          // Only refresh if it's been more than a minute since last sync
          refreshAllData();
        }
      };
      
      document.addEventListener('visibilitychange', handleVisibilityChange);
      
      // Set up regular refresh interval - less frequent to reduce server load
      const refreshInterval = setInterval(() => {
        refreshAllData(false); // silent refresh
      }, 60000); // refresh every 60 seconds
      
      return () => {
        document.removeEventListener('visibilitychange', handleVisibilityChange);
        clearInterval(refreshInterval);
      };
    };
    
    // Start subscription
    const cleanup = subscribeToEvents();
    
    // Clean up on component unmount
    return () => {
      cleanup();
    };
  }, [lastSynced]);
  
  // Shared function to refresh all data - memoized to avoid recreating function on each render
  const refreshAllData = useCallback(async (showToast = true) => {
    // Don't start a refresh if one is already in progress
    if (isSyncing) return;
    
    // Update sync indicator status
    setIsSyncing(true);
    setSyncError(false);
    
    if (showToast) {
      toast("Refreshing dashboard data...", { duration: 2000 });
    }
    
    try {
      // First, fetch primary data that doesn't depend on other data
      await Promise.all([
        // Only directly refetch the dashboard data, which is the most critical
        refetchDashboard()
      ]);
      
      // Then fetch the secondary data in parallel, but only after primary data is loaded
      // We use a small timeout to let the UI refresh with the primary data first
      setTimeout(() => {
        // Use a non-blocking update for secondary data
        Promise.all([
          refetchTransactions(),
          refetchTopUsers(),
          refetchOperators()
        ]).catch(err => {
          console.warn('Secondary data fetch error:', err);
          // No need to show error to user for secondary data
        });
      }, 100);
      
      // Update sync status to reflect successful sync
      setIsSyncing(false);
      setLastSynced(new Date());
      setSyncError(false);
      
      if (showToast) {
        toast.success("Dashboard data refreshed successfully", { duration: 2000 });
      }
    } catch (error) {
      console.error('Error refreshing dashboard data:', error);
      
      // Update sync status to reflect failed sync
      setIsSyncing(false);
      setSyncError(true);
      
      if (showToast) {
        toast.error("Error refreshing dashboard data", { duration: 3000 });
      }
    }
  }, [isSyncing, refetchDashboard, refetchTransactions, refetchTopUsers, refetchOperators]);

  const handlePeriodChange = (period: 'today' | 'week' | 'month' | 'year' | 'all' | 'custom') => {
    setSelectedPeriod(period);
    
    // If custom is selected, keep the current date range
    if (period !== 'custom') {
      // If all time is selected, set date range to undefined
      if (period === 'all') {
        setDateRange(undefined);
      } else {
        const range = getDateRangeForPeriod(period as 'today' | 'week' | 'month' | 'year');
        if (range) {
          setDateRange(range as DateRange);
        } else {
          setDateRange(undefined);
        }
      }
    }
  };
  
  const handleRefresh = () => {
    refreshAllData(true);
  };

  // Transform dashboard data into KPI metrics format - memoized to prevent unnecessary recalculations
  const kpiMetrics = useMemo(() => dashboardData ? [
    { title: 'Total Users', value: dashboardData.metrics.users.total, changePercentage: dashboardData.metrics.users.growth, icon: 'users' as const },
    { title: 'Total Revenue', value: dashboardData.metrics.revenue.total, changePercentage: dashboardData.metrics.revenue.growth, icon: 'indianRevenue' as const },
    { title: 'Transactions', value: dashboardData.metrics.transactions.total, changePercentage: dashboardData.metrics.transactions.growth, icon: 'transactions' as const },
    { title: 'Referral Earnings', value: dashboardData.metrics.referrals.earnings, changePercentage: dashboardData.metrics.referrals.growth, icon: 'referrals' as const }
  ] : [
    { title: 'Total Users', value: 0, changePercentage: 0, icon: 'users' as const },
    { title: 'Total Revenue', value: 0, changePercentage: 0, icon: 'indianRevenue' as const },
    { title: 'Transactions', value: 0, changePercentage: 0, icon: 'transactions' as const },
    { title: 'Referral Earnings', value: 0, changePercentage: 0, icon: 'referrals' as const }
  ], [dashboardData]);
  
  // Transaction type metrics - memoized
  const transactionTypeMetrics = useMemo(() => dashboardData ? [
    { title: 'Total Recharge', value: dashboardData.metrics.transactionTypes.recharge, changePercentage: 0, icon: 'recharge' as const },
    { title: 'Total Add Fund', value: dashboardData.metrics.transactionTypes.addFund, changePercentage: 0, icon: 'addFund' as const },
    { title: 'Total Transfer', value: dashboardData.metrics.transactionTypes.transfer, changePercentage: 0, icon: 'transfer' as const },
    { 
      title: 'Total Cashback', 
      value: dashboardData.metrics.cashback?.total || dashboardData.metrics.transactionTypes.cashback || 0, 
      changePercentage: dashboardData.metrics.cashback?.growth || 0, 
      icon: 'cashback' as const 
    },
    { title: 'Total Wallet Balance', value: dashboardData.metrics.users.totalWalletBalance, changePercentage: dashboardData.metrics.users.walletBalanceGrowth || 0, icon: 'walletBalance' as const }
  ] : [
    { title: 'Total Recharge', value: 0, changePercentage: 0, icon: 'recharge' as const },
    { title: 'Total Add Fund', value: 0, changePercentage: 0, icon: 'addFund' as const },
    { title: 'Total Transfer', value: 0, changePercentage: 0, icon: 'transfer' as const },
    { title: 'Total Cashback', value: 0, changePercentage: 0, icon: 'cashback' as const },
    { title: 'Total Wallet Balance', value: 0, changePercentage: 0, icon: 'walletBalance' as const }
  ], [dashboardData]);
  
  // Transaction status metrics - memoized
  const transactionStatusMetrics = useMemo(() => dashboardData ? [
    { 
      title: 'Pending Amount', 
      value: dashboardData.metrics.transactions.pendingAmount || 0, 
      changePercentage: 0, 
      icon: 'pending' as const 
    },
    { 
      title: 'Failed Amount', 
      value: dashboardData.metrics.transactions.failedAmount || 0, 
      changePercentage: 0, 
      icon: 'failed' as const 
    },
    { 
      title: 'Refund Amount', 
      value: dashboardData.metrics.transactions.refundAmount || 0, 
      changePercentage: 0, 
      icon: 'refund' as const
    }
  ] : [
    { title: 'Pending Amount', value: 0, changePercentage: 0, icon: 'pending' as const },
    { title: 'Failed Amount', value: 0, changePercentage: 0, icon: 'failed' as const },
    { title: 'Refund Amount', value: 0, changePercentage: 0, icon: 'refund' as const }
  ], [dashboardData]);

  // Chart data from the API or empty arrays if data is not available yet - memoized
  const chartData = useMemo(() => dashboardData?.chartData || {
    daily: [],
    weekly: [],
    monthly: []
  }, [dashboardData]);

  // Transaction types data for the donut chart - memoized
  const transactionTypesData = useMemo(() => dashboardData?.transactionTypes || [], [dashboardData]);

  return (
    <div className="p-6">
      {/* Page Title */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <h1 className="text-2xl font-inter font-bold">Dashboard</h1>
          <SyncIndicator 
            isSyncing={isSyncing} 
            isError={syncError} 
            lastSynced={lastSynced} 
            className="ml-4" 
          />
        </div>
        <div className="flex space-x-2">
          <Button variant="default" size="sm" onClick={handleRefresh}>
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" clipRule="evenodd" />
            </svg>
            Refresh
          </Button>
        </div>
      </div>

      {/* Period Filters */}
      <div className="flex items-center space-x-3 mb-6">
        <Button 
          variant={selectedPeriod === 'today' ? 'default' : 'outline'}
          className="px-4 py-1.5 rounded-full text-sm font-medium"
          onClick={() => handlePeriodChange('today')}
        >
          Today
        </Button>
        <Button
          variant={selectedPeriod === 'week' ? 'default' : 'outline'}
          className="px-4 py-1.5 rounded-full text-sm font-medium"
          onClick={() => handlePeriodChange('week')}
        >
          This Week
        </Button>
        <Button
          variant={selectedPeriod === 'month' ? 'default' : 'outline'}
          className="px-4 py-1.5 rounded-full text-sm font-medium"
          onClick={() => handlePeriodChange('month')}
        >
          This Month
        </Button>
        <Button
          variant={selectedPeriod === 'year' ? 'default' : 'outline'}
          className="px-4 py-1.5 rounded-full text-sm font-medium"
          onClick={() => handlePeriodChange('year')}
        >
          This Year
        </Button>
        <Button
          variant={selectedPeriod === 'all' ? 'default' : 'outline'}
          className="px-4 py-1.5 rounded-full text-sm font-medium"
          onClick={() => handlePeriodChange('all')}
        >
          All Time
        </Button>
        <div className="relative ml-auto">
          <DateRangePicker 
            dateRange={dateRange}
            onDateRangeChange={(range) => {
              setDateRange(range);
              setSelectedPeriod('custom');
            }}
            className="w-[300px]"
          />
        </div>
      </div>

      {/* KPI Cards */}
      <KPIMetricsRow metrics={kpiMetrics} isLoading={isLoadingDashboard} />
      
      {/* Transaction Type Metrics */}
      <div className="mb-4">
        <h2 className="text-lg font-medium mb-3">Transaction Metrics</h2>
        <KPIMetricsRow metrics={[...transactionTypeMetrics, ...transactionStatusMetrics]} isLoading={isLoadingDashboard} />
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        <Suspense fallback={<LoadingPlaceholder />}>
          <TransactionTrendsChart 
            data={chartData}
            totalVolume={dashboardData?.metrics?.transactions?.volume || 0}
            successRate={dashboardData?.metrics?.transactions?.successRate || 0}
            avgTransaction={dashboardData?.avgTransaction || 0}
            isLoading={isLoadingDashboard}
          />

        </Suspense>
        
        <Suspense fallback={<LoadingPlaceholder />}>
          <TransactionTypesChart 
            data={transactionTypesData}
            isLoading={isLoadingDashboard}
          />
        </Suspense>
      </div>

      {/* Recent Transactions */}
      <Suspense fallback={<div className="w-full bg-gray-100 animate-pulse rounded-lg p-6 mb-6 h-72"></div>}>
        <RecentTransactions 
          transactions={filteredTransactions || []}
          isLoading={isLoadingTransactions}
          onViewAll={() => setLocation('/transactions')}
        />
      </Suspense>

      {/* Bottom Cards Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <Suspense fallback={<LoadingPlaceholder />}>
          <TopUsers 
            users={filteredUsers || []}
            isLoading={isLoadingTopUsers}
            onViewAll={() => setLocation('/users')}
          />
        </Suspense>
        
        <Suspense fallback={<LoadingPlaceholder />}>
          <OperatorPerformance 
            operators={filteredOperators || []}
            isLoading={isLoadingOperators}
            onViewAll={() => setLocation('/operators')}
          />
        </Suspense>
      </div>
    </div>
  );
}
