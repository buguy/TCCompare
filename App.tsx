import React, { useState, useCallback, useRef, useEffect } from 'react';
import { FileUploader } from './components/FileUploader';
import { ComparisonResultDisplay } from './components/ComparisonResultDisplay';
import { parseHtmlFile } from './services/excelParser';
import { getChangesSummary } from './services/geminiService';
import { ComparisonResult, RowData, ChangeType, ComparisonRowPair } from './types';
import { HtmlIcon, LoadingIcon } from './components/icons';

type ComparisonOutput = {
  result: ComparisonResult;
  diffSummary: { added: number; deleted: number; modified: number };
};

const getCleanTextContent = (htmlString: string): string => {
    if (typeof htmlString !== 'string' || !htmlString) return '';
    try {
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = htmlString;
        return (tempDiv.textContent || '').trim();
    } catch {
        // Fallback for invalid HTML
        return htmlString.trim();
    }
};

const processRawData = (rawData: any[][]): RowData[] => {
    if (!rawData || rawData.length === 0) {
        return [];
    }

    const requiredHeaders = ["Step Order", "Procedure", "Expected Outcome"];
    
    let headerIndex = -1;
    let cleanHeaders: string[] = [];
    
    for(let i = 0; i < rawData.length; i++) {
        const row = rawData[i];
        const potentialHeaders = (row || []).map(cellHtml => getCleanTextContent(String(cellHtml || '')));
        
        if (row && Array.isArray(row) && requiredHeaders.every(h => potentialHeaders.includes(h))) {
            headerIndex = i;
            cleanHeaders = potentialHeaders;
            break;
        }
    }

    if (headerIndex === -1) {
        throw new Error(`Could not find the table header row containing "${requiredHeaders.join(', ')}".`);
    }
    
    const dataRows = rawData.slice(headerIndex + 1);

    const structuredData: RowData[] = dataRows.map(rowArray => {
        const rowObject: RowData = {};
        cleanHeaders.forEach((header, index) => {
            rowObject[header] = rowArray[index] ?? "";
        });
        return rowObject;
    });

    const mergedRows: RowData[] = [];
    let lastParentRow: RowData | null = null;

    for (const row of structuredData) {
        const stepOrderText = getCleanTextContent(String(row["Step Order"] || ''));
        const procedureText = getCleanTextContent(String(row["Procedure"] || ''));

        const isCategoryRow = stepOrderText === '' && procedureText.trim() !== '' && getCleanTextContent(String(row['Expected Outcome'] || '')) === '';
        const isTestStepRow = stepOrderText.trim() !== '';

        if (isCategoryRow) {
            lastParentRow = null; 
            mergedRows.push(row);
        } else if (isTestStepRow) {
            lastParentRow = row;
            mergedRows.push(row);
        } else { // Continuation Row
            if (lastParentRow) {
                 for (const header of cleanHeaders) {
                    const contentToAppend = row[header];
                    if (contentToAppend && getCleanTextContent(String(contentToAppend)) !== "") {
                        const existingContent = lastParentRow[header] || "";
                        lastParentRow[header] = existingContent 
                            ? existingContent + contentToAppend 
                            : contentToAppend;
                    }
                }
            } else {
                // Orphaned continuation row, preserve it.
                mergedRows.push(row);
            }
        }
    }
    return mergedRows;
}


const getFirstTwoLinesKey = (htmlString: string): string => {
    if (!htmlString) return '';
    // Normalize various line break tags into a single separator
    const withSeparators = htmlString.replace(/<br\s*\/?>|<\/p>|<\/div>/gi, '||LINE_BREAK||');
    
    // Strip remaining HTML tags to get just text content
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = withSeparators;
    const textContent = tempDiv.textContent || '';
    
    // Split into lines, filter empty ones, take the first two
    const lines = textContent.split('||LINE_BREAK||')
        .map(line => line.trim())
        .filter(line => line);
        
    // Join with a space to make it a single string for comparison
    return lines.slice(0, 2).join(' ').trim();
};


