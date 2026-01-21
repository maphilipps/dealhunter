import { Badge } from '@/components/ui/badge';

interface ConfidenceIndicatorProps {
  confidence: number; // 0-100
  showLabel?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

/**
 * TRANS-005: Confidence Indicator
 * Visual display of agent confidence levels
 * - Green: 80%+ (high confidence)
 * - Yellow: 60-79% (medium confidence)
 * - Red: <60% (low confidence)
 *
 * Best practice: Simple, pure component (no state)
 */
export function ConfidenceIndicator({
  confidence,
  showLabel = true,
  size = 'md',
}: ConfidenceIndicatorProps) {
  // Determine color based on confidence level
  const getConfidenceColor = () => {
    if (confidence >= 80) return 'green';
    if (confidence >= 60) return 'yellow';
    return 'red';
  };

  const color = getConfidenceColor();

  const getColorClasses = () => {
    switch (color) {
      case 'green':
        return 'bg-green-500';
      case 'yellow':
        return 'bg-yellow-500';
      case 'red':
        return 'bg-red-500';
      default:
        return 'bg-gray-500';
    }
  };

  const getTextColor = () => {
    switch (color) {
      case 'green':
        return 'text-green-700';
      case 'yellow':
        return 'text-yellow-700';
      case 'red':
        return 'text-red-700';
      default:
        return 'text-gray-700';
    }
  };

  const getBadgeVariant = (): 'default' | 'secondary' | 'destructive' | 'outline' => {
    switch (color) {
      case 'green':
        return 'default';
      case 'yellow':
        return 'secondary';
      case 'red':
        return 'destructive';
      default:
        return 'outline';
    }
  };

  const sizeClasses = {
    sm: 'h-1.5',
    md: 'h-2',
    lg: 'h-3',
  };

  const confidenceText = confidence >= 80 ? 'High' : confidence >= 60 ? 'Medium' : 'Low';

  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 min-w-[60px] bg-gray-200 rounded-full overflow-hidden">
        <div
          className={`${sizeClasses[size]} ${getColorClasses()} transition-all duration-300`}
          style={{ width: `${confidence}%` }}
        />
      </div>
      {showLabel && (
        <div className="flex items-center gap-2">
          <span className={`text-sm font-medium tabular-nums ${getTextColor()}`}>
            {confidence}%
          </span>
          <Badge variant={getBadgeVariant()} className="text-xs">
            {confidenceText}
          </Badge>
        </div>
      )}
    </div>
  );
}
