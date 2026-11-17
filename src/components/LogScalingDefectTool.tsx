import React, { useState } from 'react';
import { 
  Ruler, 
  Trash2, 
  Plus, 
  Download, 
  FileText, 
  CheckCircle2, 
  AlertTriangle, 
  Layers, 
  Info,
  RotateCcw,
  Sparkles,
  Scissors
} from 'lucide-react';
import { DEFAULT_SPECIES } from '../data/species';
import { 
  LogScalingItem, 
  calculateLogScale 
} from '../utils/timberCalculations';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import saveAs from 'file-saver';

export function LogScalingDefectTool() {
  // Input fields for current log (start blank without pre-entered examples)
  const [logNumber, setLogNumber] = useState('');
  const [speciesCode, setSpeciesCode] = useState('');
  const [lengthM, setLengthM] = useState<string>('');
  const [smallEndDiamCm, setSmallEndDiamCm] = useState<string>('');
  const [largeEndDiamCm, setLargeEndDiamCm] = useState<string>('');
  const [defectType, setDefectType] = useState<LogScalingItem['defectType']>('None');
  const [defectDiamCm, setDefectDiamCm] = useState<string>('');
  const [defectLengthM, setDefectLengthM] = useState<string>('');

  // Scaled Logs History / Batch Consignment
  const [logList, setLogList] = useState<LogScalingItem[]>([]);

  const parsedLengthM = parseFloat(lengthM) || 0;
  const parsedSedCm = parseFloat(smallEndDiamCm) || 0;
  const parsedLedCm = parseFloat(largeEndDiamCm) || 0;
  const parsedDefectDiamCm = parseFloat(defectDiamCm) || 0;
  const parsedDefectLengthM = parseFloat(defectLengthM) || 0;

  const hasValidDimensions = parsedLengthM > 0 && parsedSedCm > 0 && parsedLedCm > 0;
  const canSubmit = Boolean(logNumber.trim() && speciesCode && hasValidDimensions);

  // Current calculation preview
  const currentSpecies = DEFAULT_SPECIES.find(s => s.code === speciesCode) || {
    code: speciesCode,
    localName: speciesCode ? 'Selected Species' : '',
    scientificName: ''
  };

  const currentScale = hasValidDimensions
    ? calculateLogScale(
        parsedLengthM,
        parsedSedCm,
        parsedLedCm,
        defectType,
        parsedDefectDiamCm,
        parsedDefectLengthM
      )
    : {
        grossVolumeM3: 0,
        defectDeductionM3: 0,
        netVolumeM3: 0,
        recoveryPercentage: 0,
        grade: 'Standard Sawlog' as const
      };

  // Add log to batch
  const handleAddLogToBatch = () => {
    if (!canSubmit) return;

    const newItem: LogScalingItem = {
      id: `log_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
      logNumber: logNumber.trim(),
      speciesCode,
      speciesName: currentSpecies.scientificName
        ? `${currentSpecies.localName} (${currentSpecies.scientificName})`
        : currentSpecies.localName,
      lengthM: parsedLengthM,
      smallEndDiamCm: parsedSedCm,
      largeEndDiamCm: parsedLedCm,
      defectType,
      defectDiamCm: defectType !== 'None' ? parsedDefectDiamCm : 0,
      defectLengthM: defectType !== 'None' ? parsedDefectLengthM : 0,
      ...currentScale
    };

    setLogList(prev => [newItem, ...prev]);

    // Auto-increment log number if trailing digits exist
    const match = logNumber.trim().match(/^(.*?)(\d+)$/);
    if (match) {
      const prefix = match[1];
      const nextNum = (parseInt(match[2], 10) + 1).toString().padStart(match[2].length, '0');
      setLogNumber(`${prefix}${nextNum}`);
    } else {
      setLogNumber('');
    }
    setLengthM('');
    setSmallEndDiamCm('');
    setLargeEndDiamCm('');
    setDefectType('None');
    setDefectDiamCm('');
    setDefectLengthM('');
  };

  const handleRemoveLog = (id: string) => {
    setLogList(prev => prev.filter(l => l.id !== id));
  };

  // Batch Totals
  const totalGrossVol = logList.reduce((sum, l) => sum + l.grossVolumeM3, 0);
  const totalDefectDeduction = logList.reduce((sum, l) => sum + l.defectDeductionM3, 0);
  const totalNetVol = logList.reduce((sum, l) => sum + l.netVolumeM3, 0);
  const overallRecoveryPct = totalGrossVol > 0 ? (totalNetVol / totalGrossVol) * 100 : 100;

  // Export PDF Log Scale Ticket
  const handleExportPdfTicket = () => {
    const doc = new jsPDF();
    const primaryColor: [number, number, number] = [6, 78, 59];

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.text('OFFICIAL TIMBER LOG SCALING & DEFECT REPORT', 14, 18);

    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(80, 80, 80);
    doc.text(`Log Landing / Mill Yard Checkpoint | Date: ${new Date().toLocaleDateString()} | Dennis Obeng Timber Suite`, 14, 25);

    // Summary Box
    doc.setFillColor(245, 250, 245);
    doc.roundedRect(14, 29, 182, 18, 2, 2, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(20, 20, 20);
    doc.text(`Total Logs Scaled: ${logList.length}`, 18, 36);
    doc.text(`Gross Vol: ${totalGrossVol.toFixed(3)} m³`, 65, 36);
    doc.text(`Deductions: ${totalDefectDeduction.toFixed(3)} m³`, 115, 36);
    doc.text(`Net Scale: ${totalNetVol.toFixed(3)} m³ (${overallRecoveryPct.toFixed(1)}% Rec)`, 18, 43);

    const tableData = logList.map(l => [
      l.logNumber,
      l.speciesCode,
      l.speciesName,
      `${l.lengthM}m`,
      `${l.smallEndDiamCm}/${l.largeEndDiamCm}cm`,
      l.defectType.replace('_', ' '),
      `${l.grossVolumeM3} m³`,
      `${l.defectDeductionM3} m³`,
      `${l.netVolumeM3} m³`,
      `${l.recoveryPercentage}%`,
      l.grade
    ]);

    autoTable(doc, {
      startY: 52,
      head: [['Log #', 'Code', 'Species', 'Length', 'SED/LED', 'Defect', 'Gross', 'Deduct', 'Net Vol', 'Rec %', 'Grade']],
      body: tableData,
      theme: 'grid',
      headStyles: {
        fillColor: primaryColor,
        textColor: [255, 255, 255],
        fontSize: 8,
        fontStyle: 'bold'
      },
      styles: {
        fontSize: 7.5,
        cellPadding: 2
      }
    });

    doc.save(`Log_Scale_Ticket_${new Date().toISOString().slice(0, 10)}.pdf`);
  };

  // Export CSV
  const handleExportCsv = () => {
    const headers = ['Log Number', 'Species Code', 'Species Name', 'Length (m)', 'Small End Diam (cm)', 'Large End Diam (cm)', 'Defect Type', 'Defect Diam (cm)', 'Defect Length (m)', 'Gross Vol (m3)', 'Deduction (m3)', 'Net Vol (m3)', 'Recovery %', 'Grade'];
    const rows = logList.map(l => [
      `"${l.logNumber}"`,
      `"${l.speciesCode}"`,
      `"${l.speciesName}"`,
      l.lengthM,
      l.smallEndDiamCm,
      l.largeEndDiamCm,
      `"${l.defectType}"`,
      l.defectDiamCm || 0,
      l.defectLengthM || 0,
      l.grossVolumeM3,
      l.defectDeductionM3,
      l.netVolumeM3,
      l.recoveryPercentage,
      `"${l.grade}"`
    ]);

    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    saveAs(blob, `Log_Scaling_Batch_${new Date().toISOString().slice(0, 10)}.csv`);
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="p-5 rounded-2xl bg-black/90 backdrop-blur-md border border-stone-800 shadow-2xl">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                <Ruler className="w-5 h-5" />
              </div>
              <h2 className="text-lg font-serif font-bold text-white tracking-wide">
                Log Scaling & Defect Deduction Calculator
              </h2>
            </div>
            <p className="text-xs text-stone-400 mt-1">
              Smalian geometric log scaling, pipe rot, sweep/crook deductions, net recovery rate %, and sawmill grade classification.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={handleExportCsv}
              disabled={logList.length === 0}
              className="px-3.5 py-2 rounded-xl bg-stone-900 hover:bg-stone-800 border border-stone-700 text-stone-200 text-xs font-bold transition-colors flex items-center gap-1.5 disabled:opacity-40"
            >
              <FileText className="w-3.5 h-3.5 text-emerald-400" />
              Export Batch CSV
            </button>
            <button
              onClick={handleExportPdfTicket}
              disabled={logList.length === 0}
              className="px-3.5 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-600 text-white text-xs font-bold shadow-lg shadow-emerald-900/30 transition-all flex items-center gap-1.5 disabled:opacity-40"
            >
              <Download className="w-3.5 h-3.5" />
              Export Log Scale Ticket (PDF)
            </button>
          </div>
        </div>
      </div>

      {/* Main Grid: Log Scaler Form & Real-time Cross Section Visualizer */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Form Inputs */}
        <div className="p-5 rounded-2xl bg-black/90 backdrop-blur-md border border-stone-800 shadow-2xl space-y-4">
          <div className="font-serif font-bold text-sm text-white flex items-center gap-2 pb-2 border-b border-stone-800">
            <Scissors className="w-4 h-4 text-emerald-400" />
            Log Measurement & Defect Input
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-bold text-stone-300 uppercase tracking-wider mb-1">
                Log Tag / Number
              </label>
              <input
                type="text"
                value={logNumber}
                onChange={e => setLogNumber(e.target.value)}
                placeholder="Enter log tag / #"
                className="w-full bg-stone-950 border border-stone-700 rounded-xl px-3 py-2 text-xs text-white placeholder-stone-500 font-mono focus:ring-2 focus:ring-emerald-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-stone-300 uppercase tracking-wider mb-1">
                Species
              </label>
              <select
                value={speciesCode}
                onChange={e => setSpeciesCode(e.target.value)}
                className="w-full bg-stone-950 border border-stone-700 rounded-xl px-3 py-2 text-xs text-white focus:ring-2 focus:ring-emerald-500 focus:outline-none"
              >
                <option value="">Select species...</option>
                {DEFAULT_SPECIES.map(s => (
                  <option key={s.code} value={s.code}>
                    {s.code} - {s.localName}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-[11px] font-bold text-stone-300 uppercase tracking-wider mb-1">
                Length (m)
              </label>
              <input
                type="number"
                step="0.1"
                min="0.5"
                max="30"
                value={lengthM}
                onChange={e => setLengthM(e.target.value)}
                placeholder="m"
                className="w-full bg-stone-950 border border-stone-700 rounded-xl px-3 py-2 text-xs text-white placeholder-stone-500 font-mono focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-stone-300 uppercase tracking-wider mb-1">
                Small End (cm)
              </label>
              <input
                type="number"
                step="1"
                min="1"
                max="250"
                value={smallEndDiamCm}
                onChange={e => setSmallEndDiamCm(e.target.value)}
                placeholder="SED"
                className="w-full bg-stone-950 border border-stone-700 rounded-xl px-3 py-2 text-xs text-white placeholder-stone-500 font-mono focus:ring-2 focus:ring-emerald-500"
                title="Small End Diameter (SED)"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-stone-300 uppercase tracking-wider mb-1">
                Large End (cm)
              </label>
              <input
                type="number"
                step="1"
                min="1"
                max="300"
                value={largeEndDiamCm}
                onChange={e => setLargeEndDiamCm(e.target.value)}
                placeholder="LED"
                className="w-full bg-stone-950 border border-stone-700 rounded-xl px-3 py-2 text-xs text-white placeholder-stone-500 font-mono focus:ring-2 focus:ring-emerald-500"
                title="Large End Diameter (LED)"
              />
            </div>
          </div>

          <div className="pt-2 border-t border-stone-800 space-y-3">
            <div>
              <label className="block text-[11px] font-bold text-stone-300 uppercase tracking-wider mb-1">
                Defect Type
              </label>
              <select
                value={defectType}
                onChange={e => setDefectType(e.target.value as any)}
                className="w-full bg-stone-950 border border-stone-700 rounded-xl px-3 py-2 text-xs text-white focus:ring-2 focus:ring-emerald-500 focus:outline-none"
              >
                <option value="None">Sound Log (No Major Defects)</option>
                <option value="Hollow_Heart">Hollow Heart / Center Pipe Rot</option>
                <option value="Crook_Sweep">Crook / Sweep Curvature</option>
                <option value="Ring_Shake">Ring Shake / Internal Split</option>
                <option value="Butt_Rot">Butt Rot / Base Fluting</option>
                <option value="Sapwood_Rot">Sapwood Decay / Borer Damage</option>
              </select>
            </div>

            {defectType !== 'None' && (
              <div className="grid grid-cols-2 gap-3 p-3 rounded-xl bg-amber-950/20 border border-amber-500/30 animate-fadeIn">
                <div>
                  <label className="block text-[10px] font-bold text-amber-300 uppercase tracking-wider mb-1">
                    {defectType === 'Crook_Sweep' ? 'Deflection (cm)' : 'Defect Diam (cm)'}
                  </label>
                  <input
                    type="number"
                    step="1"
                    min="1"
                    value={defectDiamCm}
                    onChange={e => setDefectDiamCm(e.target.value)}
                    placeholder="cm"
                    className="w-full bg-stone-950 border border-amber-500/40 rounded-xl px-3 py-2 text-xs text-white placeholder-stone-500 font-mono focus:ring-2 focus:ring-amber-500"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-amber-300 uppercase tracking-wider mb-1">
                    Defect Length (m)
                  </label>
                  <input
                    type="number"
                    step="0.5"
                    min="0.5"
                    max={parsedLengthM || 30}
                    value={defectLengthM}
                    onChange={e => setDefectLengthM(e.target.value)}
                    placeholder="m"
                    className="w-full bg-stone-950 border border-amber-500/40 rounded-xl px-3 py-2 text-xs text-white placeholder-stone-500 font-mono focus:ring-2 focus:ring-amber-500"
                  />
                </div>
              </div>
            )}
          </div>

          <button
            onClick={handleAddLogToBatch}
            disabled={!canSubmit}
            className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold text-xs transition-all shadow-lg shadow-emerald-900/30 flex items-center justify-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Add Scaled Log to Consignment Batch
          </button>
        </div>

        {/* Real-time Calculation & Geometric Cross-Section */}
        <div className="lg:col-span-2 p-5 rounded-2xl bg-black/90 backdrop-blur-md border border-stone-800 shadow-2xl flex flex-col justify-between space-y-4">
          <div>
            <div className="flex items-center justify-between pb-2 border-b border-stone-800">
              <div className="font-serif font-bold text-sm text-white flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-amber-400" />
                Live Scale Results & Recovery Preview
              </div>
              <span className={`px-2.5 py-0.5 rounded-md text-xs font-bold ${
                !hasValidDimensions
                  ? 'bg-stone-800 text-stone-400 border border-stone-700'
                  : currentScale.grade === 'Prime / Export'
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                  : currentScale.grade === 'Standard Sawlog'
                  ? 'bg-sky-500/20 text-sky-300 border border-sky-500/30'
                  : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
              }`}>
                {hasValidDimensions ? currentScale.grade : 'Awaiting Input'}
              </span>
            </div>

            {/* Results 4-Card Summary */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4">
              <div className="p-3 rounded-xl bg-stone-950 border border-stone-800 text-center">
                <div className="text-[10px] text-stone-400 uppercase font-semibold">Gross Smalian Vol</div>
                <div className="text-lg font-mono font-bold text-white mt-0.5">{currentScale.grossVolumeM3} <span className="text-xs font-normal text-stone-400">m³</span></div>
              </div>

              <div className="p-3 rounded-xl bg-stone-950 border border-stone-800 text-center">
                <div className="text-[10px] text-stone-400 uppercase font-semibold">Defect Deduction</div>
                <div className="text-lg font-mono font-bold text-rose-400 mt-0.5">-{currentScale.defectDeductionM3} <span className="text-xs font-normal text-stone-400">m³</span></div>
              </div>

              <div className="p-3 rounded-xl bg-emerald-950/30 border border-emerald-500/40 text-center">
                <div className="text-[10px] text-emerald-300 uppercase font-bold">Net Scale Volume</div>
                <div className="text-lg font-mono font-bold text-emerald-400 mt-0.5">{currentScale.netVolumeM3} <span className="text-xs font-normal text-stone-400">m³</span></div>
              </div>

              <div className="p-3 rounded-xl bg-stone-950 border border-stone-800 text-center">
                <div className="text-[10px] text-stone-400 uppercase font-semibold">Recovery Rate</div>
                <div className="text-lg font-mono font-bold text-teal-300 mt-0.5">{currentScale.recoveryPercentage}%</div>
              </div>
            </div>

            {/* Visual Log End Profile Diagram */}
            <div className="mt-4 p-4 rounded-xl bg-[#0c0f0d] border border-stone-800 flex flex-col sm:flex-row items-center justify-around gap-4">
              <div className="text-center">
                <div className="text-[11px] text-stone-400 font-semibold mb-2">
                  Cross-Section Profile ({parsedSedCm > 0 ? `SED: ${parsedSedCm}cm` : 'Enter SED'})
                </div>
                <div className="relative w-28 h-28 mx-auto rounded-full bg-amber-900/40 border-4 border-amber-700/80 flex items-center justify-center shadow-inner">
                  {/* Growth rings simulation */}
                  <div className="w-20 h-20 rounded-full border border-amber-600/30 flex items-center justify-center">
                    <div className="w-12 h-12 rounded-full border border-amber-600/20" />
                  </div>
                  {defectType !== 'None' && parsedDefectDiamCm > 0 && parsedSedCm > 0 && (
                    <div 
                      className="absolute rounded-full bg-rose-950/90 border-2 border-rose-500 flex items-center justify-center text-[9px] text-rose-200 font-bold"
                      style={{
                        width: `${Math.min(90, (parsedDefectDiamCm / parsedSedCm) * 100)}%`,
                        height: `${Math.min(90, (parsedDefectDiamCm / parsedSedCm) * 100)}%`
                      }}
                    >
                      Defect
                    </div>
                  )}
                </div>
              </div>

              <div className="text-xs text-stone-300 space-y-1.5 font-mono max-w-xs">
                <div><span className="text-stone-500">Log Formula:</span> Smalian [(A₁ + A₂)/2] × L</div>
                <div>
                  <span className="text-stone-500">Taper Rate:</span>{' '}
                  {hasValidDimensions ? `${((parsedLedCm - parsedSedCm) / parsedLengthM).toFixed(1)} cm/m` : '—'}
                </div>
                <div><span className="text-stone-500">Defect Ratio:</span> {currentScale.defectDeductionM3} / {currentScale.grossVolumeM3} m³</div>
                <div className={canSubmit ? 'text-emerald-400 font-bold pt-1' : 'text-stone-500 pt-1'}>
                  {canSubmit ? 'Ready to log in consignment manifest.' : 'Enter log tag, species, and dimensions to calculate.'}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Batch Logs Table */}
      <div className="p-5 rounded-2xl bg-black/90 backdrop-blur-md border border-stone-800 shadow-2xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-emerald-400" />
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">
              Consignment Log Manifest ({logList.length} Logs)
            </h3>
          </div>

          <div className="flex items-center gap-3 text-xs font-mono">
            <span className="text-stone-400">Total Net Scale: <strong className="text-emerald-400 font-bold">{totalNetVol.toFixed(3)} m³</strong></span>
            <span className="text-stone-400">Avg Recovery: <strong className="text-teal-300 font-bold">{overallRecoveryPct.toFixed(1)}%</strong></span>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-stone-800 bg-stone-900/60 text-stone-400 font-semibold">
                <th className="py-2.5 px-3">Log #</th>
                <th className="py-2.5 px-3">Species</th>
                <th className="py-2.5 px-3 text-right">Length</th>
                <th className="py-2.5 px-3 text-right">SED / LED</th>
                <th className="py-2.5 px-3">Defect</th>
                <th className="py-2.5 px-3 text-right">Gross (m³)</th>
                <th className="py-2.5 px-3 text-right">Deduct (m³)</th>
                <th className="py-2.5 px-3 text-right">Net Vol (m³)</th>
                <th className="py-2.5 px-3 text-right">Rec %</th>
                <th className="py-2.5 px-3">Grade</th>
                <th className="py-2.5 px-3 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-800/60 font-mono">
              {logList.map(l => (
                <tr key={l.id} className="hover:bg-stone-900/40 transition-colors">
                  <td className="py-2.5 px-3 font-bold text-emerald-400">{l.logNumber}</td>
                  <td className="py-2.5 px-3 font-sans text-stone-200">
                    <span className="font-bold text-white font-mono mr-1.5">{l.speciesCode}</span>
                    {l.speciesName}
                  </td>
                  <td className="py-2.5 px-3 text-right text-stone-300">{l.lengthM} m</td>
                  <td className="py-2.5 px-3 text-right text-stone-300">{l.smallEndDiamCm} / {l.largeEndDiamCm} cm</td>
                  <td className="py-2.5 px-3 text-stone-300 font-sans">
                    {l.defectType !== 'None' ? (
                      <span className="text-amber-400 font-semibold">{l.defectType.replace('_', ' ')}</span>
                    ) : (
                      <span className="text-stone-500">None</span>
                    )}
                  </td>
                  <td className="py-2.5 px-3 text-right text-stone-300">{l.grossVolumeM3}</td>
                  <td className="py-2.5 px-3 text-right text-rose-400">{l.defectDeductionM3 > 0 ? `-${l.defectDeductionM3}` : '0.000'}</td>
                  <td className="py-2.5 px-3 text-right font-bold text-emerald-400">{l.netVolumeM3}</td>
                  <td className="py-2.5 px-3 text-right text-teal-300">{l.recoveryPercentage}%</td>
                  <td className="py-2.5 px-3">
                    <span className="text-[10px] font-sans font-bold px-2 py-0.5 rounded bg-stone-900 border border-stone-700 text-stone-200">
                      {l.grade}
                    </span>
                  </td>
                  <td className="py-2.5 px-3 text-center">
                    <button
                      onClick={() => handleRemoveLog(l.id)}
                      className="p-1 text-stone-500 hover:text-rose-400 hover:bg-stone-800 rounded transition-colors"
                      title="Remove log from batch"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </td>
                </tr>
              ))}

              {logList.length === 0 && (
                <tr>
                  <td colSpan={11} className="py-8 text-center text-stone-500 font-sans">
                    No logs added to consignment manifest yet. Use the scaler form above to log measurements.
                  </td>
                </tr>
              )}
            </tbody>
            {logList.length > 0 && (
              <tfoot>
                <tr className="border-t-2 border-stone-700 bg-stone-900/80 font-bold text-white font-mono">
                  <td colSpan={5} className="py-2.5 px-3 font-sans">Consignment Totals</td>
                  <td className="py-2.5 px-3 text-right text-white">{totalGrossVol.toFixed(3)} m³</td>
                  <td className="py-2.5 px-3 text-right text-rose-400">-{totalDefectDeduction.toFixed(3)} m³</td>
                  <td className="py-2.5 px-3 text-right text-emerald-400">{totalNetVol.toFixed(3)} m³</td>
                  <td className="py-2.5 px-3 text-right text-teal-300">{overallRecoveryPct.toFixed(1)}%</td>
                  <td colSpan={2} className="py-2.5 px-3" />
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
    </div>
  );
}
