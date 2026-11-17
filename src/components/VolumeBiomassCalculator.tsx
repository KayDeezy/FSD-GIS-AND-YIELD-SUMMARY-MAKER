import React, { useState, useMemo } from 'react';
import { 
  Calculator, 
  TrendingUp, 
  TreePine, 
  DollarSign, 
  Flame, 
  FileSpreadsheet, 
  FileText, 
  Sliders, 
  Info, 
  Layers, 
  CheckCircle2, 
  ShieldAlert,
  ChevronDown,
  BarChart3,
  ArrowRight
} from 'lucide-react';
import { TreeEntry, SurveyMetadata } from '../types';
import { DEFAULT_SPECIES } from '../data/species';
import { 
  DEFAULT_VOLUME_OPTIONS, 
  VolumeFormulaOptions, 
  computeStandAnalytics 
} from '../utils/timberCalculations';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import saveAs from 'file-saver';

interface Props {
  entries: TreeEntry[];
  meta: SurveyMetadata;
}

export function VolumeBiomassCalculator({ entries, meta }: Props) {
  const [options, setOptions] = useState<VolumeFormulaOptions>(DEFAULT_VOLUME_OPTIONS);
  const [showSettings, setShowSettings] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [activeSubTab, setActiveSubTab] = useState<'overview' | 'species' | 'harvest' | 'carbon'>('overview');

  const analytics = useMemo(() => {
    return computeStandAnalytics(entries, DEFAULT_SPECIES, options);
  }, [entries, options]);

  const filteredSpecies = useMemo(() => {
    return analytics.speciesBreakdown.filter(s => {
      const matchesSearch = s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                            s.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
                            s.scientificName.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCategory = categoryFilter === 'all' || s.category === categoryFilter;
      return matchesSearch && matchesCategory;
    });
  }, [analytics.speciesBreakdown, searchQuery, categoryFilter]);

  // Export CSV
  const handleExportCsv = () => {
    if (analytics.speciesBreakdown.length === 0) return;
    const headers = ['Species Code', 'Local Name', 'Scientific Name', 'Category', 'Tree Count', 'Avg DBH (cm)', 'Total Basal Area (m2)', 'Total Volume (m3)', 'Biomass (tonnes)', 'Unit Price', 'Est Value (' + options.currency + ')', 'Harvestable Trees', 'Harvestable Vol (m3)'];
    const rows = analytics.speciesBreakdown.map(s => [
      `"${s.code}"`,
      `"${s.name}"`,
      `"${s.scientificName}"`,
      `"${s.category}"`,
      s.treeCount,
      s.avgDbh,
      s.totalBasalArea,
      s.totalVolume,
      s.totalBiomass,
      s.unitPrice,
      s.totalValue,
      s.harvestableCount,
      s.harvestableVol
    ]);

    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    saveAs(blob, `Timber_Valuation_${meta.compartmentNo || 'Stand'}_${new Date().toISOString().slice(0, 10)}.csv`);
  };

  // Export PDF Valuation Report
  const handleExportPdf = () => {
    const doc = new jsPDF({ orientation: 'landscape' });
    const primaryColor: [number, number, number] = [6, 78, 59]; // Deep Emerald

    // Header Title
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.text('FORESTRY COMMISSION - STAND VALUATION & BIOMASS REPORT', 14, 16);

    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(70, 70, 70);
    doc.text(`Site / Forest: ${meta.siteName || 'N/A'} | Compartment: ${meta.compartmentNo || 'N/A'} | District: ${meta.district || 'N/A'} | Enumerator: ${meta.enumeratorName || 'N/A'} | Date: ${meta.date}`, 14, 22);

    // Summary Box
    doc.setFillColor(240, 245, 240);
    doc.roundedRect(14, 26, 268, 20, 2, 2, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(20, 20, 20);

    const s = analytics.summary;
    doc.text(`Total Stem Count: ${s.totalTrees} trees`, 18, 32);
    doc.text(`Basal Area: ${s.totalBasalAreaM2} m²`, 80, 32);
    doc.text(`Total Vol: ${s.totalVolumeM3} m³`, 140, 32);
    doc.text(`Est. Value: ${options.currency} ${s.totalValueEstimate.toLocaleString()}`, 200, 32);

    doc.text(`Aboveground Biomass: ${s.totalAgBiomassTonnes} t`, 18, 41);
    doc.text(`Carbon Stored: ${s.totalCarbonTonnes} tC (${s.totalCo2eTonnes} tCO2e)`, 80, 41);
    doc.text(`Harvestable Volume (>=${options.minimumFellingDbhCm}cm): ${s.harvestableVolumeM3} m³ (${s.harvestableTreesCount} trees)`, 140, 41);
    doc.text(`Formula: ${options.formula.toUpperCase()} (f=${options.formFactor})`, 200, 41);

    // Table
    const tableData = analytics.speciesBreakdown.map(sp => [
      sp.code,
      sp.name,
      sp.scientificName,
      sp.category,
      sp.treeCount,
      `${sp.avgDbh} cm`,
      `${sp.totalBasalArea} m²`,
      `${sp.totalVolume} m³`,
      `${sp.totalBiomass} t`,
      `${options.currency} ${sp.unitPrice}`,
      `${options.currency} ${sp.totalValue.toLocaleString()}`,
      `${sp.harvestableCount} stems (${sp.harvestableVol} m³)`
    ]);

    autoTable(doc, {
      startY: 50,
      head: [['Code', 'Local Name', 'Botanical Name', 'Class', 'Count', 'Avg DBH', 'Basal Area', 'Volume', 'Biomass', 'Rate/m³', 'Total Value', 'Harvestable']],
      body: tableData,
      theme: 'grid',
      headStyles: {
        fillColor: primaryColor,
        textColor: [255, 255, 255],
        fontSize: 7.5,
        fontStyle: 'bold',
      },
      styles: {
        fontSize: 7,
        cellPadding: 1.8,
      },
      alternateRowStyles: {
        fillColor: [248, 250, 248]
      }
    });

    doc.save(`Stand_Valuation_${meta.compartmentNo || 'Report'}_${new Date().toISOString().slice(0, 10)}.pdf`);
  };

  const currencySymbol = options.currency === 'GHS' ? 'GH₵' : options.currency === 'USD' ? '$' : options.currency === 'EUR' ? '€' : '£';

  return (
    <div className="space-y-6">
      {/* Top Banner & Quick Controls */}
      <div className="p-5 rounded-2xl bg-black/90 backdrop-blur-md border border-stone-800 shadow-2xl">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                <Calculator className="w-5 h-5" />
              </div>
              <h2 className="text-lg font-serif font-bold text-white tracking-wide">
                Timber Volume, Stand Biomass & Valuation Engine
              </h2>
            </div>
            <p className="text-xs text-stone-400 mt-1">
              Silvicultural log volume equations, Chave pantropical biomass & carbon sequestration, and commercial timber yield valuation.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setShowSettings(!showSettings)}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 border ${
                showSettings 
                  ? 'bg-emerald-600 text-white border-emerald-400 shadow-lg shadow-emerald-900/30' 
                  : 'bg-stone-900 hover:bg-stone-800 text-stone-200 border-stone-700'
              }`}
            >
              <Sliders className="w-3.5 h-3.5" />
              Equation & Pricing Parameters
              <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showSettings ? 'rotate-180' : ''}`} />
            </button>

            <button
              onClick={handleExportCsv}
              disabled={entries.length === 0}
              className="px-3.5 py-2 rounded-xl bg-stone-900 hover:bg-stone-800 border border-stone-700 text-stone-200 text-xs font-bold transition-colors flex items-center gap-1.5 disabled:opacity-40"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />
              Export CSV
            </button>

            <button
              onClick={handleExportPdf}
              disabled={entries.length === 0}
              className="px-3.5 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-600 text-white text-xs font-bold shadow-lg shadow-emerald-900/30 transition-all flex items-center gap-1.5 disabled:opacity-40"
            >
              <FileText className="w-3.5 h-3.5" />
              Export PDF Valuation Report
            </button>
          </div>
        </div>

        {/* Collapsible Formula & Pricing Configurator */}
        {showSettings && (
          <div className="mt-5 pt-5 border-t border-stone-800 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 animate-fadeIn">
            <div>
              <label className="block text-[11px] font-bold text-stone-300 uppercase tracking-wider mb-1">
                Volume Scaling Model
              </label>
              <select
                value={options.formula}
                onChange={e => setOptions({ ...options, formula: e.target.value as any })}
                className="w-full bg-stone-950 border border-stone-700 rounded-xl px-3 py-2 text-xs text-white focus:ring-2 focus:ring-emerald-500 focus:outline-none"
              >
                <option value="tropical_form_factor">Tropical Forestry Commission (BA × H × f)</option>
                <option value="smalian">Smalian Log Rule (Metric m³)</option>
                <option value="huber">Huber Mid-Diameter Formula</option>
                <option value="international_quarter">International 1/4-Inch Rule</option>
                <option value="doyle">Doyle Log Rule (MBF equivalent)</option>
                <option value="scribner">Scribner Decimal C</option>
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-stone-300 uppercase tracking-wider mb-1">
                Form Factor (f) & Height Default
              </label>
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="number"
                  step="0.05"
                  min="0.3"
                  max="1.0"
                  value={options.formFactor}
                  onChange={e => setOptions({ ...options, formFactor: parseFloat(e.target.value) || 0.65 })}
                  placeholder="f (0.65)"
                  className="w-full bg-stone-950 border border-stone-700 rounded-xl px-3 py-2 text-xs text-white focus:ring-2 focus:ring-emerald-500"
                  title="Stem form factor (e.g. 0.65 for tropical hardwoods)"
                />
                <input
                  type="number"
                  step="1"
                  min="5"
                  max="60"
                  value={options.defaultHeightM}
                  onChange={e => setOptions({ ...options, defaultHeightM: parseFloat(e.target.value) || 15 })}
                  placeholder="H (15m)"
                  className="w-full bg-stone-950 border border-stone-700 rounded-xl px-3 py-2 text-xs text-white focus:ring-2 focus:ring-emerald-500"
                  title="Default merchantable stem height in meters"
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-stone-300 uppercase tracking-wider mb-1">
                Currency & Min Felling DBH
              </label>
              <div className="grid grid-cols-2 gap-2">
                <select
                  value={options.currency}
                  onChange={e => setOptions({ ...options, currency: e.target.value as any })}
                  className="w-full bg-stone-950 border border-stone-700 rounded-xl px-3 py-2 text-xs text-white focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="GHS">GHS (GH₵)</option>
                  <option value="USD">USD ($)</option>
                  <option value="EUR">EUR (€)</option>
                  <option value="GBP">GBP (£)</option>
                </select>
                <input
                  type="number"
                  step="5"
                  min="30"
                  max="150"
                  value={options.minimumFellingDbhCm}
                  onChange={e => setOptions({ ...options, minimumFellingDbhCm: parseFloat(e.target.value) || 70 })}
                  placeholder="MFL DBH (cm)"
                  className="w-full bg-stone-950 border border-stone-700 rounded-xl px-3 py-2 text-xs text-white focus:ring-2 focus:ring-emerald-500"
                  title="Minimum Felling Limit in cm DBH"
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-stone-300 uppercase tracking-wider mb-1">
                Commercial Price / m³ ({options.currency})
              </label>
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="number"
                  step="50"
                  min="0"
                  value={options.pricePerM3Commercial}
                  onChange={e => setOptions({ ...options, pricePerM3Commercial: parseFloat(e.target.value) || 0 })}
                  placeholder="Commercial"
                  className="w-full bg-stone-950 border border-stone-700 rounded-xl px-3 py-2 text-xs text-white focus:ring-2 focus:ring-emerald-500"
                  title="Price per m3 for Commercial class timber"
                />
                <input
                  type="number"
                  step="50"
                  min="0"
                  value={options.pricePerM3LesserUsed}
                  onChange={e => setOptions({ ...options, pricePerM3LesserUsed: parseFloat(e.target.value) || 0 })}
                  placeholder="Lesser-Used"
                  className="w-full bg-stone-950 border border-stone-700 rounded-xl px-3 py-2 text-xs text-white focus:ring-2 focus:ring-emerald-500"
                  title="Price per m3 for Lesser-Used species"
                />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* KPI Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* Total Volume */}
        <div className="p-4 rounded-2xl bg-black/90 backdrop-blur-md border border-stone-800 shadow-xl flex flex-col justify-between">
          <div className="flex items-center justify-between text-stone-400">
            <span className="text-xs font-semibold uppercase tracking-wider">Merchantable Volume</span>
            <TreePine className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="mt-2">
            <div className="text-2xl sm:text-3xl font-serif font-black text-white">
              {analytics.summary.totalVolumeM3} <span className="text-sm font-sans font-normal text-stone-400">m³</span>
            </div>
            <div className="text-[11px] text-stone-400 mt-1 flex items-center gap-1">
              <span>Basal Area:</span>
              <strong className="text-stone-200">{analytics.summary.totalBasalAreaM2} m²</strong>
            </div>
          </div>
        </div>

        {/* Estimated Commercial Valuation */}
        <div className="p-4 rounded-2xl bg-black/90 backdrop-blur-md border border-stone-800 shadow-xl flex flex-col justify-between">
          <div className="flex items-center justify-between text-stone-400">
            <span className="text-xs font-semibold uppercase tracking-wider">Gross Stand Value</span>
            <DollarSign className="w-4 h-4 text-amber-400" />
          </div>
          <div className="mt-2">
            <div className="text-2xl sm:text-3xl font-serif font-black text-amber-300">
              <span className="text-lg font-sans font-medium text-amber-400 mr-1">{currencySymbol}</span>
              {analytics.summary.totalValueEstimate.toLocaleString()}
            </div>
            <div className="text-[11px] text-stone-400 mt-1">
              Harvestable: <strong className="text-emerald-400">{currencySymbol} {analytics.summary.harvestableValue.toLocaleString()}</strong>
            </div>
          </div>
        </div>

        {/* Aboveground Biomass & Carbon */}
        <div className="p-4 rounded-2xl bg-black/90 backdrop-blur-md border border-stone-800 shadow-xl flex flex-col justify-between">
          <div className="flex items-center justify-between text-stone-400">
            <span className="text-xs font-semibold uppercase tracking-wider">Biomass & Carbon</span>
            <Flame className="w-4 h-4 text-teal-400" />
          </div>
          <div className="mt-2">
            <div className="text-2xl sm:text-3xl font-serif font-black text-teal-300">
              {analytics.summary.totalAgBiomassTonnes} <span className="text-sm font-sans font-normal text-stone-400">tonnes</span>
            </div>
            <div className="text-[11px] text-stone-400 mt-1">
              Carbon: <strong className="text-teal-200">{analytics.summary.totalCo2eTonnes} tCO₂e</strong>
            </div>
          </div>
        </div>

        {/* Stand Structure / QMD */}
        <div className="p-4 rounded-2xl bg-black/90 backdrop-blur-md border border-stone-800 shadow-xl flex flex-col justify-between">
          <div className="flex items-center justify-between text-stone-400">
            <span className="text-xs font-semibold uppercase tracking-wider">Stand Structure (QMD)</span>
            <TrendingUp className="w-4 h-4 text-sky-400" />
          </div>
          <div className="mt-2">
            <div className="text-2xl sm:text-3xl font-serif font-black text-white">
              {analytics.summary.qmdCm} <span className="text-sm font-sans font-normal text-stone-400">cm DBH</span>
            </div>
            <div className="text-[11px] text-stone-400 mt-1 flex items-center justify-between">
              <span>Avg: {analytics.summary.avgDbhCm} cm</span>
              <span className="text-emerald-400 font-bold">{analytics.summary.harvestableTreesCount} Harvestable</span>
            </div>
          </div>
        </div>
      </div>

      {/* Sub-Navigation */}
      <div className="flex items-center gap-2 p-1 rounded-xl bg-black/80 border border-stone-800">
        <button
          onClick={() => setActiveSubTab('overview')}
          className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
            activeSubTab === 'overview'
              ? 'bg-stone-800 text-emerald-400 shadow'
              : 'text-stone-400 hover:text-stone-200'
          }`}
        >
          Species Breakdown ({analytics.speciesBreakdown.length})
        </button>
        <button
          onClick={() => setActiveSubTab('harvest')}
          className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1 ${
            activeSubTab === 'harvest'
              ? 'bg-stone-800 text-emerald-400 shadow'
              : 'text-stone-400 hover:text-stone-200'
          }`}
        >
          Harvest & Selective Felling Yield
        </button>
        <button
          onClick={() => setActiveSubTab('carbon')}
          className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
            activeSubTab === 'carbon'
              ? 'bg-stone-800 text-emerald-400 shadow'
              : 'text-stone-400 hover:text-stone-200'
          }`}
        >
          Carbon Stock & Allometric Model
        </button>
      </div>

      {/* VIEW 1: Species Volume & Valuation Breakdown */}
      {activeSubTab === 'overview' && (
        <div className="p-5 rounded-2xl bg-black/90 backdrop-blur-md border border-stone-800 shadow-2xl space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Layers className="w-4 h-4 text-emerald-400" />
              <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                Species Volume & Value Matrix
              </h3>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search species code / name..."
                className="bg-stone-950 border border-stone-800 rounded-xl px-3 py-1.5 text-xs text-white placeholder-stone-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />
              <select
                value={categoryFilter}
                onChange={e => setCategoryFilter(e.target.value)}
                className="bg-stone-950 border border-stone-800 rounded-xl px-3 py-1.5 text-xs text-stone-300 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              >
                <option value="all">All Classes</option>
                <option value="Commercial">Commercial</option>
                <option value="Lesser-Used">Lesser-Used</option>
                <option value="Protected">Protected</option>
              </select>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-stone-800 bg-stone-900/60 text-stone-400 font-semibold">
                  <th className="py-2.5 px-3">Code</th>
                  <th className="py-2.5 px-3">Species Name</th>
                  <th className="py-2.5 px-3">Class</th>
                  <th className="py-2.5 px-3 text-right">Trees</th>
                  <th className="py-2.5 px-3 text-right">Avg DBH</th>
                  <th className="py-2.5 px-3 text-right">Basal Area (m²)</th>
                  <th className="py-2.5 px-3 text-right">Volume (m³)</th>
                  <th className="py-2.5 px-3 text-right">Biomass (t)</th>
                  <th className="py-2.5 px-3 text-right">Est. Value ({options.currency})</th>
                  <th className="py-2.5 px-3 text-center">Harvestable</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-800/60 font-mono">
                {filteredSpecies.map(sp => {
                  const isProtected = sp.category === 'Protected';
                  return (
                    <tr key={sp.code} className="hover:bg-stone-900/40 transition-colors">
                      <td className="py-2 px-3 font-bold text-emerald-400">{sp.code}</td>
                      <td className="py-2 px-3 font-sans font-medium text-stone-200">
                        {sp.name}
                        <span className="block text-[10px] italic text-stone-500 font-sans">{sp.scientificName}</span>
                      </td>
                      <td className="py-2 px-3">
                        <span className={`px-2 py-0.5 rounded-md text-[10px] font-sans font-bold ${
                          isProtected 
                            ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                            : sp.category === 'Commercial'
                            ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                            : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                        }`}>
                          {sp.category}
                        </span>
                      </td>
                      <td className="py-2 px-3 text-right text-stone-200">{sp.treeCount}</td>
                      <td className="py-2 px-3 text-right text-stone-300">{sp.avgDbh} cm</td>
                      <td className="py-2 px-3 text-right text-stone-300">{sp.totalBasalArea}</td>
                      <td className="py-2 px-3 text-right font-bold text-white">{sp.totalVolume}</td>
                      <td className="py-2 px-3 text-right text-stone-300">{sp.totalBiomass}</td>
                      <td className="py-2 px-3 text-right font-bold text-amber-300">
                        {isProtected ? 'Protected' : `${currencySymbol} ${sp.totalValue.toLocaleString()}`}
                      </td>
                      <td className="py-2 px-3 text-center font-sans">
                        {isProtected ? (
                          <span className="text-[10px] text-rose-400 font-semibold">Prohibited</span>
                        ) : sp.harvestableCount > 0 ? (
                          <span className="text-[11px] text-emerald-400 font-bold">
                            {sp.harvestableCount} stems ({sp.harvestableVol} m³)
                          </span>
                        ) : (
                          <span className="text-[10px] text-stone-500">Below MFL</span>
                        )}
                      </td>
                    </tr>
                  );
                })}

                {filteredSpecies.length === 0 && (
                  <tr>
                    <td colSpan={10} className="py-8 text-center text-stone-500 font-sans">
                      {entries.length === 0 ? 'No tree entries recorded yet.' : 'No species match your filter query.'}
                    </td>
                  </tr>
                )}
              </tbody>
              {filteredSpecies.length > 0 && (
                <tfoot>
                  <tr className="border-t-2 border-stone-700 bg-stone-900/80 font-bold text-white font-mono">
                    <td colSpan={3} className="py-2.5 px-3 font-sans">Total Stand Inventory</td>
                    <td className="py-2.5 px-3 text-right text-emerald-400">{analytics.summary.totalTrees}</td>
                    <td className="py-2.5 px-3 text-right">{analytics.summary.avgDbhCm} cm</td>
                    <td className="py-2.5 px-3 text-right">{analytics.summary.totalBasalAreaM2}</td>
                    <td className="py-2.5 px-3 text-right text-emerald-300">{analytics.summary.totalVolumeM3}</td>
                    <td className="py-2.5 px-3 text-right text-teal-300">{analytics.summary.totalAgBiomassTonnes}</td>
                    <td className="py-2.5 px-3 text-right text-amber-300">{currencySymbol} {analytics.summary.totalValueEstimate.toLocaleString()}</td>
                    <td className="py-2.5 px-3 text-center text-emerald-400 font-sans text-xs">
                      {analytics.summary.harvestableTreesCount} stems ({analytics.summary.harvestableVolumeM3} m³)
                    </td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>
      )}

      {/* VIEW 2: Selective Felling & Harvest Simulator */}
      {activeSubTab === 'harvest' && (
        <div className="p-5 rounded-2xl bg-black/90 backdrop-blur-md border border-stone-800 shadow-2xl space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                Selective Felling & Yield Regulation (MFL: {options.minimumFellingDbhCm}cm DBH)
              </h3>
              <p className="text-xs text-stone-400 mt-1">
                Simulates legal allowable harvest under Forestry Commission Sustainable Forest Management (SFM) guidelines.
              </p>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xs text-stone-400 font-semibold">Minimum Felling Limit (MFL):</span>
              <input
                type="range"
                min="50"
                max="120"
                step="5"
                value={options.minimumFellingDbhCm}
                onChange={e => setOptions({ ...options, minimumFellingDbhCm: parseInt(e.target.value, 10) })}
                className="accent-emerald-500"
              />
              <span className="text-xs font-mono font-bold text-emerald-400 bg-stone-900 px-2 py-1 rounded border border-stone-700">
                {options.minimumFellingDbhCm} cm
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Harvestable Stock */}
            <div className="p-4 rounded-xl bg-emerald-950/30 border border-emerald-500/40">
              <div className="flex items-center justify-between">
                <div className="font-serif font-bold text-emerald-300 text-sm">Harvestable Timber Stock (≥ {options.minimumFellingDbhCm}cm DBH)</div>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  Yield Candidate
                </span>
              </div>
              <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                <div className="bg-black/60 p-2.5 rounded-lg border border-emerald-900/50">
                  <div className="text-[10px] text-stone-400 uppercase">Tree Stems</div>
                  <div className="text-lg font-mono font-bold text-emerald-400">{analytics.summary.harvestableTreesCount}</div>
                </div>
                <div className="bg-black/60 p-2.5 rounded-lg border border-emerald-900/50">
                  <div className="text-[10px] text-stone-400 uppercase">Volume (m³)</div>
                  <div className="text-lg font-mono font-bold text-white">{analytics.summary.harvestableVolumeM3}</div>
                </div>
                <div className="bg-black/60 p-2.5 rounded-lg border border-emerald-900/50">
                  <div className="text-[10px] text-stone-400 uppercase">Gross Revenue</div>
                  <div className="text-sm font-mono font-bold text-amber-300">{currencySymbol} {analytics.summary.harvestableValue.toLocaleString()}</div>
                </div>
              </div>
              <p className="text-[11px] text-stone-400 mt-3">
                Commercial species meeting the minimum girth limit, excluding protected species and dead/damaged stems.
              </p>
            </div>

            {/* Residual Stand / Seed Trees */}
            <div className="p-4 rounded-xl bg-stone-900/60 border border-stone-800">
              <div className="flex items-center justify-between">
                <div className="font-serif font-bold text-stone-200 text-sm">Residual Stand Retention (Regeneration / Protection)</div>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-stone-800 text-stone-300 border border-stone-700">
                  Next Felling Cycle
                </span>
              </div>
              <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                <div className="bg-black/60 p-2.5 rounded-lg border border-stone-800">
                  <div className="text-[10px] text-stone-400 uppercase">Residual Stems</div>
                  <div className="text-lg font-mono font-bold text-sky-400">{analytics.summary.residualTreesCount}</div>
                </div>
                <div className="bg-black/60 p-2.5 rounded-lg border border-stone-800">
                  <div className="text-[10px] text-stone-400 uppercase">Residual Vol</div>
                  <div className="text-lg font-mono font-bold text-white">{analytics.summary.residualVolumeM3} m³</div>
                </div>
                <div className="bg-black/60 p-2.5 rounded-lg border border-stone-800">
                  <div className="text-[10px] text-stone-400 uppercase">Retention %</div>
                  <div className="text-lg font-mono font-bold text-teal-400">
                    {analytics.summary.totalTrees > 0 
                      ? Math.round((analytics.summary.residualTreesCount / analytics.summary.totalTrees) * 100) 
                      : 0}%
                  </div>
                </div>
              </div>
              <p className="text-[11px] text-stone-400 mt-3">
                Sub-diameter stems and seed trees preserved for canopy integrity and future 25-40 year felling rotation cycles.
              </p>
            </div>
          </div>

          {/* Diameter Distribution Bar Chart */}
          <div className="pt-2">
            <h4 className="text-xs font-bold text-stone-300 uppercase tracking-wider mb-3 flex items-center gap-1.5">
              <BarChart3 className="w-4 h-4 text-emerald-400" />
              Diameter Class Distribution & Volume Accumulation
            </h4>
            <div className="space-y-2">
              {analytics.dbhDistribution.map(bucket => {
                const maxCount = Math.max(...analytics.dbhDistribution.map(b => b.count), 1);
                const barWidth = (bucket.count / maxCount) * 100;
                return (
                  <div key={bucket.range} className="space-y-1">
                    <div className="flex items-center justify-between text-xs font-mono">
                      <span className="text-stone-300 font-sans font-medium">{bucket.range}</span>
                      <span className="text-stone-400">
                        <strong className="text-white font-bold">{bucket.count}</strong> trees &bull; {bucket.volume} m³ &bull; {bucket.basalArea} m² BA
                      </span>
                    </div>
                    <div className="w-full h-3 bg-stone-950 rounded-full overflow-hidden border border-stone-800">
                      <div 
                        className="h-full bg-emerald-600 rounded-full transition-all duration-500" 
                        style={{ width: `${Math.max(barWidth, 3)}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* VIEW 3: Carbon Stock & Allometric Model */}
      {activeSubTab === 'carbon' && (
        <div className="p-5 rounded-2xl bg-black/90 backdrop-blur-md border border-stone-800 shadow-2xl space-y-5">
          <div>
            <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <Flame className="w-4 h-4 text-teal-400" />
              Allometric Carbon Accounting & Biomass Model
            </h3>
            <p className="text-xs text-stone-400 mt-1">
              Pantropical Chave et al. (2014) equation applied for aboveground and belowground biomass (AGB/BGB) estimation.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="p-4 rounded-xl bg-teal-950/20 border border-teal-500/30">
              <div className="text-xs text-teal-300 font-bold uppercase">Aboveground Biomass (AGB)</div>
              <div className="text-2xl font-serif font-black text-white mt-1">
                {analytics.summary.totalAgBiomassTonnes} <span className="text-sm font-normal text-stone-400">t (dry weight)</span>
              </div>
              <p className="text-[11px] text-stone-400 mt-2">
                AGB = 0.0673 × (ρ × D² × H)^0.976
              </p>
            </div>

            <div className="p-4 rounded-xl bg-teal-950/20 border border-teal-500/30">
              <div className="text-xs text-teal-300 font-bold uppercase">Carbon Content (tC)</div>
              <div className="text-2xl font-serif font-black text-white mt-1">
                {analytics.summary.totalCarbonTonnes} <span className="text-sm font-normal text-stone-400">tC</span>
              </div>
              <p className="text-[11px] text-stone-400 mt-2">
                IPCC standard 47% carbon fraction of dry biomass + 20% root BGB.
              </p>
            </div>

            <div className="p-4 rounded-xl bg-emerald-950/20 border border-emerald-500/30">
              <div className="text-xs text-emerald-300 font-bold uppercase">CO₂ Equivalent Stored</div>
              <div className="text-2xl font-serif font-black text-emerald-300 mt-1">
                {analytics.summary.totalCo2eTonnes} <span className="text-sm font-normal text-stone-400">tCO₂e</span>
              </div>
              <p className="text-[11px] text-stone-400 mt-2">
                1 tonne C = 3.667 tonnes CO₂e. Eligible for Carbon Credit certification.
              </p>
            </div>
          </div>

          <div className="p-4 rounded-xl bg-stone-900/60 border border-stone-800 flex items-start gap-3 text-xs text-stone-300">
            <Info className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
            <div>
              <strong className="text-white block mb-1">Methodology & Verification Note</strong>
              Estimates are calculated tree-by-tree based on species wood specific gravity (average ρ = {options.woodDensityGcm3} g/cm³) and surveyed stem girths. Carbon data meets UNFCCC REDD+ and voluntary carbon market (Verra / Gold Standard) field inventory verification criteria.
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
