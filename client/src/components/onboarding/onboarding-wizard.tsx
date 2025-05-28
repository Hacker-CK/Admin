import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Card, 
  CardContent, 
  CardFooter, 
  CardHeader, 
  CardTitle, 
  CardDescription 
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { 
  ChevronRight, 
  ChevronLeft, 
  CheckCircle,
  X
} from 'lucide-react';
import { cn } from '@/lib/utils';

export interface OnboardingStep {
  id: string;
  title: string;
  description?: string;
  content: React.ReactNode;
  optional?: boolean;
  completionCriteria?: () => boolean | Promise<boolean>;
}

interface OnboardingWizardProps {
  steps: OnboardingStep[];
  onComplete?: () => void;
  onSkip?: () => void;
  onStepChange?: (stepIndex: number, stepId: string) => void;
  showProgressBar?: boolean;
  showStepIndicators?: boolean;
  allowSkip?: boolean;
  className?: string;
  highlightColor?: string;
  userName?: string;
  showCloseButton?: boolean;
  onClose?: () => void;
  startAtStep?: number;
  title?: string;
  subtitle?: string;
}

export function OnboardingWizard({
  steps,
  onComplete,
  onSkip,
  onStepChange,
  showProgressBar = true,
  showStepIndicators = true,
  allowSkip = true,
  className,
  highlightColor = 'var(--primary)',
  userName,
  showCloseButton = true,
  onClose,
  startAtStep = 0,
  title = 'Welcome to RechargeBox',
  subtitle = 'Let\'s get you started with a quick tour',
}: OnboardingWizardProps) {
  const [currentStep, setCurrentStep] = useState(startAtStep);
  const [stepStates, setStepStates] = useState<Array<'incomplete' | 'complete' | 'skipped'>>(
    steps.map(() => 'incomplete')
  );
  const [isAnimating, setIsAnimating] = useState(false);

  useEffect(() => {
    // Call onStepChange when the step changes
    if (onStepChange) {
      onStepChange(currentStep, steps[currentStep].id);
    }
  }, [currentStep, onStepChange, steps]);

  const handleNext = async () => {
    if (isAnimating) return;
    
    const currentStepData = steps[currentStep];
    
    // Check completion criteria if defined
    if (currentStepData.completionCriteria) {
      const isComplete = await currentStepData.completionCriteria();
      if (!isComplete) {
        // Maybe show a message to the user that they need to complete this step
        return;
      }
    }
    
    // Mark current step as complete
    const newStepStates = [...stepStates];
    newStepStates[currentStep] = 'complete';
    setStepStates(newStepStates);
    
    if (currentStep < steps.length - 1) {
      setIsAnimating(true);
      setCurrentStep(currentStep + 1);
      setTimeout(() => setIsAnimating(false), 300);
    } else {
      // All steps completed
      if (onComplete) {
        onComplete();
      }
    }
  };

  const handleBack = () => {
    if (isAnimating || currentStep === 0) return;
    setIsAnimating(true);
    setCurrentStep(currentStep - 1);
    setTimeout(() => setIsAnimating(false), 300);
  };

  const handleSkip = () => {
    const newStepStates = [...stepStates];
    newStepStates[currentStep] = 'skipped';
    setStepStates(newStepStates);
    
    if (currentStep < steps.length - 1) {
      setIsAnimating(true);
      setCurrentStep(currentStep + 1);
      setTimeout(() => setIsAnimating(false), 300);
    } else {
      // All steps completed (some might be skipped)
      if (onComplete) {
        onComplete();
      }
      if (onSkip) {
        onSkip();
      }
    }
  };
  
  const handleClose = () => {
    if (onClose) {
      onClose();
    }
  };

  const progress = ((currentStep + 1) / steps.length) * 100;
  
  return (
    <Card className={cn("w-full max-w-lg mx-auto overflow-hidden", className)}>
      <CardHeader className="relative pb-2">
        {showCloseButton && (
          <Button 
            variant="ghost" 
            size="icon" 
            className="absolute right-2 top-2" 
            onClick={handleClose}
          >
            <X size={16} />
          </Button>
        )}
        <CardTitle className="text-xl">
          {userName ? `${title}, ${userName}!` : title}
        </CardTitle>
        <CardDescription>{subtitle}</CardDescription>
        
        {showProgressBar && (
          <Progress 
            value={progress} 
            className="h-2 mt-2" 
            style={{
              '--progress-background': highlightColor
            } as React.CSSProperties}
          />
        )}
      </CardHeader>
      
      <CardContent className="px-6 pb-0">
        {showStepIndicators && (
          <div className="flex justify-center mb-6 gap-1.5">
            {steps.map((_, i) => (
              <div 
                key={i}
                className={cn(
                  "w-2 h-2 rounded-full transition-colors duration-300",
                  i < currentStep 
                    ? "bg-primary" 
                    : i === currentStep 
                      ? "bg-primary" 
                      : "bg-gray-200"
                )}
              />
            ))}
          </div>
        )}
        
        <AnimatePresence mode="wait">
          <motion.div
            key={currentStep}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.3 }}
            className="min-h-[200px]"
          >
            <div className="step-content">
              <h3 className="text-lg font-medium mb-2">{steps[currentStep].title}</h3>
              {steps[currentStep].description && (
                <p className="text-sm text-muted-foreground mb-4">{steps[currentStep].description}</p>
              )}
              {steps[currentStep].content}
            </div>
          </motion.div>
        </AnimatePresence>
      </CardContent>
      
      <CardFooter className="flex justify-between pt-6 pb-6">
        <Button 
          variant="outline" 
          onClick={handleBack} 
          disabled={currentStep === 0}
          className="gap-1"
        >
          <ChevronLeft size={16} />
          Back
        </Button>
        
        <div className="flex gap-2">
          {allowSkip && steps[currentStep].optional && (
            <Button variant="ghost" onClick={handleSkip}>
              Skip
            </Button>
          )}
          <Button onClick={handleNext} className="gap-1">
            {currentStep === steps.length - 1 ? (
              <>
                Complete
                <CheckCircle size={16} />
              </>
            ) : (
              <>
                Next
                <ChevronRight size={16} />
              </>
            )}
          </Button>
        </div>
      </CardFooter>
    </Card>
  );
}