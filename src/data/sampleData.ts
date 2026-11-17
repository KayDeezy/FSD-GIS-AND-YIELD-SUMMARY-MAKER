import { TreeEntry, SurveyMetadata } from '../types';
import { calculateDbh } from '../utils/tally';

export const SAMPLE_SURVEY_META: SurveyMetadata = {
  siteName: '',
  clientName: '',
  compartmentNo: 'Block B - Section 4',
  enumeratorName: 'K. Owusu (Senior Forester)',
  date: new Date().toISOString().split('T')[0],
  girthClassRanges: '50-69,70-89,90-109,110-129,130-149,150+',
  targetTotalTrees: undefined
};

export const SAMPLE_TREES_RAW = [
  { num: 1, girth: 55, code: 'MIL', name: 'ODUM', condition: 'Healthy' as const },
  { num: 2, girth: 62, code: 'AMI', name: 'APROKUMA', condition: 'Healthy' as const },
  { num: 3, girth: 78, code: 'AMI', name: 'APROKUMA', condition: 'Healthy' as const },
  { num: 4, girth: 82, code: 'AMI', name: 'APROKUMA', condition: 'Healthy' as const },
  { num: 5, girth: 95, code: 'SAQ', name: 'SAPELE', condition: 'Healthy' as const },
  { num: 6, girth: 112, code: 'SAQ', name: 'SAPELE', condition: 'Healthy' as const },
  { num: 7, girth: 128, code: 'MIL', name: 'ODUM', condition: 'Healthy' as const },
  { num: 8, girth: 145, code: 'MIL', name: 'ODUM', condition: 'Healthy' as const },
  { num: 9, girth: 160, code: 'TEA', name: 'TEAK', condition: 'Healthy' as const },
  { num: 10, girth: 70, code: 'TEA', name: 'TEAK', condition: 'Healthy' as const },
  { num: 11, girth: 88, code: 'OBE', name: 'OBECHE', condition: 'Healthy' as const },
  { num: 12, girth: 104, code: 'OBE', name: 'OBECHE', condition: 'Healthy' as const },
  { num: 13, girth: 135, code: 'MAH', name: 'MAHOGANY', condition: 'Healthy' as const },
  { num: 14, girth: 155, code: 'MAH', name: 'MAHOGANY', condition: 'Healthy' as const },
  { num: 15, girth: 58, code: 'AMI', name: 'APROKUMA', condition: 'Damaged' as const, notes: 'Bark damage at base' },
  { num: 16, girth: 91, code: 'MIL', name: 'ODUM', condition: 'Healthy' as const },
  { num: 17, girth: 118, code: 'SAQ', name: 'SAPELE', condition: 'Healthy' as const },
  { num: 18, girth: 142, code: 'MAH', name: 'MAHOGANY', condition: 'Healthy' as const },
  { num: 19, girth: 168, code: 'TEA', name: 'TEAK', condition: 'Healthy' as const },
  { num: 20, girth: 75, code: 'OBE', name: 'OBECHE', condition: 'Healthy' as const },
];

export function getSampleTrees(): TreeEntry[] {
  return SAMPLE_TREES_RAW.map(t => ({
    id: `sample_tree_${t.num}`,
    num: t.num,
    girth: t.girth,
    dbh: calculateDbh(t.girth),
    code: t.code,
    name: t.name,
    condition: t.condition,
    notes: t.notes || '',
    syncStatus: 'synced',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }));
}
