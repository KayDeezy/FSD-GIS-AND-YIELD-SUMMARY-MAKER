import React from 'react';
import { Trees, CloudOff, MapPin, CheckCircle2, AlertTriangle, RotateCcw } from 'lucide-react';
import { SurveyMetadata, AuditReport } from '../types';

interface HeaderProps {
  meta: SurveyMetadata;
  setMeta: React.Dispatch<React.SetStateAction<SurveyMetadata>>;
  audit: AuditReport;
  pendingSyncCount: number;
}

export const Header: React.FC<HeaderProps> = ({
  meta,
  setMeta,
  audit,
  pendingSyncCount,
}) => {
  const handleClearHeaderFields = () => {
    setMeta(prev => ({
      ...prev,
      siteName: '',
      district: '',
      clientName: '',
      targetTotalTrees: undefined
    }));
  };

  const hasAnyDetails = Boolean(meta.siteName || meta.district || meta.clientName || meta.targetTotalTrees);

  return (
    <header className="mb-6 p-5 sm:p-6 rounded-2xl bg-black/90 text-stone-100 backdrop-blur-md border border-stone-800 shadow-2xl">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-stone-800">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-mono font-bold bg-black text-emerald-400 border border-emerald-800/80 shadow-inner">
              <Trees className="w-3.5 h-3.5" />
              FORESTRY FIELD TALLY & AUDIT
            </span>
            {pendingSyncCount > 0 && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-mono bg-amber-950/80 text-amber-300 border border-amber-800/80">
                <CloudOff className="w-3 h-3" />
                {pendingSyncCount} offline
              </span>
            )}
          </div>
          <h1 className="font-serif text-3xl md:text-4xl font-bold tracking-tight text-white drop-shadow-sm">
            Timber Tally Builder
          </h1>
          <p className="text-xs sm:text-sm text-stone-300 max-w-2xl mt-1 leading-relaxed">
            Log field enumeration, species classification, sequence corrections, and generate timber tally crosstab reports with offline local persistence.
          </p>
        </div>

        {hasAnyDetails && (
          <button
            type="button"
            onClick={handleClearHeaderFields}
            className="self-start md:self-center inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-stone-900 hover:bg-stone-800 text-stone-300 hover:text-white border border-stone-700 transition-colors"
            title="Clear all header survey details"
          >
            <RotateCcw className="w-3.5 h-3.5 text-stone-400" />
            Clear Details
          </button>
        )}
      </div>

      {/* Survey Title Details Bar */}
      <div className="mt-4 p-4 rounded-xl bg-black/80 border border-stone-800 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3 text-xs">
        <div>
          <label className="block text-[11px] uppercase tracking-wider font-semibold text-stone-300 mb-1">
            Site / Off-Reserve Area
          </label>
          <input
            type="text"
            value={meta.siteName}
            onChange={e => setMeta(m => ({ ...m, siteName: e.target.value }))}
            placeholder="Enter site / off-reserve area"
            className="w-full bg-stone-900 border border-stone-700 rounded px-2.5 py-1.5 font-medium text-white placeholder-stone-500 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500"
          />
        </div>

        <div>
          <label className="block text-[11px] uppercase tracking-wider font-semibold text-stone-300 mb-1 flex items-center gap-1">
            <MapPin className="w-3 h-3 text-amber-400" />
            Forest District Specification
          </label>
          <input
            type="text"
            value={meta.district || ''}
            onChange={e => setMeta(m => ({ ...m, district: e.target.value }))}
            placeholder="Enter forest district"
            className="w-full bg-stone-900 border border-stone-700 rounded px-2.5 py-1.5 font-medium text-white placeholder-stone-500 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500"
          />
        </div>

        <div>
          <label className="block text-[11px] uppercase tracking-wider font-semibold text-stone-300 mb-1">
            Client Company
          </label>
          <input
            type="text"
            value={meta.clientName}
            onChange={e => setMeta(m => ({ ...m, clientName: e.target.value }))}
            placeholder="Enter client company"
            className="w-full bg-stone-900 border border-stone-700 rounded px-2.5 py-1.5 font-medium text-white placeholder-stone-500 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500"
          />
        </div>

        <div>
          <label className="block text-[11px] uppercase tracking-wider font-semibold text-stone-300 mb-1">
            Target Total Trees to Enter
          </label>
          <input
            type="number"
            min="1"
            value={meta.targetTotalTrees || ''}
            onChange={e => setMeta(m => ({ ...m, targetTotalTrees: e.target.value ? parseInt(e.target.value, 10) : undefined }))}
            placeholder="Target count"
            className="w-full bg-stone-900 border border-stone-700 rounded px-2.5 py-1.5 font-medium text-white placeholder-stone-500 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 font-mono"
          />
        </div>

        <div>
          <label className="block text-[11px] uppercase tracking-wider font-semibold text-stone-300 mb-1">
            Progress & Survey Integrity
          </label>
          <div className="flex flex-col justify-center gap-1 pt-0.5">
            <div className="flex items-center gap-2">
              {audit.isClean ? (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-950/80 text-emerald-300 font-medium font-mono text-[11px] border border-emerald-800/80">
                  <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                  {audit.totalLogged} logged {meta.targetTotalTrees ? `/ ${meta.targetTotalTrees}` : ''}
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-amber-950/80 text-amber-300 font-medium font-mono text-[11px] border border-amber-800/80">
                  <AlertTriangle className="w-3 h-3 text-amber-400" />
                  {audit.totalLogged} logged ({audit.issues.length} audit flag)
                </span>
              )}
              {meta.targetTotalTrees && meta.targetTotalTrees > 0 && (
                <span className="text-[11px] font-mono font-bold text-stone-200">
                  {Math.round((audit.totalLogged / meta.targetTotalTrees) * 100)}%
                </span>
              )}
            </div>
            {meta.targetTotalTrees && meta.targetTotalTrees > 0 && (
              <div className="w-full bg-stone-800 h-1.5 rounded-full overflow-hidden">
                <div
                  className={`h-full transition-all duration-300 ${
                    audit.totalLogged >= meta.targetTotalTrees ? 'bg-emerald-500' : 'bg-amber-500'
                  }`}
                  style={{ width: `${Math.min(100, Math.round((audit.totalLogged / meta.targetTotalTrees) * 100))}%` }}
                />
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};
