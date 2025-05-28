import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Award, 
  Zap, 
  CreditCard, 
  ArrowUpCircle, 
  Phone, 
  Tv, 
  User, 
  Calendar,
  LucideIcon
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardTitle 
} from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';

export type AchievementType = 
  | 'transactions' 
  | 'referrals' 
  | 'recharges' 
  | 'funds' 
  | 'transfers' 
  | 'streak' 
  | 'milestone'
  | 'new-user';

export interface AchievementProps {
  type: AchievementType;
  title: string;
  description: string;
  icon?: React.ReactNode;
  level?: 'bronze' | 'silver' | 'gold' | 'platinum';
  unlocked?: boolean;
  progress?: number; // 0-100
  className?: string;
  size?: 'sm' | 'md' | 'lg';
  animate?: boolean;
}

const badgeColors = {
  bronze: {
    bg: 'bg-gradient-to-br from-amber-700 to-amber-800',
    border: 'border-amber-600',
    glow: 'rgba(180, 83, 9, 0.5)',
    text: 'text-amber-50'
  },
  silver: {
    bg: 'bg-gradient-to-br from-gray-300 to-gray-400',
    border: 'border-gray-200',
    glow: 'rgba(156, 163, 175, 0.5)',
    text: 'text-gray-800'
  },
  gold: {
    bg: 'bg-gradient-to-br from-yellow-400 to-yellow-500',
    border: 'border-yellow-300',
    glow: 'rgba(252, 211, 77, 0.7)',
    text: 'text-yellow-900'
  },
  platinum: {
    bg: 'bg-gradient-to-br from-sky-400 to-indigo-500',
    border: 'border-blue-400',
    glow: 'rgba(59, 130, 246, 0.7)',
    text: 'text-white'
  }
};

const achievementIcons: Record<AchievementType, LucideIcon> = {
  'transactions': CreditCard,
  'referrals': User,
  'recharges': Phone,
  'funds': ArrowUpCircle,
  'transfers': Zap,
  'streak': Calendar,
  'milestone': Award,
  'new-user': User
};

export function AchievementBadge({
  type,
  title,
  description,
  icon,
  level = 'bronze',
  unlocked = false,
  progress = unlocked ? 100 : 0,
  className,
  size = 'md',
  animate = true
}: AchievementProps) {
  const [isHovered, setIsHovered] = useState(false);

  const IconComponent = achievementIcons[type];
  const CustomIcon = icon ? icon : <IconComponent />;
  
  const sizeClasses = {
    sm: "w-12 h-12",
    md: "w-16 h-16",
    lg: "w-24 h-24"
  };
  
  const iconSizes = {
    sm: 16,
    md: 24,
    lg: 36
  };

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div 
            className={cn("relative inline-flex flex-col items-center", className)}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
          >
            <div className="relative">
              <motion.div
                className={cn(
                  "relative flex items-center justify-center rounded-full border-2",
                  badgeColors[level].bg,
                  badgeColors[level].border,
                  sizeClasses[size],
                  unlocked ? "opacity-100" : "opacity-40 grayscale"
                )}
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.95 }}
                style={{
                  boxShadow: unlocked ? `0 0 15px ${badgeColors[level].glow}` : 'none'
                }}
              >
                <div className={cn(
                  "text-white w-full h-full flex items-center justify-center",
                  badgeColors[level].text
                )}>
                  {CustomIcon}
                </div>
                
                {animate && unlocked && (
                  <AnimatePresence>
                    {isHovered && (
                      <motion.div
                        className="absolute inset-0 rounded-full"
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 1.2 }}
                        style={{
                          background: `radial-gradient(circle, ${badgeColors[level].glow} 0%, rgba(255,255,255,0) 70%)`,
                          zIndex: -1
                        }}
                      />
                    )}
                  </AnimatePresence>
                )}
              </motion.div>
              
              {!unlocked && progress > 0 && progress < 100 && (
                <div className="absolute -bottom-2 left-1/2 transform -translate-x-1/2 w-full px-1">
                  <Progress value={progress} className="h-1.5 w-full" />
                </div>
              )}
              
              {unlocked && (
                <motion.div 
                  className="absolute -top-1 -right-1 bg-green-500 rounded-full border-2 border-white"
                  initial={animate ? { scale: 0 } : false}
                  animate={animate ? { scale: 1 } : false}
                  transition={{ type: "spring", delay: 0.2 }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                    <path d="M5 13l4 4L19 7" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </motion.div>
              )}
            </div>
            
            {size !== 'sm' && (
              <span className={cn(
                "mt-2 text-xs font-medium text-center max-w-[80px] truncate",
                unlocked ? "text-foreground" : "text-muted-foreground"
              )}>
                {title}
              </span>
            )}
          </div>
        </TooltipTrigger>
        <TooltipContent side="bottom" align="center" className="p-0 overflow-hidden w-64">
          <Card className="border-none shadow-none">
            <CardContent className="p-4">
              <CardTitle className="text-base mb-1 flex items-center gap-2">
                <span className={cn(
                  "inline-flex p-1.5 rounded-full",
                  badgeColors[level].bg
                )}>
                  <IconComponent size={16} className={badgeColors[level].text} />
                </span>
                {title}
              </CardTitle>
              <CardDescription className="text-xs mt-1">
                {description}
              </CardDescription>
              
              {!unlocked && progress > 0 && (
                <div className="mt-3">
                  <div className="text-xs text-muted-foreground mb-1 flex justify-between">
                    <span>Progress</span>
                    <span>{progress}%</span>
                  </div>
                  <Progress value={progress} className="h-1.5" />
                </div>
              )}
              
              {unlocked && (
                <div className="mt-2 text-xs px-2 py-1 bg-green-100 text-green-800 rounded-md inline-flex items-center">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" className="mr-1">
                    <path d="M5 13l4 4L19 7" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                  Unlocked
                </div>
              )}
            </CardContent>
          </Card>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}