import { clsx } from 'clsx';
import { X } from 'lucide-react';
import type { Tag } from '../api/types';

interface TagBadgeProps {
  tag: Tag;
  size?: 'sm' | 'md';
  onRemove?: () => void;
}

export default function TagBadge({ tag, size = 'md', onRemove }: TagBadgeProps) {
  const maxChars = size === 'sm' ? 8 : 14;
  const display = tag.name.length > maxChars ? tag.name.slice(0, maxChars - 1) + '…' : tag.name;

  return (
    <span
      className={clsx(
        'relative inline-flex items-center justify-center rounded-md font-medium whitespace-nowrap group/tag border',
        {
          'px-1.5 py-px text-xs leading-4': size === 'sm',
          'px-2 py-0.5 text-xs': size === 'md',
        }
      )}
      style={{
        backgroundColor: `${tag.color}12`,
        color: tag.color,
        borderColor: `${tag.color}30`,
      }}
      title={tag.name}
    >
      {display}
      {onRemove && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          className="absolute -top-1.5 -right-1.5 rounded-full p-0.5 opacity-0 group-hover/tag:opacity-100 transition-all"
          style={{ backgroundColor: tag.color, color: '#18181b' }}
        >
          <X className="w-2.5 h-2.5" />
        </button>
      )}
    </span>
  );
}
