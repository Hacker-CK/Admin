import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle2, Clock, XCircle, RotateCcw, ArrowRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface TransactionStatusBadgeProps {
  status: "SUCCESS" | "FAILED" | "PENDING" | "REFUND" | string;
  size?: "sm" | "md" | "lg";
  showIcon?: boolean;
  showLabel?: boolean;
  animate?: boolean;
  className?: string;
}

export function TransactionStatusBadge({
  status,
  size = "md",
  showIcon = true,
  showLabel = true,
  animate = true,
  className = "",
}: TransactionStatusBadgeProps) {
  // Define sizes
  const sizeStyles = {
    sm: {
      badge: "px-1.5 py-0.5 text-xs",
      icon: "h-3 w-3 mr-1",
    },
    md: {
      badge: "px-2.5 py-1 text-sm",
      icon: "h-4 w-4 mr-1.5",
    },
    lg: {
      badge: "px-3 py-1.5 text-base",
      icon: "h-5 w-5 mr-2",
    },
  };

  // Define animations
  const pulseAnimation = animate ? {
    SUCCESS: {
      scale: [1, 1.05, 1],
      opacity: [0.9, 1, 0.9],
      transition: {
        duration: 2,
        repeat: Infinity,
        ease: "easeInOut",
      },
    },
    PENDING: {
      scale: [1, 1.05, 1],
      opacity: [0.8, 1, 0.8],
      transition: {
        duration: 1.2,
        repeat: Infinity,
        ease: "easeInOut",
      },
    },
    FAILED: {
      scale: [1, 1.03, 1],
      opacity: [0.9, 1, 0.9],
      transition: {
        duration: 2.5,
        repeat: Infinity,
        ease: "easeInOut",
      },
    },
    REFUND: {
      scale: [1, 1.03, 1],
      opacity: [0.9, 1, 0.9],
      transition: {
        duration: 2.5,
        repeat: Infinity,
        ease: "easeInOut",
      },
    },
  } : {};

  // Define styles
  const statusStyles = {
    SUCCESS: {
      bg: "bg-green-100 hover:bg-green-100",
      text: "text-green-800",
      border: "border-green-200",
      icon: <CheckCircle2 className={sizeStyles[size].icon} />,
      iconMotion: animate ? (
        <motion.div
          initial={{ rotate: 0 }}
          animate={{ rotate: 360 }}
          transition={{ duration: 0.5, delay: 0.2 }}
        >
          <CheckCircle2 className={sizeStyles[size].icon} />
        </motion.div>
      ) : (
        <CheckCircle2 className={sizeStyles[size].icon} />
      ),
    },
    PENDING: {
      bg: "bg-amber-100 hover:bg-amber-100",
      text: "text-amber-800",
      border: "border-amber-200",
      icon: <Clock className={sizeStyles[size].icon} />,
      iconMotion: animate ? (
        <motion.div
          animate={{ 
            rotate: [0, 360],
            scale: [1, 1.1, 1]
          }}
          transition={{ 
            rotate: { duration: 3, repeat: Infinity, ease: "linear" },
            scale: { duration: 1.5, repeat: Infinity, ease: "easeInOut" }
          }}
        >
          <Clock className={sizeStyles[size].icon} />
        </motion.div>
      ) : (
        <Clock className={sizeStyles[size].icon} />
      ),
    },
    FAILED: {
      bg: "bg-red-100 hover:bg-red-100",
      text: "text-red-800",
      border: "border-red-200",
      icon: <XCircle className={sizeStyles[size].icon} />,
      iconMotion: animate ? (
        <motion.div
          initial={{ x: 0 }}
          animate={{ x: [0, -2, 2, -2, 0] }}
          transition={{ duration: 0.5, delay: 0.2 }}
        >
          <XCircle className={sizeStyles[size].icon} />
        </motion.div>
      ) : (
        <XCircle className={sizeStyles[size].icon} />
      ),
    },
    REFUND: {
      bg: "bg-purple-100 hover:bg-purple-100",
      text: "text-purple-800",
      border: "border-purple-200",
      icon: <RotateCcw className={sizeStyles[size].icon} />,
      iconMotion: animate ? (
        <motion.div
          initial={{ rotate: 0 }}
          animate={{ rotate: -360 }}
          transition={{ duration: 0.7, delay: 0.2 }}
        >
          <RotateCcw className={sizeStyles[size].icon} />
        </motion.div>
      ) : (
        <RotateCcw className={sizeStyles[size].icon} />
      ),
    },
  };

  // Normalize status to one of our supported types
  const normalizedStatus = (() => {
    const upper = status.toUpperCase();
    if (upper === "SUCCESS" || upper === "PENDING" || upper === "FAILED" || upper === "REFUND") {
      return upper as "SUCCESS" | "PENDING" | "FAILED" | "REFUND";
    }
    
    // Default fallback
    return "PENDING" as const;
  })();
  
  const currentStyle = statusStyles[normalizedStatus as keyof typeof statusStyles];
  const animationForStatus = animate ? (pulseAnimation[normalizedStatus as keyof typeof pulseAnimation] || {}) : {};

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 5 }}
        animate={{ 
          opacity: 1, 
          y: 0,
          ...animationForStatus
        }}
        exit={{ opacity: 0, y: -5 }}
      >
        <Badge
          variant="outline"
          className={`${currentStyle.bg} ${currentStyle.text} ${currentStyle.border} ${sizeStyles[size].badge} ${className}`}
        >
          {showIcon && (animate ? currentStyle.iconMotion : currentStyle.icon)}
          {showLabel && status}
        </Badge>
      </motion.div>
    </AnimatePresence>
  );
}