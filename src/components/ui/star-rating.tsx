import { Star } from 'lucide-react';
import { cn } from '@/lib/utils';

interface StarRatingProps {
  rating: number;
  maxRating?: number;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  showRating?: boolean;
}

export function StarRating({
  rating,
  maxRating = 5,
  size = 'sm',
  className,
  showRating = false,
}: StarRatingProps) {
  const sizeClasses = {
    sm: 'w-3 h-3',
    md: 'w-4 h-4',
    lg: 'w-5 h-5',
  };

  const stars = Array.from({ length: maxRating }, (_, index) => {
    const isFilled = index < rating;
    return (
      <Star
        key={index}
        className={cn(
          sizeClasses[size],
          isFilled ? 'fill-yellow-400 text-yellow-400' : 'fill-gray-200 text-gray-200'
        )}
      />
    );
  });

  return (
    <div className={cn('flex items-center gap-0.5', className)}>
      {stars}
      {showRating && (
        <span className="ml-1 text-xs text-gray-600">
          {rating}/{maxRating}
        </span>
      )}
    </div>
  );
}
