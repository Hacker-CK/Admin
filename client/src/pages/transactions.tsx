import { useState, useEffect, useMemo, useCallback } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { queryClient } from '@/lib/queryClient';
import { apiRequest } from '@/lib/queryClient';
import { Transaction, insertTransactionSchema, User, Operator } from '@shared/schema';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import toast from 'react-hot-toast';
import { format, subDays } from 'date-fns';
import { DateRange } from 'react-day-picker';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Calendar, 
  ArrowUpRight, 
  ArrowRight, 
  Users, 
  CreditCard, 
  Wallet, 
  BanknoteIcon,
  CheckCircle2, 
  AlertCircle, 
  Clock, 
  ReceiptIcon,
  TrendingUp,
  BarChart4,
  Percent,
  Search,
  Loader2,
  ChevronDown,
  RefreshCw,
  MoreHorizontal, 
  Edit, 
  Eye,
  Trash, 
  RotateCcw,
  Info as InfoIcon,
  RotateCw,
  XCircle,
  ExternalLink,
  Cloud,
  Phone,
  Copy,
  ChevronsRight,
  ArrowRightCircle,
  CircleDollarSign
} from 'lucide-react';

// Import our new animation components
import { TransactionStatusBadge } from '@/components/ui/transaction-status-badge';
import { TransactionTimeline, TimelineEvent } from '@/components/ui/transaction-timeline';
import { TransactionProgress } from '@/components/ui/transaction-progress';
import { TransactionResult } from '@/components/ui/transaction-result';
import { 
  PieChart, 
  Pie, 
  Cell, 
  ResponsiveContainer, 
  Tooltip as RechartsTooltip, 
  Legend,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid
} from 'recharts';

import { DataTable } from '@/components/ui/data-table';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { DateRangePicker } from '@/components/ui/date-range-picker';
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Separator } from '@/components/ui/separator';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatCurrency, generateRandomId, getTransactionTypeColor, getInitials, formatDate } from '@/lib/utils';
import { CurrencyDisplay } from '@/components/ui/currency-display';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';

// Extend schema for transaction form
const transactionFormSchema = insertTransactionSchema.extend({
  userId: z.number().min(1, 'User ID is required'),
  amount: z.string().min(1, 'Amount is required').refine(val => !isNaN(parseFloat(val)), 'Must be a number'),
  type: z.enum(['RECHARGE', 'ADD_FUND', 'TRANSFER', 'REFERRAL', 'CASHBACK'], {
    required_error: 'Transaction type is required',
  }),
  status: z.enum(['PENDING', 'SUCCESS', 'FAILED', 'REFUND'], {
    required_error: 'Status is required',
  }),
  transactionId: z.string().optional(),
  description: z.string().optional(),
  operatorId: z.number().optional().nullable(),
  recipientId: z.union([z.number(), z.array(z.number())]).optional().nullable(),
  // New field for mobile number
  mobileNumber: z.string()
    .refine(val => !val || val.length === 0 || /^\d{10}$/.test(val), {
      message: 'Mobile number must be 10 digits',
      // Only apply this validation if type is RECHARGE
      path: ['mobileNumber'],
    })
    .optional(),
});

