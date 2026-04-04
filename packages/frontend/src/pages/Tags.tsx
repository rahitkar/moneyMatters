import { useState } from 'react';
import { Plus, Trash2, Edit2, Tag as TagIcon, Wallet } from 'lucide-react';
import { clsx } from 'clsx';
import Card from '../components/Card';
import Modal from '../components/Modal';
import { LoadingPage } from '../components/LoadingSpinner';
import EmptyState from '../components/EmptyState';
import TagBadge from '../components/TagBadge';
import AssetClassBadge from '../components/AssetClassBadge';
import {
  useTagsWithCounts,
  useCreateTag,
  useUpdateTag,
  useDeleteTag,
  useExchangeRate,
} from '../api/hooks';
import { formatCurrency } from '../lib/format';
import CurrencyValue, { toInr } from '../components/CurrencyValue';
import type { Tag, TagWithCount, HoldingWithValue } from '../api/types';
import { api } from '../api/client';
import { useQuery } from '@tanstack/react-query';

const PRESET_COLORS = [
  '#ef4444', // red
  '#f97316', // orange
  '#eab308', // yellow
  '#22c55e', // green
  '#06b6d4', // cyan
  '#3b82f6', // blue
  '#6366f1', // indigo
  '#a855f7', // purple
  '#ec4899', // pink
  '#71717a', // gray
];

export default function Tags() {
  const { data: tags, isLoading } = useTagsWithCounts();
  const { data: usdInrRate } = useExchangeRate('USD', 'INR');
  const usdToInr = usdInrRate?.rate ?? null;
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingTag, setEditingTag] = useState<TagWithCount | null>(null);
  const [selectedTagId, setSelectedTagId] = useState<string | null>(null);

  if (isLoading) {
    return <LoadingPage />;
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-surface-100">Tags</h1>
        <button
          onClick={() => setIsAddModalOpen(true)}
          className="btn btn-primary"
        >
          <Plus className="w-4 h-4" />
          Create Tag
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Tags List */}
        <div className="lg:col-span-1 space-y-4">
          <Card>
            <h2 className="text-lg font-semibold text-surface-100 mb-4">
              Your Tags
            </h2>
            {tags && tags.length > 0 ? (
              <div className="space-y-2">
                {tags.map((tag) => (
                  <TagItem
                    key={tag.id}
                    tag={tag}
                    isSelected={selectedTagId === tag.id}
                    onSelect={() =>
                      setSelectedTagId(selectedTagId === tag.id ? null : tag.id)
                    }
                    onEdit={() => setEditingTag(tag)}
                  />
                ))}
              </div>
            ) : (
              <EmptyState
                icon={TagIcon}
                title="No tags yet"
                description="Create tags to categorize your assets (e.g., Retirement, Emergency Fund, High Risk)."
                action={
                  <button
                    onClick={() => setIsAddModalOpen(true)}
                    className="btn btn-primary text-sm"
                  >
                    <Plus className="w-4 h-4" />
                    Create Tag
                  </button>
                }
              />
            )}
          </Card>
        </div>

        {/* Tag Details / View */}
        <div className="lg:col-span-2">
          {selectedTagId ? (
            <TagHoldingsView tagId={selectedTagId} tags={tags || []} usdToInr={usdToInr} />
          ) : (
            <Card>
              <EmptyState
                icon={Wallet}
                title="Select a tag"
                description="Click on a tag to view the holdings associated with it."
              />
            </Card>
          )}
        </div>
      </div>

      {/* Add/Edit Modal */}
      <TagModal
        isOpen={isAddModalOpen || !!editingTag}
        onClose={() => {
          setIsAddModalOpen(false);
          setEditingTag(null);
        }}
        tag={editingTag}
      />
    </div>
  );
}

