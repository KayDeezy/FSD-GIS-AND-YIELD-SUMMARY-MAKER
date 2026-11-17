export interface TreeEntry {
  id: string;
  num: number;
  girth: number; // in cm
  dbh?: number;  // Diameter at breast height = girth / PI (cm)
  height?: number; // in meters (optional)
  code: string;
  name: string;
  scientificName?: string;
  condition?: 'Healthy' | 'Damaged' | 'Dead' | 'Defective' | 'Leaning';
  gps?: {
    lat: number;
    lng: number;
    accuracy?: number;
  };
  notes?: string;
  syncStatus: 'synced' | 'pending' | 'error';
  createdAt: string;
  updatedAt: string;
}

export interface SurveyMetadata {
  siteName: string;
  clientName: string;
  compartmentNo: string;
  enumeratorName: string;
  district?: string;
  date: string;
  girthClassRanges: string; // e.g. "50-69,70-89,90-109,110-129,130-149,150+"
  targetTotalTrees?: number; // Total number of trees expected/to be entered
}

export interface GirthClass {
  label: string;
  min: number;
  max: number; // Infinity for open-ended e.g. "150+"
}

export interface SpeciesInfo {
  code: string;
  localName: string;
  scientificName: string;
  category?: 'Commercial' | 'Lesser-Used' | 'Protected' | 'General';
}

export interface AuditIssue {
  type: 'missing' | 'duplicate' | 'outlier_girth' | 'incomplete_data';
  severity: 'high' | 'medium' | 'low';
  message: string;
  affectedNums: number[];
  suggestedAction?: string;
}

export interface AuditReport {
  isClean: boolean;
  totalLogged: number;
  maxNumber: number;
  missingNums: number[];
  duplicateNums: number[];
  outliers: { num: number; girth: number; reason: string }[];
  issues: AuditIssue[];
}

export interface SyncLogItem {
  id: string;
  timestamp: string;
  type: 'upload' | 'download' | 'conflict_resolution';
  count: number;
  status: 'success' | 'failed';
  details: string;
}
