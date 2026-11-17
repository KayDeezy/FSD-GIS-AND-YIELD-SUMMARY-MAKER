import { TreeEntry, SurveyMetadata, SyncLogItem } from '../types';
import { calculateDbh } from './tally';

const STORAGE_KEY_ENTRIES = 'timber_tally_entries_v2';
const STORAGE_KEY_CLEARED = 'timber_tally_cleared_entries_v2';
const STORAGE_KEY_META = 'timber_tally_meta_v2';
const STORAGE_KEY_SYNC_LOGS = 'timber_tally_sync_logs_v2';

export const DEFAULT_SURVEY_META: SurveyMetadata = {
  siteName: '',
  clientName: '',
  compartmentNo: '',
  enumeratorName: '',
  district: '',
  date: new Date().toISOString().split('T')[0],
  girthClassRanges: '70-89,90-109,110-129,130-140,150+',
  targetTotalTrees: undefined
};

export function loadEntries(): TreeEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_ENTRIES);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    console.error('Failed to load tree entries from local storage:', err);
    return [];
  }
}

export function saveEntries(entries: TreeEntry[]): void {
  try {
    // Ensure DBH is computed for all entries
    const enriched = entries.map(e => ({
      ...e,
      dbh: e.dbh || calculateDbh(e.girth),
      updatedAt: e.updatedAt || new Date().toISOString()
    }));
    localStorage.setItem(STORAGE_KEY_ENTRIES, JSON.stringify(enriched));
  } catch (err) {
    console.error('Failed to save tree entries:', err);
  }
}

export function loadClearedEntries(): TreeEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_CLEARED);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    console.error('Failed to load cleared entries backup:', err);
    return [];
  }
}

export function saveClearedEntries(entries: TreeEntry[]): void {
  try {
    if (entries.length === 0) {
      localStorage.removeItem(STORAGE_KEY_CLEARED);
    } else {
      localStorage.setItem(STORAGE_KEY_CLEARED, JSON.stringify(entries));
    }
  } catch (err) {
    console.error('Failed to save cleared entries backup:', err);
  }
}

export function loadMetadata(): SurveyMetadata {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_META);
    if (!raw) return DEFAULT_SURVEY_META;
    const meta = { ...DEFAULT_SURVEY_META, ...JSON.parse(raw) };
    if (meta.siteName === 'ANOMABO OFF RESERVE' || meta.siteName === 'Apeakrom Off-Reserve Area' || meta.siteName === 'Apeakrom Block B') {
      meta.siteName = '';
    }
    if (meta.clientName === 'MESSRS EMMARO WOOD PROCESSING CO. LTD.' || meta.clientName === 'Messrs. Afia Sarpong Company Limited' || meta.clientName === 'Messrs. Afia Sarpong Co.') {
      meta.clientName = '';
    }
    if (meta.district === 'BEKWAI FOREST DISTRICT' || meta.district === 'BEKWAI') {
      meta.district = '';
    }
    if (!meta.girthClassRanges || meta.girthClassRanges === '50-69,70-89,90-109,110-129,130-149,150+') {
      meta.girthClassRanges = '70-89,90-109,110-129,130-140,150+';
    }
    if (meta.targetTotalTrees === 50) {
      meta.targetTotalTrees = undefined;
    }
    return meta;
  } catch {
    return DEFAULT_SURVEY_META;
  }
}

export function saveMetadata(meta: SurveyMetadata): void {
  try {
    localStorage.setItem(STORAGE_KEY_META, JSON.stringify(meta));
  } catch (err) {
    console.error('Failed to save metadata:', err);
  }
}

export function loadSyncLogs(): SyncLogItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_SYNC_LOGS);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

export function saveSyncLogs(logs: SyncLogItem[]): void {
  try {
    localStorage.setItem(STORAGE_KEY_SYNC_LOGS, JSON.stringify(logs.slice(0, 50))); // Keep last 50
  } catch (err) {
    console.error('Failed to save sync logs:', err);
  }
}

// Simulated Cloud Sync
export async function syncWithCloud(entries: TreeEntry[]): Promise<{ updatedEntries: TreeEntry[]; logItem: SyncLogItem }> {
  // Simulate network delay
  await new Promise(res => setTimeout(res, 1200));

  const pendingCount = entries.filter(e => e.syncStatus === 'pending').length;
  const now = new Date().toISOString();

  // Mark pending items as synced
  const updatedEntries = entries.map(e => ({
    ...e,
    syncStatus: 'synced' as const,
    updatedAt: now
  }));

  const logItem: SyncLogItem = {
    id: `sync_${Date.now()}`,
    timestamp: now,
    type: 'upload',
    count: pendingCount || entries.length,
    status: 'success',
    details: pendingCount > 0 
      ? `Uploaded ${pendingCount} pending tree records to Cloud Database.`
      : `Cloud Database fully synchronized (${entries.length} total records).`
  };

  saveEntries(updatedEntries);

  const currentLogs = loadSyncLogs();
  saveSyncLogs([logItem, ...currentLogs]);

  return { updatedEntries, logItem };
}

// Full Survey Export / Import
export function exportSurveyJSON(meta: SurveyMetadata, entries: TreeEntry[]): string {
  const exportObject = {
    app: 'TimberTallyBuilder',
    version: '2.0',
    exportedAt: new Date().toISOString(),
    metadata: meta,
    entries
  };
  return JSON.stringify(exportObject, null, 2);
}

export function importSurveyJSON(jsonStr: string): { meta: SurveyMetadata; entries: TreeEntry[] } {
  const parsed = JSON.parse(jsonStr);
  if (!parsed.entries || !Array.isArray(parsed.entries)) {
    throw new Error('Invalid survey backup file format.');
  }
  const meta = { ...DEFAULT_SURVEY_META, ...(parsed.metadata || {}) };
  const entries: TreeEntry[] = parsed.entries.map((e: Partial<TreeEntry>, index: number) => ({
    id: e.id || `tree_${Date.now()}_${index}`,
    num: Number(e.num) || index + 1,
    girth: Number(e.girth) || 50,
    dbh: Number(e.dbh) || calculateDbh(Number(e.girth) || 50),
    code: (e.code || 'UNK').trim().toUpperCase(),
    name: (e.name || 'UNKNOWN').trim().toUpperCase(),
    condition: e.condition || 'Healthy',
    syncStatus: 'synced',
    createdAt: e.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    notes: e.notes || '',
    gps: e.gps
  }));

  return { meta, entries };
}
