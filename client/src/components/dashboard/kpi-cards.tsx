import { User, Users, DollarSign, RefreshCw, Share2, PhoneCall, Plus, ArrowUpRight, Gift, Clock, AlertCircle, RotateCcw, IndianRupee } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import { CurrencyDisplay } from '@/components/ui/currency-display';
import { motion } from 'framer-motion';

interface KPIMetric {
  title: string;
  value: string | number;
  changePercentage: number;
  icon: 'users' | 'revenue' | 'transactions' | 'referrals' | 'recharge' | 'addFund' | 'transfer' | 'cashback' | 'pending' | 'failed' | 'refund' | 'walletBalance' | 'indianRevenue';
}

interface KPIMetricsRowProps {
  metrics: KPIMetric[];
  isLoading?: boolean;
}

export default function KPIMetricsRow({ metrics, isLoading = false }: KPIMetricsRowProps) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6 mb-6">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="kpi-card animate-pulse">
            <div className="h-10 w-10 sm:h-12 sm:w-12 rounded-full bg-gray-200"></div>
            <div className="ml-3 sm:ml-4 flex-1">
              <div className="h-4 w-24 bg-gray-200 rounded mb-2"></div>
              <div className="h-5 sm:h-6 w-16 sm:w-24 bg-gray-200 rounded"></div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  const getIconComponent = (iconType: string) => {
    switch (iconType) {
      case 'users':
        return <Users className="h-5 w-5 sm:h-6 sm:w-6" />;
      case 'revenue':
        return <DollarSign className="h-5 w-5 sm:h-6 sm:w-6" />;
      case 'indianRevenue':
        return <IndianRupee className="h-5 w-5 sm:h-6 sm:w-6" />; // Indian Rupee icon for revenue
      case 'walletBalance':
        return <IndianRupee className="h-5 w-5 sm:h-6 sm:w-6" />; // Indian Rupee icon for wallet balance
      case 'transactions':
        return <RefreshCw className="h-5 w-5 sm:h-6 sm:w-6" />;
      case 'referrals':
        return <Share2 className="h-5 w-5 sm:h-6 sm:w-6" />;
      case 'recharge':
        return <PhoneCall className="h-5 w-5 sm:h-6 sm:w-6" />;
      case 'addFund':
        return <Plus className="h-5 w-5 sm:h-6 sm:w-6" />;
      case 'transfer':
        return <ArrowUpRight className="h-5 w-5 sm:h-6 sm:w-6" />;
      case 'cashback':
        return <Gift className="h-5 w-5 sm:h-6 sm:w-6" />; // Using Gift icon for cashback
      case 'pending':
        return <Clock className="h-5 w-5 sm:h-6 sm:w-6" />; // Clock icon for pending
      case 'failed':
        return <AlertCircle className="h-5 w-5 sm:h-6 sm:w-6" />; // Alert icon for failed
      case 'refund':
        return <RotateCcw className="h-5 w-5 sm:h-6 sm:w-6" />; // Rotate counter-clockwise icon for refunds
      default:
        return <User className="h-5 w-5 sm:h-6 sm:w-6" />;
    }
  };

  const getIconBackground = (iconType: string) => {
    switch (iconType) {
      case 'users':
        return 'bg-blue-100 text-primary';
      case 'revenue':
        return 'bg-green-100 text-green-600';
      case 'indianRevenue':
        return 'bg-green-100 text-green-600'; // Same color as revenue
      case 'walletBalance':
        return 'bg-green-100 text-green-600'; // Same green color for wallet balance
      case 'transactions':
        return 'bg-purple-100 text-purple-600';
      case 'referrals':
        return 'bg-orange-100 text-orange-600';
      case 'recharge':
        return 'bg-indigo-100 text-indigo-600';
      case 'addFund':
        return 'bg-emerald-100 text-emerald-600';
      case 'transfer':
        return 'bg-rose-100 text-rose-600';
      case 'cashback':
        return 'bg-amber-100 text-amber-600'; // Special color for cashback
      case 'pending':
        return 'bg-yellow-100 text-yellow-600'; // Yellow for pending
      case 'failed':
        return 'bg-red-100 text-red-600'; // Red for failed
      case 'refund':
        return 'bg-indigo-100 text-indigo-600'; // Indigo for refund (same as status badge)
      default:
        return 'bg-gray-100 text-gray-600';
    }
  };

  const container = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1
      }
    }
  };
  
  const item = {
    hidden: { y: 20, opacity: 0 },
    show: { 
      y: 0, 
      opacity: 1,
      transition: {
        type: "spring",
        stiffness: 260,
        damping: 20
      }
    }
  };

  const countAnimation = {
    hidden: { opacity: 0 },
    show: { 
      opacity: 1,
      transition: {
        delay: 0.3,
        duration: 0.8
      }
    }
  };
  
  return (
    <motion.div 
      className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6 mb-6"
      variants={container}
      initial="hidden"
      animate="show"
    >
      {metrics.map((metric, index) => (
        <motion.div 
          key={index} 
          className="kpi-card"
          variants={item}
          whileHover={{ 
            scale: 1.03,
            boxShadow: "0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)" 
          }}
          transition={{ type: "spring", stiffness: 400, damping: 10 }}
        >
          <motion.div 
            className={`h-10 w-10 sm:h-12 sm:w-12 rounded-full ${getIconBackground(metric.icon)} flex items-center justify-center`}
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring", stiffness: 260, damping: 20, delay: 0.2 }}
          >
            {getIconComponent(metric.icon)}
          </motion.div>
          <div className="ml-3 sm:ml-4 flex-1 overflow-hidden">
            <p className="text-xs sm:text-sm text-gray-500 font-medium truncate">{metric.title}</p>
            <div className="flex items-baseline flex-wrap">
              <motion.div 
                className="text-lg sm:text-xl font-bold truncate max-w-[150px]"
                variants={countAnimation}
              >
                {metric.icon === 'revenue' || metric.icon === 'referrals' || 
                 metric.icon === 'recharge' || metric.icon === 'addFund' || 
                 metric.icon === 'transfer' || metric.icon === 'cashback' ||
                 metric.icon === 'pending' || metric.icon === 'failed' || metric.icon === 'refund' ||
                 metric.icon === 'walletBalance' || metric.icon === 'indianRevenue' ? (
                  <CurrencyDisplay amount={metric.value} />
                ) : (
                  typeof metric.value === 'number' 
                    ? metric.value.toLocaleString() 
                    : metric.value
                )}
              </motion.div>
              <motion.span 
                className={`ml-1 sm:ml-2 text-xs ${metric.changePercentage >= 0 ? 'text-green-600' : 'text-red-500'} font-medium whitespace-nowrap`}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.5 }}
              >
                {metric.changePercentage >= 0 ? '↑' : '↓'} {Math.abs(metric.changePercentage)}%
              </motion.span>
            </div>
          </div>
        </motion.div>
      ))}
    </motion.div>
  );
}
