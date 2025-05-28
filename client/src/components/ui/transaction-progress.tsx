import { motion } from "framer-motion";
import { CheckCircle2, AlertCircle, Clock } from "lucide-react";

type TransactionProgressStep = {
  id: string | number;
  label: string;
  status: "COMPLETED" | "CURRENT" | "UPCOMING" | "ERROR";
  description?: string;
};

interface TransactionProgressProps {
  steps: TransactionProgressStep[];
  animate?: boolean;
  showLabels?: boolean;
  compact?: boolean;
  className?: string;
}

export function TransactionProgress({
  steps,
  animate = true,
  showLabels = true,
  compact = false,
  className = ""
}: TransactionProgressProps) {
  // Determine if we're rendering in a horizontal or vertical format
  const isVertical = compact;

  const getStepIcon = (status: TransactionProgressStep["status"]) => {
    const iconSize = compact ? "h-4 w-4" : "h-5 w-5";
    
    switch (status) {
      case "COMPLETED":
        return animate ? (
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring", stiffness: 300, damping: 15 }}
          >
            <CheckCircle2 className={`${iconSize} text-white`} />
          </motion.div>
        ) : (
          <CheckCircle2 className={`${iconSize} text-white`} />
        );
      
      case "CURRENT":
        return animate ? (
          <motion.div
            animate={{ 
              scale: [1, 1.1, 1],
              rotate: 360
            }}
            transition={{ 
              scale: { duration: 1.5, repeat: Infinity, ease: "easeInOut" },
              rotate: { duration: 6, repeat: Infinity, ease: "linear" }
            }}
          >
            <Clock className={`${iconSize} text-white`} />
          </motion.div>
        ) : (
          <Clock className={`${iconSize} text-white`} />
        );
      
      case "ERROR":
        return animate ? (
          <motion.div
            animate={{ x: [0, -2, 2, -2, 0] }}
            transition={{ duration: 0.5, repeat: Infinity, repeatDelay: 3 }}
          >
            <AlertCircle className={`${iconSize} text-white`} />
          </motion.div>
        ) : (
          <AlertCircle className={`${iconSize} text-white`} />
        );
      
      case "UPCOMING":
      default:
        return null;
    }
  };

  const getStepColor = (status: TransactionProgressStep["status"]) => {
    switch (status) {
      case "COMPLETED": return "bg-green-500";
      case "CURRENT": return "bg-blue-500";
      case "ERROR": return "bg-red-500";
      case "UPCOMING": return "bg-gray-300";
    }
  };

  const getStepTextColor = (status: TransactionProgressStep["status"]) => {
    switch (status) {
      case "COMPLETED": return "text-green-600";
      case "CURRENT": return "text-blue-600 font-medium";
      case "ERROR": return "text-red-600";
      case "UPCOMING": return "text-gray-400";
    }
  };

  // Animation variants
  const containerVariants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: 0.15
      }
    }
  };

  const stepVariants = {
    hidden: compact ? { opacity: 0, y: 20 } : { opacity: 0, x: -20 },
    show: compact 
      ? { opacity: 1, y: 0, transition: { type: "spring", stiffness: 300, damping: 25 } }
      : { opacity: 1, x: 0, transition: { type: "spring", stiffness: 300, damping: 25 } }
  };

  // For vertical layout
  if (isVertical) {
    return (
      <motion.div 
        className={`flex flex-col space-y-4 ${className}`}
        variants={containerVariants}
        initial={animate ? "hidden" : "show"}
        animate="show"
      >
        {steps.map((step, index) => {
          const isLastStep = index === steps.length - 1;
          
          return (
            <motion.div 
              key={step.id} 
              className="relative pl-7"
              variants={stepVariants}
            >
              {/* Step Marker */}
              <div className={`absolute left-0 top-0 w-5 h-5 rounded-full ${getStepColor(step.status)} flex items-center justify-center`}>
                {getStepIcon(step.status)}
              </div>
              
              {/* Connecting Line */}
              {!isLastStep && (
                <div className="absolute left-2.5 top-5 bottom-0 w-0.5 bg-gray-200">
                  {step.status === "COMPLETED" && (
                    <motion.div 
                      className="w-0.5 bg-green-500 absolute top-0 left-0"
                      style={{ height: 0 }}
                      animate={{ height: '100%' }}
                      transition={{ duration: 0.5 }}
                    />
                  )}
                </div>
              )}
              
              {/* Step Content */}
              <div>
                <p className={`text-sm ${getStepTextColor(step.status)}`}>
                  {step.label}
                </p>
                {step.description && (
                  <p className="text-xs text-gray-500 mt-1">{step.description}</p>
                )}
              </div>
            </motion.div>
          );
        })}
      </motion.div>
    );
  }

  // For horizontal layout (default)
  return (
    <motion.div 
      className={`flex items-center w-full ${className}`}
      variants={containerVariants}
      initial={animate ? "hidden" : "show"}
      animate="show"
    >
      {steps.map((step, index) => {
        const isLastStep = index === steps.length - 1;
        
        return (
          <motion.div 
            key={step.id} 
            className="flex-1 relative"
            variants={stepVariants}
          >
            <div className="flex items-center">
              {/* Step Marker */}
              <div className={`relative z-10 flex-shrink-0 w-8 h-8 rounded-full ${getStepColor(step.status)} flex items-center justify-center`}>
                {getStepIcon(step.status)}
              </div>
              
              {/* Connector Line */}
              {!isLastStep && (
                <div className="flex-1 h-0.5 mx-2 bg-gray-200 relative">
                  {step.status === "COMPLETED" && (
                    <motion.div 
                      className="h-0.5 bg-green-500 absolute top-0 left-0"
                      style={{ width: 0 }}
                      animate={{ width: '100%' }}
                      transition={{ duration: 0.5 }}
                    />
                  )}
                </div>
              )}
            </div>
            
            {/* Step Label */}
            {showLabels && (
              <div className="mt-2">
                <p className={`text-xs ${getStepTextColor(step.status)}`}>
                  {step.label}
                </p>
                {step.description && (
                  <p className="text-xs text-gray-500 mt-0.5">{step.description}</p>
                )}
              </div>
            )}
          </motion.div>
        );
      })}
    </motion.div>
  );
}