'use client';

import * as LucideIcons from 'lucide-react';
import { type LucideIcon } from 'lucide-react';
import * as React from 'react';

/**
 * Icon Component - Centralized icon wrapper for optimal tree-shaking
 *
 * This component provides:
 * 1. Type-safe icon selection
 * 2. Consistent icon sizing via className
 * 3. Single point for icon optimization
 * 4. Support for all lucide-react icons
 *
 * @example
 * <Icon name="Bell" className="w-5 h-5" />
 * <Icon name="ChevronDown" className="w-4 h-4" />
 */

interface IconProps extends React.SVGAttributes<SVGElement> {
  name: keyof typeof LucideIcons;
  className?: string;
  size?: number | string;
}

export function Icon({ name, className = '', size, ...props }: IconProps) {
  const IconComponent = LucideIcons[name] as LucideIcon;

  if (!IconComponent) {
    console.warn(`Icon "${name}" not found in lucide-react`);
    return null;
  }

  return <IconComponent className={className} width={size} height={size} {...props} />;
}

/**
 * Common icon presets for consistent sizing
 */
export const iconSizes = {
  xs: 'w-3 h-3',
  sm: 'w-4 h-4',
  md: 'w-5 h-5',
  lg: 'w-6 h-6',
  xl: 'w-8 h-8',
} as const;

/**
 * Helper function to get icon size className
 */
export function getIconSize(size: keyof typeof iconSizes = 'md'): string {
  return iconSizes[size];
}
