import { clsx } from 'clsx';
import type { Tag } from '../api/types';

interface TagBadgeProps {
  tag: Tag;
  size?: 'sm' | 'md';
  onRemove?: () => void;
}

export default function TagBadge({ tag, size = 'md', onRemove }: TagBadgeProps) {
  return (
    <span
      className={clsx(
        'inline-flex items-center gap-1 rounded-full font-medium',
        {
          'px-2 py-0.5 text-xs': size === 'sm',
          'px-2.5 py-1 text-xs': size === 'md',
        }
      )}
      style={{
        backgroundColor: `${tag.color}20`,
        color: tag.color,
      }}
    >
      {tag.name}
      {onRemove && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          className="ml-1 hover:opacity-70"
        >
          ×
        </button>
      )}
    </span>
  );
}
