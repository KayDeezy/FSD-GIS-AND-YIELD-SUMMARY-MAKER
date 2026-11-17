import React, { useState } from 'react';
import { Search, Trash2, Edit2, Check, X, AlertCircle, RotateCcw, AlertTriangle } from 'lucide-react';
import { TreeEntry } from '../types';
import { calculateDbh } from '../utils/tally';

interface TreeLogTableProps {
  entries: TreeEntry[];
  onRemoveTree: (id: string) => void;
  onUpdateTree: (tree: TreeEntry) => void;
  onClearAll: () => void;
  onRevertClear?: () => void;
  clearedCount?: number;
}

export const TreeLogTable: React.FC<TreeLogTableProps> = ({
  entries,
  onRemoveTree,
  onUpdateTree,
  onClearAll,
  onRevertClear,
  clearedCount = 0
}) => {
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<TreeEntry>>({});
  const [showConfirmClear, setShowConfirmClear] = useState<boolean>(false);

  const handleStartEdit = (tree: TreeEntry) => {
    setEditingId(tree.id);
    setEditForm({ ...tree });
  };

  const handleSaveEdit = () => {
    if (!editingId || !editForm.num || !editForm.girth || !editForm.code || !editForm.name) return;
    const updatedGirth = Number(editForm.girth);
    onUpdateTree({
      ...(editForm as TreeEntry),
      num: Number(editForm.num),
      girth: updatedGirth,
      dbh: calculateDbh(updatedGirth),
      code: editForm.code.trim().toUpperCase(),
      name: editForm.name.trim().toUpperCase(),
      updatedAt: new Date().toISOString()
    });
    setEditingId(null);
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditForm({});
  };

  const handleConfirmClearAll = () => {
    onClearAll();
    setShowConfirmClear(false);
  };

  // Filter logic
  const filteredEntries = entries.filter(e => {
    const query = searchQuery.toLowerCase();
    return (
      e.num.toString().includes(query) ||
      e.code.toLowerCase().includes(query) ||
      e.name.toLowerCase().includes(query) ||
      e.girth.toString().includes(query)
    );
  });

  return (
    <div className="bg-black/90 backdrop-blur-md rounded-2xl border border-stone-800 p-4 sm:p-6 mb-8 shadow-2xl text-stone-100 relative">
      {/* Confirm Clear Modal Overlay */}
      {showConfirmClear && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
          <div className="bg-stone-900 border border-red-500/30 rounded-2xl p-6 max-w-md w-full shadow-2xl text-stone-100">
            <div className="flex items-center gap-3 mb-4 text-red-400">
              <div className="p-2 bg-red-500/10 rounded-xl border border-red-500/20">
                <AlertTriangle className="w-6 h-6 text-red-500" />
              </div>
              <div>
                <h4 className="font-serif font-bold text-lg text-white">Clear All Tree Entries?</h4>
                <p className="text-xs text-stone-400">Action affect all {entries.length} currently logged tree records.</p>
              </div>
            </div>

            <p className="text-xs text-stone-300 mb-6 bg-stone-950 p-3 rounded-xl border border-stone-800">
              Are you sure you want to delete all <strong className="text-white font-mono">{entries.length}</strong> entries from the register at once? You will be able to restore them immediately using the <span className="text-amber-400 font-semibold">Revert Clear Action</span> feature.
            </p>

            <div className="flex items-center justify-end gap-3">
              <button
                onClick={() => setShowConfirmClear(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-stone-300 bg-stone-800 hover:bg-stone-700 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmClearAll}
                className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-red-600 hover:bg-red-500 shadow-lg shadow-red-600/30 transition-all flex items-center gap-2"
              >
                <Trash2 className="w-4 h-4" />
                Yes, Delete All {entries.length} Entries
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
        <div>
          <h3 className="font-serif text-lg font-semibold text-white flex items-center gap-2">
            Logged Tree Register
            <span className="text-xs font-mono font-semibold px-2 py-0.5 rounded-full bg-emerald-900/10 text-emerald-800 dark:bg-emerald-400/10 dark:text-emerald-300">
              {entries.length} trees total
            </span>
          </h3>
          <p className="text-xs text-stone-500 dark:text-stone-400">
            Real-time table of all tree entries sorted by tree number.
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto flex-wrap">
          {clearedCount > 0 && onRevertClear && (
            <button
              onClick={onRevertClear}
              className="px-3 py-1.5 text-xs font-bold text-amber-300 bg-amber-500/15 border border-amber-500/30 hover:bg-amber-500/25 rounded-xl flex items-center gap-1.5 transition-all shadow-sm"
              title="Revert recent clear action and restore deleted trees"
            >
              <RotateCcw className="w-3.5 h-3.5 text-amber-400" />
              Revert Clear ({clearedCount} {clearedCount === 1 ? 'tree' : 'trees'})
            </button>
          )}

          {entries.length > 0 && (
            <button
              onClick={() => setShowConfirmClear(true)}
              className="px-3 py-1.5 text-xs font-medium text-red-400 bg-red-500/10 border border-red-500/20 hover:bg-red-500/20 hover:text-red-300 rounded-xl flex items-center gap-1.5 transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Clear All Entries
            </button>
          )}
        </div>
      </div>

      {/* Search Bar */}
      <div className="mb-4">
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
          <input
            type="text"
            placeholder="Search by Tree #, Species Code, or Name..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2 bg-white dark:bg-stone-950 border border-stone-300 dark:border-stone-800 rounded-xl text-xs text-stone-900 dark:text-stone-100 focus:outline-none focus:ring-1 focus:ring-emerald-600"
          />
        </div>
      </div>

      {/* Logged Table */}
      <div className="overflow-x-auto border border-stone-300 dark:border-stone-800 rounded-xl">
        <table className="w-full text-left border-collapse text-xs font-mono">
          <thead>
            <tr className="bg-stone-200/80 dark:bg-stone-950 text-stone-600 dark:text-stone-400 uppercase tracking-wider text-[10.5px] font-semibold border-b border-stone-300 dark:border-stone-800">
              <th className="p-3">Tree #</th>
              <th className="p-3">Girth (cm)</th>
              <th className="p-3">DBH (cm)</th>
              <th className="p-3">Code</th>
              <th className="p-3 font-sans">Local Species Name</th>
              <th className="p-3">Field Notes</th>
              <th className="p-3 text-right font-sans">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-200 dark:divide-stone-800 bg-white dark:bg-stone-900">
            {filteredEntries.length === 0 ? (
              <tr>
                <td colSpan={7} className="p-8 text-center text-stone-400 font-sans text-xs">
                  {entries.length === 0 ? (
                    <div className="flex flex-col items-center justify-center gap-3 py-4">
                      <p className="italic">
                        No trees logged yet. Use the field logger above to record your first entry.
                      </p>
                      {clearedCount > 0 && onRevertClear && (
                        <div className="flex items-center gap-2 p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-300 not-italic">
                          <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
                          <span>Cleared <strong>{clearedCount}</strong> {clearedCount === 1 ? 'entry' : 'entries'} recently.</span>
                          <button
                            onClick={onRevertClear}
                            className="ml-2 px-3 py-1 rounded-lg bg-amber-500 text-stone-950 font-bold hover:bg-amber-400 transition-colors flex items-center gap-1.5 shadow-md"
                          >
                            <RotateCcw className="w-3.5 h-3.5" />
                            Revert Clear Action
                          </button>
                        </div>
                      )}
                    </div>
                  ) : (
                    <span className="italic">No tree entries match your current search query.</span>
                  )}
                </td>
              </tr>
            ) : (
              filteredEntries.map(tree => {
                const isEditing = editingId === tree.id;

                if (isEditing) {
                  return (
                    <tr key={tree.id} className="bg-amber-500/10 dark:bg-amber-500/5">
                      <td className="p-2">
                        <input
                          type="number"
                          value={editForm.num || ''}
                          onChange={e => setEditForm(prev => ({ ...prev, num: Number(e.target.value) }))}
                          className="w-16 p-1 bg-white dark:bg-stone-950 border rounded font-mono font-bold text-xs"
                        />
                      </td>
                      <td className="p-2">
                        <input
                          type="number"
                          value={editForm.girth || ''}
                          onChange={e => setEditForm(prev => ({ ...prev, girth: Number(e.target.value) }))}
                          className="w-20 p-1 bg-white dark:bg-stone-950 border rounded font-mono font-bold text-xs"
                        />
                      </td>
                      <td className="p-2 text-stone-400">
                        {editForm.girth ? calculateDbh(Number(editForm.girth)) : '-'}
                      </td>
                      <td className="p-2">
                        <input
                          type="text"
                          value={editForm.code || ''}
                          onChange={e => setEditForm(prev => ({ ...prev, code: e.target.value }))}
                          className="w-20 p-1 bg-white dark:bg-stone-950 border rounded font-mono font-bold text-xs uppercase"
                        />
                      </td>
                      <td className="p-2">
                        <input
                          type="text"
                          value={editForm.name || ''}
                          onChange={e => setEditForm(prev => ({ ...prev, name: e.target.value }))}
                          className="w-32 p-1 bg-white dark:bg-stone-950 border rounded font-sans text-xs uppercase"
                        />
                      </td>
                      <td className="p-2 font-sans text-[11px] text-stone-500">
                        Editing entry...
                      </td>
                      <td className="p-2 text-right space-x-1">
                        <button
                          onClick={handleSaveEdit}
                          className="p-1 bg-emerald-600 text-white rounded hover:bg-emerald-700"
                          title="Save Changes"
                        >
                          <Check className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={handleCancelEdit}
                          className="p-1 bg-stone-400 text-white rounded hover:bg-stone-500"
                          title="Cancel"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                }

                return (
                  <tr key={tree.id} className="hover:bg-amber-500/5 transition-colors text-stone-800 dark:text-stone-200">
                    <td className="p-3 font-bold text-emerald-950 dark:text-amber-400 font-mono">
                      #{tree.num}
                    </td>
                    <td className="p-3 font-semibold font-mono">
                      {tree.girth} cm
                    </td>
                    <td className="p-3 text-stone-500 dark:text-stone-400">
                      {tree.dbh} cm
                    </td>
                    <td className="p-3">
                      <span className="px-2 py-0.5 rounded bg-emerald-900/10 text-emerald-900 dark:bg-emerald-400/10 dark:text-emerald-300 font-bold border border-emerald-800/20 text-[11px]">
                        {tree.code}
                      </span>
                    </td>
                    <td className="p-3 font-sans font-semibold text-stone-900 dark:text-stone-100">
                      {tree.name}
                      {tree.scientificName && (
                        <span className="block text-[10px] text-stone-400 font-mono italic">
                          {tree.scientificName}
                        </span>
                      )}
                    </td>
                    <td className="p-3 font-sans text-stone-500 dark:text-stone-400 text-[11px]">
                      {tree.notes ? <span>{tree.notes}</span> : <span className="text-stone-400 italic font-mono">-</span>}
                    </td>
                    <td className="p-3 text-right space-x-1 font-sans">
                      <button
                        onClick={() => handleStartEdit(tree)}
                        className="p-1 rounded text-stone-400 hover:text-emerald-700 dark:hover:text-emerald-400 transition-colors"
                        title="Edit Entry"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => onRemoveTree(tree.id)}
                        className="p-1 rounded text-stone-400 hover:text-red-600 transition-colors"
                        title="Delete Entry"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
