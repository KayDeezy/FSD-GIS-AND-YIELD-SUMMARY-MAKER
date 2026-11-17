import React, { useState, useEffect } from 'react';
import { RotateCcw, X, AlertCircle, CheckCircle2 } from 'lucide-react';
import { Header } from './components/Header';
import { FieldEntryForm } from './components/FieldEntryForm';
import { TreeLogTable } from './components/TreeLogTable';
import { TallyLedger } from './components/TallyLedger';
import { DataCorrectionAudit } from './components/DataCorrectionAudit';
import { GisStandMap } from './components/GisStandMap';
import { TreeEntry, SurveyMetadata, AuditReport } from './types';
import { clearStoredSurveyData } from './utils/storage';
import { auditTreeEntries, calculateDbh } from './utils/tally';
import forestBg from './assets/images/forest_background_timber_1786100538487.jpg';

export default function App() {
  const [entries, setEntries] = useState<TreeEntry[]>([]);
  const [clearedHistory, setClearedHistory] = useState<TreeEntry[]>([]);
  const [meta, setMeta] = useState<SurveyMetadata>(() => ({
    ...DEFAULT_META,
    date: new Date().toISOString().split('T')[0]
  }));
  const [activeTab, setActiveTab] = useState<'logger' | 'audit' | 'ledger' | 'map'>('logger');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Clear any previously stored survey entries, backups, and metadata upon visiting the app
  useEffect(() => {
    clearStoredSurveyData();
  }, []);

  const audit: AuditReport = auditTreeEntries(entries);

  // Compute next suggested tree number
  const nextSuggestedNum = audit.missingNums.length > 0
    ? audit.missingNums[0]
    : audit.maxNumber + 1;

  const handleAddTree = (newTreeData: Omit<TreeEntry, 'id' | 'createdAt' | 'updatedAt' | 'syncStatus'>) => {
    const newEntry: TreeEntry = {
      ...newTreeData,
      id: `tree_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
      syncStatus: 'pending',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    setEntries(prev => [...prev, newEntry]);
  };

  const handleBulkAddTrees = (rawLines: string): { added: number; skipped: number } => {
    const lines = rawLines.split('\n').map(l => l.trim()).filter(Boolean);
    let added = 0;
    let skipped = 0;
    const newEntries: TreeEntry[] = [];

    lines.forEach((line, index) => {
      const parts = line.split(',').map(p => p.trim());
      if (parts.length >= 4) {
        const num = parseInt(parts[0], 10);
        const girth = parseFloat(parts[1]);
        const code = parts[2].toUpperCase();
        const name = parts.slice(3).join(' ').toUpperCase();

        if (num && girth > 0 && code && name) {
          newEntries.push({
            id: `tree_bulk_${Date.now()}_${index}`,
            num,
            girth,
            dbh: calculateDbh(girth),
            code,
            name,
            condition: 'Healthy',
            syncStatus: 'pending',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          });
          added++;
        } else {
          skipped++;
        }
      } else {
        skipped++;
      }
    });

    if (newEntries.length > 0) {
      setEntries(prev => [...prev, ...newEntries]);
    }

    return { added, skipped };
  };

  const handleRemoveTree = (id: string) => {
    setEntries(prev => prev.filter(e => e.id !== id));
  };

  const handleUpdateTree = (updated: TreeEntry) => {
    setEntries(prev => prev.map(e => (e.id === updated.id ? updated : e)));
  };

  const handleClearAll = () => {
    if (entries.length === 0) return;
    const count = entries.length;
    // Store current snapshot before clearing to allow complete revert in current session
    const backup = [...entries];
    setClearedHistory(backup);

    // Clear entries
    setEntries([]);

    setToastMessage(`Cleared all ${count} tree ${count === 1 ? 'entry' : 'entries'}. You can revert this action using the button below.`);
  };

  const handleRevertClear = () => {
    if (clearedHistory.length === 0) return;
    const restored = [...clearedHistory];
    const count = restored.length;

    setEntries(restored);
    setClearedHistory([]);

    setToastMessage(`Reverted clear action! Successfully restored ${count} tree ${count === 1 ? 'entry' : 'entries'}.`);
    setTimeout(() => setToastMessage(null), 5000);
  };

  const knownSpeciesList = entries.map(e => ({
    code: e.code,
    localName: e.name,
    scientificName: e.scientificName || ''
  }));

  const pendingSyncCount = entries.filter(e => e.syncStatus === 'pending').length;

  return (
    <div className="relative min-h-screen bg-stone-950 text-stone-100 font-sans dark">
      {/* Fixed Forest Background Image with Black Contrast Overlay */}
      <div className="fixed inset-0 -z-20 overflow-hidden pointer-events-none">
        <img
          src={forestBg}
          alt="Forest background"
          className="w-full h-full object-cover object-center filter brightness-90 contrast-105"
          referrerPolicy="no-referrer"
        />
        {/* Contrast Overlay for High Legibility */}
        <div className="absolute inset-0 bg-black/60 backdrop-blur-[2px]" />
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6 sm:px-6 lg:px-8">
        {/* Top Header */}
        <Header
          meta={meta}
          setMeta={setMeta}
          audit={audit}
          pendingSyncCount={pendingSyncCount}
        />

        {/* Revert / Backup Notification Banner */}
        {clearedHistory.length > 0 && (
          <div className="mb-6 p-4 rounded-2xl bg-amber-500/20 border border-amber-500/40 backdrop-blur-md text-stone-100 flex flex-col sm:flex-row items-center justify-between gap-3 shadow-2xl animate-fadeIn">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-amber-500/20 border border-amber-500/30 text-amber-300">
                <RotateCcw className="w-5 h-5 shrink-0" />
              </div>
              <div>
                <div className="font-serif font-bold text-sm text-amber-200">Clear Action Backup Ready</div>
                <p className="text-xs text-stone-300">
                  {clearedHistory.length} tree {clearedHistory.length === 1 ? 'record was' : 'records were'} recently deleted. You can restore them anytime.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={handleRevertClear}
                className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-stone-950 font-bold text-xs transition-all shadow-lg shadow-amber-500/20 flex items-center gap-2"
              >
                <RotateCcw className="w-4 h-4" />
                Revert & Restore All {clearedHistory.length} Entries
              </button>
              <button
                onClick={() => {
                  setClearedHistory([]);
                  setToastMessage(null);
                }}
                className="p-2 rounded-xl text-stone-400 hover:text-white hover:bg-stone-800 text-xs transition-colors"
                title="Dismiss backup notification"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* General Toast Banner */}
        {toastMessage && clearedHistory.length === 0 && (
          <div className="mb-6 p-3 px-4 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-200 text-xs font-semibold flex items-center justify-between gap-2 shadow-lg">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>{toastMessage}</span>
            </div>
            <button
              onClick={() => setToastMessage(null)}
              className="p-1 text-stone-400 hover:text-white rounded"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* View Switcher Tabs with Black Backdrop */}
        <div className="flex items-center gap-2 mb-6 p-1.5 rounded-2xl bg-black/90 backdrop-blur-md border border-stone-800 shadow-2xl overflow-x-auto">
          <button
            onClick={() => setActiveTab('logger')}
            className={`px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all whitespace-nowrap ${
              activeTab === 'logger'
                ? 'bg-emerald-700 text-white shadow-lg ring-1 ring-emerald-500'
                : 'text-stone-300 hover:bg-stone-900 hover:text-white'
            }`}
          >
            1. Field Logger ({entries.length})
          </button>

          <button
            onClick={() => setActiveTab('audit')}
            className={`px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === 'audit'
                ? 'bg-amber-600 text-white shadow-lg ring-1 ring-amber-400'
                : 'text-stone-300 hover:bg-stone-900 hover:text-white'
            }`}
          >
            2. Sequence Audit
            {!audit.isClean && (
              <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
            )}
          </button>

          <button
            onClick={() => setActiveTab('ledger')}
            className={`px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all whitespace-nowrap ${
              activeTab === 'ledger'
                ? 'bg-emerald-700 text-white shadow-lg ring-1 ring-emerald-500'
                : 'text-stone-300 hover:bg-stone-900 hover:text-white'
            }`}
          >
            3. Tally Matrix
          </button>

          <button
            onClick={() => setActiveTab('map')}
            className={`px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all whitespace-nowrap ${
              activeTab === 'map'
                ? 'bg-emerald-700 text-white shadow-lg ring-1 ring-emerald-500'
                : 'text-stone-300 hover:bg-stone-900 hover:text-white'
            }`}
          >
            4. GIS Stand Map & GPS
          </button>
        </div>

        {/* Tab Views */}
        <div className={activeTab === 'logger' ? 'block' : 'hidden'}>
          <FieldEntryForm
            onAddTree={handleAddTree}
            nextSuggestedNum={nextSuggestedNum}
            knownSpeciesList={knownSpeciesList}
            targetTotalTrees={meta.targetTotalTrees}
            totalLoggedCount={entries.length}
          />

          <TreeLogTable
            entries={entries}
            onRemoveTree={handleRemoveTree}
            onUpdateTree={handleUpdateTree}
            onClearAll={handleClearAll}
            onRevertClear={handleRevertClear}
            clearedCount={clearedHistory.length}
          />
        </div>

        <div className={activeTab === 'audit' ? 'block' : 'hidden'}>
          <DataCorrectionAudit
            entries={entries}
            audit={audit}
            onUpdateEntries={setEntries}
          />
        </div>

        <div className={activeTab === 'ledger' ? 'block' : 'hidden'}>
          <TallyLedger
            entries={entries}
            meta={meta}
            onUpdateMeta={setMeta}
          />
        </div>

        <div className={activeTab === 'map' ? 'block' : 'hidden'}>
          <GisStandMap
            entries={entries}
            meta={meta}
            onUpdateTree={handleUpdateTree}
            onAddTree={handleAddTree}
          />
        </div>
      </div>

      <footer className="text-center py-6 text-xs text-stone-400 font-mono border-t border-stone-800/80 mt-12 space-y-1">
        <p className="text-stone-300 font-medium text-sm">
          Author: <span className="text-emerald-400 font-bold">Dennis Obeng</span>
        </p>
        <p className="text-stone-500 text-[11px]">
          Timber Tally & Field Tree Data Collector &bull; Offline Local Storage Engine &bull; Survey Data Stays Secure in Browser
        </p>
      </footer>
    </div>
  );
}

const DEFAULT_META: SurveyMetadata = {
  siteName: '',
  clientName: '',
  compartmentNo: '',
  enumeratorName: '',
  district: '',
  date: new Date().toISOString().split('T')[0],
  girthClassRanges: '70-89,90-109,110-129,130-140,150+',
  targetTotalTrees: undefined
};
