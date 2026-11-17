import { TreeEntry, SpeciesInfo } from '../types';
import { calculateDbh } from './tally';

export interface StandSummary {
  totalTrees: number;
  totalBasalAreaM2: number;
  avgDbhCm: number;
  qmdCm: number; // Quadratic Mean Diameter
  totalVolumeM3: number;
  totalAgBiomassTonnes: number; // Aboveground Biomass in dry tonnes
  totalCarbonTonnes: number; // Carbon in tonnes
  totalCo2eTonnes: number; // tCO2e
  totalValueEstimate: number; // in chosen currency
  harvestableTreesCount: number;
  harvestableVolumeM3: number;
  harvestableValue: number;
  residualTreesCount: number;
  residualVolumeM3: number;
}

export interface SpeciesVolumeSummary {
  code: string;
  name: string;
  scientificName: string;
  category: string;
  treeCount: number;
  avgDbh: number;
  totalBasalArea: number; // m²
  totalVolume: number; // m³
  totalBiomass: number; // dry tonnes
  unitPrice: number; // per m³
  totalValue: number;
  harvestableCount: number;
  harvestableVol: number;
}

export interface VolumeFormulaOptions {
  formula: 'tropical_form_factor' | 'smalian' | 'huber' | 'doyle' | 'international_quarter' | 'scribner';
  formFactor: number; // default 0.65
  defaultHeightM: number; // default 15m if not specified per tree
  currency: 'GHS' | 'USD' | 'EUR' | 'GBP';
  pricePerM3Commercial: number;
  pricePerM3LesserUsed: number;
  pricePerM3Protected: number;
  pricePerM3General: number;
  minimumFellingDbhCm: number; // e.g. 70cm DBH
  woodDensityGcm3: number; // default 0.65 g/cm³
  standAreaHectares: number; // default 1.0 ha
}

export const DEFAULT_VOLUME_OPTIONS: VolumeFormulaOptions = {
  formula: 'tropical_form_factor',
  formFactor: 0.65,
  defaultHeightM: 15,
  currency: 'GHS',
  pricePerM3Commercial: 850,
  pricePerM3LesserUsed: 420,
  pricePerM3Protected: 0, // Protected cannot be harvested
  pricePerM3General: 500,
  minimumFellingDbhCm: 70, // 70cm DBH standard minimum felling limit
  woodDensityGcm3: 0.65,
  standAreaHectares: 1.0,
};

/**
 * Calculates individual tree volume (m³) based on selected formula
 */
export function calculateTreeVolume(
  girthCm: number,
  heightM: number | undefined,
  options: VolumeFormulaOptions
): number {
  const dbhCm = girthCm / Math.PI;
  const dbhM = dbhCm / 100;
  const height = (heightM && heightM > 0) ? heightM : options.defaultHeightM;
  const basalAreaM2 = (Math.PI * Math.pow(dbhM, 2)) / 4;

  switch (options.formula) {
    case 'tropical_form_factor': {
      // Standard Forestry Commission Tropical Forest Volume: V = BA * H * FormFactor
      const vol = basalAreaM2 * height * options.formFactor;
      return Math.max(0, parseFloat(vol.toFixed(3)));
    }
    case 'smalian': {
      // Smalian approximation assuming top diameter ~ 0.6 of base DBH
      const topDiamM = dbhM * 0.65;
      const topAreaM2 = (Math.PI * Math.pow(topDiamM, 2)) / 4;
      const vol = ((basalAreaM2 + topAreaM2) / 2) * height;
      return Math.max(0, parseFloat(vol.toFixed(3)));
    }
    case 'huber': {
      // Huber formula using mid-point diameter ~ 0.82 of DBH
      const midDiamM = dbhM * 0.82;
      const midAreaM2 = (Math.PI * Math.pow(midDiamM, 2)) / 4;
      const vol = midAreaM2 * height;
      return Math.max(0, parseFloat(vol.toFixed(3)));
    }
    case 'doyle': {
      // Doyle Log Rule converted to m³ (1 MBF ≈ 2.36 m³)
      // Doyle Board Feet = (D_inches - 4)^2 * (L_feet / 16)
      const dbhInches = dbhCm / 2.54;
      const heightFeet = height * 3.28084;
      const boardFeet = Math.max(0, Math.pow(dbhInches - 4, 2) * (heightFeet / 16));
      const volM3 = (boardFeet / 1000) * 2.36;
      return Math.max(0, parseFloat(volM3.toFixed(3)));
    }
    case 'international_quarter': {
      // International 1/4-inch Rule
      // BF = (0.22 * D^2 - 0.71 * D) * (L_feet / 4)
      const dbhInches = dbhCm / 2.54;
      const heightFeet = height * 3.28084;
      const boardFeet = Math.max(0, (0.22 * Math.pow(dbhInches, 2) - 0.71 * dbhInches) * (heightFeet / 4));
      const volM3 = (boardFeet / 1000) * 2.36;
      return Math.max(0, parseFloat(volM3.toFixed(3)));
    }
    case 'scribner': {
      // Scribner Decimal C approximation
      const dbhInches = dbhCm / 2.54;
      const heightFeet = height * 3.28084;
      const boardFeet = Math.max(0, (0.79 * Math.pow(dbhInches, 2) - 2 * dbhInches - 4) * (heightFeet / 16) * 10);
      const volM3 = (boardFeet / 1000) * 2.36;
      return Math.max(0, parseFloat(volM3.toFixed(3)));
    }
    default:
      return Math.max(0, parseFloat((basalAreaM2 * height * 0.65).toFixed(3)));
  }
}

