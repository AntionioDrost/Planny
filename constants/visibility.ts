import type { VisibilityLevel } from '@/types/domain';

export const VISIBILITY_LEVELS: VisibilityLevel[] = ['hidden', 'busy_only', 'title_only', 'full_details'];

export const VISIBILITY_LABELS: Record<VisibilityLevel, string> = {
  hidden: 'Hidden',
  busy_only: 'Busy only',
  title_only: 'Title only',
  full_details: 'Full details',
};
