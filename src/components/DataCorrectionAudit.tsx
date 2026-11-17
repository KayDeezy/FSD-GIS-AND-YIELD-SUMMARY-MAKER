import React, { useState } from 'react';
import { ShieldCheck, AlertTriangle, AlertCircle, Sparkles, CheckCircle2, Wrench, RefreshCcw, Layers, ArrowRight } from 'lucide-react';
import { TreeEntry, AuditReport } from '../types';
import { calculateDbh } from '../utils/tally';

interface DataCorrectionAuditProps {
  entries: TreeEntry[];
  audit: AuditReport;
  onUpdateEntries: (entries: TreeEntry[]) => void;
}

export const DataCorrectionAudit: React.FC<DataCorrectionAuditProps> = ({
  entries,
  audit,
  onUpdateEntries
}) => {
  const [selectedFix, setSelectedFix] = useState<string | null>(null);

  // Auto-Fix Option 1: Renumber entries strictly starting from 1..N
  const handleFixRenumberSequentially = () => {
    if (entries.length === 0) return;
    const sorted = [...entries].sort((a, b) => a.num - b.num);
    const renumbered = sorted.map((e, index) => ({
      ...e,
      num: index + 1,
      syncStatus: 'pending' as const,
      updatedAt: new Date().toISOString()
    }));
    onUpdateEntries(renumbered);
    setSelectedFix('renumbered');
  };

  // Auto-Fix Option 2: Fill missing numbers with dummy entries
  const handleFixFillMissing = () => {
    if (audit.missingNums.length === 0) return;
    const missingEntries: TreeEntry[] = audit.missingNums.map(num => ({
      id: `tree_missing_${num}_${Date.now()}`,
      num,
      girth: 50,
      dbh: calculateDbh(50),
      code: 'UNK',
      name: 'PENDING FIELD VERIFICATION',
      condition: 'Healthy',
      syncStatus: 'pending' as const,
      notes: 'Auto-created gap filler entry - verify in field',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }));

    const combined = [...entries, ...missingEntries].sort((a, b) => a.num - b.num);
    onUpdateEntries(combined);
    setSelectedFix('filled');
  };

  // Auto-Fix Option 3: Remove exact duplicate tree number entries (keeps first)
  const handleDeduplicate = () => {
    const seenNums = new Set<number>();
    const deduplicated: TreeEntry[] = [];

    entries.forEach(e => {
      if (!seenNums.has(e.num)) {
        seenNums.add(e.num);
        deduplicated.push(e);
      }
    });

    onUpdateEntries(deduplicated);
    setSelectedFix('deduplicated');
  };

  return (
    <div className="bg-black/90 backdrop-blur-md rounded-2xl border border-stone-800 p-4 sm:p-6 mb-8 shadow-2xl text-stone-100">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 pb-3 border-b border-stone-800">
        <div>
          <h3 className="font-serif text-xl font-bold text-white flex items-center gap-2">
            <Wrench className="w-5 h-5 text-amber-600" />
            Field Data Quality & Sequence Correction Suite
          </h3>
          <p className="text-xs text-stone-500 dark:text-stone-400">
            Automatically detects sequence gaps, duplicate tree numbers, and girth measurement outliers.
          </p>
        </div>

        <div>
          {audit.isClean ? (
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-800 dark:text-emerald-300 font-mono font-bold text-xs uppercase tracking-wider">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              Validation Stamp: Sequence Complete
            </div>
          ) : (
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-900 dark:text-amber-300 font-mono font-bold text-xs uppercase tracking-wider">
              <AlertTriangle className="w-4 h-4 text-amber-600" />
              Validation Stamp: Needs Review
            </div>
          )}
        </div>
      </div>

      {/* Main Audit Summary Box */}
      <div className="p-4 sm:p-5 rounded-xl bg-stone-100 dark:bg-stone-950 border border-stone-200 dark:border-stone-800 mb-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <p className="text-sm text-stone-800 dark:text-stone-200 font-medium">
            Logged <strong className="font-mono text-emerald-900 dark:text-emerald-400">{audit.totalLogged}</strong> trees,
            numbered from 1 up to maximum <strong className="font-mono text-emerald-900 dark:text-emerald-400">#{audit.maxNumber}</strong>.
          </p>
          {audit.isClean ? (
            <p className="text-xs text-stone-500 dark:text-stone-400 mt-1">
              Every tree number from 1 to {audit.maxNumber} is accounted for exactly once. No duplicates or gaps found!
            </p>
          ) : (
            <p className="text-xs text-amber-800 dark:text-amber-400 font-semibold mt-1">
              Found {audit.missingNums.length} missing number gap(s) and {audit.duplicateNums.length} duplicate number issue(s).
            </p>
          )}
        </div>

        {/* One-Click Auto Fix Actions */}
        {!audit.isClean && (
          <div className="flex flex-wrap gap-2 shrink-0">
            {audit.missingNums.length > 0 && (
              <button
                onClick={handleFixFillMissing}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-amber-600 hover:bg-amber-500 text-stone-50 text-xs font-semibold shadow-sm"
              >
                <Sparkles className="w-3.5 h-3.5" />
                Fill {audit.missingNums.length} Missing Dummy Trees
              </button>
            )}

            {audit.duplicateNums.length > 0 && (
              <button
                onClick={handleDeduplicate}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-red-700 hover:bg-red-600 text-stone-50 text-xs font-semibold shadow-sm"
              >
                <Layers className="w-3.5 h-3.5" />
                Remove Duplicates
              </button>
            )}

            <button
              onClick={handleFixRenumberSequentially}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-emerald-800 hover:bg-emerald-700 text-stone-50 text-xs font-semibold shadow-sm"
            >
              <RefreshCcw className="w-3.5 h-3.5" />
              Auto-Renumber All 1..N
            </button>
          </div>
        )}
      </div>

      {selectedFix && (
        <div className="mb-4 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-xs font-mono text-emerald-800 dark:text-emerald-300 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          Sequence auto-correction applied successfully! Audit report updated below.
        </div>
      )}

      {/* Audit Detail Breakdown Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Missing Numbers Card */}
        <div className={`p-4 rounded-xl border ${audit.missingNums.length > 0 ? 'bg-amber-500/10 border-amber-500/30' : 'bg-stone-100 dark:bg-stone-950 border-stone-200 dark:border-stone-800'}`}>
          <div className="flex items-center justify-between mb-2">
            <h4 className="font-semibold text-xs uppercase tracking-wider text-stone-800 dark:text-stone-200 flex items-center gap-1.5">
              <AlertCircle className={`w-4 h-4 ${audit.missingNums.length > 0 ? 'text-amber-600' : 'text-emerald-600'}`} />
              Missing Tree Numbers ({audit.missingNums.length})
            </h4>
          </div>
          {audit.missingNums.length === 0 ? (
            <p className="text-xs text-stone-500 dark:text-stone-400 italic">No missing numbers in sequence.</p>
          ) : (
            <div>
              <p className="text-xs text-amber-900 dark:text-amber-300 mb-2 font-medium">
                The following tree numbers were skipped in field logging:
              </p>
              <div className="flex flex-wrap gap-1 max-h-28 overflow-y-auto font-mono text-xs p-2 bg-white dark:bg-stone-900 rounded-lg border border-amber-900/20">
                {audit.missingNums.map(n => (
                  <span key={n} className="px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-900 dark:text-amber-300 font-bold">
                    #{n}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Duplicate Numbers Card */}
        <div className={`p-4 rounded-xl border ${audit.duplicateNums.length > 0 ? 'bg-red-500/10 border-red-500/30' : 'bg-stone-100 dark:bg-stone-950 border-stone-200 dark:border-stone-800'}`}>
          <div className="flex items-center justify-between mb-2">
            <h4 className="font-semibold text-xs uppercase tracking-wider text-stone-800 dark:text-stone-200 flex items-center gap-1.5">
              <AlertTriangle className={`w-4 h-4 ${audit.duplicateNums.length > 0 ? 'text-red-600' : 'text-emerald-600'}`} />
              Duplicate Tree Numbers ({audit.duplicateNums.length})
            </h4>
          </div>
          {audit.duplicateNums.length === 0 ? (
            <p className="text-xs text-stone-500 dark:text-stone-400 italic">No duplicate numbers found.</p>
          ) : (
            <div>
              <p className="text-xs text-red-900 dark:text-red-300 mb-2 font-medium">
                Tree numbers logged more than once in this survey:
              </p>
              <div className="flex flex-wrap gap-1 max-h-28 overflow-y-auto font-mono text-xs p-2 bg-white dark:bg-stone-900 rounded-lg border border-red-900/20">
                {audit.duplicateNums.map(n => (
                  <span key={n} className="px-1.5 py-0.5 rounded bg-red-500/20 text-red-900 dark:text-red-300 font-bold">
                    #{n}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Girth Outlier Detection Card */}
        <div className={`p-4 rounded-xl border ${audit.outliers.length > 0 ? 'bg-amber-500/10 border-amber-500/30' : 'bg-stone-100 dark:bg-stone-950 border-stone-200 dark:border-stone-800'}`}>
          <div className="flex items-center justify-between mb-2">
            <h4 className="font-semibold text-xs uppercase tracking-wider text-stone-800 dark:text-stone-200 flex items-center gap-1.5">
              <Wrench className={`w-4 h-4 ${audit.outliers.length > 0 ? 'text-amber-600' : 'text-emerald-600'}`} />
              Measurement Outliers ({audit.outliers.length})
            </h4>
          </div>
          {audit.outliers.length === 0 ? (
            <p className="text-xs text-stone-500 dark:text-stone-400 italic">All girth values are within plausible limits.</p>
          ) : (
            <div className="space-y-1 max-h-28 overflow-y-auto font-mono text-xs">
              {audit.outliers.map(o => (
                <div key={o.num} className="p-1.5 rounded bg-white dark:bg-stone-900 border border-amber-900/20 text-amber-900 dark:text-amber-300">
                  <span className="font-bold">Tree #{o.num}:</span> {o.girth}cm &mdash; <span className="font-sans text-[11px]">{o.reason}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
