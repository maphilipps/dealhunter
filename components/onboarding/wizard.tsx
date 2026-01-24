/**
 * Onboarding Wizard Component
 *
 * Multi-step wizard for user onboarding with progress indicator.
 * Used to guide new users through initial setup and feature discovery.
 */

'use client';

import { Check, ChevronLeft, ChevronRight } from 'lucide-react';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';

export interface WizardStep {
  id: string;
  title: string;
  description?: string;
  icon?: React.ReactNode;
  content: React.ReactNode;
  optional?: boolean;
}

export interface OnboardingWizardProps {
  steps: WizardStep[];
  onComplete: () => void;
  onSkip?: () => void;
  showSkip?: boolean;
  className?: string;
}

export function OnboardingWizard({
  steps,
  onComplete,
  onSkip,
  showSkip = true,
  className,
}: OnboardingWizardProps) {
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const currentStep = steps[currentStepIndex];
  const progress = ((currentStepIndex + 1) / steps.length) * 100;
  const isFirstStep = currentStepIndex === 0;
  const isLastStep = currentStepIndex === steps.length - 1;

  const handleNext = () => {
    if (isLastStep) {
      onComplete();
    } else {
      setCurrentStepIndex(prev => prev + 1);
    }
  };

  const handlePrev = () => {
    if (!isFirstStep) {
      setCurrentStepIndex(prev => prev - 1);
    }
  };

  const handleSkip = () => {
    if (onSkip) {
      onSkip();
    }
  };

  return (
    <Card className={cn('w-full max-w-3xl mx-auto', className)}>
      <CardHeader>
        <div className="flex items-center justify-between mb-4">
          <div>
            <CardTitle>
              {currentStep.icon && (
                <span className="inline-flex items-center gap-2">
                  {currentStep.icon}
                  {currentStep.title}
                </span>
              )}
              {!currentStep.icon && currentStep.title}
            </CardTitle>
            {currentStep.description && (
              <CardDescription className="mt-2">{currentStep.description}</CardDescription>
            )}
          </div>
          {showSkip && !isLastStep && (
            <Button variant="ghost" size="sm" onClick={handleSkip}>
              Skip Tour
            </Button>
          )}
        </div>

        {/* Progress Bar */}
        <div className="space-y-2">
          <Progress value={progress} className="h-2" />
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>
              Step {currentStepIndex + 1} of {steps.length}
            </span>
            <span>{Math.round(progress)}% complete</span>
          </div>
        </div>

        {/* Step Indicators */}
        <div className="flex items-center gap-2 mt-4">
          {steps.map((step, idx) => {
            const isCompleted = idx < currentStepIndex;
            const isCurrent = idx === currentStepIndex;

            return (
              <button
                key={step.id}
                onClick={() => setCurrentStepIndex(idx)}
                className={cn(
                  'flex h-8 w-8 items-center justify-center rounded-full text-xs font-medium transition-colors',
                  isCompleted && 'bg-primary text-primary-foreground hover:bg-primary/90',
                  isCurrent &&
                    'bg-primary text-primary-foreground ring-2 ring-primary ring-offset-2',
                  !isCompleted && !isCurrent && 'bg-muted text-muted-foreground hover:bg-muted/80'
                )}
                disabled={idx > currentStepIndex}
              >
                {isCompleted ? <Check className="h-4 w-4" /> : idx + 1}
              </button>
            );
          })}
        </div>
      </CardHeader>

      <CardContent>
        {/* Step Content */}
        <div className="min-h-[300px] py-6">{currentStep.content}</div>

        {/* Navigation */}
        <div className="flex items-center justify-between pt-6 border-t">
          <Button variant="outline" onClick={handlePrev} disabled={isFirstStep} className="gap-2">
            <ChevronLeft className="h-4 w-4" />
            Previous
          </Button>

          <Button onClick={handleNext} className="gap-2">
            {isLastStep ? 'Finish' : 'Next'}
            {!isLastStep && <ChevronRight className="h-4 w-4" />}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