const performLcsDiff = (original: RowData[], revised: RowData[], mode: 'step' | 'content'): ComparisonOutput => {
    const areRowsEqual = (rowA: RowData, rowB: RowData) => {
        const isCategoryA = !getCleanTextContent(String(rowA['Step Order'] || '')) && getCleanTextContent(String(rowA['Procedure'] || '')) && !getCleanTextContent(String(rowA['Expected Outcome'] || ''));
        const isCategoryB = !getCleanTextContent(String(rowB['Step Order'] || '')) && getCleanTextContent(String(rowB['Procedure'] || '')) && !getCleanTextContent(String(rowB['Expected Outcome'] || ''));

        if (isCategoryA && isCategoryB) {
            return getCleanTextContent(String(rowA['Procedure'] || '')) === getCleanTextContent(String(rowB['Procedure'] || ''));
        }
        if (isCategoryA !== isCategoryB) {
             return false;
        }

        const procA = String(rowA['Procedure'] || '');
        const procB = String(rowB['Procedure'] || '');
        const stepA = String(rowA['Step Order'] || '').trim();
        const stepB = String(rowB['Step Order'] || '').trim();
        
        if (mode === 'step') {
            return stepA === stepB;
        } else { // mode === 'content'
            const outcomeA = String(rowA['Expected Outcome'] || '');
            const outcomeB = String(rowB['Expected Outcome'] || '');
            const keyA = getFirstTwoLinesKey(procA);
            const keyB = getFirstTwoLinesKey(procB);
            
            return keyA.trim() !== '' && keyA === keyB;
        }
    };
    
    const m = original.length;
    const n = revised.length;
    const dp = Array(m + 1).fill(null).map(() => Array(n + 1).fill(0));
    for (let i = 1; i <= m; i++) {
        for (let j = 1; j <= n; j++) {
            if (areRowsEqual(original[i - 1], revised[j - 1])) {
                dp[i][j] = dp[i - 1][j - 1] + 1;
            } else {
                dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
            }
        }
    }

    const pairedRows: ComparisonRowPair[] = [];
    let i = m, j = n;
    while (i > 0 || j > 0) {
        const originalRow = i > 0 ? original[i - 1] : null;
        const revisedRow = j > 0 ? revised[j - 1] : null;

        if (i > 0 && j > 0 && areRowsEqual(originalRow, revisedRow)) {
            let status: ChangeType = ChangeType.UNCHANGED;

            const isCategory = !getCleanTextContent(String(originalRow['Step Order'] || '')) && getCleanTextContent(String(originalRow['Procedure'] || '')) && !getCleanTextContent(String(originalRow['Expected Outcome'] || ''));

            if (!isCategory) {
                if (mode === 'step') {
                    const originalRelevant = { proc: originalRow['Procedure'], outcome: originalRow['Expected Outcome'] };
                    const revisedRelevant = { proc: revisedRow['Procedure'], outcome: revisedRow['Expected Outcome'] };
                    const isContentEqual = JSON.stringify(originalRelevant) === JSON.stringify(revisedRelevant);
                    status = isContentEqual ? ChangeType.UNCHANGED : ChangeType.MODIFIED;
                } else { // mode === 'content'
                    const originalProc = String(originalRow['Procedure'] || '').trim();
                    const revisedProc = String(revisedRow['Procedure'] || '').trim();
                    const originalOutcome = String(originalRow['Expected Outcome'] || '').trim();
                    const revisedOutcome = String(revisedRow['Expected Outcome'] || '').trim();
                    const originalStep = String(originalRow['Step Order'] || '').trim();
                    const revisedStep = String(revisedRow['Step Order'] || '').trim();
                    
                    const isFullyEqual = originalProc === revisedProc && originalOutcome === revisedOutcome && originalStep === revisedStep;
                    status = isFullyEqual ? ChangeType.UNCHANGED : ChangeType.MODIFIED;
                }
            }
            pairedRows.unshift({ status: status, original: originalRow, revised: revisedRow, key: `match-${i}-${j}` });
            i--; j--;
        } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
            pairedRows.unshift({ status: ChangeType.ADDED, original: null, revised: revisedRow, key: `revised-${j}` });
            j--;
        } else if (i > 0 && (j === 0 || dp[i][j - 1] < dp[i - 1][j])) {
            pairedRows.unshift({ status: ChangeType.DELETED, original: originalRow, revised: null, key: `original-${i}` });
            i--;
        } else {
            break;
        }
    }

    const diffSummary = { added: 0, deleted: 0, modified: 0 };
    pairedRows.forEach(p => {
        if (p.status === ChangeType.ADDED) diffSummary.added++;
        if (p.status === ChangeType.DELETED) diffSummary.deleted++;
        if (p.status === ChangeType.MODIFIED) diffSummary.modified++;
    });

    const allHeaders = Array.from(new Set([...(original[0] ? Object.keys(original[0]) : []), ...(revised[0] ? Object.keys(revised[0]) : [])]));

    return {
      result: { headers: allHeaders, rows: pairedRows },
      diffSummary: diffSummary
    };
};

