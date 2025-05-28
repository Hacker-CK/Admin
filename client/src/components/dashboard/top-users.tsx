import React, { useState, useEffect } from 'react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { formatCurrency, getAvatarColor } from '@/lib/utils';
import { CurrencyDisplay } from '@/components/ui/currency-display';
import { User } from '@shared/schema';
import { useQuery } from '@tanstack/react-query';
import { ArrowRight, Users, TrendingUp, CreditCard, RefreshCcw, Gift, Share2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface TopUserItem extends Omit<User, 'referralEarnings'> {
  totalSpent: number;
  transactionCount: number;
  growth: number;
  cashback?: number; // Added cashback field which maps to commission
  referralEarnings?: number | string; // Added referral earnings field with number or string type
}

interface TopUsersProps {
  users: TopUserItem[];
  isLoading?: boolean;
  onViewAll: () => void;
}

export default function TopUsers({ users, isLoading = false, onViewAll }: TopUsersProps) {
  const [selectedTab, setSelectedTab] = useState('all');
  const [displayedUsers, setDisplayedUsers] = useState<TopUserItem[]>(users);

  // Fetch users by transaction type - these will only get top 10 for each type
  const { data: allUsers, isLoading: isAllUsersLoading } = useQuery<{ users: TopUserItem[] }>({
    queryKey: ['/api/users/top', { type: 'ALL' }],
    enabled: selectedTab === 'all',
    queryFn: () => fetch('/api/users/top').then(res => res.json())
  });

  const { data: rechargeUsers, isLoading: isRechargeLoading } = useQuery<{ users: TopUserItem[] }>({
    queryKey: ['/api/users/top', { type: 'RECHARGE' }],
    enabled: selectedTab === 'recharge',
    queryFn: () => fetch('/api/users/top?type=RECHARGE').then(res => res.json())
  });

  const { data: addFundUsers, isLoading: isAddFundLoading } = useQuery<{ users: TopUserItem[] }>({
    queryKey: ['/api/users/top', { type: 'ADD_FUND' }],
    enabled: selectedTab === 'addFund',
    queryFn: () => fetch('/api/users/top?type=ADD_FUND').then(res => res.json())
  });

  const { data: transferUsers, isLoading: isTransferLoading } = useQuery<{ users: TopUserItem[] }>({
    queryKey: ['/api/users/top', { type: 'TRANSFER' }],
    enabled: selectedTab === 'transfer',
    queryFn: () => fetch('/api/users/top?type=TRANSFER').then(res => res.json())
  });
  
  const { data: cashbackUsers, isLoading: isCashbackLoading } = useQuery<{ users: TopUserItem[] }>({
    queryKey: ['/api/users/top', { type: 'CASHBACK' }],
    enabled: selectedTab === 'cashback',
    queryFn: () => fetch('/api/users/top?type=CASHBACK').then(res => res.json())
  });
  
  const { data: referralUsers, isLoading: isReferralLoading } = useQuery<{ users: TopUserItem[] }>({
    queryKey: ['/api/users/top', { type: 'REFERRAL' }],
    enabled: selectedTab === 'referral',
    queryFn: () => fetch('/api/users/top?type=REFERRAL').then(res => res.json())
  });

  // Update displayed users when the selected tab or data changes
  useEffect(() => {
    // Initial load - use props users
    if (!allUsers && !rechargeUsers && !addFundUsers && !transferUsers && !cashbackUsers && !referralUsers) {
      setDisplayedUsers(users || []);
      return;
    }

    switch (selectedTab) {
      case 'all':
        // Format users and add missing properties
        const enhancedUsers = (allUsers?.users || []).map(user => ({
          ...user,
          totalSpent: user.totalSpent || user.transactionVolume || parseFloat(user.walletBalance) || 0,
          transactionCount: user.transactionCount || 0,
          growth: user.growth || 0
        }));
        setDisplayedUsers(enhancedUsers);
        break;
      case 'recharge':
        const rechargeEnhanced = (rechargeUsers?.users || []).map(user => ({
          ...user,
          totalSpent: user.totalSpent || user.transactionVolume || 0,
          transactionCount: user.transactionCount || 0,
          growth: user.growth || 0
        }));
        setDisplayedUsers(rechargeEnhanced);
        break;
      case 'addFund':
        const addFundEnhanced = (addFundUsers?.users || []).map(user => ({
          ...user,
          totalSpent: user.totalSpent || user.transactionVolume || 0,
          transactionCount: user.transactionCount || 0,
          growth: user.growth || 0
        }));
        setDisplayedUsers(addFundEnhanced);
        break;
      case 'transfer':
        const transferEnhanced = (transferUsers?.users || []).map(user => ({
          ...user,
          totalSpent: user.totalSpent || user.transactionVolume || 0,
          transactionCount: user.transactionCount || 0,
          growth: user.growth || 0
        }));
        setDisplayedUsers(transferEnhanced);
        break;
      case 'cashback':
        const cashbackEnhanced = (cashbackUsers?.users || []).map(user => ({
          ...user,
          totalSpent: parseFloat(user.commission?.toString() || '0'), // Use commission as cashback amount
          cashback: parseFloat(user.commission?.toString() || '0'),   // Store the commission as cashback
          transactionCount: user.transactionCount || 0,
          growth: user.growth || 0
        }));
        // Sort users by cashback amount (commission) in descending order
        const sortedCashbackUsers = [...cashbackEnhanced].sort((a, b) => 
          (parseFloat(b.commission?.toString() || '0') - parseFloat(a.commission?.toString() || '0'))
        );
        setDisplayedUsers(sortedCashbackUsers);
        break;
      case 'referral':
        const referralEnhanced = (referralUsers?.users || []).map(user => {
          // Convert referral earnings to number for calculations and sorting
          const referralEarningsNum = user.referralEarnings 
            ? parseFloat(user.referralEarnings.toString()) 
            : 0;
          
          return {
            ...user,
            totalSpent: referralEarningsNum,
            transactionCount: user.transactionCount || 0,
            growth: user.growth || 0,
            // Store referral earnings as number for easier sorting and rendering
            referralEarnings: referralEarningsNum
          };
        });
        
        // Sort users by referral earnings in descending order
        const sortedReferralUsers = [...referralEnhanced].sort((a, b) => {
          const bEarnings = typeof b.referralEarnings === 'number' ? b.referralEarnings : 0;
          const aEarnings = typeof a.referralEarnings === 'number' ? a.referralEarnings : 0;
          return bEarnings - aEarnings;
        });
        
        setDisplayedUsers(sortedReferralUsers);
        break;
      default:
        // Apply same transformations to users from props
        const propsEnhanced = (users || []).map(user => ({
          ...user,
          totalSpent: user.totalSpent || user.transactionVolume || parseFloat(user.walletBalance) || 0,
          transactionCount: user.transactionCount || 0,
          growth: user.growth || 0
        }));
        setDisplayedUsers(propsEnhanced);
    }
  }, [selectedTab, users, allUsers, rechargeUsers, addFundUsers, transferUsers, cashbackUsers, referralUsers]);

  const isTabLoading = 
    (selectedTab === 'all' && isAllUsersLoading) ||
    (selectedTab === 'recharge' && isRechargeLoading) || 
    (selectedTab === 'addFund' && isAddFundLoading) || 
    (selectedTab === 'transfer' && isTransferLoading) || 
    (selectedTab === 'cashback' && isCashbackLoading) ||
    (selectedTab === 'referral' && isReferralLoading) ||
    (selectedTab === 'all' && isLoading);

  // Get the appropriate icon for the current tab
  const getTabIcon = () => {
    switch (selectedTab) {
      case 'recharge':
        return <RefreshCcw className="w-4 h-4 mr-2" />;
      case 'addFund':
        return <CreditCard className="w-4 h-4 mr-2" />;
      case 'transfer':
        return <ArrowRight className="w-4 h-4 mr-2" />;
      case 'cashback':
        return <Gift className="w-4 h-4 mr-2" />;
      case 'referral':
        return <Share2 className="w-4 h-4 mr-2" />;
      default:
        return <Users className="w-4 h-4 mr-2" />;
    }
  };

  if (isTabLoading) {
    return (
      <div className="bg-white rounded-xl shadow-sm p-6 animate-pulse">
        <div className="flex items-center justify-between mb-6">
          <div className="h-6 w-32 bg-gray-200 rounded"></div>
          <div className="h-6 w-16 bg-gray-200 rounded"></div>
        </div>
        <div className="h-10 bg-gray-200 rounded mb-4"></div>
        <div className="space-y-4">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="flex items-center bg-gray-50 p-3 rounded-lg">
              <div className="h-10 w-10 rounded-full bg-gray-200"></div>
              <div className="ml-3 flex-1">
                <div className="flex items-center justify-between">
                  <div className="h-4 w-24 bg-gray-200 rounded"></div>
                  <div className="h-4 w-16 bg-gray-200 rounded"></div>
                </div>
                <div className="flex items-center justify-between mt-1">
                  <div className="h-3 w-20 bg-gray-200 rounded"></div>
                  <div className="h-3 w-8 bg-gray-200 rounded"></div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }
  
  return (
    <div className="bg-white rounded-xl shadow-sm overflow-hidden border border-gray-100">
      <div className="flex items-center justify-between p-5 border-b border-gray-100">
        <div className="flex items-center space-x-2">
          {getTabIcon()}
          <h2 className="text-lg font-semibold">Top {selectedTab !== 'all' ? selectedTab : ''} Users</h2>
          <Badge variant="outline" className="ml-2 bg-blue-50 text-blue-700 border-blue-200">
            {displayedUsers.length} users
          </Badge>
        </div>
        <Button
          variant="outline" 
          size="sm" 
          onClick={onViewAll}
          className="text-sm font-medium"
        >
          View All
        </Button>
      </div>
      
      <Tabs defaultValue="all" onValueChange={setSelectedTab} value={selectedTab}>
        <div className="border-b border-gray-100">
          <TabsList className="grid grid-cols-6 w-full rounded-none bg-gray-50">
            <TabsTrigger value="all" className="data-[state=active]:bg-white">All</TabsTrigger>
            <TabsTrigger value="recharge" className="data-[state=active]:bg-white">Recharge</TabsTrigger>
            <TabsTrigger value="addFund" className="data-[state=active]:bg-white">Add Money</TabsTrigger>
            <TabsTrigger value="transfer" className="data-[state=active]:bg-white">Transfer</TabsTrigger>
            <TabsTrigger value="cashback" className="data-[state=active]:bg-white">Cashback</TabsTrigger>
            <TabsTrigger value="referral" className="data-[state=active]:bg-white">Referrals</TabsTrigger>
          </TabsList>
        </div>
        
        <div className="p-1">
          {displayedUsers.length > 0 ? (
            <div className="divide-y divide-gray-50">
              {displayedUsers.map((user, index) => (
                <div key={user.id} className="p-3 hover:bg-gray-50 transition-colors">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center">
                      <div className="flex-shrink-0 mr-2 text-gray-400 w-5">#{index + 1}</div>
                      <Avatar className="h-10 w-10" style={{ backgroundColor: getAvatarColor(user.name || user.username) }}>
                        <AvatarFallback className="text-white">
                          {user.name ? user.name.slice(0, 2).toUpperCase() : user.username.slice(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="ml-3">
                        <p className="text-sm font-medium truncate max-w-[120px]">{user.name || user.username}</p>
                        <p className="text-xs text-gray-500">{user.transactionCount || 0} transactions</p>
                      </div>
                    </div>
                    <div className="text-right">
                      {/* Show appropriate label based on selected tab */}
                      {selectedTab === 'cashback' && <p className="text-xs text-gray-500 mb-1">Cashback Amount</p>}
                      {selectedTab === 'referral' && <p className="text-xs text-gray-500 mb-1">Referral Earnings</p>}
                      <CurrencyDisplay 
                        amount={
                          selectedTab === 'cashback' && user.cashback !== undefined 
                            ? user.cashback 
                            : selectedTab === 'referral' && user.referralEarnings !== undefined
                              ? user.referralEarnings
                              : user.totalSpent || 0
                        }
                        className="text-sm font-bold text-primary"
                      />
                      <div className="flex items-center justify-end mt-1">
                        <TrendingUp className={`w-3 h-3 mr-1 ${(user.growth || 0) >= 0 ? 'text-green-600' : 'text-red-500'}`} />
                        <p className={`text-xs ${(user.growth || 0) >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                          {(user.growth || 0) >= 0 ? '+' : ''}{user.growth || 0}%
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-8 text-center">
              <Users className="w-12 h-12 mx-auto text-gray-300" />
              <p className="mt-2 text-sm text-gray-500">No users found for this transaction type</p>
            </div>
          )}
        </div>
      </Tabs>
    </div>
  );
}
