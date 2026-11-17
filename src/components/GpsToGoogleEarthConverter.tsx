import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  Globe,
  Plus,
  Trash2,
  Copy,
  Check,
  Download,
  Upload,
  Code2,
  AlertTriangle,
  MapPin,
  Trees,
  FileText,
  Loader2,
  FolderOpen,
  FolderCheck,
  X,
} from 'lucide-react';
import saveAs from 'file-saver';
import { TreeEntry, SurveyMetadata } from '../types';
import {
  GoogleEarthPointInput,
  KmlConversionOptions,
  parseCoordinateValue,
  dmsToDecimal,
  decimalToDmsParts,
  isValidLatLng,
  parseGpsPointsBatch,
  extractLinesFromDocx,
  extractLinesFromPdf,
  convertGpsPointsToKml,
  formatPlacemarkName,
  getNextPatternName,
  formatKmlFilenamePrefix,
  formatKmlFilename,
  getStoredKmlSequence,
  saveUsedKmlSequence,
} from '../utils/kmlConverter';
import {
  PermissionCapableDirectoryHandle,
  isDirectoryPickerSupported,
  getSavedPlacemarkFolderHandle,
  clearSavedPlacemarkFolderHandle,
  ensureFolderWritePermission,
  pickMyPlacemarksFolder,
  getNextSequenceInFolder,
  saveKmlToFolder,
} from '../utils/placemarkFolderStorage';

interface GpsToGoogleEarthConverterProps {
  entries: TreeEntry[];
  meta: SurveyMetadata;
}

type CoordinateSystemMode = 'DMS' | 'DD';