const App: React.FC = () => {
  const [originalFile, setOriginalFile] = useState<File | null>(null);
  const [revisedFile, setRevisedFile] = useState<File | null>(null);
  const [comparisonResult, setComparisonResult] = useState<ComparisonResult | null>(null);
  const [geminiSummary, setGeminiSummary] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [comparisonMode, setComparisonMode] = useState<'step' | 'content'>('step');
  const hasCompared = useRef(false);


  const handleCompare = useCallback(async () => {
    if (!originalFile || !revisedFile) {
      setError("Please upload both original and revised files.");
      return;
    }

    setIsLoading(true);
    setError(null);
    setComparisonResult(null);
    setGeminiSummary('');

    try {
      const originalRawData = await parseHtmlFile(originalFile).catch(e => {
        throw new Error(`${e.message} in original file: ${originalFile.name}`);
      });
      const revisedRawData = await parseHtmlFile(revisedFile).catch(e => {
          throw new Error(`${e.message} in revised file: ${revisedFile.name}`);
      });
      
      const originalTestSteps = processRawData(originalRawData);
      const revisedTestSteps = processRawData(revisedRawData);
      
      if (originalTestSteps.length === 0 && revisedTestSteps.length === 0) {
          throw new Error("No comparable test step data could be found in either file. Please ensure the HTML file contains a table with a header row with 'Step Order', 'Procedure', and 'Expected Outcome'.");
      }

      const { result, diffSummary } = performLcsDiff(originalTestSteps, revisedTestSteps, comparisonMode);
      setComparisonResult(result);
      hasCompared.current = true;

      const changedRowsSample = result.rows.filter(r => r.status !== ChangeType.UNCHANGED).slice(0, 10);
      if (changedRowsSample.length > 0) {
        const summary = await getChangesSummary(diffSummary, changedRowsSample);
        setGeminiSummary(summary);
      } else {
        setGeminiSummary("No functional changes were detected between the two files.");
      }

    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : "An unknown error occurred during comparison.");
      hasCompared.current = false;
    } finally {
      setIsLoading(false);
    }
  }, [originalFile, revisedFile, comparisonMode]);

  useEffect(() => {
    if (hasCompared.current) {
      handleCompare();
    }
  }, [comparisonMode, handleCompare]);
  
  const handleOriginalFileSelect = (file: File) => {
    setOriginalFile(file);
    setComparisonResult(null);
    setGeminiSummary('');
    setError(null);
    hasCompared.current = false;
  };
  
  const handleRevisedFileSelect = (file: File) => {
    setRevisedFile(file);
    setComparisonResult(null);
    setGeminiSummary('');
    setError(null);
    hasCompared.current = false;
  };

  return (
    <div className="min-h-screen bg-gray-50 font-sans text-gray-800">
      <main className="px-4 sm:px-6 lg:px-8 py-8 md:py-12">
        <header className="text-center mb-10">
          <div className="flex justify-center items-center gap-4 mb-4">
            <HtmlIcon className="h-12 w-12 text-orange-600" />
            <h1 className="text-4xl md:text-5xl font-bold text-gray-800 tracking-tight">HTML Version Comparator</h1>
          </div>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            Upload original and revised HTML files to see an AI-powered summary of the changes.
          </p>
        </header>

        <div className="max-w-4xl mx-auto bg-white p-6 md:p-8 rounded-2xl shadow-lg border border-gray-200">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            <FileUploader
              id="original-file"
              label="Original Version"
              onFileSelect={handleOriginalFileSelect}
              fileName={originalFile?.name}
            />
            <FileUploader
              id="revised-file"
              label="Revised Version"
              onFileSelect={handleRevisedFileSelect}
              fileName={revisedFile?.name}
            />
          </div>

          <fieldset className="my-6">
            <legend className="block text-sm font-medium text-gray-800 text-center mb-3">Comparison Method</legend>
            <div className="flex justify-center items-center gap-4 md:gap-8">
                <div className="flex items-center">
                <input
                    id="compare-by-step"
                    name="comparison-mode"
                    type="radio"
                    value="step"
                    checked={comparisonMode === 'step'}
                    onChange={() => setComparisonMode('step')}
                    className="h-4 w-4 text-[#4A70A9] border-gray-300 focus:ring-[#4A70A9]"
                />
                <label htmlFor="compare-by-step" className="ml-2 block text-sm font-medium text-gray-700">
                    By Step Order
                </label>
                </div>
                <div className="flex items-center">
                <input
                    id="compare-by-content"
                    name="comparison-mode"
                    type="radio"
                    value="content"
                    checked={comparisonMode === 'content'}
                    onChange={() => setComparisonMode('content')}
                    className="h-4 w-4 text-[#4A70A9] border-gray-300 focus:ring-[#4A70A9]"
                />
                <label htmlFor="compare-by-content" className="ml-2 block text-sm font-medium text-gray-700">
                    By Content
                </label>
                </div>
            </div>
          </fieldset>

          <div className="text-center">
            <button
              onClick={handleCompare}
              disabled={!originalFile || !revisedFile || isLoading}
              className="w-full md:w-auto inline-flex items-center justify-center px-8 py-3 bg-[#4A70A9] text-white font-semibold rounded-lg shadow-md hover:bg-[#3e6094] disabled:bg-[#a0b3ce] disabled:cursor-not-allowed transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#4A70A9]"
            >
              {isLoading ? (
                <>
                  <LoadingIcon className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" />
                  Analyzing...
                </>
              ) : (
                'Compare Files'
              )}
            </button>
          </div>

          {error && (
            <div className="mt-6 p-4 bg-red-100 border border-red-400 text-red-700 rounded-lg" role="alert">
              <p className="font-bold">Error</p>
              <p>{error}</p>
            </div>
          )}
        </div>

        {comparisonResult && (
          <div className="mt-12">
            <ComparisonResultDisplay result={comparisonResult} summary={geminiSummary} mode={comparisonMode} />
          </div>
        )}
      </main>
    </div>
  );
};

export default App;