import JSZip from 'jszip';
import * as pdfjsLib from 'pdfjs-dist';
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { TreeEntry, SurveyMetadata } from '../types';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

export interface GoogleEarthPointInput {
  id: string;
  name: string;
  lat: number;
  lng: number;
  altitude?: number;
  description?: string;
}

export interface ParsedPointLineError {
  lineNumber: number;
  rawLine: string;
  reason: string;
}

export interface KmlConversionOptions {
  documentName?: string;
  documentDescription?: string;
  iconStyle?: 'tree' | 'pin' | 'flag';
  markerColor?: 'emerald' | 'amber' | 'rose' | 'sky';
}

// KML colors use aabbggrr hex format
const KML_COLOR_MAP: Record<NonNullable<KmlConversionOptions['markerColor']>, string> = {
  emerald: 'ff59b910',
  amber: 'ff0b9ef5',
  rose: 'ff5e3ff4',
  sky: 'fff8bd38',
};

const KML_ICON_HREF_MAP: Record<NonNullable<KmlConversionOptions['iconStyle']>, string> = {
  tree: 'http://maps.google.com/mapfiles/kml/shapes/parks.png',
  pin: 'http://maps.google.com/mapfiles/kml/pushpin/ylw-pushpin.png',
  flag: 'http://maps.google.com/mapfiles/kml/shapes/flag.png',
};

export function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Normalizes any entered placemark name into a single canonical pattern:
 * UPPERCASE-LABEL-001
 */
export function formatPlacemarkName(rawName: string, sequenceNumber: number = 1): string {
  const safeSeq = Math.max(1, Math.floor(sequenceNumber) || 1);
  const cleaned = rawName
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  if (!cleaned) {
    return `PT-${String(safeSeq).padStart(3, '0')}`;
  }

  if (/^\d+$/.test(cleaned)) {
    return `PT-${cleaned.padStart(3, '0')}`;
  }

  const trailingNumMatch = cleaned.match(/^(.*?)-(\d+)$/);
  if (trailingNumMatch && trailingNumMatch[1]) {
    const prefix = trailingNumMatch[1];
    const paddedNum = trailingNumMatch[2].padStart(3, '0');
    return `${prefix}-${paddedNum}`;
  }

  return `${cleaned}-${String(safeSeq).padStart(3, '0')}`;
}

/**
 * Given a formatted placemark name (e.g. BP-001), returns the next sequential name (BP-002).
 */
export function getNextPatternName(formattedName: string): string {
  const match = formattedName.match(/^(.*)-(\d+)$/);
  if (!match) return '';
  const prefix = match[1];
  const nextNum = parseInt(match[2], 10) + 1;
  return `${prefix}-${String(nextNum).padStart(3, '0')}`;
}