/**
 * Calculates Aboveground Biomass (AGB) in metric tonnes using Chave et al. (2014) pantropical allometric equation:
 * AGB (kg) = 0.0673 * (ρ * D^2 * H)^0.976
 * where ρ is wood density (g/cm³), D is DBH (cm), H is height (m).
 */
export function calculateTreeBiomass(
  girthCm: number,
  heightM: number | undefined,
  woodDensity: number = 0.65,
  defaultHeight: number = 15
): {
  agbKg: number;
  totalBiomassTonnes: number;
  carbonTonnes: number;
  co2eTonnes: number;
} {
  const dbhCm = girthCm / Math.PI;
  const height = (heightM && heightM > 0) ? heightM : defaultHeight;
  
  if (dbhCm <= 0) {
    return { agbKg: 0, totalBiomassTonnes: 0, carbonTonnes: 0, co2eTonnes: 0 };
  }

  // Chave et al. (2014) equation
  const agbKg = 0.0673 * Math.pow(woodDensity * Math.pow(dbhCm, 2) * height, 0.976);
  // Below-ground biomass (BGB) is typically ~ 20% of AGB (Cairns et al., 1997 / IPCC 2006)
  const bgbKg = agbKg * 0.20;
  const totalBiomassKg = agbKg + bgbKg;
  const totalBiomassTonnes = totalBiomassKg / 1000;

  // Carbon fraction of dry biomass is approx 47% (IPCC standard)
  const carbonTonnes = totalBiomassTonnes * 0.47;
  // CO2 equivalent = Carbon * (44 / 12) = Carbon * 3.667
  const co2eTonnes = carbonTonnes * 3.667;

  return {
    agbKg: parseFloat(agbKg.toFixed(1)),
    totalBiomassTonnes: parseFloat(totalBiomassTonnes.toFixed(3)),
    carbonTonnes: parseFloat(carbonTonnes.toFixed(3)),
    co2eTonnes: parseFloat(co2eTonnes.toFixed(3))
  };
}

/**
 * Computes full stand silvicultural and economic metrics
 */
