export interface TreeIdentificationResult {
  localName: string;
  scientificName: string;
  speciesCode: string;
  confidence: 'High' | 'Medium' | 'Low' | string;
  reasoning: string;
  diagnosticFeatures?: string[];
  alternativeSpecies?: Array<{
    localName: string;
    scientificName: string;
    speciesCode: string;
    distinction?: string;
  }>;
}

export async function identifyTreeWithGemini(description: string): Promise<TreeIdentificationResult> {
  if (!description || !description.trim()) {
    throw new Error('Please enter a description of the tree.');
  }

  const response = await fetch('/api/identify-tree', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ description: description.trim() }),
  });

  if (!response.ok) {
    let errorMessage = `Server error (${response.status})`;
    try {
      const errData = await response.json();
      if (errData?.error) {
        errorMessage = errData.error;
      }
    } catch {
      // ignore
    }
    throw new Error(errorMessage);
  }

  const data = await response.json();
  return data as TreeIdentificationResult;
}