export function getLocalDateStamp(date: Date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}${m}${d}`;
}

/**
 * Normalizes a folder/label string into the prefix used by the downloaded KML file pattern:
 * <LABEL>-<YYYYMMDD>
 */
export function formatKmlFilenamePrefix(rawLabel: string, date: Date = new Date()): string {
  const cleaned = rawLabel
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  const labelPart = cleaned && !/^\d+$/.test(cleaned) ? cleaned : 'PLACEMARKS';
  return `${labelPart}-${getLocalDateStamp(date)}`;
}

/**
 * Formats downloaded KML filenames using a single canonical pattern:
 * <LABEL>-<YYYYMMDD>-001.kml
 */
export function formatKmlFilename(
  rawLabel: string,
  sequenceNumber: number = 1,
  date: Date = new Date()
): string {
  const safeSeq = Math.max(1, Math.floor(sequenceNumber) || 1);
  const prefix = formatKmlFilenamePrefix(rawLabel, date);
  return `${prefix}-${String(safeSeq).padStart(3, '0')}.kml`;
}

const KML_SEQ_STORAGE_KEY = 'timber_tally_kml_file_seq_v1';

export function getStoredKmlSequence(date: Date = new Date()): number {
  const stamp = getLocalDateStamp(date);
  try {
    const raw = localStorage.getItem(KML_SEQ_STORAGE_KEY);
    if (!raw) return 1;
    const parsed = JSON.parse(raw) as { dateStamp?: string; nextSeq?: number };
    if (parsed.dateStamp === stamp && typeof parsed.nextSeq === 'number' && parsed.nextSeq >= 1) {
      return parsed.nextSeq;
    }
  } catch {
    // Ignore storage access errors
  }
  return 1;
}

export function saveUsedKmlSequence(usedSeq: number, date: Date = new Date()): number {
  const stamp = getLocalDateStamp(date);
  const nextSeq = Math.max(1, Math.floor(usedSeq) + 1);
  try {
    localStorage.setItem(
      KML_SEQ_STORAGE_KEY,
      JSON.stringify({ dateStamp: stamp, nextSeq })
    );
  } catch {
    // Ignore storage access errors
  }
  return nextSeq;
}

/**
 * Parses a single latitude or longitude string in Decimal Degrees (DD),
 * Degrees & Decimal Minutes (DDM), or Degrees Minutes Seconds (DMS).
 */
export function parseCoordinateValue(raw: string): number | null {
  if (!raw || !raw.trim()) return null;
  const trimmed = raw.trim().toUpperCase();

  // Check hemisphere direction
  const hasSouth = /\bS\b|S$/.test(trimmed);
  const hasWest = /\bW\b|W$/.test(trimmed);
  const hasNorth = /\bN\b|N$/.test(trimmed);
  const hasEast = /\bE\b|E$/.test(trimmed);

  const cleaned = trimmed
    .replace(/[NSEW]/g, ' ')
    .replace(/[°º]/g, ' ')
    .replace(/[′’']/g, ' ')
    .replace(/[″”"]/g, ' ')
    .trim();

  // Extract numeric components
  const tokens = cleaned.split(/[\s,]+/).filter(Boolean);
  if (tokens.length === 0) return null;

  const numbers = tokens.map(t => Number(t));
  if (numbers.some(n => Number.isNaN(n))) return null;

  let decimal = 0;
  if (numbers.length === 1) {
    decimal = numbers[0];
  } else if (numbers.length === 2) {
    const sign = numbers[0] < 0 ? -1 : 1;
    decimal = sign * (Math.abs(numbers[0]) + Math.abs(numbers[1]) / 60);
  } else if (numbers.length >= 3) {
    const sign = numbers[0] < 0 ? -1 : 1;
    decimal = sign * (Math.abs(numbers[0]) + Math.abs(numbers[1]) / 60 + Math.abs(numbers[2]) / 3600);
  }

  if (hasSouth || hasWest) {
    decimal = -Math.abs(decimal);
  } else if (hasNorth || hasEast) {
    decimal = Math.abs(decimal);
  }

  return Number.isFinite(decimal) ? parseFloat(decimal.toFixed(7)) : null;
}

/**
 * Converts Degrees, Minutes, Seconds + Hemisphere into Decimal Degrees.
 */
export function dmsToDecimal(
  deg: number,
  min: number,
  sec: number,
  dir: 'N' | 'S' | 'E' | 'W'
): number | null {
  if (
    Number.isNaN(deg) ||
    Number.isNaN(min) ||
    Number.isNaN(sec) ||
    deg < 0 ||
    min < 0 ||
    min >= 60 ||
    sec < 0 ||
    sec >= 60
  ) {
    return null;
  }
  const absVal = deg + min / 60 + sec / 3600;
  const isLat = dir === 'N' || dir === 'S';
  if (isLat && absVal > 90) return null;
  if (!isLat && absVal > 180) return null;

  const signed = dir === 'S' || dir === 'W' ? -absVal : absVal;
  return parseFloat(signed.toFixed(7));
}

/**
 * Formats Decimal Degrees into DMS components and display string.
 */
export function decimalToDmsParts(
  decimal: number,
  isLat: boolean
): { deg: number; min: number; sec: number; dir: 'N' | 'S' | 'E' | 'W'; formatted: string } {
  const dir: 'N' | 'S' | 'E' | 'W' = isLat
    ? decimal >= 0
      ? 'N'
      : 'S'
    : decimal >= 0
    ? 'E'
    : 'W';

  const abs = Math.abs(decimal);
  const deg = Math.floor(abs);
  const minFloat = (abs - deg) * 60;
  const min = Math.floor(minFloat);
  const sec = parseFloat(((minFloat - min) * 60).toFixed(2));

  // Handle rounding edge case where sec === 60
  const adjustedSec = sec >= 60 ? 0 : sec;
  const adjustedMin = sec >= 60 ? min + 1 : min;
  const finalMin = adjustedMin >= 60 ? 0 : adjustedMin;
  const finalDeg = adjustedMin >= 60 ? deg + 1 : deg;

  return {
    deg: finalDeg,
    min: finalMin,
    sec: adjustedSec,
    dir,
    formatted: `${finalDeg}° ${finalMin}' ${adjustedSec.toFixed(2)}" ${dir}`,
  };
}

