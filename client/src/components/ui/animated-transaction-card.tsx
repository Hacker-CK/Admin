import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { 
  CreditCard, 
  Users, 
  ArrowUpRight, 
  ArrowRight, 
  Percent,
  Copy,
  ArrowUpRight as ArrowUpRightIcon,
  ChevronsRight
} from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/utils";
import { Transaction } from "@shared/schema";
import { TransactionStatusBadge } from "./transaction-status-badge";

interface AnimatedTransactionCardProps {
  transaction: Transaction;
  onClick?: () => void;
  highlight?: boolean;
  compact?: boolean;
}

export function AnimatedTransactionCard({
  transaction,
  onClick,
  highlight = false,
  compact = false,
}: AnimatedTransactionCardProps) {
  const [isNew, setIsNew] = useState(highlight);
  
  // If highlight is true, show a pulse animation and then fade it out after 3 seconds
  useEffect(() => {
    if (highlight) {
      const timer = setTimeout(() => {
        setIsNew(false);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [highlight]);

  // Define transaction icon based on type
  const getTransactionIcon = () => {
    switch (transaction.type) {
      case "RECHARGE":
        return (
          <motion.div
            whileHover={{ rotate: 15, scale: 1.1 }}
            transition={{ type: "spring", stiffness: 400, damping: 10 }}
          >
            <CreditCard className="h-5 w-5 text-blue-500" />
          </motion.div>
        );
      case "ADD_FUND":
        return (
          <motion.div
            whileHover={{ y: -3 }}
            transition={{ type: "spring", stiffness: 400, damping: 10 }}
          >
            <ArrowUpRight className="h-5 w-5 text-orange-500" />
          </motion.div>
        );
      case "TRANSFER":
        return (
          <motion.div
            whileHover={{ x: 3 }}
            transition={{ type: "spring", stiffness: 400, damping: 10 }}
          >
            <ArrowRight className="h-5 w-5 text-green-500" />
          </motion.div>
        );
      case "REFERRAL":
        return (
          <motion.div
            whileHover={{ scale: 1.1 }}
            transition={{ type: "spring", stiffness: 400, damping: 10 }}
          >
            <Users className="h-5 w-5 text-purple-500" />
          </motion.div>
        );
      case "CASHBACK":
        return (
          <motion.div
            whileHover={{ rotate: 15 }}
            transition={{ type: "spring", stiffness: 400, damping: 10 }}
          >
            <Percent className="h-5 w-5 text-fuchsia-500" />
          </motion.div>
        );
      default:
        return (
          <motion.div
            whileHover={{ scale: 1.1 }}
            transition={{ type: "spring", stiffness: 400, damping: 10 }}
          >
            <CreditCard className="h-5 w-5 text-gray-500" />
          </motion.div>
        );
    }
  };

  const cardVariants = {
    initial: { 
      opacity: 0, 
      y: 20,
      scale: 0.95,
    },
    animate: { 
      opacity: 1, 
      y: 0,
      scale: 1,
      transition: {
        type: "spring",
        stiffness: 300,
        damping: 25
      }
    },
    exit: { 
      opacity: 0, 
      scale: 0.9,
      transition: {
        duration: 0.2
      }
    },
    highlight: {
      boxShadow: "0 0 0 2px rgba(59, 130, 246, 0.5)",
      scale: [1, 1.02, 1],
      transition: {
        scale: {
          repeat: 3,
          duration: 0.5
        }
      }
    }
  };

  // Return compact version if compact prop is true
  if (compact) {
    return (
      <motion.div
        initial="initial"
        animate={isNew ? "highlight" : "animate"}
        exit="exit"
        variants={cardVariants}
        whileHover={{ 
          y: -3,
          boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)", 
          transition: { duration: 0.2 }
        }}
        className="h-full"
      >
        <Card 
          className={`cursor-pointer overflow-hidden h-full border ${
            isNew ? "border-blue-300 bg-blue-50/50" : "border-gray-200"
          }`}
          onClick={onClick}
        >
          <CardContent className="p-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <div className={`p-1.5 rounded-full ${
                  transaction.type === "RECHARGE" ? "bg-blue-100" :
                  transaction.type === "ADD_FUND" ? "bg-orange-100" :
                  transaction.type === "TRANSFER" ? "bg-green-100" :
                  transaction.type === "REFERRAL" ? "bg-purple-100" :
                  transaction.type === "CASHBACK" ? "bg-fuchsia-100" :
                  "bg-gray-100"
                }`}>
                  {getTransactionIcon()}
                </div>
                <div>
                  <p className="text-sm font-medium line-clamp-1">
                    {transaction.type.replace('_', ' ')}
                  </p>
                  <p className="text-xs text-gray-500">
                    {formatDate(transaction.timestamp)}
                  </p>
                </div>
              </div>
              <div className="text-right">
                <p className={`text-sm font-semibold ${
                  transaction.type === "ADD_FUND" || transaction.type === "REFERRAL" || transaction.type === "CASHBACK" 
                    ? "text-green-600" 
                    : "text-gray-800"
                }`}>
                  {formatCurrency(transaction.amount)}
                </p>
                <div className="mt-1">
                  <TransactionStatusBadge 
                    status={transaction.status} 
                    size="sm" 
                    animate={true} 
                  />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    );
  }

  // Full version with more details
  return (
    <AnimatePresence>
      <motion.div
        initial="initial"
        animate={isNew ? "highlight" : "animate"}
        exit="exit"
        variants={cardVariants}
        whileHover={{ 
          y: -5,
          boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)", 
          transition: { duration: 0.2 }
        }}
      >
        <Card 
          className={`cursor-pointer overflow-hidden border ${
            isNew ? "border-blue-300 bg-blue-50/50" : "border-gray-200"
          }`}
          onClick={onClick}
        >
          <div className={`h-1 ${
            transaction.type === "RECHARGE" ? "bg-blue-500" :
            transaction.type === "ADD_FUND" ? "bg-orange-500" :
            transaction.type === "TRANSFER" ? "bg-green-500" :
            transaction.type === "REFERRAL" ? "bg-purple-500" :
            transaction.type === "CASHBACK" ? "bg-fuchsia-500" :
            "bg-gray-500"
          }`}></div>
          
          <CardContent className="p-4">
            <div className="flex items-start justify-between">
              <div className="flex items-start space-x-3">
                <div className={`p-2 rounded-lg ${
                  transaction.type === "RECHARGE" ? "bg-blue-100" :
                  transaction.type === "ADD_FUND" ? "bg-orange-100" :
                  transaction.type === "TRANSFER" ? "bg-green-100" :
                  transaction.type === "REFERRAL" ? "bg-purple-100" :
                  transaction.type === "CASHBACK" ? "bg-fuchsia-100" :
                  "bg-gray-100"
                }`}>
                  {getTransactionIcon()}
                </div>
                <div>
                  <div className="flex items-center mb-1">
                    <p className="font-medium">{transaction.type.replace('_', ' ')}</p>
                    <TransactionStatusBadge 
                      status={transaction.status} 
                      size="sm" 
                      animate={true} 
                      className="ml-2"
                    />
                  </div>
                  
                  <div className="flex items-center text-sm text-gray-500 mb-2">
                    <p className="truncate max-w-[200px]">
                      ID: {transaction.transactionId}
                    </p>
                    <motion.div 
                      whileHover={{ scale: 1.2 }}
                      whileTap={{ scale: 0.9 }}
                      onClick={(e) => {
                        e.stopPropagation();
                        navigator.clipboard.writeText(transaction.transactionId || '');
                      }}
                      className="ml-1 cursor-pointer text-gray-400 hover:text-gray-600"
                    >
                      <Copy className="h-3.5 w-3.5" />
                    </motion.div>
                  </div>
                  
                  {transaction.description && (
                    <p className="text-sm text-gray-500 line-clamp-1">
                      {transaction.description}
                    </p>
                  )}
                </div>
              </div>
              
              <div className="text-right">
                <p className={`text-lg font-bold ${
                  transaction.type === "ADD_FUND" || transaction.type === "REFERRAL" || transaction.type === "CASHBACK" 
                    ? "text-green-600" 
                    : "text-gray-800"
                }`}>
                  {formatCurrency(transaction.amount)}
                </p>
                <p className="text-xs text-gray-500">
                  {formatDate(transaction.timestamp)}
                </p>
              </div>
            </div>
            
            <div className="mt-3 flex items-center justify-end">
              <motion.div
                whileHover={{ x: 3 }}
                whileTap={{ x: 5 }}
              >
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="text-xs h-8 px-2 text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                >
                  View Details
                  <ChevronsRight className="h-3.5 w-3.5 ml-1" />
                </Button>
              </motion.div>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </AnimatePresence>
  );
}