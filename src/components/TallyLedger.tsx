import React, { useState } from 'react';
import { Table, Copy, Download, Printer, Settings, Trees, Check, Layers, BarChart3, FileSpreadsheet, FileText } from 'lucide-react';
import { TreeEntry, SurveyMetadata, GirthClass } from '../types';
import { parseGirthRanges, getGirthBucketIndex, calculateBasalArea, estimateVolume } from '../utils/tally';
import { exportToPDF, exportToDocx, getHeadingLines } from '../utils/exportDocs';

interface TallyLedgerProps {
  entries: TreeEntry[];
  meta: SurveyMetadata;
  onUpdateMeta: (meta: SurveyMetadata) => void;
}

export const TallyLedger: React.FC<TallyLedgerProps> = ({
  entries,
  meta,
  onUpdateMeta
}) => {
  const [copiedStatus, setCopiedStatus] = useState<boolean>(false);
  const [showRangesEditor, setShowRangesEditor] = useState<boolean>(false);
  const [customRangesInput, setCustomRangesInput] = useState<string>(meta.girthClassRanges);
  const [isExportingPDF, setIsExportingPDF] = useState<boolean>(false);
  const [isExportingDocx, setIsExportingDocx] = useState<boolean>(false);
  const [showCompiledHtml, setShowCompiledHtml] = useState<boolean>(false);

  const ranges: GirthClass[] = parseGirthRanges(meta.girthClassRanges);

  // Group entries by species code
  const speciesOrder: string[] = [];
  const speciesGroupMap = new Map<string, { name: string; scientificName?: string; buckets: number[][] }>();

  entries.forEach(e => {
    const code = e.code.toUpperCase();
    if (!speciesGroupMap.has(code)) {
      speciesOrder.push(code);
      speciesGroupMap.set(code, {
        name: e.name,
        scientificName: e.scientificName,
        buckets: ranges.map(() => [])
      });
    }
    const bucketIdx = getGirthBucketIndex(e.girth, ranges);
    if (bucketIdx >= 0) {
      speciesGroupMap.get(code)!.buckets[bucketIdx].push(e.num);
    }
  });

  // Calculate Column Totals & Totals Volume
  const colCounts = ranges.map(() => 0);
  let grandTotalTrees = 0;
  let grandTotalBasalArea = 0;
  let grandTotalVolume = 0;

  entries.forEach(e => {
    grandTotalBasalArea += calculateBasalArea(e.girth);
    grandTotalVolume += estimateVolume(e.girth);
  });

  // Generate heading lines from entered metadata
  const { line1, line2, line3, line4 } = getHeadingLines(meta);
  const headingLines = [line1, line2, line3, line4].filter(Boolean);
  const reportTitle = headingLines.join('\n');

  const handleSaveRanges = () => {
    onUpdateMeta({ ...meta, girthClassRanges: customRangesInput });
    setShowRangesEditor(false);
  };

  const handleCopyTSV = () => {
    let tsv = `${reportTitle}\n\n`;
    tsv += ['Species Code', 'Local Name', ...ranges.map(r => r.label), 'Total Count'].join('\t') + '\n';

    speciesOrder.forEach(code => {
      const g = speciesGroupMap.get(code)!;
      let rowTotal = 0;
      const cells = g.buckets.map(nums => {
        rowTotal += nums.length;
        return nums.length ? `${nums.slice().sort((a, b) => a - b).join(',')} (${nums.length})` : '-';
      });
      tsv += [code, g.name, ...cells, rowTotal].join('\t') + '\n';
    });

    navigator.clipboard.writeText(tsv).then(() => {
      setCopiedStatus(true);
      setTimeout(() => setCopiedStatus(false), 2000);
    });
  };

  const handleDownloadCSV = () => {
    let csv = `"${reportTitle}"\n\n`;
    csv += ['Code', 'Local Name', ...ranges.map(r => `"${r.label}"`), 'Total Count'].join(',') + '\n';

    speciesOrder.forEach(code => {
      const g = speciesGroupMap.get(code)!;
      let rowTotal = 0;
      const cells = g.buckets.map(nums => {
        rowTotal += nums.length;
        return nums.length ? `"${nums.slice().sort((a, b) => a - b).join(',')} (${nums.length})"` : '-';
      });
      csv += [code, `"${g.name}"`, ...cells, rowTotal].join(',') + '\n';
    });

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `timber_tally_${meta.siteName.toLowerCase().replace(/[^a-z0-9]/g, '_')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExportPDF = async () => {
    setIsExportingPDF(true);
    try {
      exportToPDF(entries, meta);
    } catch (err) {
      console.error('PDF export error:', err);
    } finally {
      setIsExportingPDF(false);
    }
  };

  const handleExportDocx = async () => {
    setIsExportingDocx(true);
    try {
      await exportToDocx(entries, meta);
    } catch (err) {
      console.error('Docx export error:', err);
    } finally {
      setIsExportingDocx(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="bg-black/90 backdrop-blur-md rounded-2xl border border-stone-800 p-4 sm:p-6 mb-8 shadow-2xl text-stone-100">
      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 pb-3 border-b border-stone-800">
        <div>
          <h3 className="font-serif text-xl font-bold text-white flex items-center gap-2">
            <Table className="w-5 h-5 text-amber-600" />
            Generated Timber Tally Matrix Report
          </h3>
          <p className="text-xs text-stone-500 dark:text-stone-400">
            Species &times; Girth Class Crosstab ledger with tree number lists and timber volume metrics.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => setShowRangesEditor(prev => !prev)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-stone-200 dark:bg-stone-800 text-stone-800 dark:text-stone-200 text-xs font-medium border border-stone-300 dark:border-stone-700 hover:bg-stone-300"
          >
            <Settings className="w-3.5 h-3.5" />
            Classes
          </button>

          <button
            onClick={handleExportPDF}
            disabled={isExportingPDF || entries.length === 0}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-800 hover:bg-red-700 text-stone-50 text-xs font-semibold shadow-sm disabled:opacity-50 transition-all"
            title="Export full survey report as PDF document"
          >
            <FileText className="w-3.5 h-3.5 text-red-200" />
            {isExportingPDF ? 'Generating PDF...' : 'Save .PDF'}
          </button>

          <button
            onClick={handleExportDocx}
            disabled={isExportingDocx || entries.length === 0}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-800 hover:bg-blue-700 text-stone-50 text-xs font-semibold shadow-sm disabled:opacity-50 transition-all"
            title="Export survey report to Microsoft Word document (.docx)"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-blue-200" />
            {isExportingDocx ? 'Generating DOCX...' : 'Save Word (.docx)'}
          </button>

          <button
            onClick={handleDownloadCSV}
            disabled={entries.length === 0}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-800 hover:bg-emerald-700 text-stone-50 text-xs font-semibold shadow-sm"
          >
            <Download className="w-3.5 h-3.5" />
            .CSV
          </button>

          <button
            onClick={handleCopyTSV}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-stone-200 dark:bg-stone-800 text-stone-800 dark:text-stone-200 text-xs font-medium border border-stone-300 dark:border-stone-700 hover:bg-stone-300"
          >
            {copiedStatus ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
            {copiedStatus ? 'Copied TSV!' : 'Excel Copy'}
          </button>

          <button
            onClick={handlePrint}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-stone-200 dark:bg-stone-800 text-stone-800 dark:text-stone-200 text-xs font-medium border border-stone-300 dark:border-stone-700 hover:bg-stone-300"
            title="Print or compile report layout"
          >
            <Printer className="w-3.5 h-3.5" />
            Print / PDF
          </button>
        </div>
      </div>

      {/* Girth Class Configuration Editor */}
      {showRangesEditor && (
        <div className="mb-4 p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs space-y-2">
          <label className="block font-semibold text-amber-950 dark:text-amber-200">
            Girth Class Ranges (cm, comma-separated):
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              value={customRangesInput}
              onChange={e => setCustomRangesInput(e.target.value)}
              placeholder="Enter comma-separated girth ranges (cm)"
              className="flex-1 p-2 rounded bg-white dark:bg-stone-950 border border-amber-900/20 font-mono text-xs"
            />
            <button
              onClick={handleSaveRanges}
              className="px-3 py-2 bg-amber-600 text-white rounded font-medium"
            >
              Apply Classes
            </button>
          </div>
        </div>
      )}

      {/* Volumetric & Commercial Timber Metrics Header Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6 p-4 rounded-xl bg-stone-100 dark:bg-stone-950/80 border border-stone-200 dark:border-stone-800 text-center">
        <div>
          <span className="block text-2xl font-bold font-mono text-emerald-950 dark:text-emerald-400">
            {entries.length}
          </span>
          <span className="text-[11px] font-semibold text-stone-500 uppercase tracking-wider">
            Total Enumerated Trees
          </span>
        </div>

        <div>
          <span className="block text-2xl font-bold font-mono text-amber-800 dark:text-amber-400">
            {grandTotalBasalArea.toFixed(2)} m²
          </span>
          <span className="text-[11px] font-semibold text-stone-500 uppercase tracking-wider">
            Total Basal Area
          </span>
        </div>

        <div>
          <span className="block text-2xl font-bold font-mono text-emerald-800 dark:text-emerald-300">
            {grandTotalVolume.toFixed(1)} m³
          </span>
          <span className="text-[11px] font-semibold text-stone-500 uppercase tracking-wider">
            Est. Merchantable Timber Vol.
          </span>
        </div>
      </div>

      {entries.length === 0 ? (
        <div className="text-center py-12 text-stone-400 italic text-xs">
          No field entries recorded yet. Add trees in Step 3 above to populate the ledger table.
        </div>
      ) : (
        <div id="printable-area" className="overflow-x-auto border border-stone-300 dark:border-stone-800 rounded-xl bg-stone-100 dark:bg-stone-950 p-4">
          {/* Formal Report Ledger Banner matching attached image format */}
          <div className="text-center font-bold text-stone-900 dark:text-stone-100 text-sm sm:text-base border-b border-stone-300 dark:border-stone-800 pb-3 mb-4 uppercase tracking-wide space-y-1">
            {headingLines.map((line, i) => (
              <div key={i} className="underline font-bold">{line}</div>
            ))}
          </div>

          <table className="w-full text-center border-collapse font-mono text-xs">
            <thead>
              <tr className="bg-emerald-900 text-stone-100 uppercase tracking-wider text-[11px] font-sans font-bold">
                <th className="p-2.5 text-left border border-emerald-800 w-20">Code</th>
                <th className="p-2.5 text-left border border-emerald-800 min-w-[140px]">Local Name</th>
                {ranges.map(r => (
                  <th key={r.label} className="p-2.5 border border-emerald-800 min-w-[100px]">
                    {r.label} cm
                  </th>
                ))}
                <th className="p-2.5 border border-emerald-800 bg-emerald-950 w-20">Total</th>
              </tr>
            </thead>
            <tbody className="bg-stone-50 dark:bg-stone-900 divide-y divide-stone-200 dark:divide-stone-800">
              {speciesOrder.map(code => {
                const g = speciesGroupMap.get(code)!;
                let rowTotalCount = 0;

                return (
                  <tr key={code} className="hover:bg-amber-500/5 transition-colors">
                    <td className="p-2.5 font-bold border border-stone-300 dark:border-stone-800 text-emerald-900 dark:text-emerald-400 bg-stone-200/50 dark:bg-stone-950 text-left">
                      {code}
                    </td>
                    <td className="p-2.5 font-sans font-semibold border border-stone-300 dark:border-stone-800 text-stone-900 dark:text-stone-100 text-left">
                      {g.name}
                    </td>
                    {g.buckets.map((nums, i) => {
                      rowTotalCount += nums.length;
                      colCounts[i] += nums.length;

                      if (nums.length === 0) {
                        return (
                          <td key={i} className="p-2.5 border border-stone-300 dark:border-stone-800 text-stone-300 dark:text-stone-700">
                            &ndash;
                          </td>
                        );
                      }

                      const sortedNums = nums.slice().sort((a, b) => a - b);
                      return (
                        <td key={i} className="p-2.5 border border-stone-300 dark:border-stone-800 text-stone-800 dark:text-stone-200">
                          <span className="block font-mono text-[11.5px]">
                            {sortedNums.join(',')}
                          </span>
                          <span className="block text-[10px] font-bold text-amber-700 dark:text-amber-400 mt-0.5">
                            ({nums.length})
                          </span>
                        </td>
                      );
                    })}
                    <td className="p-2.5 font-bold font-mono border border-stone-300 dark:border-stone-800 bg-emerald-900/5 text-emerald-950 dark:text-emerald-300">
                      {rowTotalCount}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="bg-emerald-950 text-stone-100 font-bold font-sans text-xs">
                <td colSpan={2 + ranges.length} className="p-3 text-center font-bold border border-emerald-800 uppercase tracking-wider">
                  Total
                </td>
                <td className="p-3 border border-emerald-800 font-mono text-black text-sm font-bold text-center">
                  {entries.length}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
};