/**
 * Validates latitude and longitude bounds.
 */
export function isValidLatLng(lat: number | null, lng: number | null): boolean {
  if (lat === null || lng === null) return false;
  if (Number.isNaN(lat) || Number.isNaN(lng)) return false;
  return lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;
}

function looksLikeCoordinateToken(token: string): boolean {
  const t = token.trim();
  return /[°º'′’"″”NSEW.]/i.test(t);
}

/**
 * Extracts text lines (including tab-delimited table rows) from a Word (.docx) document.
 */
export async function extractLinesFromDocx(file: File): Promise<string[]> {
  const lowerName = file.name.toLowerCase();
  if (lowerName.endsWith('.doc')) {
    throw new Error('Legacy binary .doc files are not supported directly. Please save the file as .docx in Microsoft Word and upload again.');
  }

  const buffer = await file.arrayBuffer();
  const zip = await JSZip.loadAsync(buffer);
  const docXmlFile = zip.file('word/document.xml');
  if (!docXmlFile) {
    throw new Error('Invalid Word (.docx) file: could not find document content.');
  }

  const xmlText = await docXmlFile.async('string');
  const parser = new DOMParser();
  const xmlDoc = parser.parseFromString(xmlText, 'application/xml');

  const body = xmlDoc.getElementsByTagName('w:body')[0] || xmlDoc.documentElement;
  const lines: string[] = [];

  const getParagraphText = (pEl: Element): string => {
    const parts: string[] = [];
    const walker = xmlDoc.createTreeWalker(pEl, NodeFilter.SHOW_ELEMENT);
    let node = walker.nextNode() as Element | null;
    while (node) {
      if (node.tagName === 'w:t') {
        parts.push(node.textContent || '');
      } else if (node.tagName === 'w:tab') {
        parts.push('\t');
      } else if (node.tagName === 'w:br') {
        parts.push('\n');
      }
      node = walker.nextNode() as Element | null;
    }
    return parts.join('').replace(/\r/g, '').trim();
  };

  Array.from(body.children).forEach(child => {
    if (child.tagName === 'w:tbl') {
      const rows = Array.from(child.getElementsByTagName('w:tr'));
      rows.forEach(row => {
        const cells = Array.from(row.getElementsByTagName('w:tc'));
        const cellTexts = cells.map(cell => {
          const paragraphs = Array.from(cell.getElementsByTagName('w:p'));
          return paragraphs
            .map(getParagraphText)
            .filter(Boolean)
            .join(' ')
            .trim();
        });
        const nonEmpty = cellTexts.filter(Boolean);
        if (nonEmpty.length > 0) {
          lines.push(cellTexts.join('\t'));
        }
      });
    } else if (child.tagName === 'w:p') {
      const pText = getParagraphText(child);
      if (pText) {
        pText.split('\n').forEach(sub => {
          const trimmedSub = sub.trim();
          if (trimmedSub) lines.push(trimmedSub);
        });
      }
    }
  });

  return lines;
}

interface PositionedPdfItem {
  str: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Extracts text lines (preserving table columns via tab delimiters) from a PDF document.
 */
export async function extractLinesFromPdf(file: File): Promise<string[]> {
  const buffer = await file.arrayBuffer();
  const data = new Uint8Array(buffer);
  const loadingTask = pdfjsLib.getDocument({ data });
  const pdfDoc = await loadingTask.promise;

  const lines: string[] = [];

  for (let pageNum = 1; pageNum <= pdfDoc.numPages; pageNum++) {
    const page = await pdfDoc.getPage(pageNum);
    const textContent = await page.getTextContent();

    const items: PositionedPdfItem[] = [];
    for (const rawItem of textContent.items) {
      if ('str' in rawItem && typeof rawItem.str === 'string' && rawItem.str.trim() !== '') {
        const transform = Array.isArray(rawItem.transform) ? rawItem.transform : [1, 0, 0, 10, 0, 0];
        items.push({
          str: rawItem.str,
          x: Number(transform[4]) || 0,
          y: Number(transform[5]) || 0,
          width: typeof rawItem.width === 'number' ? rawItem.width : 0,
          height:
            typeof rawItem.height === 'number' && rawItem.height > 0
              ? rawItem.height
              : Math.abs(Number(transform[3]) || 10),
        });
      }
    }

    if (items.length === 0) continue;

    // Sort top-to-bottom (higher PDF Y is higher on page)
    items.sort((a, b) => b.y - a.y || a.x - b.x);

    const rows: PositionedPdfItem[][] = [];
    for (const item of items) {
      const lastRow = rows[rows.length - 1];
      if (!lastRow) {
        rows.push([item]);
        continue;
      }
      const rowY = lastRow[0].y;
      const yTolerance = Math.max(3.5, Math.min(lastRow[0].height, item.height) * 0.45);
      if (Math.abs(item.y - rowY) <= yTolerance) {
        lastRow.push(item);
      } else {
        rows.push([item]);
      }
    }

    for (const row of rows) {
      row.sort((a, b) => a.x - b.x);
      let rowText = '';
      let prev: PositionedPdfItem | null = null;

      for (const item of row) {
        const chunk = item.str.trim();
        if (!chunk) continue;
        if (!prev) {
          rowText = chunk;
        } else {
          const prevEnd = prev.x + prev.width;
          const gap = item.x - prevEnd;
          const tabThreshold = Math.max(8, (prev.height || 10) * 0.85);
          if (gap >= tabThreshold) {
            rowText += `\t${chunk}`;
          } else if (gap > 1.5) {
            rowText += ` ${chunk}`;
          } else {
            rowText += chunk;
          }
        }
        prev = item;
      }

      const cleaned = rowText.trim();
      if (cleaned) {
        lines.push(cleaned);
      }
    }
  }

  return lines;
}

/**
 * Parses multi-line text containing GPS coordinate points into structured points.
 * Supports Word tables, CSV/TSV lines, and inline DMS/DD coordinate pairs.
 */
export function parseGpsPointsBatch(
  rawText: string,
  startingIndex: number = 1
): { points: GoogleEarthPointInput[]; errors: ParsedPointLineError[] } {
  const lines = rawText.split(/\r?\n/);
  const points: GoogleEarthPointInput[] = [];
  const errors: ParsedPointLineError[] = [];
  let pointCounter = startingIndex;

  lines.forEach((line, idx) => {
    const trimmed = line.trim();
    if (!trimmed) return;

    // Skip table/CSV header rows (e.g. Point | Latitude | Longitude)
    if (/lat(itude)?/i.test(trimmed) && /(lng|lon(gitude)?)/i.test(trimmed)) {
      return;
    }

    let name = '';
    let lat: number | null = null;
    let lng: number | null = null;
    let description: string | undefined;

    // First try explicit delimiters (tab, semicolon, comma)
    const delimitedParts = trimmed.split(/[;\t,]+/).map(p => p.trim()).filter(Boolean);

    if (delimitedParts.length >= 2) {
      // Scan for the best adjacent (lat, lng) coordinate pair in delimited columns
      let foundIdx = -1;
      for (let i = 0; i < delimitedParts.length - 1; i++) {
        const c1 = parseCoordinateValue(delimitedParts[i]);
        const c2 = parseCoordinateValue(delimitedParts[i + 1]);
        if (isValidLatLng(c1, c2)) {
          // Avoid mistaking a leading integer serial number (e.g. "1 \t 5.6037 \t -0.1869") for latitude
          if (
            i === 0 &&
            delimitedParts.length >= 3 &&
            /^\d{1,4}$/.test(delimitedParts[0]) &&
            !looksLikeCoordinateToken(delimitedParts[0]) &&
            looksLikeCoordinateToken(delimitedParts[1]) &&
            looksLikeCoordinateToken(delimitedParts[2])
          ) {
            continue;
          }
          foundIdx = i;
          lat = c1;
          lng = c2;
          break;
        }
      }

      if (foundIdx >= 0) {
        const beforeParts = delimitedParts.slice(0, foundIdx);
        if (beforeParts.length >= 2 && /^\d{1,4}$/.test(beforeParts[0])) {
          name = beforeParts.slice(1).join(' ');
        } else {
          name = beforeParts.join(' ');
        }
        const afterParts = delimitedParts.slice(foundIdx + 2);
        description = afterParts.join(' ').trim() || undefined;
      }
    }

    // Fallback: detect inline N/S + E/W coordinate pair (common in Word paragraphs)
    if (lat === null || lng === null) {
      const hemiPairRegex = /^(.*?)\b(\d{1,3}(?:[°º\s]+\d{1,2}(?:[′’'\s]+\d{1,2}(?:\.\d+)?[″”"]?)?|\.\d+[°º]?)\s*[NS])\s*[,;\s]+\s*(\d{1,3}(?:[°º\s]+\d{1,2}(?:[′’'\s]+\d{1,2}(?:\.\d+)?[″”"]?)?|\.\d+[°º]?)\s*[EW])\b(.*)$/i;
      const match = trimmed.match(hemiPairRegex);
      if (match) {
        const candidateLat = parseCoordinateValue(match[2]);
        const candidateLng = parseCoordinateValue(match[3]);
        if (isValidLatLng(candidateLat, candidateLng)) {
          lat = candidateLat;
          lng = candidateLng;
          name = match[1].replace(/[:\-–—|]+$/g, '').trim();
          description = match[4].replace(/^[:\-–—|]+/g, '').trim() || undefined;
        }
      }
    }

    // Fallback: whitespace-separated tokens
    if (lat === null || lng === null) {
      const wsParts = trimmed.split(/\s+/).map(p => p.trim()).filter(Boolean);
      if (wsParts.length >= 2) {
        for (let i = 0; i < wsParts.length - 1; i++) {
          const c1 = parseCoordinateValue(wsParts[i]);
          const c2 = parseCoordinateValue(wsParts[i + 1]);
          if (isValidLatLng(c1, c2) && looksLikeCoordinateToken(wsParts[i]) && looksLikeCoordinateToken(wsParts[i + 1])) {
            lat = c1;
            lng = c2;
            name = wsParts.slice(0, i).join(' ');
            description = wsParts.slice(i + 2).join(' ').trim() || undefined;
            break;
          }
        }
      }
    }

    if (!isValidLatLng(lat, lng)) {
      errors.push({
        lineNumber: idx + 1,
        rawLine: trimmed,
        reason: 'Could not find valid DMS or DD latitude and longitude.',
      });
      return;
    }

    points.push({
      id: `ge_pt_${Date.now()}_${idx}_${Math.random().toString(36).slice(2, 6)}`,
      name: formatPlacemarkName(name, pointCounter),
      lat: lat!,
      lng: lng!,
      description,
    });
    pointCounter++;
  });

  return { points, errors };
}

/**
 * Converts a single GPS point into a Google Earth KML <Placemark> XML block.
 */
export function convertPointToPlacemarkXml(
  point: GoogleEarthPointInput,
  styleId: string = 'placemarkStyle'
): string {
  const safeName = escapeXml(point.name || 'Unnamed Point');
  const latDms = decimalToDmsParts(point.lat, true).formatted;
  const lngDms = decimalToDmsParts(point.lng, false).formatted;
  const descLines = [
    point.description ? point.description : null,
    `DD: ${point.lat.toFixed(6)}, ${point.lng.toFixed(6)}`,
    `DMS: ${latDms}, ${lngDms}`,
  ].filter(Boolean);

  const safeDesc = escapeXml(descLines.join(' | '));

  return `    <Placemark>
      <name>${safeName}</name>
      <description>${safeDesc}</description>
      <styleUrl>#${styleId}</styleUrl>
      <Point>
        <coordinates>${point.lng},${point.lat},0</coordinates>
      </Point>
    </Placemark>`;
}

/**
 * Converts an array of GPS coordinate points into a complete Google Earth KML 2.2 document.
 */
export function convertGpsPointsToKml(
  points: GoogleEarthPointInput[],
  options: KmlConversionOptions = {}
): string {
  const docName = escapeXml(options.documentName?.trim() || 'GPS Survey Placemarks');
  const docDesc = escapeXml(options.documentDescription?.trim() || 'Converted GPS Coordinates for Google Earth');
  const iconStyle = options.iconStyle || 'tree';
  const markerColor = options.markerColor || 'emerald';

  const kmlColor = KML_COLOR_MAP[markerColor];
  const iconHref = KML_ICON_HREF_MAP[iconStyle];
  const styleId = 'surveyPlacemarkStyle';

  const placemarksXml = points
    .map(pt => convertPointToPlacemarkXml(pt, styleId))
    .join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Document>
    <name>${docName}</name>
    <description>${docDesc}</description>
    <Style id="${styleId}">
      <IconStyle>
        <color>${kmlColor}</color>
        <scale>1.1</scale>
        <Icon>
          <href>${iconHref}</href>
        </Icon>
      </IconStyle>
      <LabelStyle>
        <scale>0.85</scale>
      </LabelStyle>
    </Style>
${placemarksXml}
  </Document>
</kml>`;
}

/**
 * Converts survey tree entries (with real GPS or spatial coordinates) into Google Earth KML.
 */
export function convertSurveyTreesToKml(
  trees: Array<TreeEntry & { x: number; y: number; category: string }>,
  meta: SurveyMetadata
): string {
  const points: GoogleEarthPointInput[] = trees.map(t => {
    const lat = t.gps?.lat ?? 5.55 + t.y / 10000;
    const lng = t.gps?.lng ?? -0.20 + t.x / 10000;
    return {
      id: t.id,
      name: formatPlacemarkName(`TREE-${t.code}-${t.num}`, t.num),
      lat: parseFloat(lat.toFixed(6)),
      lng: parseFloat(lng.toFixed(6)),
      description: `${t.name} | Girth: ${t.girth}cm | DBH: ${t.dbh}cm | Category: ${t.category} | Condition: ${t.condition || 'Healthy'}`,
    };
  });

  const sitePart = meta.siteName?.trim() || 'Forest Survey';
  const compPart = meta.compartmentNo?.trim() ? ` Comp ${meta.compartmentNo.trim()}` : '';

  return convertGpsPointsToKml(points, {
    documentName: `${sitePart}${compPart}`,
    documentDescription: 'Timber Tally GPS Cruise Placemarks',
    iconStyle: 'tree',
    markerColor: 'emerald',
  });
}