export default function Transactions() {
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const [isUpdateModalOpen, setIsUpdateModalOpen] = useState(false);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [typeFilter, setTypeFilter] = useState<string>('ALL');
  const [userFilter, setUserFilter] = useState<string>('ALL');
  
  // Get userId from URL parameters if present
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const userIdParam = urlParams.get('userId');
    if (userIdParam) {
      setUserFilter(userIdParam);
    }
  }, []);
  
  // State for external API status check
  const [isStatusCheckingApi, setIsStatusCheckingApi] = useState(false);
  const [apiStatusData, setApiStatusData] = useState<any>(null);
  const [apiStatusError, setApiStatusError] = useState<string | null>(null);

  // Fetch transactions with automatic refresh
  const { data: transactionsData, isLoading, refetch: refetchTransactions } = useQuery<{ transactions: Transaction[] }>({
    queryKey: ['/api/transactions'],
    refetchInterval: 5000, // Refetch data every 5 seconds
    refetchOnWindowFocus: true, // Refetch when window regains focus
    staleTime: 3000, // Consider data stale after 3 seconds
  });
  
  // State for wallet balance checking
  const [selectedUserId, setSelectedUserId] = useState<number | undefined>(undefined);
  const [insufficientBalance, setInsufficientBalance] = useState(false);
  const [userWalletBalance, setUserWalletBalance] = useState<number | null>(null);
  
  // Fetch user data when needed for wallet balance check
  const { data: userData, isLoading: isUserLoading, refetch: refetchUser } = useQuery<{ user: User }>({
    queryKey: ['/api/users', selectedUserId],
    enabled: selectedUserId !== undefined,
  });
  
  // Fetch all users for recipient dropdown
  const { data: allUsersData, isLoading: isAllUsersLoading } = useQuery<{ users: User[] }>({
    queryKey: ['/api/users'],
  });
  
  // Fetch all operators for operator dropdown
  const { data: allOperatorsData, isLoading: isAllOperatorsLoading } = useQuery<{ operators: Operator[] }>({
    queryKey: ['/api/operators'],
  });

  // Create transaction mutation
  const createTransactionMutation = useMutation({
    mutationFn: async (transactionData: z.infer<typeof transactionFormSchema>) => {
      // Generate a transaction ID if not provided
      if (!transactionData.transactionId) {
        transactionData.transactionId = generateRandomId();
      }
      
      // Debug the data being sent to the server
      console.log('Creating transaction with data:', JSON.stringify(transactionData));
      console.log('operatorId type:', typeof transactionData.operatorId, 'value:', transactionData.operatorId);
      
      // apiRequest now returns the parsed JSON directly
      return apiRequest('POST', '/api/transactions', transactionData);
    },
    onSuccess: (data) => {
      // Check if we got multiple transactions (array) or single transaction response
      const isMultipleTransactions = data.transactions && Array.isArray(data.transactions);
      const transactionCount = isMultipleTransactions ? data.transactions.length : 1;
      
      // Show success notification with toast
      if (isMultipleTransactions) {
        toast.success(
          <div className="flex flex-col gap-1">
            <span>Transactions created successfully!</span>
            <span className="text-xs">{transactionCount} transactions were created</span>
          </div>
        );
      } else {
        toast.success(
          <div className="flex flex-col gap-1">
            <span>Transaction created successfully!</span>
            <span className="text-xs">Transaction ID: {data.transaction?.transactionId || 'N/A'}</span>
          </div>
        );
      }
      
      // Invalidate all transaction-related queries
      queryClient.invalidateQueries({ queryKey: ['/api/transactions'] });
      queryClient.invalidateQueries({ queryKey: ['/api/transactions/recent'] });
      queryClient.invalidateQueries({ queryKey: ['/api/dashboard/summary'] });
      queryClient.invalidateQueries({ queryKey: ['/api/users/top'] });
      queryClient.invalidateQueries({ queryKey: ['/api/operators/performance'] });
      
      // Close the dialog
      setIsCreateModalOpen(false);
      
      // Reset form fields
      createForm.reset({
        userId: undefined,
        amount: '',
        type: undefined,
        status: 'PENDING',
        transactionId: generateRandomId(),
        description: '',
        operatorId: undefined,
        recipientId: undefined,
        mobileNumber: '',
      });
      
      // Clear wallet balance check state
      setInsufficientBalance(false);
      setUserWalletBalance(null);
      setSelectedUserId(undefined);
    },
    onError: (error: any) => {
      const errorMessage = error.message || 'Failed to create transaction';
      
      // Handle specific error cases with custom messages
      if (errorMessage.includes('Insufficient wallet balance')) {
        // Custom error for insufficient balance
        toast.error(
          <div className="flex flex-col gap-1">
            <span>Insufficient wallet balance</span>
            <span className="text-xs">Please add funds to the user's wallet first</span>
          </div>
        );
      } else if (errorMessage.includes('User not found')) {
        toast.error('User not found. Please select a valid user.');
      } else if (errorMessage.includes('Operator not found')) {
        toast.error('Operator not found. Please select a valid operator.');
      } else if (errorMessage.includes('Recipient not found')) {
        toast.error('Recipient not found. Please select a valid recipient.');
      } else {
        // Generic error message for other cases
        toast.error(`Failed to create transaction: ${errorMessage}`);
      }
    },
  });

  // Form for creating a new transaction
  const createForm = useForm<z.infer<typeof transactionFormSchema>>({
    resolver: zodResolver(transactionFormSchema),
    defaultValues: {
      userId: undefined,
      amount: '',
      type: undefined,
      status: 'PENDING',
      transactionId: generateRandomId(),
      description: '',
      operatorId: undefined,
      recipientId: undefined,
      mobileNumber: '',
    },
  });

  // Function to check wallet balance for recharge transactions
  const checkWalletBalanceForRecharge = (userId: number, amount: string) => {
    // Fetch the user data to get the current wallet balance
    setSelectedUserId(userId);
    
    // If user data is already loaded, check wallet balance
    if (userData?.user) {
      const walletBalance = parseFloat(userData.user.walletBalance.toString());
      const transactionAmount = parseFloat(amount);
      
      setUserWalletBalance(walletBalance);
      
      // Check if there's enough balance for a recharge transaction
      if (transactionAmount > walletBalance) {
        setInsufficientBalance(true);
        return false;
      } else {
        setInsufficientBalance(false);
        return true;
      }
    }
    
    return true; // If user data isn't loaded yet, allow the transaction to proceed (server will validate)
  };
  
  // Effect to check wallet balance when user data changes
  useEffect(() => {
    if (userData?.user) {
      const formValues = createForm.getValues();
      const type = formValues.type;
      const amount = formValues.amount;
      
      if (type === 'RECHARGE' && amount) {
        const walletBalance = parseFloat(userData.user.walletBalance.toString());
        const transactionAmount = parseFloat(amount);
        
        setUserWalletBalance(walletBalance);
        
        if (transactionAmount > walletBalance) {
          setInsufficientBalance(true);
        } else {
          setInsufficientBalance(false);
        }
      }
    }
  }, [userData, createForm]);
  
  // Handle creating a new transaction
  const onCreateTransaction = (data: z.infer<typeof transactionFormSchema>) => {
    // For recharge transactions, check if the user has sufficient wallet balance
    if (data.type === 'RECHARGE' && data.status === 'SUCCESS') {
      // Do client-side validation for recharge transactions
      const isBalanceSufficient = checkWalletBalanceForRecharge(data.userId, data.amount);
      
      if (!isBalanceSufficient) {
        // Show a more descriptive error message with toast
        toast.error(
          <div className="flex flex-col gap-1">
            <span>Insufficient wallet balance</span>
            <span className="text-xs">
              Available: {userWalletBalance ? <CurrencyDisplay amount={userWalletBalance} /> : '₹0.00'}, 
              Required: <CurrencyDisplay amount={data.amount} />
            </span>
            <span className="text-xs">Please add funds to the user's wallet first</span>
          </div>
        );
        return;
      }
    }
    
    // Validate the transaction type and required fields
    if (data.type === 'TRANSFER') {
      if (!data.recipientId) {
        toast.error('Please select at least one recipient for the transfer transaction');
        return;
      }
      
      // Check if it's an array and has at least one element
      if (Array.isArray(data.recipientId) && data.recipientId.length === 0) {
        toast.error('Please select at least one recipient for the transfer transaction');
        return;
      }
    }
    
    if (data.type === 'RECHARGE' && !data.operatorId) {
      toast.error('Please select an operator for the recharge transaction');
      return;
    }
    
    createTransactionMutation.mutate({
      ...data,
      amount: data.amount,
    });
  };

  // Update transaction mutation
  const updateTransactionMutation = useMutation({
    mutationFn: async (transactionData: Partial<Transaction & { needsRefund?: boolean }>) => {
      if (!selectedTransaction) return null;
      return apiRequest('PATCH', `/api/transactions/${selectedTransaction.id}`, transactionData);
    },
    onSuccess: () => {
      // Show success notification
      const wasChangedToFailed = selectedTransaction?.status === 'SUCCESS' && updateForm.getValues().status === 'FAILED';
      
      if (wasChangedToFailed) {
        if (refundWallet) {
          toast.success(
            <div className="flex flex-col gap-1">
              <span>Transaction updated to Failed successfully!</span>
              <span className="text-xs">
                Amount <CurrencyDisplay amount={selectedTransaction?.amount || 0} /> has been refunded to user's wallet
              </span>
            </div>
          );
        } else {
          toast.success(
            <div className="flex flex-col gap-1">
              <span>Transaction updated to Failed successfully!</span>
              <span className="text-xs">No wallet refund was processed</span>
            </div>
          );
        }
      } else {
        toast.success('Transaction updated successfully!');
      }
      
      // Invalidate all transaction-related queries
      queryClient.invalidateQueries({ queryKey: ['/api/transactions'] });
      queryClient.invalidateQueries({ queryKey: ['/api/transactions/recent'] });
      queryClient.invalidateQueries({ queryKey: ['/api/dashboard/summary'] });
      queryClient.invalidateQueries({ queryKey: ['/api/users/top'] });
      queryClient.invalidateQueries({ queryKey: ['/api/operators/performance'] });
      queryClient.invalidateQueries({ queryKey: ['/api/users', selectedTransaction?.userId] });
      
      // Close update modal
      setIsUpdateModalOpen(false);
      setSelectedTransaction(null);
    },
    onError: (error: any) => {
      // Show error notification
      console.error('Update transaction error:', error);
      
      // Check if this is the "already refunded" error from the server
      if (error.response?.data?.message?.includes('already been refunded')) {
        setRefundError(error.response.data.message);
        toast.error('Transaction has already been refunded');
      } else {
        toast.error(`Failed to update transaction: ${error.message || 'Unknown error'}`);
      }
    }
  });
  
  // Delete transaction mutation
  const deleteTransactionMutation = useMutation({
    mutationFn: async () => {
      if (!selectedTransaction) return null;
      return apiRequest('DELETE', `/api/transactions/${selectedTransaction.id}`, {});
    },
    onSuccess: () => {
      // Show success notification
      toast.success('Transaction deleted successfully!');
      
      // Invalidate all transaction-related queries
      queryClient.invalidateQueries({ queryKey: ['/api/transactions'] });
      queryClient.invalidateQueries({ queryKey: ['/api/transactions/recent'] });
      queryClient.invalidateQueries({ queryKey: ['/api/dashboard/summary'] });
      queryClient.invalidateQueries({ queryKey: ['/api/users/top'] });
      queryClient.invalidateQueries({ queryKey: ['/api/operators/performance'] });
      
      // Close confirm dialog
      setIsDeleteConfirmOpen(false);
      setSelectedTransaction(null);
    },
    onError: (error: any) => {
      // Show error notification
      toast.error(`Failed to delete transaction: ${error.message || 'Unknown error'}`);
    }
  });
  
  // Form for updating a transaction
  const updateForm = useForm<z.infer<typeof transactionFormSchema>>({
    resolver: zodResolver(transactionFormSchema),
    defaultValues: {
      userId: undefined,
      amount: '',
      type: undefined,
      status: undefined,
      transactionId: '',
      description: '',
      operatorId: undefined,
      recipientId: undefined,
      mobileNumber: '',
    },
  });
  
  // Initialize update form with selected transaction data
  useEffect(() => {
    if (selectedTransaction && isUpdateModalOpen) {
      // Extract mobile number from description if it exists
      let mobileNumber = '';
      if (selectedTransaction.description) {
        // For recharge transactions, extract mobile number from description
        if (selectedTransaction.type === 'RECHARGE') {
          // Try to find a 10-digit number in the description
          const match = selectedTransaction.description.match(/(?:\+91)?(\d{10})/);
          if (match) {
            mobileNumber = match[1];
          } else {
            // Try to find "mobile number" pattern in the description
            const mobileMatch = selectedTransaction.description.match(/mobile\s*(?:number)?:?\s*(?:\+91)?(\d+)/i);
            if (mobileMatch) {
              mobileNumber = mobileMatch[1];
            }
          }
        }
        
        // For transfer transactions, try to find recipient information
        if (selectedTransaction.type === 'TRANSFER') {
          // Try to find "to" or "transfer to" pattern in the description
          const transferMatch = selectedTransaction.description.match(/(?:transfer(?:red)?\s*to|to|recipient):?\s*(?:\+91)?(\d+)/i);
          if (transferMatch) {
            mobileNumber = transferMatch[1];
          }
        }
      }
      
      updateForm.reset({
        userId: selectedTransaction.userId,
        amount: selectedTransaction.amount.toString(),
        type: selectedTransaction.type as any,
        status: selectedTransaction.status as any,
        transactionId: selectedTransaction.transactionId,
        description: selectedTransaction.description || '',
        operatorId: selectedTransaction.operatorId || undefined,
        recipientId: selectedTransaction.recipientId || undefined,
        mobileNumber: mobileNumber,
      });
    }
  }, [selectedTransaction, isUpdateModalOpen, updateForm]);
  
  // Handle updating a transaction
  // Track refund option state
  const [refundWallet, setRefundWallet] = useState(false);
  // State to track refund error
  const [refundError, setRefundError] = useState<string | null>(null);
  
  const onUpdateTransaction = (data: z.infer<typeof transactionFormSchema>) => {
    if (!selectedTransaction) return;
    
    // Check if transaction is being changed from SUCCESS to FAILED
    const isChangingToFailed = (selectedTransaction.status === 'SUCCESS' || selectedTransaction.status === 'PENDING') && data.status === 'FAILED';
    
    // Check if transaction has already been refunded
    const alreadyRefunded = selectedTransaction.description?.includes('[Amount refunded to wallet]');
    
    // Show error and prevent update if transaction was already refunded
    if (isChangingToFailed && refundWallet && alreadyRefunded) {
      setRefundError('This transaction has already been refunded. Cannot refund again.');
      return;
    }
    
    // Clear any previous error
    setRefundError(null);
    
    // Debug
    console.log('Updating transaction with:');
    console.log('- Status changing to:', data.status);
    console.log('- Transaction type:', selectedTransaction.type);
    console.log('- Refund wallet checked:', refundWallet);
    
    const needsRefundValue = isChangingToFailed && refundWallet && !alreadyRefunded;
    console.log('- Computed needsRefund value:', needsRefundValue);
    
    updateTransactionMutation.mutate({
      status: data.status,
      description: data.description,
      // Only set the refund flag if checkbox is checked and not already refunded
      needsRefund: needsRefundValue
    });
  };
  
  // Handle opening update modal
  const handleUpdateTransaction = (transaction: Transaction) => {
    setSelectedTransaction(transaction);
    // Reset error message when opening modal
    setRefundError(null);
    
    // For RECHARGE transactions, default the refund checkbox to true
    // For other transaction types, default to false
    if (transaction.type === 'RECHARGE') {
      setRefundWallet(true);
    } else {
      setRefundWallet(false);
    }
    
    setIsUpdateModalOpen(true);
  };
  
  // Handle opening delete confirmation
  const handleDeleteTransaction = (transaction: Transaction) => {
    setSelectedTransaction(transaction);
    setIsDeleteConfirmOpen(true);
  };
  
  // Handle viewing transaction details
  const handleViewDetails = (transaction: Transaction) => {
    setSelectedTransaction(transaction);
    setIsDetailsModalOpen(true);
    // Reset API status check data
    setApiStatusData(null);
    setApiStatusError(null);
  };
  
  // Function to check transaction status from the external API
  const checkTransactionStatusFromApi = async (transaction: Transaction | null) => {
    if (!transaction || transaction.type !== 'RECHARGE' || !transaction.transactionId) {
      setApiStatusError('This feature is only available for recharge transactions with a valid transaction ID');
      return;
    }
    
    setIsStatusCheckingApi(true);
    setApiStatusData(null);
    setApiStatusError(null);
    
    try {
      const response = await apiRequest('GET', `/api/transactions/check-status/${transaction.transactionId}`, null);
      
      if (response.success) {
        setApiStatusData(response);
        
        // Check if API returned null or response with status
        if (!response.apiResponse) {
          // Display toast for null API response
          toast(
            <div className="flex flex-col gap-1">
              <span className="font-medium">Record Not Found</span>
              <span className="text-xs">
                No record found in external API
              </span>
            </div>,
            { 
              duration: 5000,
              style: { 
                background: '#EFF6FF', 
                color: '#1E40AF',
                border: '1px solid #BFDBFE'
              },
              icon: '🔍'
            }
          );
        }
        // If status has changed (only for non-null responses)
        else if (response.mappedStatus !== transaction.status) {
          toast(
            <div className="flex flex-col gap-1">
              <span>Transaction status differs from API</span>
              <span className="text-xs">
                Current: {transaction.status}, API: {response.mappedStatus}
              </span>
            </div>
          );
        }
      } else {
        setApiStatusError(response.message || 'Failed to get status from API');
      }
    } catch (error: any) {
      console.error('Error checking status from API:', error);
      setApiStatusError(error.message || 'Failed to check status from API');
    } finally {
      setIsStatusCheckingApi(false);
    }
  };
  
  // Function to update transaction based on API status
  const updateTransactionFromApi = async (transaction: Transaction | null) => {
    if (!transaction || transaction.type !== 'RECHARGE' || !transaction.transactionId) {
      toast.error('This feature is only available for recharge transactions with a valid transaction ID');
      return;
    }
    
    setIsStatusCheckingApi(true);
    
    try {
      const response = await apiRequest(
        'POST', 
        `/api/transactions/update-from-api/${transaction.id}`, 
        { orderId: transaction.transactionId }
      );
      
      if (response.success) {
        // Check if it's a null API response case
        if (response.statusUpdated === false && response.message?.includes('Record not found')) {
          toast(
            <div className="flex flex-col gap-1">
              <span className="font-medium">Record Not Found</span>
              <span className="text-xs">
                No record found in external API
              </span>
            </div>,
            { 
              duration: 5000,
              // Use a neutral style with blue accent
              style: { 
                background: '#EFF6FF', 
                color: '#1E40AF',
                border: '1px solid #BFDBFE'
              },
              icon: '🔍'
            }
          );
          // Don't update any queries since nothing changed
        } else if (response.previousStatus !== response.newStatus) {
          // Normal status update success
          toast.success(
            <div className="flex flex-col gap-1">
              <span>Transaction updated successfully</span>
              <span className="text-xs">
                Status changed from {response.previousStatus} to {response.newStatus}
              </span>
            </div>
          );
          
          // Update relevant queries since status changed
          queryClient.invalidateQueries({ queryKey: ['/api/transactions'] });
          queryClient.invalidateQueries({ queryKey: ['/api/transactions/recent'] });
          queryClient.invalidateQueries({ queryKey: ['/api/dashboard/summary'] });
          setSelectedTransaction(response.transaction);
        } else {
          // No changes needed
          toast(
            response.message || 'No changes were needed',
            { 
              style: {
                background: '#F0FDF4',
                color: '#166534',
                border: '1px solid #BBF7D0'
              },
              icon: '✅'
            }
          );
        }
      } else {
        toast.error(response.message || 'Failed to update transaction');
      }
    } catch (error: any) {
      console.error('Error updating from API:', error);
      toast.error(error.message || 'Failed to update from API');
    } finally {
      setIsStatusCheckingApi(false);
    }
  };

  // Time period filter state
  const [timePeriod, setTimePeriod] = useState<'today' | 'week' | 'month' | 'year' | 'custom'>('week');
  
  // Set default date range based on time period
  useEffect(() => {
    if (timePeriod === 'today') {
      const today = new Date();
      setDateRange({ from: today, to: today });
    } else if (timePeriod === 'week') {
      const today = new Date();
      const weekAgo = new Date();
      weekAgo.setDate(today.getDate() - 7);
      setDateRange({ from: weekAgo, to: today });
    } else if (timePeriod === 'month') {
      const today = new Date();
      const monthAgo = new Date();
      monthAgo.setMonth(today.getMonth() - 1);
      setDateRange({ from: monthAgo, to: today });
    } else if (timePeriod === 'year') {
      const today = new Date();
      const yearAgo = new Date();
      yearAgo.setFullYear(today.getFullYear() - 1);
      setDateRange({ from: yearAgo, to: today });
    }
    // Don't update if custom time period is selected
  }, [timePeriod]);

  // Apply filters to transactions
  let filteredTransactions = transactionsData?.transactions || [];
  const allTransactions = transactionsData?.transactions || [];
  
  // Function to apply all filters except search
  const applyFilters = useCallback((transactions: Transaction[]): Transaction[] => {
    let result = [...transactions];
    
    // Apply user filter first (for specific user transactions)
    if (userFilter && userFilter !== 'ALL') {
      result = result.filter(tx => 
        tx.userId.toString() === userFilter
      );
    }
    
    // Apply status filter
    if (statusFilter && statusFilter !== 'ALL') {
      result = result.filter(tx => 
        tx.status.toUpperCase() === statusFilter.toUpperCase()
      );
    }
    
    // Apply type filter
    if (typeFilter && typeFilter !== 'ALL') {
      result = result.filter(tx => 
        tx.type.toUpperCase() === typeFilter.toUpperCase()
      );
    }
    
    // Apply date range filter
    if (dateRange?.from && dateRange.from instanceof Date) {
      const fromDate = new Date(dateRange.from);
      fromDate.setHours(0, 0, 0, 0);
      
      result = result.filter(tx => {
        if (!tx.timestamp) return false;
        const txDate = new Date(tx.timestamp);
        
        if (dateRange.to && dateRange.to instanceof Date) {
          // Now we've checked dateRange.to is a Date
          const toDate = new Date(dateRange.to);
          toDate.setHours(23, 59, 59, 999);
          return txDate >= fromDate && txDate <= toDate;
        }
        
        return txDate >= fromDate;
      });
    }
    
    return result;
  }, [userFilter, statusFilter, typeFilter, dateRange]);
  
  // Filtered transactions for stats calculation (excludes search filter)
  const filteredForStats = useMemo(() => 
    applyFilters(allTransactions), 
    [applyFilters, allTransactions]
  );
  
  // Calculate statistics for KPI cards based on filtered data
  const transactionStats = useMemo(() => {
    // Calculate total amounts
    const totalAmount = filteredForStats.reduce((sum, tx) => 
      sum + parseFloat(tx.amount.toString()), 0
    );
    
    // Success transactions
    const successTransactions = filteredForStats.filter(tx => 
      tx.status.toUpperCase() === 'SUCCESS'
    );
    const successAmount = successTransactions.reduce((sum, tx) => 
      sum + parseFloat(tx.amount.toString()), 0
    );
    
    // Failed transactions
    const failedTransactions = filteredForStats.filter(tx => 
      tx.status.toUpperCase() === 'FAILED'
    );
    const failedAmount = failedTransactions.reduce((sum, tx) => 
      sum + parseFloat(tx.amount.toString()), 0
    );
    
    // Pending transactions
    const pendingTransactions = filteredForStats.filter(tx => 
      tx.status.toUpperCase() === 'PENDING'
    );
    const pendingAmount = pendingTransactions.reduce((sum, tx) => 
      sum + parseFloat(tx.amount.toString()), 0
    );
    
    // Refund transactions
    const refundTransactions = filteredForStats.filter(tx => 
      tx.status.toUpperCase() === 'REFUND'
    );
    const refundAmount = refundTransactions.reduce((sum, tx) => 
      sum + parseFloat(tx.amount.toString()), 0
    );
    
    // Get cashback amount (only CASHBACK transactions)
    const cashbackTransactions = filteredForStats.filter(tx => 
      tx.type.toUpperCase() === 'CASHBACK' && 
      tx.status.toUpperCase() === 'SUCCESS'
    );
    const cashbackAmount = cashbackTransactions.reduce((sum, tx) => 
      sum + parseFloat(tx.amount.toString()), 0
    );
    
    // Get referral earnings (only REFERRAL transactions)
    const referralTransactions = filteredForStats.filter(tx => 
      tx.type.toUpperCase() === 'REFERRAL' && 
      tx.status.toUpperCase() === 'SUCCESS'
    );
    const referralAmount = referralTransactions.reduce((sum, tx) => 
      sum + parseFloat(tx.amount.toString()), 0
    );
    
    // Get Add Fund Success total
    const addFundTransactions = successTransactions.filter(tx => 
      tx.type.toUpperCase() === 'ADD_FUND'
    );
    const addFundAmount = addFundTransactions.reduce((sum, tx) => 
      sum + parseFloat(tx.amount.toString()), 0
    );
    
    // Get Recharge Success total
    const rechargeTransactions = successTransactions.filter(tx => 
      tx.type.toUpperCase() === 'RECHARGE'
    );
    const rechargeAmount = rechargeTransactions.reduce((sum, tx) => 
      sum + parseFloat(tx.amount.toString()), 0
    );
    
    // Get Transfer Success total
    const transferTransactions = successTransactions.filter(tx => 
      tx.type.toUpperCase() === 'TRANSFER'
    );
    const transferAmount = transferTransactions.reduce((sum, tx) => 
      sum + parseFloat(tx.amount.toString()), 0
    );
    
    // Calculate wallet balance (credits - debits)
    // Credits: ADD_FUND, REFERRAL, and CASHBACK
    // Debits: RECHARGE and TRANSFER
    const credits = filteredForStats
      .filter(tx => ['ADD_FUND', 'REFERRAL', 'CASHBACK'].includes(tx.type.toUpperCase()) && tx.status.toUpperCase() === 'SUCCESS')
      .reduce((sum, tx) => sum + parseFloat(tx.amount.toString()), 0);
      
    const debits = filteredForStats
      .filter(tx => ['RECHARGE', 'TRANSFER'].includes(tx.type.toUpperCase()) && tx.status.toUpperCase() === 'SUCCESS')
      .reduce((sum, tx) => sum + parseFloat(tx.amount.toString()), 0);
      
    const walletBalance = credits - debits;
    
    // Calculate success, failed, and pending rates
    // Only counting SUCCESS transactions for the total displayed to user
    const successOnlyCount = successTransactions.length;
    const totalCount = filteredForStats.length;
    const successRate = totalCount ? (successTransactions.length / totalCount) * 100 : 0;
    const failedRate = totalCount ? (failedTransactions.length / totalCount) * 100 : 0;
    const pendingRate = totalCount ? (pendingTransactions.length / totalCount) * 100 : 0;
    
    // Transaction type distribution
    const allRechargeTransactions = filteredForStats.filter(tx => tx.type.toUpperCase() === 'RECHARGE');
    const allAddFundTransactions = filteredForStats.filter(tx => tx.type.toUpperCase() === 'ADD_FUND');
    const allTransferTransactions = filteredForStats.filter(tx => tx.type.toUpperCase() === 'TRANSFER');
    const allReferralTransactions = filteredForStats.filter(tx => tx.type.toUpperCase() === 'REFERRAL');
    const allCashbackTransactions = filteredForStats.filter(tx => tx.type.toUpperCase() === 'CASHBACK');
    
    const typeDistribution = [
      { 
        name: 'Recharge', 
        value: allRechargeTransactions.length, 
        amount: allRechargeTransactions.reduce((sum, tx) => sum + parseFloat(tx.amount.toString()), 0),
        color: '#4F46E5' 
      },
      { 
        name: 'Add Fund', 
        value: allAddFundTransactions.length, 
        amount: allAddFundTransactions.reduce((sum, tx) => sum + parseFloat(tx.amount.toString()), 0),
        color: '#10B981' 
      },
      { 
        name: 'Transfer', 
        value: allTransferTransactions.length, 
        amount: allTransferTransactions.reduce((sum, tx) => sum + parseFloat(tx.amount.toString()), 0),
        color: '#F59E0B' 
      },
      { 
        name: 'Referral', 
        value: allReferralTransactions.length, 
        amount: allReferralTransactions.reduce((sum, tx) => sum + parseFloat(tx.amount.toString()), 0),
        color: '#EC4899' 
      },
      { 
        name: 'Cashback', 
        value: allCashbackTransactions.length, 
        amount: allCashbackTransactions.reduce((sum, tx) => sum + parseFloat(tx.amount.toString()), 0),
        color: '#8B5CF6' 
      },
    ];
    
    // Status distribution
    const statusDistribution = [
      { name: 'Success', value: successTransactions.length, color: '#10B981' },
      { name: 'Failed', value: failedTransactions.length, color: '#EF4444' },
      { name: 'Pending', value: pendingTransactions.length, color: '#F59E0B' },
      { name: 'Refund', value: refundTransactions.length, color: '#3B82F6' },
    ];
    
    return {
      totalAmount,
      successAmount,
      failedAmount,
      pendingAmount,
      refundAmount,
      cashbackAmount,
      referralAmount,
      addFundAmount,
      rechargeAmount,
      transferAmount,
      walletBalance,
      totalCount,
      successOnlyCount,  // Only SUCCESS transactions
      successCount: successTransactions.length,
      failedCount: failedTransactions.length,
      pendingCount: pendingTransactions.length,
      refundCount: refundTransactions.length,
      successRate,
      failedRate,
      pendingRate,
      typeDistribution,
      statusDistribution
    };
  }, [filteredForStats]);
  
  // Apply filters to transaction table data
  filteredTransactions = applyFilters(filteredTransactions);
  
  // Apply search filter separately (only for table display, not for KPI cards)
  if (searchTerm) {
    // First find if any users match the search term (by username or ID)
    const matchingUsers = allUsersData?.users.filter(user => 
      user.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.id.toString().includes(searchTerm)
    ) || [];
    
    // Get the user IDs for matching users
    const matchingUserIds = matchingUsers.map(user => user.id);
    
    filteredTransactions = filteredTransactions.filter(transaction => 
      // Original search criteria
      transaction.transactionId.toLowerCase().includes(searchTerm.toLowerCase()) ||
      transaction.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      transaction.userId.toString().includes(searchTerm) ||
      // New criteria: match transactions from users found by username/name search
      matchingUserIds.includes(transaction.userId)
    );
  }

  const columns = [
    {
      key: "id",
      title: "ID",
      sortable: true,
      render: (transaction: Transaction) => (
        <span className="text-sm font-medium">#{transaction.id}</span>
      ),
    },
    {
      key: "transactionId",
      title: "Transaction ID",
      sortable: true,
      render: (transaction: Transaction) => (
        <span className="text-sm">#{transaction.transactionId}</span>
      ),
    },
    {
      key: "mobileNumber",
      title: "Number/Username",
      sortable: true,
      render: (transaction: Transaction) => {
        // Extract mobile number from description
        let mobileNumber = '';
        
        // Find the user from all users data
        const user = allUsersData?.users.find(u => u.id === transaction.userId);
        const initials = user ? getInitials(user.name || user.username) : `U${transaction.userId}`;
        
        // For ADD_FUND, we will prioritize showing username
        if (transaction.type === 'ADD_FUND') {
          return (
            <div className="flex items-center">
              <Avatar className="h-8 w-8">
                <AvatarFallback>{initials}</AvatarFallback>
              </Avatar>
              <div className="ml-3">
                <p className="text-sm font-medium">{user ? user.username : 'Unknown User'}</p>
                {user && user.name && (
                  <p className="text-xs text-gray-500">{user.username}</p>
                )}
              </div>
            </div>
          );
        }
        
        if (transaction.description) {
          // For recharge transactions, extract mobile number from description
          if (transaction.type === 'RECHARGE') {
            // Try to find a 10-digit number in the description
            const match = transaction.description.match(/(?:\+91)?(\d{10})/);
            if (match) {
              mobileNumber = match[1];
            } else {
              // Try to find "mobile number" pattern in the description
              const mobileMatch = transaction.description.match(/mobile\s*(?:number)?:?\s*(?:\+91)?(\d+)/i);
              if (mobileMatch) {
                mobileNumber = mobileMatch[1];
              }
            }
          }
          
          // For transfer transactions, try to find recipient information
          if (transaction.type === 'TRANSFER') {
            // Try to find "to" or "transfer to" pattern in the description
            const transferMatch = transaction.description.match(/(?:transfer(?:red)?\s*to|to|recipient):?\s*(?:\+91)?(\d+)/i);
            if (transferMatch) {
              mobileNumber = transferMatch[1];
            }
          }
        }
        
        return (
          <div className="flex items-center">
            <Avatar className="h-8 w-8">
              <AvatarFallback>{initials}</AvatarFallback>
            </Avatar>
            <div className="ml-3">
              {mobileNumber ? (
                <p className="text-sm font-medium">{mobileNumber}</p>
              ) : (
                <p className="text-sm font-medium">{user ? (user.name || user.username) : 'Unknown User'}</p>
              )}
              <p className="text-xs text-gray-500">{user ? user.username : `ID: ${transaction.userId}`}</p>
            </div>
          </div>
        );
      },
    },
    {
      key: "type",
      title: "TX Type",
      sortable: true,
      render: (transaction: Transaction) => {
        let variant: "recharge" | "addFund" | "transfer" | "referral" | "cashback" | "debit" | "moneySent" | "moneyReceived" | "default" = "default";
        switch (transaction.type.toUpperCase()) {
          case "RECHARGE": variant = "recharge"; break;
          case "ADD_FUND": variant = "addFund"; break;
          case "TRANSFER": variant = "transfer"; break;
          case "REFERRAL": variant = "referral"; break;
          case "CASHBACK": variant = "cashback"; break;
          case "DEBIT": variant = "debit"; break;
          case "MONEY_SENT": variant = "moneySent"; break;
          case "MONEY_RECEIVED": variant = "moneyReceived"; break;
          default: variant = "default";
        }
        return <Badge variant={variant}>{transaction.type.replace('_', ' ')}</Badge>;
      },
    },
    {
      key: "amount",
      title: "TX Amount",
      sortable: true,
      render: (transaction: Transaction) => (
        <CurrencyDisplay amount={transaction.amount} className="text-sm font-medium" />
      ),
    },

    {
      key: "status",
      title: "TX Status",
      sortable: true,
      render: (transaction: Transaction) => {
        let variant: "success" | "pending" | "failed" | "refund" | "default" = "default";
        switch (transaction.status.toUpperCase()) {
          case "SUCCESS": variant = "success"; break;
          case "PENDING": variant = "pending"; break;
          case "FAILED": variant = "failed"; break;
          case "REFUND": variant = "refund"; break;
          default: variant = "default";
        }
        return <Badge variant={variant}>{transaction.status}</Badge>;
      },
    },

    {
      key: "timestamp",
      title: "TX Date",
      sortable: true,
      render: (transaction: Transaction) => (
        <span className="text-sm text-gray-500">
          {transaction.timestamp ? new Date(transaction.timestamp).toLocaleString() : ''}
        </span>
      ),
    },
    {
      key: "actions",
      title: "Actions",
      render: (transaction: Transaction) => (
        <div className="flex items-center justify-end">
          <div className="flex items-center gap-2">
            <Button 
              variant="ghost" 
              size="icon"
              onClick={() => handleViewDetails(transaction)}
              title="View Details"
            >
              <Eye className="h-4 w-4" />
            </Button>
            <Button 
              variant="ghost" 
              size="icon"
              onClick={() => handleUpdateTransaction(transaction)}
              title="Edit Transaction"
            >
              <Edit className="h-4 w-4" />
            </Button>
            <Button 
              variant="ghost" 
              size="icon"
              onClick={() => handleDeleteTransaction(transaction)}
              title="Delete Transaction"
              className="text-destructive"
            >
              <Trash className="h-4 w-4" />
            </Button>
          </div>
        </div>
      ),
    },
  ];

  // KPI Card component
  const KpiCard = ({ title, value, icon: Icon, bgColor, textColor, txCount }: {
    title: string;
    value: string | number;
    icon: React.ElementType;
    bgColor: string;
    textColor: string;
    txCount: number;
  }) => (
    <div className="bg-white rounded-xl shadow-sm p-5 flex flex-col">
      <div className="flex items-start justify-between mb-3">
        <div>
          <h3 className="text-sm text-gray-500 font-medium mb-1">{title}</h3>
          <p className="text-2xl font-bold">
            <CurrencyDisplay amount={value} />
          </p>
          <p className="text-xs text-green-500 font-medium mt-1">
            {txCount} txn
          </p>
        </div>
        <div className={`p-3 rounded-full ${bgColor} ${textColor}`}>
          <Icon size={20} />
        </div>
      </div>
    </div>
  );
  
  // Transaction Type Chart component
  const TransactionTypeChart = ({ data }: { data: { name: string; value: number; amount: number; color: string }[] }) => (
    <div className="bg-white rounded-xl shadow-sm p-5">
      <h3 className="text-lg font-semibold mb-4">Transaction Types</h3>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={60}
              outerRadius={80}
              paddingAngle={5}
              dataKey="value"
              label={({ name, percent }) => percent > 0 ? `${name}: ${(percent * 100).toFixed(0)}%` : ''}
            >
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Pie>
            <RechartsTooltip 
              formatter={(value, name, props) => {
                const amount = props.payload?.amount || 0;
                return [
                  `${value} transactions`,
                  name,
                  `Total: ₹${amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                ];
              }} 
            />
            <Legend />
          </PieChart>
        </ResponsiveContainer>
      </div>
    </div>
  );

  // Transaction Status Chart component
  const TransactionStatusChart = ({ data }: { data: { name: string; value: number; color: string }[] }) => (
    <div className="bg-white rounded-xl shadow-sm p-5">
      <h3 className="text-lg font-semibold mb-4">Transaction Status</h3>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={data}
            margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
          >
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="name" />
            <YAxis />
            <RechartsTooltip formatter={(value) => [`${value} transactions`]} />
            <Bar dataKey="value" name="Transactions">
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );

  // Filter UI component is defined below

  // Filter UI component
  const FilterSection = () => (
    <div className="mb-6">
      <div className="flex flex-wrap items-center gap-4">
        <Button 
          variant={timePeriod === 'today' ? 'default' : 'outline'} 
          onClick={() => setTimePeriod('today')}
          className="rounded-full"
          size="sm"
        >
          Today
        </Button>
        <Button 
          variant={timePeriod === 'week' ? 'default' : 'outline'} 
          onClick={() => setTimePeriod('week')}
          className="rounded-full"
          size="sm"
        >
          This Week
        </Button>
        <Button 
          variant={timePeriod === 'month' ? 'default' : 'outline'} 
          onClick={() => setTimePeriod('month')}
          className="rounded-full"
          size="sm"
        >
          This Month
        </Button>
        <Button 
          variant={timePeriod === 'year' ? 'default' : 'outline'} 
          onClick={() => setTimePeriod('year')}
          className="rounded-full"
          size="sm"
        >
          This Year
        </Button>
        <DateRangePicker 
          dateRange={dateRange} 
          onDateRangeChange={(range) => {
            setDateRange(range);
            setTimePeriod('custom');
          }}
        />
        
        <div className="flex-shrink-0 ml-2">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="All Statuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All Statuses</SelectItem>
              <SelectItem value="SUCCESS">Success</SelectItem>
              <SelectItem value="PENDING">Pending</SelectItem>
              <SelectItem value="FAILED">Failed</SelectItem>
              <SelectItem value="REFUND">Refund</SelectItem>
            </SelectContent>
          </Select>
        </div>
        
        <div className="flex-shrink-0">
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="All Types" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All Types</SelectItem>
              <SelectItem value="RECHARGE">Recharge</SelectItem>
              <SelectItem value="ADD_FUND">Add Fund</SelectItem>
              <SelectItem value="TRANSFER">Transfer</SelectItem>
              <SelectItem value="MONEY_SENT">Money Sent</SelectItem>
              <SelectItem value="MONEY_RECEIVED">Money Received</SelectItem>
              <SelectItem value="DEBIT">Debit</SelectItem>
              <SelectItem value="CASHBACK">Cashback</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  );

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-inter font-bold">Transactions</h1>
        <Button onClick={() => setIsCreateModalOpen(true)}>
          Add Transaction
        </Button>
      </div>

      {/* Filter Section on Top */}
      <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Transaction Filters</h2>
          <div className="flex space-x-2">
            {/* New Refresh Data button */}
            <Button 
              variant="default" 
              size="sm"
              onClick={() => {
                // Manually refresh data
                refetchTransactions();
                toast.success("Refreshing transaction data...");
              }}
              className="flex items-center gap-1"
            >
              <RotateCw className="h-4 w-4 mr-1" />
              Refresh Data
            </Button>
            
            {/* Existing Reset Filters button */}
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => {
                setSearchTerm('');
                setDateRange(undefined);
                setStatusFilter('ALL');
                setTypeFilter('ALL');
                setTimePeriod('week');
              }}
              className="flex items-center gap-1"
            >
              <RefreshCw className="h-4 w-4" />
              Reset Filters
            </Button>
          </div>
        </div>
        <FilterSection />
      </div>

      {/* KPI Cards - Added Refund KPI card */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-5 mb-6">
        <KpiCard 
          title="Total Transactions"
          value={transactionStats.totalAmount}
          icon={ReceiptIcon}
          bgColor="bg-blue-100"
          textColor="text-blue-600"
          txCount={transactionStats.successCount + transactionStats.pendingCount + transactionStats.failedCount + transactionStats.refundCount}
        />
        <KpiCard 
          title="Success"
          value={transactionStats.successAmount}
          icon={CheckCircle2}
          bgColor="bg-green-100"
          textColor="text-green-600"
          txCount={transactionStats.successCount}
        />
        <KpiCard 
          title="Pending"
          value={transactionStats.pendingAmount}
          icon={Clock}
          bgColor="bg-yellow-100"
          textColor="text-yellow-600"
          txCount={transactionStats.pendingCount}
        />
        <KpiCard 
          title="Failed"
          value={transactionStats.failedAmount}
          icon={AlertCircle}
          bgColor="bg-red-100"
          textColor="text-red-600"
          txCount={transactionStats.failedCount}
        />
        <KpiCard 
          title="Refund"
          value={transactionStats.refundAmount}
          icon={RotateCcw}
          bgColor="bg-indigo-100"
          textColor="text-indigo-600"
          txCount={transactionStats.refundCount}
        />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-6">
        <TransactionTypeChart data={transactionStats.typeDistribution} />
        <TransactionStatusChart data={transactionStats.statusDistribution} />
      </div>

      {/* Transaction Table */}
      <div className="bg-white rounded-xl shadow-sm p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-semibold">Transaction List</h2>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              refetchTransactions();
              toast.success("Refreshing transaction data...");
            }}
            className="flex items-center gap-1 text-blue-600 hover:text-blue-800"
          >
            <RotateCw className="h-4 w-4 animate-spin-slow" />
            Auto-refreshing every 5s
          </Button>
        </div>
        <DataTable
          data={filteredTransactions}
          columns={columns}
          onSearch={setSearchTerm}
          isLoading={isLoading}
          itemsPerPage={25}
        />
      </div>

      {/* Create Transaction Modal */}
      <Dialog 
        open={isCreateModalOpen} 
        onOpenChange={(open) => {
          setIsCreateModalOpen(open);
          
          // Reset form when dialog is closed
          if (!open) {
            // Get current type before reset (if any)
            const currentType = createForm.getValues('type');
            
            createForm.reset({
              userId: undefined,
              amount: '',
              type: currentType, // Preserve the current type if it exists
              status: 'PENDING',
              transactionId: generateRandomId(currentType), // Generate ID based on type
              description: '',
              operatorId: undefined,
              recipientId: undefined,
              mobileNumber: '',
            });
            
            // Clear wallet balance check state
            setInsufficientBalance(false);
            setUserWalletBalance(null);
            setSelectedUserId(undefined);
          }
        }}
      >
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Create New Transaction</DialogTitle>
            <DialogDescription>
              Fill in the details to create a new transaction.
            </DialogDescription>
          </DialogHeader>
          <Form {...createForm}>
            <form onSubmit={createForm.handleSubmit(onCreateTransaction)} className="space-y-4">
              <FormField
                control={createForm.control}
                name="userId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>User ID*</FormLabel>
                    <FormControl>
                      <Input 
                        type="number" 
                        placeholder="1" 
                        {...field} 
                        onChange={e => {
                          const userId = parseInt(e.target.value, 10) || undefined;
                          field.onChange(userId);
                          
                          if (userId) {
                            // Fetch user data for wallet balance check
                            setSelectedUserId(userId);
                            refetchUser();
                          }
                        }}
                        value={field.value || ''}
                      />
                    </FormControl>
                    <FormMessage />
                    {isUserLoading && (
                      <div className="text-xs text-muted-foreground mt-1">
                        Checking user wallet balance...
                      </div>
                    )}
                    {insufficientBalance && (
                      <div className="text-xs text-red-500 mt-1 flex items-center gap-1">
                        <AlertCircle className="h-3 w-3" />
                        Insufficient wallet balance: {userWalletBalance ? formatCurrency(userWalletBalance) : '₹0.00'} available
                      </div>
                    )}
                    {userData?.user && !insufficientBalance && createForm.getValues('type') === 'RECHARGE' && (
                      <div className="text-xs text-green-500 mt-1 flex items-center gap-1">
                        <CheckCircle2 className="h-3 w-3" />
                        Available balance: {formatCurrency(userData.user.walletBalance)}
                      </div>
                    )}
                  </FormItem>
                )}
              />
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={createForm.control}
                  name="type"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Transaction Type*</FormLabel>
                      <Select 
                        onValueChange={(value) => {
                          field.onChange(value);
                          
                          // Update transaction ID to match the selected type format
                          createForm.setValue('transactionId', generateRandomId(value));
                          
                          // If RECHARGE is selected, check wallet balance if user is selected
                          if (value === 'RECHARGE') {
                            const userId = createForm.getValues('userId');
                            const amount = createForm.getValues('amount');
                            
                            if (userId && amount) {
                              checkWalletBalanceForRecharge(userId, amount);
                            }
                          } else {
                            // Reset insufficient balance warning for other transaction types
                            setInsufficientBalance(false);
                          }
                        }} 
                        defaultValue={field.value}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select type" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="RECHARGE">Recharge</SelectItem>
                          <SelectItem value="ADD_FUND">Add Fund</SelectItem>
                          <SelectItem value="TRANSFER">Transfer</SelectItem>
                          <SelectItem value="CASHBACK">Cashback</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={createForm.control}
                  name="amount"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Amount*</FormLabel>
                      <FormControl>
                        <Input 
                          placeholder="100.00" 
                          {...field}
                          onChange={(e) => {
                            field.onChange(e.target.value);
                            
                            // If transaction type is RECHARGE, check wallet balance with new amount
                            const type = createForm.getValues('type');
                            const userId = createForm.getValues('userId');
                            
                            if (type === 'RECHARGE' && userId && e.target.value) {
                              checkWalletBalanceForRecharge(userId, e.target.value);
                            }
                          }}
                        />
                      </FormControl>
                      <FormMessage />
                      {createForm.getValues('type') === 'RECHARGE' && insufficientBalance && (
                        <div className="text-xs text-red-500 mt-1">
                          Amount exceeds available wallet balance
                        </div>
                      )}
                    </FormItem>
                  )}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={createForm.control}
                  name="status"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Status*</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select status" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="PENDING">Pending</SelectItem>
                          <SelectItem value="SUCCESS">Success</SelectItem>
                          <SelectItem value="FAILED">Failed</SelectItem>
                          <SelectItem value="REFUND">Refund</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={createForm.control}
                  name="transactionId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Transaction ID</FormLabel>
                      <FormControl>
                        <div className="flex space-x-2">
                          <Input 
                            placeholder="Enter manually or auto-generate" 
                            {...field} 
                            value={field.value || ''}
                          />
                          <Button 
                            type="button"
                            variant="outline"
                            size="icon"
                            onClick={() => {
                              // Get current transaction type and generate ID accordingly
                              const transactionType = createForm.getValues('type');
                              field.onChange(generateRandomId(transactionType));
                            }}
                            title="Generate random ID"
                          >
                            <RefreshCw className="h-4 w-4" />
                          </Button>
                        </div>
                      </FormControl>
                      <FormDescription className="text-xs">
                        Enter manually or click refresh to auto-generate
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <FormField
                control={createForm.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description</FormLabel>
                    <FormControl>
                      <Input 
                        placeholder="Transaction description" 
                        {...field} 
                        value={field.value || ''}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              {/* Mobile Number Field - Only shown for RECHARGE or TRANSFER transactions */}
              {(createForm.watch('type') === 'RECHARGE' || createForm.watch('type') === 'TRANSFER') && (
                <FormField
                  control={createForm.control}
                  name="mobileNumber"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Mobile Number{createForm.watch('type') === 'RECHARGE' ? '*' : ''}</FormLabel>
                      <FormControl>
                        <Input 
                          placeholder={createForm.watch('type') === 'RECHARGE' ? 'Enter mobile number to recharge' : 'Enter recipient mobile number'} 
                          {...field} 
                          value={field.value || ''}
                          onChange={(e) => {
                            // Validate and format as mobile number
                            let value = e.target.value.replace(/\D/g, '').substring(0, 10);
                            field.onChange(value);
                            
                            // Update description field with mobile number information
                            const type = createForm.getValues('type');
                            if (type === 'RECHARGE') {
                              const operatorId = createForm.getValues('operatorId');
                              const operator = allOperatorsData?.operators.find((op: Operator) => op.id === operatorId);
                              const operatorName = operator ? operator.name : 'Unknown';
                              createForm.setValue('description', `${operatorName} recharge for mobile number: ${value}`);
                            } else if (type === 'TRANSFER') {
                              createForm.setValue('description', `Funds transferred to: ${value}`);
                            }
                          }}
                        />
                      </FormControl>
                      <FormDescription>
                        {createForm.watch('type') === 'RECHARGE' 
                          ? 'Enter the 10-digit mobile number for recharge'
                          : 'Enter the mobile number where funds will be transferred'
                        }
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}
              <div className="grid grid-cols-2 gap-4">
                {/* Operator ID Field - Only shown for RECHARGE transactions */}
                {createForm.watch('type') === 'RECHARGE' && (
                  <FormField
                    control={createForm.control}
                    name="operatorId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Operator</FormLabel>
                        <Select 
                          onValueChange={(value) => {
                            // Parse the value to an integer first to ensure we have a number, not a string or object
                            const parsedId = parseInt(value, 10);
                            console.log('Selected operator ID:', parsedId, typeof parsedId);
                            field.onChange(parsedId);
                          }} 
                          value={field.value?.toString() || undefined}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select operator" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectGroup>
                              <SelectLabel>Operators</SelectLabel>
                              <div className="relative">
                                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                                <Input
                                  placeholder="Search operators..."
                                  className="pl-8 mb-2"
                                  // We would add search functionality here in a real app
                                />
                              </div>
                              {isAllOperatorsLoading ? (
                                <div className="flex justify-center p-2">
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                </div>
                              ) : (
                                allOperatorsData?.operators.map(operator => (
                                  <SelectItem key={operator.id} value={operator.id.toString()}>
                                    {operator.name} ({operator.code})
                                  </SelectItem>
                                ))
                              )}
                            </SelectGroup>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}
                
                {/* Recipient ID Field - Only shown for TRANSFER transactions */}
                {createForm.watch('type') === 'TRANSFER' && (
                  <FormField
                    control={createForm.control}
                    name="recipientId"
                    render={({ field }) => {
                      // Convert the current value to an array if it's not already
                      const selectedIds = Array.isArray(field.value) 
                        ? field.value 
                        : field.value 
                          ? [field.value] 
                          : [];
                          
                      // Handle checkbox toggling logic
                      const toggleRecipient = (userId: number) => {
                        if (selectedIds.includes(userId)) {
                          // Remove if already selected
                          field.onChange(selectedIds.filter(id => id !== userId));
                        } else {
                          // Add if not selected
                          field.onChange([...selectedIds, userId]);
                        }
                      };
                      
                      // Format selected recipients for display
                      const getDisplayValue = () => {
                        if (selectedIds.length === 0) return "Select recipients";
                        if (selectedIds.length === 1) {
                          const user = allUsersData?.users.find(u => u.id === selectedIds[0]);
                          return user ? `${user.name || user.username} (#${user.id})` : `Unknown User (ID: ${selectedIds[0]})`;
                        }
                        return `${selectedIds.length} recipients selected`;
                      };
                      
                      return (
                        <FormItem className="col-span-2">
                          <FormLabel>Recipients (Select Multiple)</FormLabel>
                          <Popover>
                            <PopoverTrigger asChild>
                              <FormControl>
                                <Button
                                  variant="outline"
                                  role="combobox"
                                  className="justify-between w-full font-normal"
                                >
                                  {getDisplayValue()}
                                  <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                </Button>
                              </FormControl>
                            </PopoverTrigger>
                            <PopoverContent className="w-[320px] p-0" align="start">
                              <div className="relative border-b p-2">
                                <Search className="absolute left-2 top-3 h-4 w-4 text-muted-foreground" />
                                <Input
                                  placeholder="Search users..."
                                  className="pl-8"
                                  // Add search functionality here in a real app
                                />
                              </div>
                              <div className="max-h-[300px] overflow-auto">
                                {isAllUsersLoading ? (
                                  <div className="flex justify-center p-2">
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                  </div>
                                ) : allUsersData?.users.length === 0 ? (
                                  <div className="text-center p-4 text-sm text-muted-foreground">
                                    No users found
                                  </div>
                                ) : (
                                  <div className="grid">
                                    {allUsersData?.users.map(user => (
                                      <div
                                        key={user.id}
                                        className={`flex items-center px-3 py-2 cursor-pointer hover:bg-muted ${
                                          selectedIds.includes(user.id) ? 'bg-muted' : ''
                                        }`}
                                        onClick={() => toggleRecipient(user.id)}
                                      >
                                        <Checkbox 
                                          checked={selectedIds.includes(user.id)}
                                          onCheckedChange={() => toggleRecipient(user.id)}
                                          className="mr-2"
                                        />
                                        <div className="flex items-center">
                                          <Avatar className="h-6 w-6 mr-2">
                                            <AvatarFallback className="text-xs">
                                              {getInitials(user.name || user.username)}
                                            </AvatarFallback>
                                          </Avatar>
                                          <div>
                                            <span>{user.name || user.username}</span>
                                            <span className="text-xs text-muted-foreground ml-1">
                                              (#{user.id})
                                            </span>
                                          </div>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                              {selectedIds.length > 0 && (
                                <div className="border-t p-2 flex justify-between items-center">
                                  <div className="text-sm text-muted-foreground">
                                    {selectedIds.length} selected
                                  </div>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => field.onChange([])}
                                  >
                                    Clear
                                  </Button>
                                </div>
                              )}
                            </PopoverContent>
                          </Popover>
                          <FormMessage />
                        </FormItem>
                      );
                    }}
                  />
                )}
                
                {/* Display a spacer or other fields if neither RECHARGE nor TRANSFER is selected */}
                {createForm.watch('type') !== 'RECHARGE' && createForm.watch('type') !== 'TRANSFER' && (
                  <div className="col-span-2"></div>
                )}
              </div>
              <DialogFooter>
                {insufficientBalance && createForm.getValues('type') === 'RECHARGE' && (
                  <div className="text-xs text-red-500 mr-auto flex items-center">
                    <AlertCircle className="h-3 w-3 mr-1" />
                    Insufficient wallet balance for recharge
                  </div>
                )}
                <Button 
                  type="submit" 
                  disabled={createTransactionMutation.isPending || 
                    (insufficientBalance && createForm.getValues('type') === 'RECHARGE')}
                >
                  {createTransactionMutation.isPending ? 'Creating...' : 'Create Transaction'}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Update Transaction Modal */}
      <Dialog open={isUpdateModalOpen} onOpenChange={setIsUpdateModalOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Update Transaction</DialogTitle>
            <DialogDescription>
              Update transaction details or change transaction status
            </DialogDescription>
          </DialogHeader>
          <Form {...updateForm}>
            <form onSubmit={updateForm.handleSubmit(onUpdateTransaction)} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={updateForm.control}
                  name="transactionId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Transaction ID</FormLabel>
                      <FormControl>
                        <Input 
                          {...field} 
                          value={field.value || ''}
                          disabled
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />
                <FormField
                  control={updateForm.control}
                  name="userId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>User ID</FormLabel>
                      <FormControl>
                        <Input 
                          type="number" 
                          {...field} 
                          value={field.value || ''}
                          disabled
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={updateForm.control}
                  name="type"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Transaction Type</FormLabel>
                      <FormControl>
                        <Input 
                          {...field} 
                          value={field.value || ''}
                          disabled
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />
                <FormField
                  control={updateForm.control}
                  name="amount"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Amount</FormLabel>
                      <FormControl>
                        <Input 
                          {...field} 
                          value={field.value || ''}
                          disabled
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={updateForm.control}
                name="status"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Status*</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select status" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="PENDING">Pending</SelectItem>
                        <SelectItem value="SUCCESS">Success</SelectItem>
                        <SelectItem value="FAILED">Failed</SelectItem>
                        <SelectItem value="REFUND">Refund</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                    {field.value === 'REFUND' && (
                      <div className="text-xs text-blue-500 mt-1 flex items-center gap-1">
                        <InfoIcon className="h-3 w-3" />
                        The transaction amount will be refunded to the user's wallet
                      </div>
                    )}
                    {(selectedTransaction?.status === 'SUCCESS' || selectedTransaction?.status === 'PENDING') && field.value === 'FAILED' && (
                      <div className="mt-1">
                        <div className="flex items-center space-x-2 mb-1">
                          <Checkbox 
                            id="refund-wallet" 
                            checked={refundWallet} 
                            onCheckedChange={(checked) => setRefundWallet(checked as boolean)}
                          />
                          <label
                            htmlFor="refund-wallet"
                            className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                          >
                            Refund amount to user's wallet
                          </label>
                        </div>
                        {refundWallet ? (
                          <div className="text-xs text-green-500 flex items-center gap-1 mt-1">
                            <RefreshCw className="h-3 w-3" />
                            <strong>Amount will be automatically refunded to user's wallet</strong>
                          </div>
                        ) : (
                          <div className="text-xs text-gray-500 flex items-center gap-1 mt-1">
                            <InfoIcon className="h-3 w-3" />
                            <strong>IMPORTANT:</strong> Check the box above to refund original recharge amount to user's wallet
                          </div>
                        )}
                        
                        {refundError && (
                          <div className="text-xs text-red-500 flex items-center gap-1 mt-1">
                            <AlertCircle className="h-3 w-3" />
                            {refundError}
                          </div>
                        )}
                        
                        <div className="text-xs bg-yellow-50 p-2 rounded border border-yellow-200 text-yellow-700 mt-2">
                          <div className="font-semibold mb-1">Transaction Status Change Information:</div>
                          <ul className="list-disc pl-4 space-y-1">
                            <li>If updating from SUCCESS or PENDING to FAILED, check the refund box to add the amount back to user's wallet</li>
                            <li>If the checkbox is not selected, no refund will be processed</li>
                            <li>This applies to recharge transactions changing from either SUCCESS or PENDING to FAILED status</li>
                          </ul>
                        </div>
                      </div>
                    )}
                  </FormItem>
                )}
              />

              <FormField
                control={updateForm.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description</FormLabel>
                    <FormControl>
                      <Input 
                        placeholder="Transaction description" 
                        {...field} 
                        value={field.value || ''}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <DialogFooter>
                <Button 
                  type="submit" 
                  disabled={updateTransactionMutation.isPending}
                >
                  {updateTransactionMutation.isPending ? 'Updating...' : 'Update Transaction'}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={isDeleteConfirmOpen} onOpenChange={setIsDeleteConfirmOpen}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Confirm Delete Transaction</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this transaction? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="bg-gray-50 rounded-lg p-4 my-4">
            <p className="text-sm text-gray-500 mb-1">Transaction ID</p>
            <p className="font-semibold">{selectedTransaction?.transactionId}</p>
            <div className="mt-3">
              <p className="text-sm text-gray-500 mb-1">Amount</p>
              <p className="font-semibold">{selectedTransaction ? <CurrencyDisplay amount={selectedTransaction.amount} /> : ''}</p>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsDeleteConfirmOpen(false)}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => deleteTransactionMutation.mutate()}
              disabled={deleteTransactionMutation.isPending}
            >
              {deleteTransactionMutation.isPending ? 'Deleting...' : 'Delete Transaction'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Transaction Details Modal - Modern UI with larger size */}
      <Dialog open={isDetailsModalOpen} onOpenChange={setIsDetailsModalOpen}>
        <DialogContent className="sm:max-w-[900px] lg:max-w-[1000px] p-0 gap-0 overflow-y-auto max-h-[90vh] rounded-xl border-0 shadow-xl">
          {selectedTransaction && (
            <div className="flex flex-col">
              {/* Hero Header Section with Glass Morphism */}
              <div className="relative">
                <div className={`absolute inset-0 ${
                  selectedTransaction.type === "RECHARGE" ? "bg-gradient-to-r from-blue-600 via-blue-500 to-indigo-500" :
                  selectedTransaction.type === "ADD_FUND" ? "bg-gradient-to-r from-amber-500 via-orange-500 to-orange-600" :
                  selectedTransaction.type === "TRANSFER" ? "bg-gradient-to-r from-emerald-600 via-green-500 to-teal-500" :
                  selectedTransaction.type === "REFERRAL" ? "bg-gradient-to-r from-violet-600 via-purple-500 to-fuchsia-500" :
                  selectedTransaction.type === "CASHBACK" ? "bg-gradient-to-r from-fuchsia-600 via-purple-500 to-violet-500" :
                  "bg-gradient-to-r from-gray-800 via-gray-700 to-gray-900"
                }`}></div>
                
                {/* Glass Morphism Pattern - Blurred Circles */}
                <div className="absolute top-0 left-0 w-32 h-32 bg-white opacity-10 rounded-full blur-xl transform -translate-x-1/2 -translate-y-1/3"></div>
                <div className="absolute bottom-0 right-0 w-40 h-40 bg-white opacity-10 rounded-full blur-xl transform translate-x-1/3 translate-y-1/4"></div>
                <div className="absolute top-1/2 left-1/2 w-24 h-24 bg-white opacity-5 rounded-full blur-xl transform -translate-x-1/2 -translate-y-1/2"></div>
                
                <div className="relative z-10 px-8 pt-8 pb-12 text-white">
                  <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                    <div className="flex items-center space-x-4">
                      <div className="bg-white/20 backdrop-blur-md p-3 rounded-xl shadow-inner flex items-center justify-center">
                        {selectedTransaction.type === "RECHARGE" && <CreditCard className="h-6 w-6" strokeWidth={1.5} />}
                        {selectedTransaction.type === "ADD_FUND" && <ArrowUpRight className="h-6 w-6" strokeWidth={1.5} />}
                        {selectedTransaction.type === "TRANSFER" && <ArrowRight className="h-6 w-6" strokeWidth={1.5} />}
                        {selectedTransaction.type === "REFERRAL" && <Users className="h-6 w-6" strokeWidth={1.5} />}
                        {selectedTransaction.type === "CASHBACK" && <Percent className="h-6 w-6" strokeWidth={1.5} />}
                      </div>
                      <div>
                        <h2 className="text-2xl font-bold flex items-center">
                          Transaction Details
                          <Badge variant="outline" className="ml-3 text-white border-white/30 bg-white/10 py-1">
                            #{selectedTransaction.id}
                          </Badge>
                        </h2>
                        <p className="text-white/80 mt-1">{selectedTransaction.type.replace('_', ' ')} Transaction</p>
                      </div>
                    </div>
                    <motion.div 
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ 
                        type: "spring", 
                        stiffness: 400, 
                        damping: 25, 
                        delay: 0.2
                      }}
                      className={`px-4 py-2 rounded-lg ${
                        selectedTransaction.status === "SUCCESS" ? "bg-green-500/20 text-green-50 border border-green-400/30" : 
                        selectedTransaction.status === "PENDING" ? "bg-amber-500/20 text-amber-50 border border-amber-400/30" : 
                        "bg-red-500/20 text-red-50 border border-red-400/30"
                      } shadow-sm backdrop-blur-sm`}
                    >
                      <div className="text-xs font-medium uppercase tracking-wider mb-1 opacity-90">Status</div>
                      <div className="flex items-center space-x-1.5">
                        <TransactionStatusBadge 
                          status={selectedTransaction.status as any} 
                          size="md" 
                          animate={true} 
                          className="bg-opacity-30 border-opacity-30"
                        />
                      </div>
                    </motion.div>
                  </div>
                  
                  <div className="mt-8">
                    <p className="text-white/80 font-medium mb-2">Transaction Amount</p>
                    <div className="flex items-center">
                      <span className="text-4xl font-bold"><CurrencyDisplay amount={selectedTransaction.amount} /></span>
                      <div className="ml-4 text-white/70">INR</div>
                    </div>
                  </div>
                </div>
              </div>
              
              {/* Transaction Information - Main Content */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 p-8 bg-white">
                {/* Left Column - Primary Details */}
                <div className="space-y-6 md:col-span-2">
                  {/* Key Details Card */}
                  <div className="bg-slate-50 rounded-xl border border-slate-100 p-6 shadow-sm">
                    <h3 className="text-sm font-semibold text-slate-900 mb-4 flex items-center">
                      <ReceiptIcon className="h-4 w-4 mr-2 text-slate-600" />
                      Transaction Details
                    </h3>
                    
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-6 gap-x-8">
                      {/* Transaction ID */}
                      <div>
                        <p className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-1.5">Transaction ID</p>
                        <div className="flex items-center">
                          <code className="bg-slate-100 px-3 py-1.5 rounded-lg text-sm font-mono text-slate-800 mr-2 flex-1 truncate">
                            {selectedTransaction.transactionId}
                          </code>
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-8 w-8 rounded-full" 
                            onClick={() => {
                              navigator.clipboard.writeText(selectedTransaction.transactionId || '');
                              toast.success("Transaction ID copied to clipboard");
                            }}
                          >
                            <Copy className="h-4 w-4 text-slate-500" />
                          </Button>
                        </div>
                      </div>
                      
                      {/* Date & Time */}
                      <div>
                        <p className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-1.5">Date & Time</p>
                        <div className="flex items-center bg-slate-100 px-3 py-1.5 rounded-lg">
                          <Calendar className="h-4 w-4 mr-2 text-slate-500" />
                          <p className="text-sm font-medium text-slate-800">
                            {formatDate(selectedTransaction.timestamp)}
                          </p>
                        </div>
                      </div>
                      
                      {/* Mobile Number - for RECHARGE or TRANSFER transactions */}
                      {(selectedTransaction.type === 'RECHARGE' || selectedTransaction.type === 'TRANSFER') && (
                        <div>
                          <p className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-1.5">Mobile Number</p>
                          <div className="flex items-center bg-slate-100 px-3 py-1.5 rounded-lg">
                            <Phone className="h-4 w-4 mr-2 text-slate-500" />
                            <p className="text-sm font-medium text-slate-800">
                              {(() => {
                                // Extract mobile number from description
                                let mobileNumber = 'N/A';
                                
                                if (selectedTransaction.description) {
                                  // For recharge transactions, extract mobile number from description
                                  if (selectedTransaction.type === 'RECHARGE') {
                                    // Try to find a 10-digit number in the description
                                    const match = selectedTransaction.description.match(/(?:\+91)?(\d{10})/);
                                    if (match) {
                                      mobileNumber = match[1];
                                    } else {
                                      // Try to find "mobile number" pattern in the description
                                      const mobileMatch = selectedTransaction.description.match(/mobile\s*(?:number)?:?\s*(?:\+91)?(\d+)/i);
                                      if (mobileMatch) {
                                        mobileNumber = mobileMatch[1];
                                      }
                                    }
                                  }
                                  
                                  // For transfer transactions, try to find recipient information
                                  if (selectedTransaction.type === 'TRANSFER') {
                                    // Try to find "to" or "transfer to" pattern in the description
                                    const transferMatch = selectedTransaction.description.match(/(?:transfer(?:red)?\s*to|to|recipient):?\s*(?:\+91)?(\d+)/i);
                                    if (transferMatch) {
                                      mobileNumber = transferMatch[1];
                                    }
                                  }
                                }
                                
                                return mobileNumber;
                              })()}
                            </p>
                          </div>
                        </div>
                      )}
                      
                      {/* Transaction Type */}
                      <div>
                        <p className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-1.5">Transaction Type</p>
                        <div className="flex items-center">
                          <Badge className={`
                            px-3 py-1 text-sm font-medium ${
                              selectedTransaction.type === "RECHARGE" ? "bg-blue-100 text-blue-800 hover:bg-blue-100" :
                              selectedTransaction.type === "ADD_FUND" ? "bg-orange-100 text-orange-800 hover:bg-orange-100" :
                              selectedTransaction.type === "TRANSFER" ? "bg-green-100 text-green-800 hover:bg-green-100" :
                              selectedTransaction.type === "REFERRAL" ? "bg-purple-100 text-purple-800 hover:bg-purple-100" :
                              selectedTransaction.type === "CASHBACK" ? "bg-fuchsia-100 text-fuchsia-800 hover:bg-fuchsia-100" :
                              "bg-gray-100 text-gray-800 hover:bg-gray-100"
                            }
                          `}>
                            {selectedTransaction.type.replace('_', ' ')}
                          </Badge>
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  {/* Participants Card */}
                  <div className="bg-slate-50 rounded-xl border border-slate-100 p-6 shadow-sm">
                    <h3 className="text-sm font-semibold text-slate-900 mb-4 flex items-center">
                      <Users className="h-4 w-4 mr-2 text-slate-600" />
                      Participants
                    </h3>
                    
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                      {/* User/Sender */}
                      <div className="bg-white rounded-lg p-4 border border-slate-200">
                        <p className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-3">
                          {selectedTransaction.type === "TRANSFER" ? "Sender" : "User"}
                        </p>
                        <div className="flex items-center">
                          {(() => {
                            const user = allUsersData?.users.find(u => u.id === selectedTransaction.userId);
                            const initials = user ? getInitials(user.name || user.username) : `U${selectedTransaction.userId}`;
                            return (
                              <>
                                <Avatar className="h-12 w-12 mr-3 border-2 border-slate-200 shadow-sm">
                                  <AvatarFallback className="bg-slate-100 text-slate-700 text-sm font-semibold">
                                    {initials}
                                  </AvatarFallback>
                                </Avatar>
                                <div>
                                  <p className="font-medium text-slate-900">
                                    {user ? user.username : `Unknown User`}
                                  </p>
                                  {user && user.name && (
                                    <p className="text-sm text-slate-500 mt-0.5">{user.name}</p>
                                  )}
                                  <p className="text-xs text-slate-400 mt-0.5">ID: {selectedTransaction.userId}</p>
                                </div>
                              </>
                            );
                          })()}
                        </div>
                      </div>
                      
                      {/* Operator or Recipient */}
                      {selectedTransaction.operatorId ? (
                        <div className="bg-white rounded-lg p-4 border border-slate-200">
                          <p className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-3">Operator</p>
                          <div className="flex items-center">
                            {(() => {
                              const operator = allOperatorsData?.operators.find(o => o.id === selectedTransaction.operatorId);
                              const operatorName = operator ? operator.name : 'Unknown Operator';
                              const initials = operator ? operator.name.substring(0, 2).toUpperCase() : 'OP';
                              
                              return (
                                <>
                                  <div className="w-12 h-12 bg-blue-50 rounded-full flex items-center justify-center mr-3 text-blue-600 border-2 border-blue-100 shadow-sm">
                                    <span className="text-sm font-semibold">{initials}</span>
                                  </div>
                                  <div>
                                    <p className="font-medium text-slate-900">{operatorName}</p>
                                    {operator && (
                                      <p className="text-sm text-slate-500 mt-0.5">Code: {operator.code}</p>
                                    )}
                                    <p className="text-xs text-slate-400 mt-0.5">ID: {selectedTransaction.operatorId}</p>
                                  </div>
                                </>
                              );
                            })()}
                          </div>
                        </div>
                      ) : selectedTransaction.recipientId ? (
                        <div className="bg-white rounded-lg p-4 border border-slate-200">
                          <p className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-3">Recipient</p>
                          <div className="flex items-center">
                            {(() => {
                              const recipient = allUsersData?.users.find(u => u.id === selectedTransaction.recipientId);
                              const initials = recipient ? getInitials(recipient.name || recipient.username) : `U${selectedTransaction.recipientId}`;
                              
                              return (
                                <>
                                  <Avatar className="h-12 w-12 mr-3 border-2 border-slate-200 shadow-sm">
                                    <AvatarFallback className="bg-slate-100 text-slate-700 text-sm font-semibold">
                                      {initials}
                                    </AvatarFallback>
                                  </Avatar>
                                  <div>
                                    <p className="font-medium text-slate-900">
                                      {recipient ? recipient.username : `Unknown User`}
                                    </p>
                                    {recipient && recipient.name && (
                                      <p className="text-sm text-slate-500 mt-0.5">{recipient.name}</p>
                                    )}
                                    <p className="text-xs text-slate-400 mt-0.5">ID: {selectedTransaction.recipientId}</p>
                                  </div>
                                </>
                              );
                            })()}
                          </div>
                        </div>
                      ) : null}
                    </div>
                  </div>
                  
                  {/* Description Section - if present */}
                  {selectedTransaction.description && (
                    <div className="bg-slate-50 rounded-xl border border-slate-100 p-6 shadow-sm">
                      <h3 className="text-sm font-semibold text-slate-900 mb-4 flex items-center">
                        <InfoIcon className="h-4 w-4 mr-2 text-slate-600" />
                        Description
                      </h3>
                      <div className="bg-white rounded-lg p-4 border border-slate-200">
                        <p className="text-sm text-slate-700 whitespace-pre-line">{selectedTransaction.description}</p>
                      </div>
                    </div>
                  )}
                </div>
                
                {/* Right Column - API Status and Additional Details */}
                <div className="space-y-6">
                  {/* Amount Card with Status - Animated */}
                  <motion.div 
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ 
                      type: "spring", 
                      stiffness: 400, 
                      damping: 25 
                    }}
                    className={`rounded-xl p-6 ${
                      selectedTransaction.status === "SUCCESS" ? "bg-green-50 border border-green-100" :
                      selectedTransaction.status === "PENDING" ? "bg-amber-50 border border-amber-100" :
                      "bg-red-50 border border-red-100"
                    }`}
                  >
                    <motion.div
                      initial={{ y: -10, opacity: 0 }}
                      animate={{ y: 0, opacity: 1 }}
                      transition={{ delay: 0.2 }}
                    >
                      <div className="flex items-center justify-between">
                        <h3 className="text-sm font-semibold flex items-center">
                          <span className={
                            selectedTransaction.status === "SUCCESS" ? "text-green-800" :
                            selectedTransaction.status === "PENDING" ? "text-amber-800" :
                            "text-red-800"
                          }>
                            Transaction Status
                          </span>
                        </h3>
                        <TransactionStatusBadge 
                          status={selectedTransaction.status as any} 
                          size="md" 
                          animate={true} 
                        />
                      </div>
                      
                      <div className="mt-5">
                        <p className="text-xs font-medium text-slate-600 uppercase tracking-wider mb-1">Amount</p>
                        <div className="flex items-center">
                          <motion.p 
                            className={`text-2xl font-bold ${
                              selectedTransaction.status === "SUCCESS" ? "text-green-700" :
                              selectedTransaction.status === "PENDING" ? "text-amber-700" :
                              "text-red-700"
                            }`}
                            initial={{ opacity: 0, y: 5 }}
                            animate={{ 
                              opacity: 1, 
                              y: 0,
                              scale: [1, 1.05, 1]
                            }}
                            transition={{ 
                              delay: 0.3,
                              scale: {
                                delay: 0.5,
                                duration: 0.5
                              }
                            }}
                          >
                            <CurrencyDisplay amount={selectedTransaction.amount} />
                          </motion.p>
                          <div className="ml-2 bg-white/50 px-2 py-1 rounded text-xs text-gray-600">INR</div>
                        </div>
                      </div>
                      
                      <motion.div 
                        className="mt-5 text-sm px-4 py-3 bg-white/70 rounded-lg"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.4 }}
                      >
                        <p className={
                          selectedTransaction.status === "SUCCESS" ? "text-green-600" :
                          selectedTransaction.status === "PENDING" ? "text-amber-600" :
                          "text-red-600"
                        }>
                          {selectedTransaction.status === "SUCCESS" && "Transaction completed successfully"}
                          {selectedTransaction.status === "PENDING" && "Transaction is being processed"}
                          {selectedTransaction.status === "FAILED" && "Transaction failed to process"}
                          {selectedTransaction.status === "REFUND" && "Transaction has been refunded"}
                        </p>
                      </motion.div>
                    </motion.div>
                  </motion.div>
                  
                  {/* API Status Check Section - only for RECHARGE transactions */}
                  {selectedTransaction.type === 'RECHARGE' && (
                    <div className="bg-slate-50 rounded-xl border border-slate-100 p-6 shadow-sm">
                      <h3 className="text-sm font-semibold text-slate-900 mb-4 flex items-center justify-between">
                        <div className="flex items-center">
                          <Cloud className="h-4 w-4 mr-2 text-slate-600" /> 
                          <span>External API Status</span>
                        </div>
                      </h3>
                      
                      <div className="flex flex-col gap-3">
                        <Button 
                          size="sm" 
                          variant="outline"
                          onClick={() => checkTransactionStatusFromApi(selectedTransaction)}
                          disabled={isStatusCheckingApi}
                          className="w-full justify-center"
                        >
                          {isStatusCheckingApi ? (
                            <>
                              <RotateCw className="h-4 w-4 mr-2 animate-spin" />
                              <span>Checking...</span>
                            </>
                          ) : (
                            <>
                              <RefreshCw className="h-4 w-4 mr-2" />
                              <span>Check Status</span>
                            </>
                          )}
                        </Button>
                        
                        <Button 
                          size="sm" 
                          variant="default"
                          onClick={() => updateTransactionFromApi(selectedTransaction)}
                          disabled={isStatusCheckingApi}
                          className="w-full justify-center bg-blue-600 hover:bg-blue-700"
                        >
                          {isStatusCheckingApi ? (
                            <>
                              <RotateCw className="h-4 w-4 mr-2 animate-spin" />
                              <span>Updating...</span>
                            </>
                          ) : (
                            <>
                              <ExternalLink className="h-4 w-4 mr-2" />
                              <span>Update from API</span>
                            </>
                          )}
                        </Button>
                      </div>
                      
                      <div className="mt-4">
                        {/* API Status Results */}
                        {apiStatusData ? (
                          <div className="bg-white p-4 rounded-lg border border-slate-200 text-sm">
                            <div className="grid grid-cols-2 gap-4">
                              <div className="space-y-1">
                                <p className="text-xs text-slate-500 font-medium">Transaction ID</p>
                                <p className="font-medium text-slate-800">
                                  {apiStatusData.apiResponse && apiStatusData.apiResponse.txid ? 
                                    apiStatusData.apiResponse.txid : 
                                    "Record not found"}
                                </p>
                              </div>
                              <div className="space-y-1">
                                <p className="text-xs text-slate-500 font-medium">Status</p>
                                <div className="flex items-center">
                                  {!apiStatusData.apiResponse || apiStatusData.apiResponse.status === null ? (
                                    <Badge variant="outline" className="bg-slate-50 text-slate-700 border-slate-200 flex items-center">
                                      <InfoIcon className="h-3 w-3 mr-1" />
                                      Record not found
                                    </Badge>
                                  ) : apiStatusData.mappedStatus === 'SUCCESS' && (
                                    <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 flex items-center">
                                      <CheckCircle2 className="h-3 w-3 mr-1" />
                                      {apiStatusData.apiResponse.status}
                                    </Badge>
                                  )}
                                  {apiStatusData.apiResponse && apiStatusData.apiResponse.status && apiStatusData.mappedStatus === 'FAILED' && (
                                    <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200 flex items-center">
                                      <XCircle className="h-3 w-3 mr-1" />
                                      {apiStatusData.apiResponse.status}
                                    </Badge>
                                  )}
                                  {apiStatusData.apiResponse && apiStatusData.apiResponse.status && apiStatusData.mappedStatus === 'PENDING' && (
                                    <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200 flex items-center">
                                      <Clock className="h-3 w-3 mr-1" />
                                      {apiStatusData.apiResponse.status}
                                    </Badge>
                                  )}
                                </div>
                              </div>
                              <div className="space-y-1">
                                <p className="text-xs text-slate-500 font-medium">Mobile</p>
                                <p className="font-medium text-slate-800">
                                  {apiStatusData.apiResponse && apiStatusData.apiResponse.number ? 
                                    apiStatusData.apiResponse.number : 
                                    "Record not found"}
                                </p>
                              </div>
                              <div className="space-y-1">
                                <p className="text-xs text-slate-500 font-medium">Amount</p>
                                <p className="font-medium text-slate-800">
                                  {apiStatusData.apiResponse && apiStatusData.apiResponse.amount ? 
                                    `₹${apiStatusData.apiResponse.amount}` : 
                                    "Record not found"}
                                </p>
                              </div>
                            </div>
                            
                            {apiStatusData.apiResponse && apiStatusData.mappedStatus && selectedTransaction.status !== apiStatusData.mappedStatus && (
                              <div className="mt-4 p-3 bg-blue-50 border border-blue-100 rounded-md">
                                <p className="text-xs text-blue-700 flex items-center">
                                  <InfoIcon className="h-3.5 w-3.5 mr-1.5 flex-shrink-0" />
                                  <span>
                                    Status mismatch! API shows <strong className="mx-0.5">{apiStatusData.mappedStatus}</strong> 
                                    but transaction is <strong className="mx-0.5">{selectedTransaction.status}</strong>
                                  </span>
                                </p>
                              </div>
                            )}
                          </div>
                        ) : apiStatusError ? (
                          <div className="bg-red-50 p-4 rounded-lg border border-red-100">
                            <p className="text-red-700 flex items-center text-sm">
                              <AlertCircle className="h-4 w-4 mr-2 flex-shrink-0" />
                              <span>{apiStatusError}</span>
                            </p>
                          </div>
                        ) : (
                          <div className="bg-slate-100 p-4 rounded-lg text-sm text-slate-600 border border-slate-200">
                            <div className="flex items-center">
                              <InfoIcon className="h-4 w-4 mr-2 text-slate-500" />
                              <p>Click "Check Status" to verify this transaction with the external API</p>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                  
                  {/* Metadata and Timeline Card */}
                  <div className="bg-slate-50 rounded-xl border border-slate-100 p-6 shadow-sm overflow-hidden">
                    <h3 className="text-sm font-semibold text-slate-900 mb-4 flex items-center">
                      <Clock className="h-4 w-4 mr-2 text-slate-600" />
                      Transaction Timeline
                    </h3>
                    
                    <TransactionTimeline 
                      events={(() => {
                        // Use a function to convert timestamps safely
                        const safeTimestamp = selectedTransaction.timestamp 
                          ? new Date(selectedTransaction.timestamp) 
                          : new Date();
                          
                        return [
                          {
                            id: 1,
                            title: "Transaction Created",
                            description: `${selectedTransaction.type.replace('_', ' ')} transaction initiated`,
                            timestamp: safeTimestamp,
                            status: "CREATED"
                          },
                          {
                            id: 2,
                            title: `Status: ${selectedTransaction.status}`,
                            description: selectedTransaction.status === "SUCCESS" 
                              ? "Transaction completed successfully" 
                              : selectedTransaction.status === "PENDING" 
                                ? "Transaction is being processed" 
                                : selectedTransaction.status === "FAILED"
                                  ? "Transaction failed to process"
                                  : "Transaction was refunded",
                            timestamp: safeTimestamp,
                            status: selectedTransaction.status as any,
                            isActive: true
                          }
                        ];
                      })()}
                      animate={true}
                    />
                    
                    {/* Progress Indicator */}
                    {selectedTransaction.type === "RECHARGE" && (
                      <div className="mt-6 pt-4 border-t border-slate-200">
                        <p className="text-xs font-medium text-slate-500 uppercase mb-4">TRANSACTION PROGRESS</p>
                        <TransactionProgress
                          steps={[
                            {
                              id: 1,
                              label: "Created",
                              status: "COMPLETED"
                            },
                            {
                              id: 2,
                              label: "Processing",
                              status: selectedTransaction.status === "PENDING" 
                                ? "CURRENT" 
                                : (selectedTransaction.status === "SUCCESS" || selectedTransaction.status === "REFUND") 
                                  ? "COMPLETED" 
                                  : "ERROR"
                            },
                            {
                              id: 3,
                              label: "Completed",
                              status: selectedTransaction.status === "SUCCESS" 
                                ? "COMPLETED" 
                                : selectedTransaction.status === "PENDING" 
                                  ? "UPCOMING" 
                                  : "ERROR"
                            }
                          ]}
                          animate={true}
                          showLabels={true}
                          compact={true}
                          className="mt-2"
                        />
                      </div>
                    )}
                  </div>
                </div>
              </div>
              
              {/* Footer Actions */}
              <div className="px-8 py-5 bg-slate-50 border-t border-slate-100 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div className="text-xs text-slate-500 flex items-center">
                  <Calendar className="h-3.5 w-3.5 mr-1.5 text-slate-400" />
                  Created on {formatDate(selectedTransaction.timestamp)}
                </div>
                <div className="flex items-center space-x-3">
                  <Button 
                    variant="outline" 
                    onClick={() => setIsDetailsModalOpen(false)}
                  >
                    Close
                  </Button>
                  <Button 
                    variant="default" 
                    onClick={() => {
                      setIsDetailsModalOpen(false);
                      handleUpdateTransaction(selectedTransaction);
                    }}
                    className="bg-blue-600 hover:bg-blue-700"
                  >
                    <Edit className="h-4 w-4 mr-2" />
                    Edit Transaction
                  </Button>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
