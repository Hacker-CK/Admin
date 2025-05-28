import { useEffect } from "react";
import { motion, useAnimation, AnimatePresence } from "framer-motion";
import { CheckCircle2, XCircle, AlertCircle, RotateCcw, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type TransactionResultStatus = "SUCCESS" | "FAILED" | "PENDING" | "REFUND" | "PROCESSING";

interface TransactionResultProps {
  status: TransactionResultStatus;
  title?: string;
  message?: string;
  amount?: string | number;
  onDismiss?: () => void;
  onRetry?: () => void;
  className?: string;
  fullScreen?: boolean;
}

export function TransactionResult({
  status,
  title,
  message,
  amount,
  onDismiss,
  onRetry,
  className = "",
  fullScreen = false,
}: TransactionResultProps) {
  const controls = useAnimation();
  
  // Set default title based on status
  const defaultTitle = {
    SUCCESS: "Transaction Successful",
    FAILED: "Transaction Failed",
    PENDING: "Transaction Pending",
    REFUND: "Refund Processed",
    PROCESSING: "Processing Transaction",
  };

  // Set default message based on status
  const defaultMessage = {
    SUCCESS: "Your transaction has been processed successfully.",
    FAILED: "There was an error processing your transaction. Please try again.",
    PENDING: "Your transaction is being processed. This may take a moment.",
    REFUND: "Your refund has been processed and will reflect in your account.",
    PROCESSING: "Please wait while we process your transaction.",
  };

  // Animations for success and error statuses
  useEffect(() => {
    const sequence = async () => {
      if (status === "SUCCESS") {
        await controls.start({
          scale: [1, 1.2, 1],
          rotate: [0, 360, 360],
          transition: { duration: 1, ease: "easeInOut" }
        });
      } else if (status === "FAILED") {
        await controls.start({
          x: [0, -10, 10, -10, 10, 0],
          transition: { duration: 0.5, ease: "easeInOut" }
        });
      }
    };

    sequence();
  }, [status, controls]);

  // Set icon based on status
  const Icon = () => {
    const iconClassName = "h-12 w-12";
    
    switch (status) {
      case "SUCCESS":
        return (
          <motion.div
            animate={controls}
            className="w-24 h-24 rounded-full bg-green-100 flex items-center justify-center"
          >
            <CheckCircle2 className={`${iconClassName} text-green-600`} />
          </motion.div>
        );
      case "FAILED":
        return (
          <motion.div
            animate={controls}
            className="w-24 h-24 rounded-full bg-red-100 flex items-center justify-center"
          >
            <XCircle className={`${iconClassName} text-red-600`} />
          </motion.div>
        );
      case "PENDING":
        return (
          <motion.div
            animate={{ 
              rotate: 360
            }}
            transition={{ 
              duration: 2, 
              repeat: Infinity, 
              ease: "linear" 
            }}
            className="w-24 h-24 rounded-full bg-amber-100 flex items-center justify-center"
          >
            <Clock className={`${iconClassName} text-amber-600`} />
          </motion.div>
        );
      case "REFUND":
        return (
          <motion.div
            animate={{ 
              rotate: -360
            }}
            transition={{ 
              duration: 1,
              ease: "easeInOut"
            }}
            className="w-24 h-24 rounded-full bg-purple-100 flex items-center justify-center"
          >
            <RotateCcw className={`${iconClassName} text-purple-600`} />
          </motion.div>
        );
      case "PROCESSING":
      default:
        return (
          <motion.div
            animate={{ 
              scale: [1, 1.05, 1],
              rotate: 360
            }}
            transition={{ 
              scale: { duration: 1.5, repeat: Infinity, ease: "easeInOut" },
              rotate: { duration: 3, repeat: Infinity, ease: "linear" }
            }}
            className="w-24 h-24 rounded-full bg-blue-100 flex items-center justify-center"
          >
            <Clock className={`${iconClassName} text-blue-600`} />
          </motion.div>
        );
    }
  };

  // Background and text colors
  const colors = {
    SUCCESS: {
      bg: "bg-green-100",
      border: "border-green-200",
      text: "text-green-800",
      button: "bg-green-600 hover:bg-green-700",
    },
    FAILED: {
      bg: "bg-red-100",
      border: "border-red-200",
      text: "text-red-800",
      button: "bg-red-600 hover:bg-red-700",
    },
    PENDING: {
      bg: "bg-amber-100",
      border: "border-amber-200",
      text: "text-amber-800",
      button: "bg-amber-600 hover:bg-amber-700",
    },
    REFUND: {
      bg: "bg-purple-100",
      border: "border-purple-200",
      text: "text-purple-800",
      button: "bg-purple-600 hover:bg-purple-700",
    },
    PROCESSING: {
      bg: "bg-blue-100",
      border: "border-blue-200",
      text: "text-blue-800",
      button: "bg-blue-600 hover:bg-blue-700",
    },
  };
  
  // Define container animations
  const containerVariants = {
    hidden: { opacity: 0, scale: 0.9 },
    visible: { 
      opacity: 1, 
      scale: 1,
      transition: { 
        duration: 0.3,
        ease: "easeOut"
      }
    },
    exit: { 
      opacity: 0, 
      scale: 0.9,
      transition: { 
        duration: 0.2,
        ease: "easeIn"
      }
    },
  };

  // When full screen, show a backdrop for better emphasis
  if (fullScreen) {
    return (
      <AnimatePresence>
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
        >
          <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            className={cn(
              "relative bg-white rounded-2xl shadow-2xl max-w-md w-full mx-4 p-6 overflow-hidden",
              className
            )}
          >
            {/* Background pattern for better visual appeal */}
            <div className="absolute top-0 left-0 right-0 h-1/3 opacity-10 pattern-dots pattern-gray-700 pattern-size-3"></div>
            
            <div className="flex flex-col items-center text-center py-6 px-4">
              <Icon />
              
              <h2 className={`mt-6 text-xl font-bold ${colors[status].text}`}>
                {title || defaultTitle[status]}
              </h2>
              
              <p className="mt-2 text-gray-600">
                {message || defaultMessage[status]}
              </p>
              
              {amount && (
                <div className="mt-6 mb-4">
                  <p className="text-sm text-gray-500">Transaction Amount</p>
                  <p className="text-3xl font-bold">₹{amount}</p>
                </div>
              )}
              
              <div className="mt-8 space-y-3 w-full">
                {onDismiss && (
                  <Button 
                    onClick={onDismiss} 
                    className={`w-full ${colors[status].button}`}
                  >
                    {status === "FAILED" ? "Dismiss" : "Done"}
                  </Button>
                )}
                
                {onRetry && status === "FAILED" && (
                  <Button 
                    variant="outline" 
                    onClick={onRetry} 
                    className="w-full border-red-200 text-red-600 hover:bg-red-50"
                  >
                    Try Again
                  </Button>
                )}
              </div>
            </div>
          </motion.div>
        </motion.div>
      </AnimatePresence>
    );
  }

  // Regular in-page version
  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      exit="exit"
      className={cn(
        `rounded-xl border ${colors[status].border} ${colors[status].bg} overflow-hidden shadow-sm`,
        className
      )}
    >
      <div className="flex flex-col items-center text-center p-6">
        <Icon />
        
        <h3 className={`mt-4 text-lg font-semibold ${colors[status].text}`}>
          {title || defaultTitle[status]}
        </h3>
        
        <p className="mt-2 text-sm text-gray-600">
          {message || defaultMessage[status]}
        </p>
        
        {amount && (
          <div className="mt-4 mb-2">
            <p className="text-xs text-gray-500">Amount</p>
            <p className="text-xl font-bold">₹{amount}</p>
          </div>
        )}
        
        <div className="mt-6 space-x-3">
          {onDismiss && (
            <Button 
              size="sm"
              onClick={onDismiss} 
              className={colors[status].button}
            >
              {status === "FAILED" ? "Dismiss" : "Done"}
            </Button>
          )}
          
          {onRetry && status === "FAILED" && (
            <Button 
              size="sm"
              variant="outline" 
              onClick={onRetry} 
              className="border-red-200 text-red-600 hover:bg-red-50"
            >
              Try Again
            </Button>
          )}
        </div>
      </div>
    </motion.div>
  );
}