export function computeStandAnalytics(
  entries: TreeEntry[],
  speciesList: SpeciesInfo[],
  options: VolumeFormulaOptions = DEFAULT_VOLUME_OPTIONS
): {
  summary: StandSummary;
  speciesBreakdown: SpeciesVolumeSummary[];
  dbhDistribution: { range: string; count: number; volume: number; basalArea: number }[];
} {
  if (entries.length === 0) {
    return {
      summary: {
        totalTrees: 0,
        totalBasalAreaM2: 0,
        avgDbhCm: 0,
        qmdCm: 0,
        totalVolumeM3: 0,
        totalAgBiomassTonnes: 0,
        totalCarbonTonnes: 0,
        totalCo2eTonnes: 0,
        totalValueEstimate: 0,
        harvestableTreesCount: 0,
        harvestableVolumeM3: 0,
        harvestableValue: 0,
        residualTreesCount: 0,
        residualVolumeM3: 0,
      },
      speciesBreakdown: [],
      dbhDistribution: []
    };
  }

  const speciesMap = new Map<string, SpeciesInfo>();
  speciesList.forEach(s => speciesMap.set(s.code.toUpperCase(), s));

  let totalBasalAreaM2 = 0;
  let totalVolumeM3 = 0;
  let totalAgBiomassTonnes = 0;
  let totalCarbonTonnes = 0;
  let totalCo2eTonnes = 0;
  let totalValueEstimate = 0;
  let harvestableTreesCount = 0;
  let harvestableVolumeM3 = 0;
  let harvestableValue = 0;
  let residualTreesCount = 0;
  let residualVolumeM3 = 0;

  const dbhSumSquares: number[] = [];
  const dbhValues: number[] = [];

  const speciesAgg: Record<string, SpeciesVolumeSummary> = {};

  // Diameter Distribution buckets
  const dbhRanges = [
    { label: '< 30 cm', min: 0, max: 29.9 },
    { label: '30 - 49 cm', min: 30, max: 49.9 },
    { label: '50 - 69 cm', min: 50, max: 69.9 },
    { label: '70 - 89 cm (Harvestable)', min: 70, max: 89.9 },
    { label: '90 - 109 cm', min: 90, max: 109.9 },
    { label: '110+ cm (Prime)', min: 110, max: Infinity },
  ];

  const dbhDistMap = dbhRanges.map(r => ({
    range: r.label,
    min: r.min,
    max: r.max,
    count: 0,
    volume: 0,
    basalArea: 0
  }));

  entries.forEach(tree => {
    const dbhCm = tree.dbh || calculateDbh(tree.girth);
    dbhValues.push(dbhCm);
    dbhSumSquares.push(Math.pow(dbhCm, 2));

    const dbhM = dbhCm / 100;
    const baM2 = (Math.PI * Math.pow(dbhM, 2)) / 4;
    totalBasalAreaM2 += baM2;

    const volM3 = calculateTreeVolume(tree.girth, tree.height, options);
    totalVolumeM3 += volM3;

    const biomass = calculateTreeBiomass(tree.girth, tree.height, options.woodDensityGcm3, options.defaultHeightM);
    totalAgBiomassTonnes += biomass.totalBiomassTonnes;
    totalCarbonTonnes += biomass.carbonTonnes;
    totalCo2eTonnes += biomass.co2eTonnes;

    const specInfo = speciesMap.get(tree.code.toUpperCase()) || {
      code: tree.code,
      localName: tree.name,
      scientificName: tree.scientificName || '',
      category: 'General' as const
    };

    // Determine unit price per m³
    let unitPrice = options.pricePerM3General;
    if (specInfo.category === 'Commercial') unitPrice = options.pricePerM3Commercial;
    else if (specInfo.category === 'Lesser-Used') unitPrice = options.pricePerM3LesserUsed;
    else if (specInfo.category === 'Protected') unitPrice = options.pricePerM3Protected;

    const treeVal = (specInfo.category === 'Protected') ? 0 : volM3 * unitPrice;
    totalValueEstimate += treeVal;

    // Harvestable Check (DBH >= minimum felling limit and not protected and not dead/defective)
    const isHarvestable = dbhCm >= options.minimumFellingDbhCm && specInfo.category !== 'Protected' && tree.condition !== 'Dead';
    if (isHarvestable) {
      harvestableTreesCount++;
      harvestableVolumeM3 += volM3;
      harvestableValue += treeVal;
    } else {
      residualTreesCount++;
      residualVolumeM3 += volM3;
    }

    // Species aggregation
    const code = tree.code.toUpperCase();
    if (!speciesAgg[code]) {
      speciesAgg[code] = {
        code,
        name: specInfo.localName || tree.name,
        scientificName: specInfo.scientificName || tree.scientificName || '',
        category: specInfo.category || 'General',
        treeCount: 0,
        avgDbh: 0,
        totalBasalArea: 0,
        totalVolume: 0,
        totalBiomass: 0,
        unitPrice,
        totalValue: 0,
        harvestableCount: 0,
        harvestableVol: 0
      };
    }

    speciesAgg[code].treeCount++;
    speciesAgg[code].totalBasalArea += baM2;
    speciesAgg[code].totalVolume += volM3;
    speciesAgg[code].totalBiomass += biomass.totalBiomassTonnes;
    speciesAgg[code].totalValue += treeVal;
    if (isHarvestable) {
      speciesAgg[code].harvestableCount++;
      speciesAgg[code].harvestableVol += volM3;
    }

    // DBH Distribution bucket
    for (const bucket of dbhDistMap) {
      if (dbhCm >= bucket.min && dbhCm <= bucket.max) {
        bucket.count++;
        bucket.volume += volM3;
        bucket.basalArea += baM2;
        break;
      }
    }
  });

  const avgDbhCm = dbhValues.reduce((a, b) => a + b, 0) / dbhValues.length;
  // Quadratic Mean Diameter = sqrt( sum(DBH^2) / N )
  const qmdCm = Math.sqrt(dbhSumSquares.reduce((a, b) => a + b, 0) / dbhSumSquares.length);

  // Finalize species averages
  const speciesBreakdown = Object.values(speciesAgg).map(s => {
    return {
      ...s,
      avgDbh: parseFloat((Math.sqrt((s.totalBasalArea * 4 / Math.PI) / s.treeCount) * 100).toFixed(1)),
      totalBasalArea: parseFloat(s.totalBasalArea.toFixed(3)),
      totalVolume: parseFloat(s.totalVolume.toFixed(2)),
      totalBiomass: parseFloat(s.totalBiomass.toFixed(2)),
      totalValue: Math.round(s.totalValue),
      harvestableVol: parseFloat(s.harvestableVol.toFixed(2))
    };
  }).sort((a, b) => b.totalVolume - a.totalVolume);

  return {
    summary: {
      totalTrees: entries.length,
      totalBasalAreaM2: parseFloat(totalBasalAreaM2.toFixed(3)),
      avgDbhCm: parseFloat(avgDbhCm.toFixed(1)),
      qmdCm: parseFloat(qmdCm.toFixed(1)),
      totalVolumeM3: parseFloat(totalVolumeM3.toFixed(2)),
      totalAgBiomassTonnes: parseFloat(totalAgBiomassTonnes.toFixed(2)),
      totalCarbonTonnes: parseFloat(totalCarbonTonnes.toFixed(2)),
      totalCo2eTonnes: parseFloat(totalCo2eTonnes.toFixed(2)),
      totalValueEstimate: Math.round(totalValueEstimate),
      harvestableTreesCount,
      harvestableVolumeM3: parseFloat(harvestableVolumeM3.toFixed(2)),
      harvestableValue: Math.round(harvestableValue),
      residualTreesCount,
      residualVolumeM3: parseFloat(residualVolumeM3.toFixed(2)),
    },
    speciesBreakdown,
    dbhDistribution: dbhDistMap.map(b => ({
      range: b.range,
      count: b.count,
      volume: parseFloat(b.volume.toFixed(2)),
      basalArea: parseFloat(b.basalArea.toFixed(3))
    }))
  };
}

