import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import {
  Bell,
  AlertCircle,
  Wallet,
  RefreshCw
} from "lucide-react";
import toast from "react-hot-toast";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { apiRequest } from "@/lib/queryClient";
import type { Notification, Operator, Transaction } from "@shared/schema";

import { formatDate, formatCurrency, getInitials } from "@/lib/utils";
import { CurrencyDisplay } from "@/components/ui/currency-display";

// Extended type for notifications with recharge details
interface NotificationWithRechargeDetails extends Notification {
  rechargeDetails?: {
    amount: string | number;
    status: string;
    phoneNumber: string;
    operatorName: string;
    operatorLogo: string;
  }
}

interface HeaderProps {
  onToggleSidebar?: () => void;
  showActions?: boolean;
}

export default function Header({
  onToggleSidebar,
  showActions = true,
}: HeaderProps) {
  const [, setLocation] = useLocation();

  const [userData, setUserData] = useState<{ id: number; username: string; name?: string; isAdmin?: boolean } | null>(null);
  
  // Fetch user data
  useEffect(() => {
    // Get user data from session or localStorage
    const storedUserData = localStorage.getItem("userData");
    if (storedUserData) {
      try {
        const parsedUserData = JSON.parse(storedUserData);
        setUserData(parsedUserData);
      } catch (e) {
        console.error("Error parsing stored user data:", e);
      }
    }
    
    // Also fetch from the server to ensure we have the latest data
    fetch('/api/auth/session')
      .then(response => response.json())
      .then(data => {
        if (data.isAuthenticated && data.user) {
          setUserData(data.user);
        }
      })
      .catch(error => console.error("Failed to fetch user session:", error));
  }, []);

  // Fetch notifications for the current user
  const { data: notificationsData, isLoading: isLoadingNotifications } = useQuery<{ notifications: Notification[] }>({
    queryKey: ['/api/notifications/user', userData?.id],
    queryFn: async () => {
      if (!userData?.id) return { notifications: [] };
      const response = await fetch(`/api/notifications/user/${userData.id}`);
      return response.json();
    },
    enabled: !!userData?.id,
    refetchInterval: 30000, // Refetch every 30 seconds
  });

  // Mark notification as read mutation
  const markAsReadMutation = useMutation({
    mutationFn: async ({ id, read }: { id: number; read: boolean }) => {
      const response = await fetch(`/api/notifications/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ read })
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/notifications/user', userData?.id] });
    },
  });



  // Fetch wallet balance from external API
  const { 
    data: walletData, 
    isLoading: isLoadingWallet, 
    isError: isWalletError,
    refetch: refetchWallet
  } = useQuery({
    queryKey: ['/api/external/wallet-balance'],
    queryFn: async () => {
      const response = await fetch('/api/external/wallet-balance');
      if (!response.ok) {
        throw new Error('Failed to fetch wallet balance');
      }
      return response.json();
    },
    refetchInterval: 60000, // Refetch every minute
  });

  const handleRefreshWallet = () => {
    refetchWallet();
    toast.success("Refreshing wallet balance...");
  };

  const handleLogout = () => {
    localStorage.removeItem("isLoggedIn");
    localStorage.removeItem("userData");
    toast.success("Logged out successfully");
    setLocation("/login");
  };

  // Fetch transaction data for linking notifications to recharge transactions
  const { data: transactionsData } = useQuery<{ transactions: any[] }>({
    queryKey: ['/api/transactions'],
    queryFn: async () => {
      const response = await fetch('/api/transactions');
      return response.json();
    },
    refetchInterval: 30000, // Refetch every 30 seconds
  });

  // Find all transaction IDs of RECHARGE transactions
  const rechargeTransactionIds = (transactionsData?.transactions || [])
    .filter(tx => tx.type === "RECHARGE" && tx.status === "SUCCESS")
    .map(tx => tx.transactionId);

  console.log("Recharge Transaction IDs:", rechargeTransactionIds);
  
  // Fetch operators data for showing operator names
  const { data: operatorsData } = useQuery<{ operators: any[] }>({
    queryKey: ['/api/operators'],
    queryFn: async () => {
      const response = await fetch('/api/operators');
      return response.json();
    },
  });

  // Create a map of transactions with their details
  const rechargeTransactionDetails = (transactionsData?.transactions || [])
    .filter(tx => tx.type === "RECHARGE" && tx.status === "SUCCESS")
    .reduce((map, tx) => {
      map[tx.transactionId] = tx;
      return map;
    }, {} as Record<string, any>);
  
  // Filter for successful recharge-related notifications that are unread
  const unreadRechargeNotifications = (notificationsData?.notifications || [])
    .filter(notification => {
      if (!notification.read) {
        // Include direct RECHARGE type notifications
        if (notification.type === "RECHARGE") return true;
        
        // For WALLET_DEBIT notifications, check if they're related to recharge transactions
        if (notification.type === "WALLET_DEBIT") {
          try {
            const metadata = JSON.parse(notification.metadata || "{}");
            // Check if this notification is linked to a recharge transaction
            if (metadata.transactionId && rechargeTransactionIds.includes(metadata.transactionId)) {
              console.log("Found matching recharge notification:", notification);
              return true;
            }
          } catch (e) {
            console.error("Failed to parse notification metadata", e);
          }
        }
      }
      return false;
    })
    // Add transaction details to each notification
    .map(notification => {
      try {
        const metadata = JSON.parse(notification.metadata || "{}");
        const transactionId = metadata.transactionId;
        if (transactionId && rechargeTransactionDetails[transactionId]) {
          const txDetails = rechargeTransactionDetails[transactionId];
          const operator = (operatorsData?.operators || []).find(op => op.id === txDetails.operatorId);
          
          // Extract mobile number from the description
          const phoneNumberMatch = txDetails.description.match(/\d{10}/);
          const phoneNumber = phoneNumberMatch ? phoneNumberMatch[0] : '';
          
          return {
            ...notification,
            rechargeDetails: {
              amount: txDetails.amount,
              status: txDetails.status,
              phoneNumber: phoneNumber,
              operatorName: operator?.name || '',
              operatorLogo: operator?.logo || ''
            }
          };
        }
      } catch (e) {
        console.error("Failed to add transaction details to notification", e);
      }
      return notification;
    });

  // Mutation for marking all notifications as read
  const clearAllNotificationsMutation = useMutation({
    mutationFn: async () => {
      const ids = unreadRechargeNotifications.map(n => n.id);
      const promises = ids.map(id => 
        fetch(`/api/notifications/${id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ read: true })
        })
      );
      await Promise.all(promises);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/notifications'] });
      queryClient.invalidateQueries({ queryKey: ['/api/notifications/user'] });
      toast.success("All notifications marked as read");
    },
    onError: () => {
      toast.error("Failed to clear notifications");
    }
  });

  // Handle marking a notification as read
  const handleNotificationClick = (notification: Notification) => {
    markAsReadMutation.mutate({ id: notification.id, read: true });
  };

  // Handle clearing all notifications
  const handleClearAllNotifications = () => {
    if (unreadRechargeNotifications.length > 0) {
      clearAllNotificationsMutation.mutate();
    }
  };

  return (
    <div className="bg-white h-16 px-6 flex items-center justify-between shadow-sm border-b border-gray-100">
      {/* Title/Page Indicator - Left empty for now */}
      <div className="flex items-center"></div>

      <div className="flex items-center space-x-4">
        {/* Wallet Balance */}
        <div className="flex items-center bg-gray-50 rounded-full px-4 py-1.5 border border-gray-100 shadow-sm hover:shadow transition-all duration-200">
          <div className="mr-2 bg-gradient-to-tr from-primary/90 to-primary-light/90 w-6 h-6 rounded-full flex items-center justify-center">
            <Wallet className="h-3.5 w-3.5 text-white" />
          </div>
          <div className="flex items-center">
            {isLoadingWallet ? (
              <span className="text-sm font-medium text-gray-500">Loading...</span>
            ) : isWalletError ? (
              <span className="text-sm font-medium text-red-500">Error</span>
            ) : (
              <CurrencyDisplay 
                amount={walletData?.walletBalance || "0.00"}
                className="text-sm font-medium"
              />
            )}
            <button 
              onClick={handleRefreshWallet}
              className="ml-2 text-gray-400 hover:text-primary transition-colors"
              title="Refresh balance"
            >
              <RefreshCw className="h-3 w-3" />
            </button>
          </div>
        </div>

        {/* Notifications dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              className="relative h-9 w-9 rounded-full bg-gray-50 flex items-center justify-center hover:bg-gray-100 transition-colors border border-gray-100 shadow-sm"
            >
              <Bell className="h-[18px] w-[18px] text-gray-600" />
              {unreadRechargeNotifications.length > 0 && (
                <span className="absolute -top-1 -right-1 h-5 w-5 bg-gradient-to-r from-red-500 to-red-600 rounded-full text-white text-xs font-medium flex items-center justify-center shadow-sm">
                  {unreadRechargeNotifications.length}
                </span>
              )}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-80">
            <div className="flex items-center justify-between px-4 py-3 border-b">
              <h3 className="font-semibold text-gray-800">Recharge Activity</h3>
              {unreadRechargeNotifications.length > 0 && (
                <Button 
                  variant="link" 
                  size="sm" 
                  onClick={handleClearAllNotifications}
                  disabled={clearAllNotificationsMutation.isPending}
                  className="text-primary font-medium p-0 h-auto"
                >
                  Clear All
                </Button>
              )}
            </div>
            
            <div className="max-h-[300px] overflow-y-auto">
              {isLoadingNotifications ? (
                <div className="p-4 text-center text-sm text-gray-500">Loading notifications...</div>
              ) : unreadRechargeNotifications.length === 0 ? (
                <div className="p-4 text-center">
                  <AlertCircle className="mx-auto h-8 w-8 text-gray-400 mb-2" />
                  <p className="text-sm text-gray-500">No new notifications</p>
                </div>
              ) : (
                unreadRechargeNotifications.map(notification => (
                  <DropdownMenuItem 
                    key={notification.id} 
                    className="cursor-pointer p-3 hover:bg-gray-50 focus:bg-gray-50 border-b border-gray-100 last:border-b-0"
                    onClick={() => handleNotificationClick(notification)}
                  >
                    <div className="flex items-start gap-3">
                      {/* Operator icon with gradient background */}
                      <div className="w-8 h-8 bg-gradient-to-br from-primary/70 to-primary-light rounded-full flex items-center justify-center shrink-0 text-white shadow-sm">
                        <span className="text-xs font-medium">
                          {'rechargeDetails' in notification 
                            ? notification.rechargeDetails?.operatorName.substring(0, 2).toUpperCase() 
                            : 'OP'}
                        </span>
                      </div>
                      <div className="flex-1">
                        {'rechargeDetails' in notification ? (
                          <>
                            <div className="flex items-center justify-between">
                              <p className="text-sm font-medium">
                                {notification.rechargeDetails?.operatorName} Recharge
                              </p>
                              <span className={`text-xs font-medium px-2 py-0.5 rounded-full shadow-sm ${
                                notification.rechargeDetails?.status === 'SUCCESS'
                                  ? 'bg-gradient-to-r from-green-500 to-green-600 text-white'
                                  : 'bg-gradient-to-r from-amber-500 to-amber-600 text-white'
                              }`}>
                                {notification.rechargeDetails?.status}
                              </span>
                            </div>
                            <p className="text-sm font-semibold mt-1 text-gray-800">
                              ₹{notification.rechargeDetails?.amount}
                            </p>
                            <div className="flex items-center justify-between mt-1">
                              <p className="text-xs text-gray-600">
                                Mobile: {notification.rechargeDetails?.phoneNumber}
                              </p>
                              <p className="text-xs text-gray-500">{formatDate(notification.timestamp)}</p>
                            </div>
                          </>
                        ) : (
                          <>
                            <div className="flex items-center justify-between">
                              <p className="text-sm font-medium">{notification.type}</p>
                              <p className="text-xs text-gray-500">{formatDate(notification.timestamp)}</p>
                            </div>
                            <p className="text-sm mt-1 text-gray-700">{notification.message}</p>
                          </>
                        )}
                      </div>
                    </div>
                  </DropdownMenuItem>
                ))
              )}
            </div>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* User profile dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <div className="flex items-center cursor-pointer bg-gray-50 pl-2 pr-3 py-1 rounded-full border border-gray-100 shadow-sm hover:shadow hover:bg-gray-100 transition-all duration-200">
              <Avatar className="h-7 w-7 border-2 border-white shadow-sm">
                <AvatarFallback className="bg-gradient-to-br from-primary/80 to-primary-light/80 text-white text-xs">
                  {getInitials(userData?.name || userData?.username || "User")}
                </AvatarFallback>
              </Avatar>
              <div className="ml-2 hidden md:block">
                <p className="text-sm font-medium leading-tight">{userData?.name || userData?.username || "User"}</p>
                <p className="text-xs text-gray-500 leading-tight">{userData?.isAdmin ? "Administrator" : "User"}</p>
              </div>
            </div>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <div className="px-4 py-3 border-b">
              <p className="text-sm font-medium">{userData?.name || userData?.username || "User"}</p>
              <p className="text-xs text-gray-500 mt-0.5">{userData?.isAdmin ? "Administrator Account" : "User Account"}</p>
            </div>
            <DropdownMenuItem className="cursor-pointer" onClick={() => setLocation("/settings")}>
              Settings
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="cursor-pointer text-red-600" onClick={handleLogout}>
              Logout
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}
