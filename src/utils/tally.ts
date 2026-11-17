import { TreeEntry, GirthClass, AuditReport, AuditIssue } from '../types';

export function parseGirthRanges(defStr: string): GirthClass[] {
  if (!defStr) defStr = "50-69,70-89,90-109,110-129,130-149,150+";
  return defStr.split(',').map(s => s.trim()).filter(Boolean).map(s => {
    if (s.endsWith('+')) {
      const min = parseInt(s, 10) || 0;
      return { label: s, min, max: Infinity };
    }
    const parts = s.split('-').map(x => parseInt(x.trim(), 10));
    const min = parts[0] || 0;
    const max = parts[1] || min;
    return { label: s, min, max };
  });
}

export function getGirthBucketIndex(girth: number, ranges: GirthClass[]): number {
  for (let i = 0; i < ranges.length; i++) {
    if (girth >= ranges[i].min && girth <= ranges[i].max) {
      return i;
    }
  }
  return -1;
}

// Calculate DBH (Diameter at Breast Height) in cm from girth
export function calculateDbh(girth: number): number {
  return parseFloat((girth / Math.PI).toFixed(1));
}

// Calculate estimated basal area in m²: BA = (π * DBH^2) / 40000
export function calculateBasalArea(girth: number): number {
  const dbhMeters = (girth / Math.PI) / 100; // convert cm to m
  const area = (Math.PI * Math.pow(dbhMeters, 2)) / 4;
  return parseFloat(area.toFixed(3));
}

// Estimate merchantable volume (m³) assuming default form factor ~ 0.65 and height ~ 15m or measured height
export function estimateVolume(girth: number, heightM: number = 15): number {
  const ba = calculateBasalArea(girth);
  const vol = ba * heightM * 0.65;
  return parseFloat(vol.toFixed(2));
}

// Full sequence and data audit
export function auditTreeEntries(entries: TreeEntry[]): AuditReport {
  if (entries.length === 0) {
    return {
      isClean: true,
      totalLogged: 0,
      maxNumber: 0,
      missingNums: [],
      duplicateNums: [],
      outliers: [],
      issues: [],
    };
  }

  const nums = entries.map(e => e.num);
  const maxNumber = Math.max(...nums);
  
  // Duplicates check
  const counts: Record<number, number> = {};
  nums.forEach(n => { counts[n] = (counts[n] || 0) + 1; });
  const duplicateNums = Object.keys(counts)
    .map(Number)
    .filter(n => counts[n] > 1)
    .sort((a, b) => a - b);

  // Missing numbers check (assume starting from 1 up to maxNumber)
  const present = new Set(nums);
  const missingNums: number[] = [];
  for (let i = 1; i <= maxNumber; i++) {
    if (!present.has(i)) {
      missingNums.push(i);
    }
  }

  // Outlier detection: Girth < 10cm (too small) or > 600cm (unusually huge typo) or extreme relative deviation
  const outliers: { num: number; girth: number; reason: string }[] = [];
  const girthValues = entries.map(e => e.girth);
  const avgGirth = girthValues.reduce((a, b) => a + b, 0) / (girthValues.length || 1);

  entries.forEach(e => {
    if (e.girth < 15) {
      outliers.push({ num: e.num, girth: e.girth, reason: 'Girth < 15cm (Extremely small or typo)' });
    } else if (e.girth > 500) {
      outliers.push({ num: e.num, girth: e.girth, reason: 'Girth > 500cm (Possible extra zero digit added)' });
    } else if (girthValues.length > 5 && (e.girth > avgGirth * 3.5 || e.girth < avgGirth * 0.2)) {
      outliers.push({ num: e.num, girth: e.girth, reason: `Significant deviation from average (${Math.round(avgGirth)}cm)` });
    }
  });

  const issues: AuditIssue[] = [];

  if (missingNums.length > 0) {
    issues.push({
      type: 'missing',
      severity: 'high',
      message: `${missingNums.length} tree number(s) skipped in sequence`,
      affectedNums: missingNums,
      suggestedAction: 'Fill missing trees or re-sequence total count'
    });
  }

  if (duplicateNums.length > 0) {
    issues.push({
      type: 'duplicate',
      severity: 'high',
      message: `${duplicateNums.length} tree number(s) logged more than once`,
      affectedNums: duplicateNums,
      suggestedAction: 'Resolve duplicate tree numbers'
    });
  }

  if (outliers.length > 0) {
    issues.push({
      type: 'outlier_girth',
      severity: 'medium',
      message: `${outliers.length} entry/entries with extreme girth values`,
      affectedNums: outliers.map(o => o.num),
      suggestedAction: 'Verify girth measurement'
    });
  }

  const isClean = missingNums.length === 0 && duplicateNums.length === 0 && outliers.length === 0;

  return {
    isClean,
    totalLogged: entries.length,
    maxNumber,
    missingNums,
    duplicateNums,
    outliers,
    issues
  };
}
