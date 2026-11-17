import React from 'react';
import { TreeEntry, SurveyMetadata } from '../types';
import { GpsToGoogleEarthConverter } from './GpsToGoogleEarthConverter';

interface Props {
  entries: TreeEntry[];
  meta: SurveyMetadata;
  onUpdateTree?: (updated: TreeEntry) => void;
  onAddTree?: (newTree: Omit<TreeEntry, 'id' | 'createdAt' | 'updatedAt' | 'syncStatus'>) => void;
}

export function GisStandMap({ entries, meta }: Props) {
  return (
    <div className="space-y-6">
      {/* GPS Coordinates to Google Earth Placemarks (.KML) Converter */}
      <GpsToGoogleEarthConverter
        entries={entries}
        meta={meta}
      />
    </div>
  );
}
