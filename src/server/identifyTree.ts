import { GoogleGenAI, Type } from '@google/genai';

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

export async function identifyTreeSpecies(description: string): Promise<TreeIdentificationResult> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not set on the server.');
  }

  const ai = new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });

  const prompt = `You are a tropical dendrologist and timber identification specialist. A field forester or timber enumerator provided the following field description of a tree:

"""
${description.trim()}
"""

Identify the most likely tree species, local/commercial timber name, scientific binomial name, and 2-4 letter timber code (e.g. Ghana Forestry Commission standard code like MIL for Odum/Milicia excelsa, PIP for Dahoma/Piptadeniastrum africanum, EC for Sapele/Entandrophragma cylindricum, CP for Onyina/Ceiba pentandra, or suitable forestry code).

Provide high accuracy reasoning citing the key botanical traits mentioned (bark, slash, latex, leaves, buttress, odor, timber properties).`;

  const response = await ai.models.generateContent({
    model: 'gemini-3.7-flash',
    contents: prompt,
    config: {
      systemInstruction:
        'You are an authoritative forestry taxonomist specializing in tropical timber species. Always return your response strictly as valid JSON adhering to the specified schema.',
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          localName: {
            type: Type.STRING,
            description: 'Common or local timber species name (e.g. Odum, Dahoma, Sapele, Onyina, Wawa, Kusia)',
          },
          scientificName: {
            type: Type.STRING,
            description: 'Botanical scientific name with Genus and species (e.g. Milicia excelsa, Piptadeniastrum africanum)',
          },
          speciesCode: {
            type: Type.STRING,
            description: 'Standard 2-4 letter uppercase timber species code (e.g. MIL, PIP, EC, CP, NAU, DO, EA)',
          },
          confidence: {
            type: Type.STRING,
            description: "Confidence level: 'High', 'Medium', or 'Low'",
          },
          reasoning: {
            type: Type.STRING,
            description: 'Concise explanation highlighting the diagnostic physical traits that identify this tree.',
          },
          diagnosticFeatures: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            description: '2 to 4 key physical field traits to verify on-site.',
          },
          alternativeSpecies: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                localName: { type: Type.STRING },
                scientificName: { type: Type.STRING },
                speciesCode: { type: Type.STRING },
                distinction: { type: Type.STRING },
              },
              required: ['localName', 'scientificName', 'speciesCode'],
            },
            description: 'Alternative candidate species if the description could match other trees.',
          },
        },
        required: ['localName', 'scientificName', 'speciesCode', 'confidence', 'reasoning'],
      },
    },
  });

  const outputText = response.text;
  if (!outputText) {
    throw new Error('Gemini API returned an empty response.');
  }

  const parsed = JSON.parse(outputText) as TreeIdentificationResult;
  return parsed;
}
