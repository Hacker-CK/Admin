import { motion } from "framer-motion";
import { CheckCircle2, Clock, XCircle, RotateCcw, PlusCircle } from "lucide-react";
import { formatDate } from "@/lib/utils";

export interface TimelineEvent {
  id: string | number;
  title: string;
  description?: string;
  timestamp: Date | string | null;
  status: "SUCCESS" | "PENDING" | "FAILED" | "REFUND" | "CREATED" | string;
  isActive?: boolean;
}

interface TransactionTimelineProps {
  events: TimelineEvent[];
  animate?: boolean;
}

export function TransactionTimeline({ events, animate = true }: TransactionTimelineProps) {
  const sortedEvents = [...events].sort((a, b) => {
    const dateA = a.timestamp ? new Date(a.timestamp).getTime() : 0;
    const dateB = b.timestamp ? new Date(b.timestamp).getTime() : 0;
    return dateA - dateB;
  });

  // Define animations
  const containerVariants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1
      }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    show: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 300, damping: 25 } }
  };

  // Helper to get status icon with animation
  const getStatusIcon = (status: TimelineEvent["status"], isActive: boolean = false) => {
    const iconSize = "h-4 w-4";
    
    switch (status) {
      case "SUCCESS":
        return animate ? (
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1, rotate: [0, 360] }}
            transition={{ type: "spring", stiffness: 300, damping: 15, delay: 0.2 }}
            className="bg-green-500 text-white p-1 rounded-full"
          >
            <CheckCircle2 className={iconSize} />
          </motion.div>
        ) : (
          <div className="bg-green-500 text-white p-1 rounded-full">
            <CheckCircle2 className={iconSize} />
          </div>
        );
      
      case "PENDING":
        return animate ? (
          <motion.div
            animate={{ 
              rotate: 360,
              scale: [1, 1.1, 1]
            }}
            transition={{ 
              rotate: { duration: 3, repeat: Infinity, ease: "linear" },
              scale: { duration: 1.5, repeat: Infinity, ease: "easeInOut" }
            }}
            className="bg-amber-500 text-white p-1 rounded-full"
          >
            <Clock className={iconSize} />
          </motion.div>
        ) : (
          <div className="bg-amber-500 text-white p-1 rounded-full">
            <Clock className={iconSize} />
          </div>
        );
      
      case "FAILED":
        return animate ? (
          <motion.div
            animate={{ x: [0, -2, 2, -2, 0] }}
            transition={{ duration: 0.5, repeat: isActive ? Infinity : 0, repeatDelay: 3 }}
            className="bg-red-500 text-white p-1 rounded-full"
          >
            <XCircle className={iconSize} />
          </motion.div>
        ) : (
          <div className="bg-red-500 text-white p-1 rounded-full">
            <XCircle className={iconSize} />
          </div>
        );
      
      case "REFUND":
        return animate ? (
          <motion.div
            animate={{ rotate: -360 }}
            transition={{ duration: 0.7, delay: 0.2 }}
            className="bg-purple-500 text-white p-1 rounded-full"
          >
            <RotateCcw className={iconSize} />
          </motion.div>
        ) : (
          <div className="bg-purple-500 text-white p-1 rounded-full">
            <RotateCcw className={iconSize} />
          </div>
        );
      
      case "CREATED":
      default:
        return animate ? (
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1, y: [0, -2, 0] }}
            transition={{ type: "spring", stiffness: 300, damping: 15 }}
            className="bg-blue-500 text-white p-1 rounded-full"
          >
            <PlusCircle className={iconSize} />
          </motion.div>
        ) : (
          <div className="bg-blue-500 text-white p-1 rounded-full">
            <PlusCircle className={iconSize} />
          </div>
        );
    }
  };

  // Status color for timeline connector
  const getStatusColor = (status: TimelineEvent["status"]) => {
    switch (status) {
      case "SUCCESS": return "bg-green-500";
      case "PENDING": return "bg-amber-500";
      case "FAILED": return "bg-red-500";
      case "REFUND": return "bg-purple-500";
      case "CREATED":
      default: return "bg-blue-500";
    }
  };

  // Status background color for event card
  const getStatusBgColor = (status: TimelineEvent["status"]) => {
    switch (status) {
      case "SUCCESS": return "bg-green-50 border-green-100";
      case "PENDING": return "bg-amber-50 border-amber-100";
      case "FAILED": return "bg-red-50 border-red-100";
      case "REFUND": return "bg-purple-50 border-purple-100";
      case "CREATED":
      default: return "bg-blue-50 border-blue-100";
    }
  };

  return (
    <motion.div
      className="relative space-y-0 pl-6"
      variants={containerVariants}
      initial={animate ? "hidden" : "show"}
      animate="show"
    >
      {/* Timeline connector */}
      <div className="absolute left-2.5 top-0 bottom-0 w-0.5 bg-gray-200"></div>
      
      {sortedEvents.map((event, index) => {
        const isLastItem = index === sortedEvents.length - 1;
        
        // Animated connector for in-between items
        const ConnectorLine = () => {
          if (isLastItem) return null;
          
          const nextEvent = sortedEvents[index + 1];
          const statusColor = getStatusColor(event.status);
          
          return animate ? (
            <motion.div 
              className={`absolute left-2.5 w-0.5 ${statusColor}`}
              style={{ top: 24, bottom: 0 }}
              initial={{ height: 0 }}
              animate={{ height: '100%' }}
              transition={{ duration: 0.5, delay: 0.3 }}
            />
          ) : (
            <div 
              className={`absolute left-2.5 w-0.5 ${statusColor}`}
              style={{ top: 24, bottom: 0 }}
            />
          );
        };
        
        return (
          <motion.div 
            key={event.id} 
            className="relative mb-6 last:mb-0"
            variants={itemVariants}
          >
            {/* Status Icon */}
            <div className="absolute left-0 -translate-x-1/2">
              {getStatusIcon(event.status, event.isActive)}
            </div>
            
            {/* Connector Line */}
            <ConnectorLine />
            
            {/* Content Card */}
            <motion.div 
              className={`ml-4 p-3 rounded-lg border ${getStatusBgColor(event.status)}`}
              whileHover={{ x: 3, transition: { duration: 0.2 } }}
            >
              <h4 className="text-sm font-medium">{event.title}</h4>
              {event.description && (
                <p className="text-xs text-gray-600 mt-1">{event.description}</p>
              )}
              <p className="text-xs text-gray-500 mt-2">{formatDate(event.timestamp)}</p>
            </motion.div>
          </motion.div>
        );
      })}
    </motion.div>
  );
}