function TagItem({
  tag,
  isSelected,
  onSelect,
  onEdit,
}: {
  tag: TagWithCount;
  isSelected: boolean;
  onSelect: () => void;
  onEdit: () => void;
}) {
  const deleteTag = useDeleteTag();

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm(`Delete tag "${tag.name}"? This won't delete the assets.`)) {
      deleteTag.mutate(tag.id);
    }
  };

  return (
    <button
      onClick={onSelect}
      className={clsx(
        'w-full p-3 rounded-xl text-left transition-all flex items-center justify-between group',
        isSelected
          ? 'bg-surface-700/50 border border-surface-600'
          : 'bg-surface-800/30 hover:bg-surface-800/50 border border-transparent'
      )}
    >
      <div className="flex items-center gap-3">
        <div
          className="w-4 h-4 rounded-full"
          style={{ backgroundColor: tag.color }}
        />
        <div>
          <p className="font-medium text-surface-100">{tag.name}</p>
          <p className="text-xs text-surface-500">
            {tag.assetCount} asset{tag.assetCount !== 1 ? 's' : ''}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          onClick={(e) => {
            e.stopPropagation();
            onEdit();
          }}
          className="p-1.5 rounded-lg text-surface-400 hover:text-surface-100 hover:bg-surface-700/50"
        >
          <Edit2 className="w-3 h-3" />
        </button>
        <button
          onClick={handleDelete}
          disabled={deleteTag.isPending}
          className="p-1.5 rounded-lg text-surface-400 hover:text-red-400 hover:bg-red-500/10"
        >
          <Trash2 className="w-3 h-3" />
        </button>
      </div>
    </button>
  );
}