export const GpsToGoogleEarthConverter: React.FC<GpsToGoogleEarthConverterProps> = ({
  entries,
  meta,
}) => {
  const [points, setPoints] = useState<GoogleEarthPointInput[]>([]);
  const [coordSystem, setCoordSystem] = useState<CoordinateSystemMode>('DMS');

  // Single coordinate input state (blank by default)
  const [pointName, setPointName] = useState('');
  const [descInput, setDescInput] = useState('');

  // DD mode inputs
  const [ddLat, setDdLat] = useState('');
  const [ddLng, setDdLng] = useState('');

  // DMS mode inputs
  const [latDeg, setLatDeg] = useState('');
  const [latMin, setLatMin] = useState('');
  const [latSec, setLatSec] = useState('');
  const [latDir, setLatDir] = useState<'N' | 'S'>('N');

  const [lngDeg, setLngDeg] = useState('');
  const [lngMin, setLngMin] = useState('');
  const [lngSec, setLngSec] = useState('');
  const [lngDir, setLngDir] = useState<'E' | 'W'>('W');

  const [singleError, setSingleError] = useState<string | null>(null);

  // Word (.docx) & PDF (.pdf) import state
  const docxInputRef = useRef<HTMLInputElement>(null);
  const [isParsingDocx, setIsParsingDocx] = useState(false);
  const [docxStatusMessage, setDocxStatusMessage] = useState<string | null>(null);
  const [docxError, setDocxError] = useState<string | null>(null);

  // KML Document & Placemark style options
  const [documentName, setDocumentName] = useState(meta.siteName || '');
  const [iconStyle, setIconStyle] = useState<NonNullable<KmlConversionOptions['iconStyle']>>('tree');
  const [markerColor, setMarkerColor] = useState<NonNullable<KmlConversionOptions['markerColor']>>('emerald');

  // Output preview / copy / direct folder save feedback
  const [showKmlPreview, setShowKmlPreview] = useState(false);
  const [copiedKml, setCopiedKml] = useState(false);
  const [targetFolderHandle, setTargetFolderHandle] = useState<PermissionCapableDirectoryHandle | null>(null);
  const [nextKmlSeq, setNextKmlSeq] = useState<number>(() => getStoredKmlSequence());
  const [isSavingKml, setIsSavingKml] = useState(false);
  const [saveStatusMessage, setSaveStatusMessage] = useState<string | null>(null);
  const [saveErrorMessage, setSaveErrorMessage] = useState<string | null>(null);

  const labelSource = useMemo(
    () => documentName.trim() || meta.siteName?.trim() || 'PLACEMARKS',
    [documentName, meta.siteName]
  );

  const nextFilenamePreview = useMemo(
    () => formatKmlFilename(labelSource, nextKmlSeq),
    [labelSource, nextKmlSeq]
  );

  useEffect(() => {
    let active = true;
    (async () => {
      const savedHandle = await getSavedPlacemarkFolderHandle();
      if (!active || !savedHandle) return;
      setTargetFolderHandle(savedHandle);
      const hasPerm = await ensureFolderWritePermission(savedHandle, false);
      if (hasPerm && active) {
        const prefix = formatKmlFilenamePrefix(labelSource);
        const folderNext = await getNextSequenceInFolder(savedHandle, prefix);
        if (active) {
          setNextKmlSeq(prev => Math.max(prev, folderNext));
        }
      }
    })();
    return () => {
      active = false;
    };
  }, [labelSource]);

  const gpsTaggedTrees = useMemo(
    () => entries.filter(e => e.gps && typeof e.gps.lat === 'number' && typeof e.gps.lng === 'number'),
    [entries]
  );

  const generatedKml = useMemo(() => {
    if (points.length === 0) return '';
    return convertGpsPointsToKml(points, {
      documentName: documentName.trim() || meta.siteName || 'GPS Survey Placemarks',
      documentDescription: meta.district
        ? `${meta.district} GPS Placemarks`
        : 'Converted GPS Coordinates for Google Earth',
      iconStyle,
      markerColor,
    });
  }, [points, documentName, meta.siteName, meta.district, iconStyle, markerColor]);

  // Switch between DMS and DD, auto-converting valid entered coordinates
  const handleSwitchCoordSystem = (nextMode: CoordinateSystemMode) => {
    if (nextMode === coordSystem) return;
    setSingleError(null);

    if (nextMode === 'DD') {
      const hasDmsLat = latDeg !== '' || latMin !== '' || latSec !== '';
      const hasDmsLng = lngDeg !== '' || lngMin !== '' || lngSec !== '';

      if (hasDmsLat) {
        const decLat = dmsToDecimal(
          parseFloat(latDeg) || 0,
          parseFloat(latMin) || 0,
          parseFloat(latSec) || 0,
          latDir
        );
        if (decLat !== null) setDdLat(decLat.toFixed(6));
      }
      if (hasDmsLng) {
        const decLng = dmsToDecimal(
          parseFloat(lngDeg) || 0,
          parseFloat(lngMin) || 0,
          parseFloat(lngSec) || 0,
          lngDir
        );
        if (decLng !== null) setDdLng(decLng.toFixed(6));
      }
    } else {
      const parsedLat = parseCoordinateValue(ddLat);
      const parsedLng = parseCoordinateValue(ddLng);
      if (parsedLat !== null && parsedLat >= -90 && parsedLat <= 90) {
        const parts = decimalToDmsParts(parsedLat, true);
        setLatDeg(parts.deg.toString());
        setLatMin(parts.min.toString());
        setLatSec(parts.sec.toString());
        setLatDir(parts.dir as 'N' | 'S');
      }
      if (parsedLng !== null && parsedLng >= -180 && parsedLng <= 180) {
        const parts = decimalToDmsParts(parsedLng, false);
        setLngDeg(parts.deg.toString());
        setLngMin(parts.min.toString());
        setLngSec(parts.sec.toString());
        setLngDir(parts.dir as 'E' | 'W');
      }
    }

    setCoordSystem(nextMode);
  };

  // Live conversion preview for current form inputs
  const liveConversionPreview = useMemo(() => {
    if (coordSystem === 'DMS') {
      if (latDeg === '' && lngDeg === '') return null;
      const decLat = dmsToDecimal(
        parseFloat(latDeg) || 0,
        parseFloat(latMin) || 0,
        parseFloat(latSec) || 0,
        latDir
      );
      const decLng = dmsToDecimal(
        parseFloat(lngDeg) || 0,
        parseFloat(lngMin) || 0,
        parseFloat(lngSec) || 0,
        lngDir
      );
      if (!isValidLatLng(decLat, decLng)) return null;
      return `DD: ${decLat!.toFixed(6)}, ${decLng!.toFixed(6)}`;
    } else {
      if (!ddLat.trim() || !ddLng.trim()) return null;
      const decLat = parseCoordinateValue(ddLat);
      const decLng = parseCoordinateValue(ddLng);
      if (!isValidLatLng(decLat, decLng)) return null;
      return `DMS: ${decimalToDmsParts(decLat!, true).formatted}, ${decimalToDmsParts(decLng!, false).formatted}`;
    }
  }, [coordSystem, latDeg, latMin, latSec, latDir, lngDeg, lngMin, lngSec, lngDir, ddLat, ddLng]);

  const handleAddSinglePoint = (e: React.FormEvent) => {
    e.preventDefault();
    setSingleError(null);

    let parsedLat: number | null = null;
    let parsedLng: number | null = null;

    if (coordSystem === 'DMS') {
      if (latDeg.trim() === '' || lngDeg.trim() === '') {
        setSingleError('Enter Degrees for both Latitude and Longitude.');
        return;
      }
      parsedLat = dmsToDecimal(
        parseFloat(latDeg),
        latMin.trim() === '' ? 0 : parseFloat(latMin),
        latSec.trim() === '' ? 0 : parseFloat(latSec),
        latDir
      );
      parsedLng = dmsToDecimal(
        parseFloat(lngDeg),
        lngMin.trim() === '' ? 0 : parseFloat(lngMin),
        lngSec.trim() === '' ? 0 : parseFloat(lngSec),
        lngDir
      );

      if (!isValidLatLng(parsedLat, parsedLng)) {
        setSingleError('Invalid DMS values. Minutes and Seconds must be 0–59.99, Latitude 0–90°, Longitude 0–180°.');
        return;
      }
    } else {
      parsedLat = parseCoordinateValue(ddLat);
      parsedLng = parseCoordinateValue(ddLng);

      if (!isValidLatLng(parsedLat, parsedLng)) {
        setSingleError('Enter valid Decimal Degrees: Latitude (-90 to 90) and Longitude (-180 to 180).');
        return;
      }
    }

    const formattedName = formatPlacemarkName(pointName, points.length + 1);

    const nextPoint: GoogleEarthPointInput = {
      id: `ge_single_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      name: formattedName,
      lat: parsedLat!,
      lng: parsedLng!,
      description: descInput.trim() || undefined,
    };

    setPoints(prev => [...prev, nextPoint]);
    setPointName(getNextPatternName(formattedName));
    setDescInput('');
    setDdLat('');
    setDdLng('');
    setLatDeg('');
    setLatMin('');
    setLatSec('');
    setLngDeg('');
    setLngMin('');
    setLngSec('');
  };

  const processDocumentFile = async (file: File) => {
    setDocxError(null);
    setDocxStatusMessage(null);
    setIsParsingDocx(true);

    try {
      const lowerName = file.name.toLowerCase();
      const isPdf = lowerName.endsWith('.pdf') || file.type === 'application/pdf';
      const isDocx =
        lowerName.endsWith('.docx') ||
        lowerName.endsWith('.doc') ||
        file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

      if (!isPdf && !isDocx) {
        setDocxError(`Unsupported file format for "${file.name}". Upload a .pdf or Word (.docx) file.`);
        return;
      }

      const lines = isPdf ? await extractLinesFromPdf(file) : await extractLinesFromDocx(file);
      if (lines.length === 0) {
        setDocxError(
          isPdf
            ? `No selectable text or coordinate tables were found in "${file.name}".`
            : `No readable text or coordinate tables were found in "${file.name}".`
        );
        return;
      }

      const { points: parsed, errors } = parseGpsPointsBatch(lines.join('\n'), points.length + 1);
      if (parsed.length === 0) {
        setDocxError(
          `No valid DMS or DD coordinate pairs were found in "${file.name}". Ensure each table row or line includes both Latitude and Longitude.`
        );
        return;
      }

      setPoints(prev => [...prev, ...parsed.map(({ altitude: _alt, ...rest }) => rest)]);
      const skippedNote =
        errors.length > 0
          ? ` (${errors.length} non-coordinate ${errors.length === 1 ? 'line' : 'lines'} skipped)`
          : '';
      setDocxStatusMessage(
        `Converted ${parsed.length} coordinate ${parsed.length === 1 ? 'point' : 'points'} from "${file.name}" into Google Earth Placemarks${skippedNote}.`
      );
    } catch (err) {
      setDocxError(err instanceof Error ? err.message : 'Failed to read the selected document.');
    } finally {
      setIsParsingDocx(false);
    }
  };

  const handleDocxFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      await processDocumentFile(file);
    } finally {
      e.target.value = '';
    }
  };

  const handleDocumentDrop = async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (isParsingDocx) return;
    const file = e.dataTransfer.files?.[0];
    if (file) {
      await processDocumentFile(file);
    }
  };

  const handleImportSurveyGpsTrees = () => {
    if (gpsTaggedTrees.length === 0) return;

    const existingIds = new Set(points.map(p => p.id));
    const imported: GoogleEarthPointInput[] = [];

    gpsTaggedTrees.forEach(t => {
      const ptId = `tree_gps_${t.id}`;
      if (!existingIds.has(ptId) && t.gps) {
        imported.push({
          id: ptId,
          name: formatPlacemarkName(`TREE-${t.code}-${t.num}`, t.num),
          lat: t.gps.lat,
          lng: t.gps.lng,
          description: `${t.name} | Girth: ${t.girth}cm | DBH: ${t.dbh}cm | Condition: ${t.condition || 'Healthy'}`,
        });
      }
    });

    if (imported.length > 0) {
      setPoints(prev => [...prev, ...imported]);
    }
  };

  const handleRemovePoint = (id: string) => {
    setPoints(prev => prev.filter(p => p.id !== id));
  };

  const handleCopyKml = async () => {
    if (!generatedKml) return;
    try {
      await navigator.clipboard.writeText(generatedKml);
      setCopiedKml(true);
      setTimeout(() => setCopiedKml(false), 2500);
    } catch {
      // Ignore clipboard errors if blocked
    }
  };

  const handleSelectTargetFolder = async () => {
    setSaveErrorMessage(null);
    setSaveStatusMessage(null);
    try {
      const handle = await pickMyPlacemarksFolder();
      setTargetFolderHandle(handle);
      const prefix = formatKmlFilenamePrefix(labelSource);
      const folderNext = await getNextSequenceInFolder(handle, prefix);
      setNextKmlSeq(prev => Math.max(prev, folderNext));
      setSaveStatusMessage(
        `Connected folder "${handle.name}". Downloaded KML files will save directly there.`
      );
    } catch (err: unknown) {
      const domErr = err as { name?: string; message?: string };
      if (domErr?.name === 'AbortError') return;
      if (domErr?.name === 'SecurityError') {
        setSaveErrorMessage(
          'Direct Desktop folder access is blocked inside this embedded preview frame. Open the app in a standalone browser tab to connect your Desktop "My Placemarks" folder; downloads here still use your patterned filename.'
        );
        return;
      }
      setSaveErrorMessage(
        domErr?.message || 'Unable to select the My Placemarks folder in this browser.'
      );
    }
  };

  const handleDisconnectTargetFolder = async () => {
    await clearSavedPlacemarkFolderHandle();
    setTargetFolderHandle(null);
    setSaveStatusMessage(null);
    setSaveErrorMessage(null);
  };

  const triggerBrowserDownload = (filename: string, kmlContent: string) => {
    const blob = new Blob([kmlContent], {
      type: 'application/vnd.google-earth.kml+xml;charset=utf-8',
    });
    saveAs(blob, filename);
  };

  const handleDownloadKml = async () => {
    if (!generatedKml || isSavingKml) return;
    setSaveStatusMessage(null);
    setSaveErrorMessage(null);
    setIsSavingKml(true);

    const now = new Date();
    const prefix = formatKmlFilenamePrefix(labelSource, now);

    try {
      let handle = targetFolderHandle;

      if (!handle && isDirectoryPickerSupported()) {
        try {
          handle = await pickMyPlacemarksFolder();
          setTargetFolderHandle(handle);
        } catch (err: unknown) {
          const domErr = err as { name?: string };
          if (domErr?.name === 'AbortError') {
            setSaveErrorMessage(
              'Folder selection cancelled. Connect your Desktop "My Placemarks" folder to save directly.'
            );
            return;
          }
          if (domErr?.name === 'SecurityError') {
            const seqToUse = Math.max(nextKmlSeq, getStoredKmlSequence(now));
            const filename = formatKmlFilename(labelSource, seqToUse, now);
            triggerBrowserDownload(filename, generatedKml);
            const updatedNext = saveUsedKmlSequence(seqToUse, now);
            setNextKmlSeq(updatedNext);
            setSaveStatusMessage(
              `Downloaded "${filename}" via browser. Open the app in a standalone browser tab to save directly into Desktop → My Placemarks.`
            );
            return;
          }
          handle = null;
        }
      }

      if (handle) {
        const granted = await ensureFolderWritePermission(handle, true);
        if (granted) {
          const folderNext = await getNextSequenceInFolder(handle, prefix);
          const seqToUse = Math.max(nextKmlSeq, getStoredKmlSequence(now), folderNext);
          const filename = formatKmlFilename(labelSource, seqToUse, now);
          await saveKmlToFolder(handle, filename, generatedKml);
          const updatedNext = saveUsedKmlSequence(seqToUse, now);
          setNextKmlSeq(Math.max(updatedNext, seqToUse + 1));
          setSaveStatusMessage(`Saved "${filename}" directly into "${handle.name}".`);
          return;
        }
      }

      const seqToUse = Math.max(nextKmlSeq, getStoredKmlSequence(now));
      const filename = formatKmlFilename(labelSource, seqToUse, now);
      triggerBrowserDownload(filename, generatedKml);
      const updatedNext = saveUsedKmlSequence(seqToUse, now);
      setNextKmlSeq(updatedNext);
      setSaveStatusMessage(
        isDirectoryPickerSupported()
          ? `Downloaded "${filename}" to your browser Downloads folder (folder write permission was not granted).`
          : `Downloaded "${filename}" to your browser Downloads folder.`
      );
    } catch (err) {
      setSaveErrorMessage(
        err instanceof Error ? err.message : 'Failed to save the KML file.'
      );
    } finally {
      setIsSavingKml(false);
    }
  };

  return (
    <div className="p-5 rounded-2xl bg-black/90 backdrop-blur-md border border-stone-800 shadow-2xl space-y-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 pb-4 border-b border-stone-800">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
              <Globe className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-serif font-bold text-white tracking-wide">
                GPS Coordinates to Google Earth Placemarks (.KML)
              </h3>
              <p className="text-xs text-stone-400">
                Convert DMS (Degrees, Minutes, Seconds) and DD (Decimal Degrees) coordinates into Google Earth KML Placemarks.
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <input
            ref={docxInputRef}
            type="file"
            accept=".docx,.doc,.pdf,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            onChange={handleDocxFileChange}
            className="hidden"
          />

          <button
            type="button"
            onClick={() => docxInputRef.current?.click()}
            disabled={isParsingDocx}
            className="px-3 py-2 rounded-xl bg-amber-600/20 hover:bg-amber-600/30 border border-amber-500/40 text-amber-300 text-xs font-bold transition-colors flex items-center gap-1.5 disabled:opacity-50"
          >
            {isParsingDocx ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <FileText className="w-3.5 h-3.5" />
            )}
            {isParsingDocx ? 'Reading File...' : 'Convert Word / PDF'}
          </button>

          {gpsTaggedTrees.length > 0 && (
            <button
              type="button"
              onClick={handleImportSurveyGpsTrees}
              className="px-3 py-2 rounded-xl bg-stone-900 hover:bg-stone-800 border border-stone-700 text-stone-200 text-xs font-bold transition-colors flex items-center gap-1.5"
            >
              <Trees className="w-3.5 h-3.5 text-emerald-400" />
              Load {gpsTaggedTrees.length} GPS Survey {gpsTaggedTrees.length === 1 ? 'Tree' : 'Trees'}
            </button>
          )}

          <button
            type="button"
            onClick={() => setShowKmlPreview(prev => !prev)}
            disabled={points.length === 0}
            className="px-3 py-2 rounded-xl bg-stone-900 hover:bg-stone-800 border border-stone-700 text-stone-200 text-xs font-bold transition-colors flex items-center gap-1.5 disabled:opacity-40"
          >
            <Code2 className="w-3.5 h-3.5 text-sky-400" />
            {showKmlPreview ? 'Hide KML XML' : 'Preview KML XML'}
          </button>

          <button
            type="button"
            onClick={handleCopyKml}
            disabled={points.length === 0}
            className="px-3 py-2 rounded-xl bg-stone-900 hover:bg-stone-800 border border-stone-700 text-stone-200 text-xs font-bold transition-colors flex items-center gap-1.5 disabled:opacity-40"
          >
            {copiedKml ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-amber-400" />}
            {copiedKml ? 'Copied KML!' : 'Copy KML'}
          </button>

          <button
            type="button"
            onClick={handleDownloadKml}
            disabled={points.length === 0 || isSavingKml}
            className="px-3.5 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-600 text-white text-xs font-bold shadow-lg shadow-emerald-900/30 transition-all flex items-center gap-1.5 disabled:opacity-40"
          >
            {isSavingKml ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Download className="w-3.5 h-3.5" />
            )}
            {isSavingKml ? 'Saving .KML...' : `Save .KML (${points.length})`}
          </button>
        </div>
      </div>

      {/* Input Grid: Single Point & Batch Coordinates */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Single GPS Coordinate Entry (DMS & DD) */}
        <form onSubmit={handleAddSinglePoint} className="p-4 rounded-xl bg-stone-950/90 border border-stone-800 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5" />
              Add Coordinate Point
            </span>

            {/* DMS / DD Coordinate System Switcher */}
            <div className="inline-flex rounded-lg bg-stone-900 p-0.5 border border-stone-700">
              <button
                type="button"
                onClick={() => handleSwitchCoordSystem('DMS')}
                className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition-colors ${
                  coordSystem === 'DMS'
                    ? 'bg-emerald-700 text-white shadow'
                    : 'text-stone-400 hover:text-stone-200'
                }`}
              >
                DMS (Deg° Min&apos; Sec&quot;)
              </button>
              <button
                type="button"
                onClick={() => handleSwitchCoordSystem('DD')}
                className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition-colors ${
                  coordSystem === 'DD'
                    ? 'bg-emerald-700 text-white shadow'
                    : 'text-stone-400 hover:text-stone-200'
                }`}
              >
                DD (Decimal Degrees)
              </button>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-[10px] font-bold uppercase tracking-wider text-stone-400">
                Placemark Name
              </label>
              <span className="text-[10px] font-mono text-emerald-400/90">
                Pattern: LABEL-001
              </span>
            </div>
            <input
              type="text"
              value={pointName}
              onChange={e => setPointName(e.target.value)}
              onBlur={() => {
                if (pointName.trim()) {
                  setPointName(formatPlacemarkName(pointName, points.length + 1));
                }
              }}
              placeholder="Enter label (auto-formatted as LABEL-001)"
              className="w-full bg-stone-900 border border-stone-700 rounded-lg px-3 py-2 text-xs text-white placeholder-stone-500 font-mono uppercase focus:outline-none focus:ring-1 focus:ring-emerald-500"
            />
            {pointName.trim() && (
              <div className="mt-1 text-[10px] font-mono text-stone-400">
                Formatted Name: <span className="text-emerald-300 font-bold">{formatPlacemarkName(pointName, points.length + 1)}</span>
              </div>
            )}
          </div>

          {coordSystem === 'DMS' ? (
            <div className="space-y-3">
              {/* Latitude DMS */}
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-stone-400 mb-1">
                  Latitude (DMS)
                </label>
                <div className="grid grid-cols-4 gap-2">
                  <div className="relative">
                    <input
                      type="number"
                      min="0"
                      max="90"
                      step="1"
                      value={latDeg}
                      onChange={e => setLatDeg(e.target.value)}
                      placeholder="Deg"
                      className="w-full bg-stone-900 border border-stone-700 rounded-lg px-2.5 py-2 pr-6 text-xs text-white placeholder-stone-500 font-mono focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    />
                    <span className="absolute right-2 top-1/2 -translate-y-1/2 text-stone-400 text-xs font-mono">°</span>
                  </div>
                  <div className="relative">
                    <input
                      type="number"
                      min="0"
                      max="59"
                      step="1"
                      value={latMin}
                      onChange={e => setLatMin(e.target.value)}
                      placeholder="Min"
                      className="w-full bg-stone-900 border border-stone-700 rounded-lg px-2.5 py-2 pr-6 text-xs text-white placeholder-stone-500 font-mono focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    />
                    <span className="absolute right-2 top-1/2 -translate-y-1/2 text-stone-400 text-xs font-mono">&apos;</span>
                  </div>
                  <div className="relative">
                    <input
                      type="number"
                      min="0"
                      max="59.999"
                      step="any"
                      value={latSec}
                      onChange={e => setLatSec(e.target.value)}
                      placeholder="Sec"
                      className="w-full bg-stone-900 border border-stone-700 rounded-lg px-2.5 py-2 pr-6 text-xs text-white placeholder-stone-500 font-mono focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    />
                    <span className="absolute right-2 top-1/2 -translate-y-1/2 text-stone-400 text-xs font-mono">&quot;</span>
                  </div>
                  <select
                    value={latDir}
                    onChange={e => setLatDir(e.target.value as 'N' | 'S')}
                    className="w-full bg-stone-900 border border-stone-700 rounded-lg px-2 py-2 text-xs text-white font-mono font-bold focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  >
                    <option value="N">N</option>
                    <option value="S">S</option>
                  </select>
                </div>
              </div>

              {/* Longitude DMS */}
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-stone-400 mb-1">
                  Longitude (DMS)
                </label>
                <div className="grid grid-cols-4 gap-2">
                  <div className="relative">
                    <input
                      type="number"
                      min="0"
                      max="180"
                      step="1"
                      value={lngDeg}
                      onChange={e => setLngDeg(e.target.value)}
                      placeholder="Deg"
                      className="w-full bg-stone-900 border border-stone-700 rounded-lg px-2.5 py-2 pr-6 text-xs text-white placeholder-stone-500 font-mono focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    />
                    <span className="absolute right-2 top-1/2 -translate-y-1/2 text-stone-400 text-xs font-mono">°</span>
                  </div>
                  <div className="relative">
                    <input
                      type="number"
                      min="0"
                      max="59"
                      step="1"
                      value={lngMin}
                      onChange={e => setLngMin(e.target.value)}
                      placeholder="Min"
                      className="w-full bg-stone-900 border border-stone-700 rounded-lg px-2.5 py-2 pr-6 text-xs text-white placeholder-stone-500 font-mono focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    />
                    <span className="absolute right-2 top-1/2 -translate-y-1/2 text-stone-400 text-xs font-mono">&apos;</span>
                  </div>
                  <div className="relative">
                    <input
                      type="number"
                      min="0"
                      max="59.999"
                      step="any"
                      value={lngSec}
                      onChange={e => setLngSec(e.target.value)}
                      placeholder="Sec"
                      className="w-full bg-stone-900 border border-stone-700 rounded-lg px-2.5 py-2 pr-6 text-xs text-white placeholder-stone-500 font-mono focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    />
                    <span className="absolute right-2 top-1/2 -translate-y-1/2 text-stone-400 text-xs font-mono">&quot;</span>
                  </div>
                  <select
                    value={lngDir}
                    onChange={e => setLngDir(e.target.value as 'E' | 'W')}
                    className="w-full bg-stone-900 border border-stone-700 rounded-lg px-2 py-2 text-xs text-white font-mono font-bold focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  >
                    <option value="W">W</option>
                    <option value="E">E</option>
                  </select>
                </div>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-stone-400 mb-1">
                  Latitude (Decimal Degrees)
                </label>
                <input
                  type="text"
                  required
                  value={ddLat}
                  onChange={e => setDdLat(e.target.value)}
                  placeholder="Enter latitude in DD"
                  className="w-full bg-stone-900 border border-stone-700 rounded-lg px-3 py-2 text-xs text-white placeholder-stone-500 font-mono focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-stone-400 mb-1">
                  Longitude (Decimal Degrees)
                </label>
                <input
                  type="text"
                  required
                  value={ddLng}
                  onChange={e => setDdLng(e.target.value)}
                  placeholder="Enter longitude in DD"
                  className="w-full bg-stone-900 border border-stone-700 rounded-lg px-3 py-2 text-xs text-white placeholder-stone-500 font-mono focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>
            </div>
          )}

          {liveConversionPreview && (
            <div className="px-3 py-1.5 rounded-lg bg-emerald-950/40 border border-emerald-800/60 text-[11px] font-mono text-emerald-300">
              {liveConversionPreview}
            </div>
          )}

          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-stone-400 mb-1">
              Description / Notes (Optional)
            </label>
            <input
              type="text"
              value={descInput}
              onChange={e => setDescInput(e.target.value)}
              placeholder="Placemark description or field notes"
              className="w-full bg-stone-900 border border-stone-700 rounded-lg px-3 py-2 text-xs text-white placeholder-stone-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            />
          </div>

          {singleError && (
            <div className="p-2.5 rounded-lg bg-rose-950/70 border border-rose-800 text-rose-200 text-[11px] flex items-center gap-2">
              <AlertTriangle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
              <span>{singleError}</span>
            </div>
          )}

          <button
            type="submit"
            className="w-full py-2 rounded-xl bg-emerald-700 hover:bg-emerald-600 text-white text-xs font-bold transition-colors flex items-center justify-center gap-1.5"
          >
            <Plus className="w-4 h-4" />
            Add Point to Placemark List
          </button>
        </form>

        {/* Word (.docx) & PDF (.pdf) Conversion */}
        <div className="p-4 rounded-xl bg-stone-950/90 border border-stone-800 space-y-3 flex flex-col justify-between">
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
                <Upload className="w-3.5 h-3.5" />
                Word (.docx) &amp; PDF Converter
              </span>
              <span className="text-[10px] text-stone-500 font-mono">
                DMS or DD
              </span>
            </div>

            {/* Word (.docx) & PDF (.pdf) Upload Box */}
            <div
              onDragOver={e => e.preventDefault()}
              onDrop={handleDocumentDrop}
              className="p-4 rounded-xl bg-stone-900/80 border border-dashed border-amber-500/40 hover:border-amber-400/70 transition-colors flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"
            >
              <div className="space-y-1">
                <div className="text-xs font-semibold text-stone-200 flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                  Import from Word (.docx) or PDF (.pdf)
                </div>
                <p className="text-[11px] text-stone-400">
                  Extracts DMS and DD coordinates from Word or PDF tables and text lines directly into Google Earth Placemarks.
                </p>
              </div>
              <button
                type="button"
                onClick={() => docxInputRef.current?.click()}
                disabled={isParsingDocx}
                className="shrink-0 px-3 py-2 rounded-lg bg-amber-600/20 hover:bg-amber-600/30 border border-amber-500/50 text-amber-300 text-xs font-bold transition-colors flex items-center justify-center gap-1.5 disabled:opacity-50"
              >
                {isParsingDocx ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Upload className="w-3.5 h-3.5" />
                )}
                {isParsingDocx ? 'Converting...' : 'Upload .docx / .pdf'}
              </button>
            </div>

            {docxStatusMessage && (
              <div className="p-2.5 rounded-lg bg-emerald-950/60 border border-emerald-700/70 text-emerald-200 text-[11px] flex items-center gap-2">
                <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span>{docxStatusMessage}</span>
              </div>
            )}

            {docxError && (
              <div className="p-2.5 rounded-lg bg-rose-950/70 border border-rose-800 text-rose-200 text-[11px] flex items-center gap-2">
                <AlertTriangle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                <span>{docxError}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Placemark Folder, File Pattern & Icon Settings */}
      <div className="p-4 rounded-xl bg-stone-950/70 border border-stone-800 space-y-4 text-xs">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-stone-400 mb-1">
              Google Earth Folder Name
            </label>
            <input
              type="text"
              value={documentName}
              onChange={e => setDocumentName(e.target.value)}
              placeholder="Enter KML document name"
              className="w-full bg-stone-900 border border-stone-700 rounded-lg px-3 py-1.5 text-xs text-white placeholder-stone-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            />
          </div>

          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-stone-400 mb-1">
              Placemark Icon Style
            </label>
            <select
              value={iconStyle}
              onChange={e => setIconStyle(e.target.value as any)}
              className="w-full bg-stone-900 border border-stone-700 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
            >
              <option value="tree">Forest / Tree Marker</option>
              <option value="pin">Standard Pushpin</option>
              <option value="flag">Survey Flag</option>
            </select>
          </div>

          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-stone-400 mb-1">
              Marker Color
            </label>
            <select
              value={markerColor}
              onChange={e => setMarkerColor(e.target.value as any)}
              className="w-full bg-stone-900 border border-stone-700 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
            >
              <option value="emerald">Emerald Green</option>
              <option value="amber">Amber Gold</option>
              <option value="rose">Crimson Red</option>
              <option value="sky">Sky Blue</option>
            </select>
          </div>
        </div>

        {/* Desktop "My Placemarks" Destination & Patterned Filename Bar */}
        <div className="pt-3 border-t border-stone-800/80 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-stone-400">
                Save Destination:
              </span>
              {targetFolderHandle ? (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md bg-emerald-950/70 border border-emerald-700/70 text-emerald-300 font-semibold text-[11px]">
                  <FolderCheck className="w-3.5 h-3.5 text-emerald-400" />
                  Desktop / {targetFolderHandle.name}
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md bg-stone-900 border border-stone-700 text-stone-300 text-[11px]">
                  <FolderOpen className="w-3.5 h-3.5 text-amber-400" />
                  Select Desktop &rarr; My Placemarks folder
                </span>
              )}
            </div>
            <div className="text-[11px] font-mono text-stone-400">
              File Pattern: <span className="text-stone-300">LABEL-YYYYMMDD-001.kml</span> &bull; Next File:{' '}
              <span className="text-emerald-300 font-bold">{nextFilenamePreview}</span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {isDirectoryPickerSupported() && (
              <button
                type="button"
                onClick={handleSelectTargetFolder}
                className="px-3 py-1.5 rounded-lg bg-stone-900 hover:bg-stone-800 border border-stone-700 text-stone-200 text-[11px] font-bold transition-colors flex items-center gap-1.5"
              >
                <FolderOpen className="w-3.5 h-3.5 text-emerald-400" />
                {targetFolderHandle ? 'Change Folder' : 'Connect My Placemarks Folder'}
              </button>
            )}
            {targetFolderHandle && (
              <button
                type="button"
                onClick={handleDisconnectTargetFolder}
                className="px-2.5 py-1.5 rounded-lg bg-stone-900 hover:bg-stone-800 border border-stone-700 text-stone-400 hover:text-rose-300 text-[11px] font-semibold transition-colors flex items-center gap-1"
                title="Disconnect saved folder"
              >
                <X className="w-3 h-3" />
                Reset
              </button>
            )}
          </div>
        </div>

        {saveStatusMessage && (
          <div className="p-2.5 rounded-lg bg-emerald-950/60 border border-emerald-700/70 text-emerald-200 text-[11px] flex items-center gap-2">
            <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            <span>{saveStatusMessage}</span>
          </div>
        )}

        {saveErrorMessage && (
          <div className="p-2.5 rounded-lg bg-rose-950/70 border border-rose-800 text-rose-200 text-[11px] flex items-center gap-2">
            <AlertTriangle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
            <span>{saveErrorMessage}</span>
          </div>
        )}
      </div>

      {/* Converted Placemarks Table */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold uppercase tracking-wider text-stone-300">
            Converted Google Earth Placemarks ({points.length})
          </span>
          {points.length > 0 && (
            <button
              type="button"
              onClick={() => setPoints([])}
              className="text-[11px] font-semibold text-rose-400 hover:text-rose-300 flex items-center gap-1"
            >
              <Trash2 className="w-3 h-3" />
              Clear All Points
            </button>
          )}
        </div>

        <div className="overflow-x-auto border border-stone-800 rounded-xl">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-stone-900/80 border-b border-stone-800 text-stone-400 text-[11px] uppercase">
                <th className="py-2 px-3">#</th>
                <th className="py-2 px-3">Placemark Name</th>
                <th className="py-2 px-3">DMS Coordinates</th>
                <th className="py-2 px-3 text-right">DD Latitude</th>
                <th className="py-2 px-3 text-right">DD Longitude</th>
                <th className="py-2 px-3">Description</th>
                <th className="py-2 px-3 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-800/70 font-mono">
              {points.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-6 text-center text-stone-500 font-sans italic">
                    No GPS coordinate points added yet. Enter DMS or DD coordinates above to convert to Google Earth Placemarks.
                  </td>
                </tr>
              ) : (
                points.map((pt, idx) => (
                  <tr key={pt.id} className="hover:bg-stone-900/50 transition-colors">
                    <td className="py-2 px-3 text-stone-500">{idx + 1}</td>
                    <td className="py-2 px-3 font-sans font-semibold text-emerald-300">{pt.name}</td>
                    <td className="py-2 px-3 text-stone-200 text-[11px] whitespace-nowrap">
                      {decimalToDmsParts(pt.lat, true).formatted}, {decimalToDmsParts(pt.lng, false).formatted}
                    </td>
                    <td className="py-2 px-3 text-right text-stone-300">{pt.lat.toFixed(6)}</td>
                    <td className="py-2 px-3 text-right text-stone-300">{pt.lng.toFixed(6)}</td>
                    <td className="py-2 px-3 font-sans text-stone-400 max-w-[220px] truncate" title={pt.description}>
                      {pt.description || '—'}
                    </td>
                    <td className="py-2 px-3 text-center">
                      <button
                        type="button"
                        onClick={() => handleRemovePoint(pt.id)}
                        className="p-1 rounded text-stone-500 hover:text-rose-400 hover:bg-stone-800 transition-colors"
                        title="Remove placemark"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Optional KML XML Preview */}
      {showKmlPreview && generatedKml && (
        <div className="space-y-1.5">
          <span className="text-[10px] font-bold uppercase tracking-wider text-stone-400">
            Generated KML 2.2 Placemark Output
          </span>
          <pre className="p-3 rounded-xl bg-stone-950 border border-stone-800 text-[11px] font-mono text-emerald-300 overflow-x-auto max-h-64">
            {generatedKml}
          </pre>
        </div>
      )}
    </div>
  );
};
