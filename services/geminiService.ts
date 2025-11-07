import { GoogleGenAI } from "@google/genai";
import { ComparisonRowPair } from "../types";

const API_KEY = process.env.API_KEY;

if (!API_KEY) {
  throw new Error("API_KEY environment variable not set");
}

const ai = new GoogleGenAI({ apiKey: API_KEY });

export const getChangesSummary = async (
  diffSummary: { added: number; deleted: number; modified: number },
  changedRowsSample: ComparisonRowPair[]
): Promise<string> => {
  const model = 'gemini-2.5-flash';
  
  const prompt = `
    You are an expert data analyst assistant. Your task is to provide a concise, high-level summary of the differences between two versions of an HTML test case document.
    Do not repeat the stats verbatim; instead, interpret them to describe the nature of the aanges. The user is likely a project manager or QA lead, so make the summary easy to understand and focused on test procedures and outcomes.
    
    The comparison was performed by matching test steps based on their 'Step Order' ID from a table within the HTML files.

    Here is a statistical summary of the changes:
    - Test steps added: ${diffSummary.added}
    - Test steps deleted: ${diffSummary.deleted}
    - Test steps modified: ${diffSummary.modified}

    Here is a sample of up to 10 changed rows to provide context (format is: {status, originalData, revisedData}):
    ${JSON.stringify(changedRowsSample.map(p => ({ status: p.status, original: p.original, revised: p.revised })), null, 2)}

    Based on this information, provide a brief, insightful summary of what has changed between the two file versions.
    For example, instead of "3 rows were modified", you could say "Several test procedures and expected outcomes were updated, particularly for the login and checkout sequences."
    Focus on the substance of the changes if possible (e.g., "It appears the authentication flow has been significantly reworked").
    Keep the summary to 2-4 sentences.
    `;

  try {
    const response = await ai.models.generateContent({
      model: model,
      contents: prompt,
    });
    return response.text;
  } catch (error) {
    console.error("Error calling Gemini API:", error);
    return "Could not generate an AI summary due to an error. Please review the detailed changes below.";
  }
};