/**
 * Log Scaling & Defect Deduction Model for individual timber logs
 */
export interface LogScalingItem {
  id: string;
  logNumber: string;
  speciesCode: string;
  speciesName: string;
  lengthM: number; // log length in meters
  smallEndDiamCm: number; // SED in cm
  largeEndDiamCm: number; // LED in cm
  defectType: 'None' | 'Hollow_Heart' | 'Crook_Sweep' | 'Ring_Shake' | 'Butt_Rot' | 'Sapwood_Rot';
  defectDiamCm?: number; // defect diameter in cm
  defectLengthM?: number; // defect length in m
  grossVolumeM3: number;
  defectDeductionM3: number;
  netVolumeM3: number;
  recoveryPercentage: number;
  grade: 'Prime / Export' | 'Standard Sawlog' | 'Industrial' | 'Cull / Fuelwood';
}

export function calculateLogScale(
  lengthM: number,
  smallEndDiamCm: number,
  largeEndDiamCm: number,
  defectType: LogScalingItem['defectType'],
  defectDiamCm: number = 0,
  defectLengthM: number = 0
): {
  grossVolumeM3: number;
  defectDeductionM3: number;
  netVolumeM3: number;
  recoveryPercentage: number;
  grade: LogScalingItem['grade'];
} {
  // Smalian Gross Log Volume = (pi/8) * (D1^2 + D2^2) * L (in meters)
  const d1M = smallEndDiamCm / 100;
  const d2M = largeEndDiamCm / 100;
  const grossVolumeM3 = ((Math.PI / 8) * (Math.pow(d1M, 2) + Math.pow(d2M, 2))) * lengthM;

  let defectDeductionM3 = 0;

  if (defectType === 'Hollow_Heart' || defectType === 'Butt_Rot') {
    // Pipe / Hollow Core Defect: V_defect = (pi/4) * (defectDiam + 2cm allowance)^2 * defectLength
    const defDM = (defectDiamCm + 2) / 100;
    const defLen = Math.min(lengthM, defectLengthM > 0 ? defectLengthM : lengthM);
    defectDeductionM3 = ((Math.PI * Math.pow(defDM, 2)) / 4) * defLen;
  } else if (defectType === 'Crook_Sweep') {
    // Crook / Sweep deduction: (Deflection cm / SED cm) * Gross Volume * 1.5
    const deflectionCm = defectDiamCm;
    const deductionFactor = Math.min(0.60, (deflectionCm / (smallEndDiamCm || 1)) * 1.2);
    defectDeductionM3 = grossVolumeM3 * deductionFactor;
  } else if (defectType === 'Ring_Shake') {
    // Ring shake deduction
    const defDM = defectDiamCm / 100;
    defectDeductionM3 = ((Math.PI * Math.pow(defDM, 2)) / 4) * (defectLengthM || lengthM) * 0.5;
  } else if (defectType === 'Sapwood_Rot') {
    // Sapwood collar rot: Gross - core cylinder
    const coreDiamM = Math.max(0.1, d1M - (defectDiamCm * 2 / 100));
    const soundVol = ((Math.PI * Math.pow(coreDiamM, 2)) / 4) * lengthM;
    defectDeductionM3 = Math.max(0, grossVolumeM3 - soundVol);
  }

  // Ensure deduction cannot exceed gross volume
  defectDeductionM3 = Math.min(grossVolumeM3, defectDeductionM3);
  const netVolumeM3 = Math.max(0, grossVolumeM3 - defectDeductionM3);
  const recoveryPercentage = grossVolumeM3 > 0 ? (netVolumeM3 / grossVolumeM3) * 100 : 100;

  // Grade classification
  let grade: LogScalingItem['grade'] = 'Standard Sawlog';
  if (recoveryPercentage >= 85 && smallEndDiamCm >= 60 && defectType === 'None') {
    grade = 'Prime / Export';
  } else if (recoveryPercentage >= 65 && smallEndDiamCm >= 40) {
    grade = 'Standard Sawlog';
  } else if (recoveryPercentage >= 35) {
    grade = 'Industrial';
  } else {
    grade = 'Cull / Fuelwood';
  }

  return {
    grossVolumeM3: parseFloat(grossVolumeM3.toFixed(3)),
    defectDeductionM3: parseFloat(defectDeductionM3.toFixed(3)),
    netVolumeM3: parseFloat(netVolumeM3.toFixed(3)),
    recoveryPercentage: parseFloat(recoveryPercentage.toFixed(1)),
    grade
  };
}
