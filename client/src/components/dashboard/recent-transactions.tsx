import { useState, useMemo } from 'react';
import { Eye, ArrowUpRight, Calendar, CreditCard, Users, Clock, ArrowRight } from 'lucide-react';
import { useLocation } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import { 
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter
} from '@/components/ui/dialog';
import { DataTable } from '@/components/ui/data-table';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { formatCurrency, formatDate, getTransactionTypeColor, getInitials } from '@/lib/utils';
import { CurrencyDisplay } from '@/components/ui/currency-display';
import { Transaction, User, Operator } from '@shared/schema';

interface RecentTransactionsProps {
  transactions: Transaction[];
  isLoading?: boolean;
  onViewAll?: () => void;
}

export default function RecentTransactions({ transactions, isLoading = false, onViewAll }: RecentTransactionsProps) {
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);
  const [showDetails, setShowDetails] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [, navigate] = useLocation();
  
  // Fetch all users for username display
  const { data: usersData } = useQuery<{ users: User[] }>({
    queryKey: ['/api/users'],
    staleTime: 300000, // 5 minutes
  });
  
  // Fetch all operators for operator name display
  const { data: operatorsData } = useQuery<{ operators: Operator[] }>({
    queryKey: ['/api/operators'],
    staleTime: 300000, // 5 minutes
  });
  
  // Filter transactions based on search term
  const filteredTransactions = useMemo(() => {
    if (!searchTerm) return transactions;
    
    const term = searchTerm.toLowerCase();
    return transactions.filter(transaction => 
      transaction.transactionId.toLowerCase().includes(term) ||
      transaction.type.toLowerCase().includes(term) ||
      transaction.status.toLowerCase().includes(term) ||
      transaction.amount.toString().includes(term) ||
      transaction.userId.toString().includes(term) ||
      (transaction.description && transaction.description.toLowerCase().includes(term))
    );
  }, [transactions, searchTerm]);
  
  if (isLoading) {
    return (
      <div className="bg-white rounded-xl shadow-sm p-6 mb-6 animate-pulse">
        <div className="flex items-center justify-between mb-6">
          <div className="h-6 w-40 bg-gray-200 rounded"></div>
          <div className="flex items-center">
            <div className="w-64 h-10 bg-gray-200 rounded-md mr-4"></div>
            <div className="w-24 h-10 bg-gray-200 rounded-md"></div>
          </div>
        </div>
        <div className="space-y-4">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-16 bg-gray-100 rounded"></div>
          ))}
        </div>
        <div className="flex items-center justify-between pt-4 border-t border-gray-200 mt-4">
          <div className="h-4 w-40 bg-gray-200 rounded"></div>
          <div className="flex space-x-1">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="w-8 h-8 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }
  
  const getTypeIcon = (type: string) => {
    switch (type.toUpperCase()) {
      case "RECHARGE": return <CreditCard className="h-4 w-4" />;
      case "ADD_FUND": return <ArrowUpRight className="h-4 w-4" />;
      case "TRANSFER": return <ArrowRight className="h-4 w-4" />;
      case "REFERRAL": return <Users className="h-4 w-4" />;
      default: return <CreditCard className="h-4 w-4" />;
    }
  };

  const getStatusColor = (status: string): string => {
    switch (status.toUpperCase()) {
      case "SUCCESS": return "bg-green-500";
      case "PENDING": return "bg-yellow-500";
      case "FAILED": return "bg-red-500";
      case "REFUND": return "bg-indigo-500";
      default: return "bg-gray-400";
    }
  };
  
  const columns = [
    {
      key: "id",
      title: "ID",
      render: (transaction: Transaction) => (
        <span className="text-sm font-medium text-gray-900">#{transaction.id}</span>
      )
    },
    {
      key: "transactionId",
      title: "TXN ID",
      render: (transaction: Transaction) => (
        <span className="text-sm text-gray-700">#{transaction.transactionId}</span>
      )
    },
    {
      key: "user",
      title: "User",
      render: (transaction: Transaction) => {
        const user = usersData?.users.find((u: User) => u.id === transaction.userId);
        const initials = user ? getInitials(user.name || user.username) : `U${transaction.userId}`;
        
        return (
          <div className="flex items-center">
            <Avatar className="h-8 w-8 bg-primary/10">
              <AvatarFallback className="text-primary font-medium">{initials}</AvatarFallback>
            </Avatar>
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-900">{user ? user.username : 'Unknown User'}</p>
              {user && user.name && (
                <p className="text-xs text-gray-500">{user.name}</p>
              )}
            </div>
          </div>
        );
      }
    },
    {
      key: "type",
      title: "Type",
      render: (transaction: Transaction) => {
        let variant;
        let color;
        switch (transaction.type.toUpperCase()) {
          case "RECHARGE": 
            variant = "recharge"; 
            color = "bg-blue-100 text-blue-800";
            break;
          case "ADD_FUND": 
            variant = "addFund"; 
            color = "bg-green-100 text-green-800";
            break;
          case "TRANSFER": 
            variant = "transfer"; 
            color = "bg-purple-100 text-purple-800";
            break;
          case "REFERRAL": 
            variant = "referral"; 
            color = "bg-amber-100 text-amber-800";
            break;
          case "CASHBACK": 
            variant = "cashback"; 
            color = "bg-purple-100 text-purple-800";
            break;
          case "DEBIT": 
            variant = "debit"; 
            color = "bg-red-100 text-red-800";
            break;
          case "MONEY_SENT": 
            variant = "moneySent"; 
            color = "bg-amber-100 text-amber-800";
            break;
          case "MONEY_RECEIVED": 
            variant = "moneyReceived"; 
            color = "bg-emerald-100 text-emerald-800";
            break;
          default: 
            variant = "default";
            color = "bg-gray-100 text-gray-800";
        }
        return (
          <div className="flex items-center">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center ${color} mr-2`}>
              {getTypeIcon(transaction.type)}
            </div>
            <span className="text-sm font-medium">{transaction.type.replace('_', ' ')}</span>
          </div>
        );
      }
    },
    {
      key: "amount",
      title: "Amount",
      render: (transaction: Transaction) => (
        <CurrencyDisplay amount={transaction.amount} className="text-sm font-semibold text-gray-900" />
      )
    },
    {
      key: "status",
      title: "Status",
      render: (transaction: Transaction) => {
        let variant: "success" | "pending" | "failed" | "refund" | "default" = "default";
        switch (transaction.status.toUpperCase()) {
          case "SUCCESS": variant = "success"; break;
          case "PENDING": variant = "pending"; break;
          case "FAILED": variant = "failed"; break;
          case "REFUND": variant = "refund"; break;
          default: variant = "default";
        }
        return (
          <div className="flex items-center">
            <div className={`w-2 h-2 rounded-full ${getStatusColor(transaction.status)} mr-2`}></div>
            <Badge variant={variant} className="font-medium">{transaction.status}</Badge>
          </div>
        );
      }
    },
    {
      key: "timestamp",
      title: "Date",
      render: (transaction: Transaction) => (
        <div className="flex items-center text-sm text-gray-500">
          <Clock className="h-3.5 w-3.5 mr-1.5 opacity-70" />
          <span>{formatDate(transaction.timestamp)}</span>
        </div>
      )
    },
    {
      key: "actions",
      title: "",
      render: (transaction: Transaction) => (
        <Button 
          variant="ghost" 
          size="sm" 
          className="rounded-full h-8 w-8 p-0"
          onClick={(e) => {
            e.stopPropagation();
            setSelectedTransaction(transaction);
            setShowDetails(true);
          }}
        >
          <Eye className="h-4 w-4" />
        </Button>
      )
    }
  ];
  
  const handleRowClick = (transaction: Transaction) => {
    setSelectedTransaction(transaction);
    setShowDetails(true);
  };
  
  const handleCloseDetails = () => {
    setShowDetails(false);
    setSelectedTransaction(null);
  };

  const handleSearch = (term: string) => {
    setSearchTerm(term);
  };

  const handleViewAll = () => {
    if (onViewAll) {
      onViewAll();
    } else {
      navigate('/transactions');
    }
  };
  
  return (
    <>
      <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center">
            <div className="bg-primary/10 p-2 rounded-lg mr-3">
              <CreditCard className="h-5 w-5 text-primary" />
            </div>
            <h2 className="font-inter font-semibold text-lg text-gray-900">Recent Transactions</h2>
          </div>
          <Button variant="outline" size="sm" onClick={handleViewAll}>
            View All <ArrowRight className="ml-1 h-3.5 w-3.5" />
          </Button>
        </div>
        
        <DataTable
          data={filteredTransactions}
          columns={columns}
          onRowClick={handleRowClick}
          onSearch={handleSearch}
          itemsPerPage={5}
        />
      </div>
      
      {/* Transaction Details Dialog */}
      <Dialog open={showDetails} onOpenChange={handleCloseDetails}>
        <DialogContent className="sm:max-w-[525px]">
          <DialogHeader>
            <DialogTitle className="flex items-center text-xl">
              <div className={`mr-2 w-8 h-8 rounded-full flex items-center justify-center ${selectedTransaction ? getTransactionTypeColor(selectedTransaction.type) : ''}`}>
                {selectedTransaction && getTypeIcon(selectedTransaction.type)}
              </div>
              Transaction Details
            </DialogTitle>
            <DialogDescription>
              Complete information about this transaction
            </DialogDescription>
          </DialogHeader>
          
          {selectedTransaction && (
            <div className="mt-4">
              {/* Status Indicator */}
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center">
                  <div className={`w-3 h-3 rounded-full ${getStatusColor(selectedTransaction.status)} mr-2`}></div>
                  <span className="font-semibold text-lg capitalize">{selectedTransaction.status.toLowerCase()}</span>
                </div>
                <Badge variant={
                  selectedTransaction.type.toUpperCase() === "RECHARGE" ? "recharge" :
                  selectedTransaction.type.toUpperCase() === "ADD_FUND" ? "addFund" :
                  selectedTransaction.type.toUpperCase() === "TRANSFER" ? "transfer" :
                  selectedTransaction.type.toUpperCase() === "MONEY_SENT" ? "moneySent" :
                  selectedTransaction.type.toUpperCase() === "MONEY_RECEIVED" ? "moneyReceived" :
                  selectedTransaction.type.toUpperCase() === "DEBIT" ? "debit" : "referral"
                } className="text-sm py-1 px-3">
                  {selectedTransaction.type.replace('_', ' ')}
                </Badge>
              </div>
              
              {/* Amount Section */}
              <div className="bg-gray-50 rounded-lg p-4 mb-6">
                <p className="text-sm text-gray-500 mb-1">Amount</p>
                <p className="text-2xl font-bold">{formatCurrency(selectedTransaction.amount)}</p>
              </div>
              
              {/* Transaction Information */}
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs font-medium text-gray-500 uppercase mb-1">Database ID</p>
                    <p className="font-medium">#{selectedTransaction.id}</p>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-gray-500 uppercase mb-1">Date & Time</p>
                    <div className="flex items-center">
                      <Calendar className="h-4 w-4 mr-1.5 text-gray-400" />
                      <p>{selectedTransaction.timestamp ? new Date(selectedTransaction.timestamp).toLocaleString() : 'N/A'}</p>
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-1 gap-4 mt-4">
                  <div>
                    <p className="text-xs font-medium text-gray-500 uppercase mb-1">Transaction ID</p>
                    <p className="font-medium">#{selectedTransaction.transactionId}</p>
                  </div>
                </div>
                
                <Separator />
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs font-medium text-gray-500 uppercase mb-1">User</p>
                    <div className="flex items-center">
                      {(() => {
                        const user = usersData?.users.find((u: User) => u.id === selectedTransaction.userId);
                        const initials = user ? getInitials(user.name || user.username) : `U${selectedTransaction.userId}`;
                        
                        return (
                          <>
                            <Avatar className="h-5 w-5 mr-1.5">
                              <AvatarFallback className="text-xs">{initials}</AvatarFallback>
                            </Avatar>
                            <div>
                              <p className="font-medium">{user ? user.username : `Unknown User`}</p>
                              {user && user.name && (
                                <p className="text-xs text-gray-500">{user.name}</p>
                              )}
                            </div>
                          </>
                        );
                      })()}
                    </div>
                  </div>
                  
                  {selectedTransaction.operatorId && (
                    <div>
                      <p className="text-xs font-medium text-gray-500 uppercase mb-1">Operator</p>
                      <div className="flex items-center">
                        {(() => {
                          const operator = operatorsData?.operators.find((o: Operator) => o.id === selectedTransaction.operatorId);
                          const operatorName = operator ? operator.name : 'Unknown Operator';
                          const initials = operator ? operator.name.substring(0, 2).toUpperCase() : 'OP';
                          
                          return (
                            <>
                              <div className="w-5 h-5 bg-blue-100 rounded-full flex items-center justify-center mr-1.5 text-blue-600">
                                <span className="text-xs font-medium">{initials}</span>
                              </div>
                              <div>
                                <p className="font-medium">{operatorName}</p>
                                {operator && (
                                  <p className="text-xs text-gray-500">{operator.code}</p>
                                )}
                              </div>
                            </>
                          );
                        })()}
                      </div>
                    </div>
                  )}
                  
                  {selectedTransaction.recipientId && (
                    <div>
                      <p className="text-xs font-medium text-gray-500 uppercase mb-1">Recipient</p>
                      <div className="flex items-center">
                        {(() => {
                          const recipient = usersData?.users.find((u: User) => u.id === selectedTransaction.recipientId);
                          const initials = recipient ? getInitials(recipient.name || recipient.username) : `U${selectedTransaction.recipientId}`;
                          
                          return (
                            <>
                              <Avatar className="h-5 w-5 mr-1.5">
                                <AvatarFallback className="text-xs">{initials}</AvatarFallback>
                              </Avatar>
                              <div>
                                <p className="font-medium">{recipient ? recipient.username : `Unknown User`}</p>
                                {recipient && recipient.name && (
                                  <p className="text-xs text-gray-500">{recipient.name}</p>
                                )}
                              </div>
                            </>
                          );
                        })()}
                      </div>
                    </div>
                  )}
                </div>
                
                {selectedTransaction.description && (
                  <>
                    <Separator />
                    <div>
                      <p className="text-xs font-medium text-gray-500 uppercase mb-1">Description</p>
                      <p className="bg-gray-50 p-3 rounded text-sm">{selectedTransaction.description}</p>
                    </div>
                  </>
                )}
                
                {(selectedTransaction.ipAddress || selectedTransaction.deviceInfo) && (
                  <>
                    <Separator />
                    <div className="grid grid-cols-2 gap-4">
                      {selectedTransaction.ipAddress && (
                        <div>
                          <p className="text-xs font-medium text-gray-500 uppercase mb-1">IP Address</p>
                          <p className="text-sm">{selectedTransaction.ipAddress}</p>
                        </div>
                      )}
                      
                      {selectedTransaction.deviceInfo && (
                        <div>
                          <p className="text-xs font-medium text-gray-500 uppercase mb-1">Device Info</p>
                          <p className="text-sm">{selectedTransaction.deviceInfo}</p>
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>
              
              {/* Footer buttons removed as requested */}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