function TagHoldingsView({
  tagId,
  tags,
  usdToInr,
}: {
  tagId: string;
  tags: TagWithCount[];
  usdToInr: number | null;
}) {
  const tag = tags.find((t) => t.id === tagId);
  const { data: holdings, isLoading } = useQuery({
    queryKey: ['portfolio', 'holdings', 'tag', tagId],
    queryFn: () =>
      api
        .get<{ holdings: HoldingWithValue[] }>(`/portfolio/holdings/tag/${tagId}`)
        .then((r) => r.holdings),
  });

  if (isLoading) {
    return (
      <Card>
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full w-8 h-8 border-2 border-surface-600 border-t-brand-500" />
        </div>
      </Card>
    );
  }

  if (!tag) return null;

  const totalValue = holdings?.reduce((sum, h) => sum + toInr(h.currentValue, h.currency || 'INR', usdToInr), 0) || 0;
  const totalGain = holdings?.reduce((sum, h) => sum + toInr(h.gain, h.currency || 'INR', usdToInr), 0) || 0;
  const isPositive = totalGain >= 0;

  return (
    <Card>
      <div className="flex items-center gap-4 mb-6">
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center"
          style={{ backgroundColor: `${tag.color}20` }}
        >
          <TagIcon className="w-5 h-5" style={{ color: tag.color }} />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-surface-100">{tag.name}</h2>
          {tag.description && (
            <p className="text-sm text-surface-400">{tag.description}</p>
          )}
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="p-4 rounded-xl bg-surface-800/50">
          <p className="text-sm text-surface-400">Holdings</p>
          <p className="text-xl font-semibold text-surface-100">
            {holdings?.length || 0}
          </p>
        </div>
        <div className="p-4 rounded-xl bg-surface-800/50">
          <p className="text-sm text-surface-400">Total Value</p>
          <p className="text-xl font-semibold text-surface-100">
            {formatCurrency(totalValue, 'INR')}
          </p>
          {usdToInr && (
            <p className="text-[10px] text-surface-500 mt-0.5">{formatCurrency(totalValue / usdToInr, 'USD')}</p>
          )}
        </div>
        <div className="p-4 rounded-xl bg-surface-800/50">
          <p className="text-sm text-surface-400">Total P&L</p>
          <p
            className={clsx(
              'text-xl font-semibold',
              isPositive ? 'text-green-400' : 'text-red-400'
            )}
          >
            {isPositive ? '+' : ''}
            {formatCurrency(totalGain, 'INR')}
          </p>
          {usdToInr && (
            <p className={clsx('text-[10px] mt-0.5', isPositive ? 'text-green-400/60' : 'text-red-400/60')}>
              {isPositive ? '+' : ''}{formatCurrency(totalGain / usdToInr, 'USD')}
            </p>
          )}
        </div>
      </div>

      {/* Holdings List */}
      {holdings && holdings.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-surface-700">
                <th className="table-header">Asset</th>
                <th className="table-header text-right">Value</th>
                <th className="table-header text-right">P&L</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-800">
              {holdings.map((holding) => (
                <tr
                  key={holding.id}
                  className="hover:bg-surface-800/30 transition-colors"
                >
                  <td className="table-cell">
                    <div className="flex items-center gap-2">
                      <div>
                        <p className="font-medium text-surface-100">
                          {holding.symbol}
                        </p>
                        <p className="text-xs text-surface-500">{holding.name}</p>
                      </div>
                      <AssetClassBadge assetClass={holding.assetClass} size="sm" />
                    </div>
                  </td>
                  <td className="table-cell text-right tabular-nums">
                    <CurrencyValue value={holding.currentValue} currency={holding.currency || 'INR'} usdToInr={usdToInr} />
                  </td>
                  <td
                    className={clsx(
                      'table-cell text-right tabular-nums',
                      holding.gain >= 0 ? 'text-green-400' : 'text-red-400'
                    )}
                  >
                    <CurrencyValue value={holding.gain} currency={holding.currency || 'INR'} usdToInr={usdToInr} sign />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="text-surface-500 text-center py-8">
          No holdings with this tag yet.
        </p>
      )}
    </Card>
  );
}

function TagModal({
  isOpen,
  onClose,
  tag,
}: {
  isOpen: boolean;
  onClose: () => void;
  tag: TagWithCount | null;
}) {
  const isEditing = !!tag;
  const createTag = useCreateTag();
  const updateTag = useUpdateTag();

  const [formData, setFormData] = useState({
    name: tag?.name || '',
    color: tag?.color || PRESET_COLORS[0],
    description: tag?.description || '',
  });

  // Reset form when tag changes
  useState(() => {
    if (tag) {
      setFormData({
        name: tag.name,
        color: tag.color,
        description: tag.description || '',
      });
    } else {
      setFormData({
        name: '',
        color: PRESET_COLORS[Math.floor(Math.random() * PRESET_COLORS.length)],
        description: '',
      });
    }
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      if (isEditing) {
        await updateTag.mutateAsync({
          id: tag.id,
          name: formData.name,
          color: formData.color,
          description: formData.description || undefined,
        });
      } else {
        await createTag.mutateAsync({
          name: formData.name,
          color: formData.color,
          description: formData.description || undefined,
        });
      }
      onClose();
    } catch (error) {
      // Error handled by mutation
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isEditing ? 'Edit Tag' : 'Create Tag'}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="label">Name</label>
          <input
            type="text"
            value={formData.name}
            onChange={(e) =>
              setFormData((f) => ({ ...f, name: e.target.value }))
            }
            className="input"
            placeholder="e.g., Retirement, Emergency Fund"
            required
            maxLength={50}
          />
        </div>

        <div>
          <label className="label">Color</label>
          <div className="flex flex-wrap gap-2">
            {PRESET_COLORS.map((color) => (
              <button
                key={color}
                type="button"
                onClick={() => setFormData((f) => ({ ...f, color }))}
                className={clsx(
                  'w-8 h-8 rounded-lg transition-all',
                  formData.color === color
                    ? 'ring-2 ring-white ring-offset-2 ring-offset-surface-800'
                    : 'hover:scale-110'
                )}
                style={{ backgroundColor: color }}
              />
            ))}
          </div>
          <div className="mt-3 flex items-center gap-2">
            <input
              type="color"
              value={formData.color}
              onChange={(e) =>
                setFormData((f) => ({ ...f, color: e.target.value }))
              }
              className="w-8 h-8 rounded cursor-pointer"
            />
            <span className="text-sm text-surface-400">Custom color</span>
          </div>
        </div>

        <div>
          <label className="label">Description (optional)</label>
          <textarea
            value={formData.description}
            onChange={(e) =>
              setFormData((f) => ({ ...f, description: e.target.value }))
            }
            className="input min-h-[80px]"
            placeholder="What is this tag for?"
            maxLength={200}
          />
        </div>

        {/* Preview */}
        <div className="p-4 rounded-xl bg-surface-800/50">
          <p className="text-sm text-surface-400 mb-2">Preview</p>
          <TagBadge
            tag={{
              id: 'preview',
              name: formData.name || 'Tag Name',
              color: formData.color,
              description: formData.description,
              createdAt: new Date().toISOString(),
            }}
          />
        </div>

        <div className="flex justify-end gap-3 pt-4 border-t border-surface-700">
          <button type="button" onClick={onClose} className="btn btn-secondary">
            Cancel
          </button>
          <button
            type="submit"
            disabled={createTag.isPending || updateTag.isPending}
            className="btn btn-primary"
          >
            {createTag.isPending || updateTag.isPending
              ? 'Saving...'
              : isEditing
              ? 'Update'
              : 'Create Tag'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
