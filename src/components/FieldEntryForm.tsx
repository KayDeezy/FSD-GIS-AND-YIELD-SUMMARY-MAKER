import React, { useState, useEffect } from 'react';
import { PlusCircle } from 'lucide-react';
import { TreeEntry, SpeciesInfo } from '../types';
import { DEFAULT_SPECIES } from '../data/species';
import { calculateDbh } from '../utils/tally';

interface FieldEntryFormProps {
  onAddTree: (tree: Omit<TreeEntry, 'id' | 'createdAt' | 'updatedAt' | 'syncStatus'>) => void;
  nextSuggestedNum: number;
  knownSpeciesList: SpeciesInfo[];
  targetTotalTrees?: number;
  totalLoggedCount?: number;
}

export const FieldEntryForm: React.FC<FieldEntryFormProps> = ({
  onAddTree,
  nextSuggestedNum,
  knownSpeciesList,
  targetTotalTrees,
  totalLoggedCount,
}) => {
  const [num, setNum] = useState<number>(nextSuggestedNum);
  const [girth, setGirth] = useState<string>('');
  const [code, setCode] = useState<string>('');
  const [name, setName] = useState<string>('');
  const [scientificName, setScientificName] = useState<string>('');
  const [height, setHeight] = useState<string>('');

  // Update num when nextSuggestedNum changes if user hasn't edited manually
  useEffect(() => {
    setNum(nextSuggestedNum);
  }, [nextSuggestedNum]);

  // Combine default species with user known species
  const allSpecies = [...DEFAULT_SPECIES, ...knownSpeciesList];
  const uniqueSpeciesMap = new Map<string, SpeciesInfo>();
  const nameToSpeciesMap = new Map<string, SpeciesInfo>();
  allSpecies.forEach(s => {
    uniqueSpeciesMap.set(s.code.toUpperCase(), s);
    nameToSpeciesMap.set(s.localName.toUpperCase(), s);
  });
  const speciesOptions = Array.from(uniqueSpeciesMap.values());

  // Auto-fill local name when species code is entered
  const handleCodeChange = (newCode: string) => {
    const formattedCode = newCode.toUpperCase();
    setCode(formattedCode);
    const match = uniqueSpeciesMap.get(formattedCode);
    if (match) {
      setName(match.localName);
      setScientificName(match.scientificName || '');
    }
  };

  // Auto-fill species code when local name is selected/entered
  const handleNameChange = (newName: string) => {
    const formattedName = newName.toUpperCase();
    setName(formattedName);
    const match = nameToSpeciesMap.get(formattedName);
    if (match) {
      setCode(match.code);
      setScientificName(match.scientificName || '');
    }
  };

  const handleQuickGirth = (delta: number) => {
    const current = parseFloat(girth) || 0;
    const nextVal = Math.max(0, current + delta);
    setGirth(nextVal.toString());
  };

  const handleSetGirthPreset = (presetVal: number) => {
    setGirth(presetVal.toString());
  };

  const handleSubmitSingle = (e: React.FormEvent) => {
    e.preventDefault();
    const parsedGirth = parseFloat(girth);
    if (!num || isNaN(parsedGirth) || parsedGirth <= 0 || !code.trim() || !name.trim()) {
      alert('Please fill in Tree #, valid Girth (> 0), Species Code, and Local Name.');
      return;
    }

    const matchedSpecies = uniqueSpeciesMap.get(code.trim().toUpperCase());

    onAddTree({
      num,
      girth: parsedGirth,
      dbh: calculateDbh(parsedGirth),
      code: code.trim().toUpperCase(),
      name: name.trim().toUpperCase(),
      scientificName: scientificName || matchedSpecies?.scientificName,
      height: height ? parseFloat(height) : undefined,
    });

    // Reset fields for next rapid entry
    setGirth('');
  };

  const calculatedDbhPreview = girth ? calculateDbh(parseFloat(girth)) : null;

  return (
    <div className="bg-black/90 backdrop-blur-md rounded-2xl border border-stone-800 shadow-2xl p-4 sm:p-6 mb-8 relative overflow-hidden">
      {/* Decorative inner line frame */}
      <div className="absolute inset-2 border border-stone-800/80 pointer-events-none rounded-xl" />

      {/* Header Bar */}
      <div className="flex items-center justify-between mb-4 pb-3 border-b border-stone-800 flex-wrap gap-2">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="px-3 py-1.5 rounded-lg bg-emerald-800 text-stone-50 font-semibold text-xs sm:text-sm shadow-sm">
            Direct Rapid Field Logger
          </span>
          {targetTotalTrees && targetTotalTrees > 0 && (
            <span className="px-2.5 py-1 rounded-lg bg-amber-950/80 text-amber-300 font-mono font-bold text-xs border border-amber-800/80">
              Target: {totalLoggedCount || 0} / {targetTotalTrees} trees
            </span>
          )}
        </div>
      </div>

      <form onSubmit={handleSubmitSingle} className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Tree Number */}
          <div>
            <label className="block text-xs uppercase tracking-wider font-semibold text-stone-600 dark:text-stone-400 mb-1">
              Tree Number #
            </label>
            <input
              type="number"
              min="1"
              required
              value={num}
              onChange={e => setNum(parseInt(e.target.value, 10) || 0)}
              className="w-full bg-white dark:bg-stone-950 border border-stone-300 dark:border-stone-700 rounded-lg p-2.5 font-mono text-base font-bold text-emerald-950 dark:text-stone-100 focus:outline-none focus:ring-2 focus:ring-emerald-600"
            />
          </div>

          {/* Girth Entry & Quick Buttons */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-xs uppercase tracking-wider font-semibold text-stone-600 dark:text-stone-400">
                Girth (cm)
              </label>
              {calculatedDbhPreview && (
                <span className="text-[11px] font-mono text-emerald-700 dark:text-emerald-400 font-semibold">
                  DBH: {calculatedDbhPreview} cm
                </span>
              )}
            </div>
            <input
              type="number"
              step="0.1"
              min="1"
              required
              placeholder="Girth in cm"
              value={girth}
              onChange={e => setGirth(e.target.value)}
              className="w-full bg-white dark:bg-stone-950 border border-stone-300 dark:border-stone-700 rounded-lg p-2.5 font-mono text-base font-bold text-stone-900 dark:text-stone-100 focus:outline-none focus:ring-2 focus:ring-emerald-600"
            />

            {/* Touch Numpad Quick Presets */}
            <div className="flex items-center gap-1 mt-1.5 flex-wrap">
              <button
                type="button"
                onClick={() => handleQuickGirth(5)}
                className="px-2 py-0.5 rounded bg-stone-200 dark:bg-stone-800 text-[11px] font-mono font-semibold text-stone-700 dark:text-stone-300 hover:bg-stone-300"
              >
                +5
              </button>
              <button
                type="button"
                onClick={() => handleQuickGirth(10)}
                className="px-2 py-0.5 rounded bg-stone-200 dark:bg-stone-800 text-[11px] font-mono font-semibold text-stone-700 dark:text-stone-300 hover:bg-stone-300"
              >
                +10
              </button>
              <button
                type="button"
                onClick={() => handleQuickGirth(-1)}
                className="px-2 py-0.5 rounded bg-stone-200 dark:bg-stone-800 text-[11px] font-mono font-semibold text-stone-700 dark:text-stone-300 hover:bg-stone-300"
              >
                -1
              </button>
              <span className="text-stone-300 dark:text-stone-700 mx-0.5">|</span>
              {[60, 85, 105, 125, 150].map(p => (
                <button
                  key={p}
                  type="button"
                  onClick={() => handleSetGirthPreset(p)}
                  className="px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-900 dark:text-amber-300 text-[10px] font-mono hover:bg-amber-500/20"
                >
                  {p}
                </button>
              ))}
            </div>
          </div>

          {/* Species Code */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-xs uppercase tracking-wider font-semibold text-stone-600 dark:text-stone-400">
                Species Code
              </label>
              {scientificName && (
                <span className="text-[10px] font-serif italic text-stone-400 truncate max-w-[120px]" title={scientificName}>
                  {scientificName}
                </span>
              )}
            </div>
            <input
              type="text"
              required
              list="speciesCodeDatalist"
              placeholder="Enter species code"
              value={code}
              onChange={e => handleCodeChange(e.target.value)}
              className="w-full bg-white dark:bg-stone-950 border border-stone-300 dark:border-stone-700 rounded-lg p-2.5 font-mono text-base uppercase font-bold text-amber-800 dark:text-amber-400 focus:outline-none focus:ring-2 focus:ring-emerald-600"
            />
            <datalist id="speciesCodeDatalist">
              {speciesOptions.map(s => (
                <option key={s.code} value={s.code}>{`${s.localName} (${s.scientificName})`}</option>
              ))}
            </datalist>
          </div>

          {/* Local Species Name */}
          <div>
            <label className="block text-xs uppercase tracking-wider font-semibold text-stone-600 dark:text-stone-400 mb-1">
              Local / Common Name
            </label>
            <input
              type="text"
              required
              list="speciesNameDatalist"
              placeholder="Enter local / common name"
              value={name}
              onChange={e => handleNameChange(e.target.value)}
              className="w-full bg-white dark:bg-stone-950 border border-stone-300 dark:border-stone-700 rounded-lg p-2.5 font-semibold text-stone-900 dark:text-stone-100 focus:outline-none focus:ring-2 focus:ring-emerald-600 uppercase"
            />
            <datalist id="speciesNameDatalist">
              {speciesOptions.map(s => (
                <option key={s.code + '_name'} value={s.localName}>{`${s.code} - ${s.scientificName}`}</option>
              ))}
            </datalist>
          </div>
        </div>

        {/* Secondary Field Options: Height and Scientific Name */}
        <div className="pt-2 grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-[11px] uppercase tracking-wider font-semibold text-stone-500 dark:text-stone-400 mb-1">
              Est. Height (m) <span className="text-stone-600 text-[10px]">(Optional)</span>
            </label>
            <input
              type="number"
              step="0.5"
              placeholder="Height in meters"
              value={height}
              onChange={e => setHeight(e.target.value)}
              className="w-full bg-white dark:bg-stone-950 border border-stone-300 dark:border-stone-700 rounded-lg p-2 text-xs font-mono text-stone-800 dark:text-stone-200"
            />
          </div>

          <div>
            <label className="block text-[11px] uppercase tracking-wider font-semibold text-stone-500 dark:text-stone-400 mb-1">
              Scientific Botanical Name <span className="text-stone-600 text-[10px]">(Auto-filled)</span>
            </label>
            <input
              type="text"
              placeholder="Auto-filled or enter botanical name"
              value={scientificName}
              onChange={e => setScientificName(e.target.value)}
              className="w-full bg-white dark:bg-stone-950 border border-stone-300 dark:border-stone-700 rounded-lg p-2 text-xs italic font-serif text-stone-800 dark:text-stone-200"
            />
          </div>
        </div>

        {/* Submit Action Bar */}
        <div className="pt-2 flex items-center justify-end gap-3">
          <button
            type="submit"
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-emerald-800 hover:bg-emerald-700 text-stone-50 font-semibold text-sm shadow-md hover:shadow-lg transition-all"
          >
            <PlusCircle className="w-5 h-5 text-emerald-300" />
            Add Tree Entry (Tree #{num})
          </button>
        </div>
      </form>
    </div>
  );
};
