import React, { useState } from 'react';
import { ComparisonResult, ChangeType, RowData } from '../types';
import { AiSparkleIcon } from './icons';
import { TextDiff } from './TextDiff';

interface ComparisonResultDisplayProps {
  result: ComparisonResult;
  summary: string;
  mode: 'step' | 'content';
}

const getRowClass = (status: ChangeType) => {
  switch (status) {
    case ChangeType.ADDED:
      return 'bg-green-50/70';
    case ChangeType.DELETED:
      return 'bg-red-50/70';
    case ChangeType.MODIFIED:
      return 'bg-amber-50/70';
    default:
      return 'bg-white';
  }
};

const getCategoryClass = (rowData: RowData | null): string => {
    if (!rowData) return '';

    // Infer category status: has a procedure, but no step order or expected outcome.
    const hasProcedure = rowData['Procedure'] && String(rowData['Procedure']).trim();
    const hasStepOrder = rowData['Step Order'] && String(rowData['Step Order']).trim();
    const hasExpectedOutcome = rowData['Expected Outcome'] && String(rowData['Expected Outcome']).trim();
    
    const isCategory = hasProcedure && !hasStepOrder && !hasExpectedOutcome;
    
    if (!isCategory) return '';
    
    const procedure = rowData['Procedure'] || '';
    
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = procedure;
    const procedureText = tempDiv.textContent || '';
    
    if (procedureText.includes('Full screen mode') || procedureText.includes('Test with')) {
        return 'bg-[#31694E] text-white'; // Green for sub-category
    }
    return 'bg-[#4A70A9] text-white'; // Blue for primary category
};

/**
 * Strips inline color styles and <font color> attributes from an HTML string 
 * to ensure app-defined CSS controls text color for readability.
 * @param htmlString The HTML content string.
 * @returns The sanitized HTML string.
 */
const stripColorStyles = (htmlString: string): string => {
  if (typeof htmlString !== 'string' || !htmlString) return '';

  try {
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = htmlString;
  
    const elements = tempDiv.querySelectorAll('*');
  
    elements.forEach(el => {
      if (el instanceof HTMLElement) {
        if (el.style.color) {
          el.style.removeProperty('color');
        }
      }
      if (el.tagName.toLowerCase() === 'font' && el.hasAttribute('color')) {
        el.removeAttribute('color');
      }
      if (el.getAttribute('style') === '') {
          el.removeAttribute('style');
      }
    });
  
    return tempDiv.innerHTML;
  } catch (e) {
    console.error("Could not strip styles from html string", htmlString, e);
    return htmlString; // Return original string on error
  }
};


export const ComparisonResultDisplay: React.FC<ComparisonResultDisplayProps> = ({ result, summary, mode }) => {
  const { rows: pairedRows } = result;
  const [showOnlyChanges, setShowOnlyChanges] = useState(false);

  const filteredRows = showOnlyChanges 
    ? pairedRows.filter(p => p.status !== ChangeType.UNCHANGED)
    : pairedRows;
  
  const hasChanges = pairedRows.some(p => p.status !== ChangeType.UNCHANGED);

  return (
    <div className="space-y-10">
      {/* AI Summary Section */}
      <div className="bg-white p-6 rounded-2xl shadow-lg border border-gray-200">
        <div className="flex items-center gap-3 mb-4">
          <AiSparkleIcon className="h-8 w-8 text-indigo-500"/>
          <h2 className="text-2xl font-bold text-gray-800">AI-Powered Summary</h2>
        </div>
        <p className="text-gray-600 prose">{summary}</p>
      </div>
      
      {/* Detailed Changes Section */}
      <div className="bg-white rounded-2xl shadow-lg border border-gray-200 overflow-hidden">
        <div className="p-6 border-b border-gray-200">
            <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold text-gray-800">Detailed Comparison</h2>
                {hasChanges && (
                    <div className="relative flex items-center">
                        <input
                            type="checkbox"
                            id="show-only-changes"
                            checked={showOnlyChanges}
                            onChange={(e) => setShowOnlyChanges(e.target.checked)}
                            className="h-4 w-4 rounded border-gray-300 text-[#4A70A9] focus:ring-[#4A70A9]"
                        />
                        <label htmlFor="show-only-changes" className="ml-2 block text-sm font-medium text-gray-700">
                            Show only changes
                        </label>
                    </div>
                )}
            </div>
            <div className="flex flex-wrap gap-x-4 gap-y-2 mt-4 text-sm">
                <div className="flex items-center"><span className="w-4 h-4 rounded-sm bg-green-100 mr-2 border border-green-200"></span>Added Row</div>
                <div className="flex items-center"><span className="w-4 h-4 rounded-sm bg-red-100 mr-2 border border-red-200"></span>Deleted Row</div>
                <div className="flex items-center"><span className="w-4 h-4 rounded-sm bg-amber-100 mr-2 border border-amber-200"></span>Modified Row</div>
                <div className="flex items-center"><span className="px-1 rounded-sm bg-green-200 text-black mr-2">Added Text</span></div>
                <div className="flex items-center"><del className="px-1 rounded-sm bg-red-200/60 mr-2 border border-red-300">Deleted Text</del></div>
            </div>
        </div>
        
        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead className="bg-gray-100">
              {mode === 'step' ? (
                  <tr>
                    <th scope="col" className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider w-[2%] border-r border-gray-200">Step Order</th>
                    <th scope="col" className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider w-[24%] border-r border-gray-200">Original Procedure</th>
                    <th scope="col" className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider w-[24%] border-r border-gray-200">Original Expected Outcome</th>
                    <th scope="col" className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider w-[24%] border-r border-gray-200">Revised Procedure</th>
                    <th scope="col" className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider w-[24%]">Revised Expected Outcome</th>
                  </tr>
              ) : (
                  <tr>
                    <th scope="col" className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider w-[2%] border-r border-gray-200">Step Order (Original)</th>
                    <th scope="col" className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider w-[24%] border-r border-gray-200">Original Procedure</th>
                    <th scope="col" className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider w-[24%] border-r border-gray-200">Original Expected Outcome</th>
                    <th scope="col" className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider w-[24%] border-r border-gray-200">Revised Procedure</th>
                    <th scope="col" className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider w-[24%] border-r border-gray-200">Revised Expected Outcome</th>
                    <th scope="col" className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider w-[2%]">Step Order (Revised)</th>
                  </tr>
              )}
            </thead>
            <tbody className="bg-white">
              {filteredRows.map((pair) => {
                  const { status, original, revised, key } = pair;

                  const categoryClass = getCategoryClass(original || revised);
                  const finalRowClass = categoryClass || getRowClass(status);
                  
                  const originalProc = stripColorStyles(original?.['Procedure'] ?? '');
                  const revisedProc = stripColorStyles(revised?.['Procedure'] ?? '');
                  const originalOutcome = stripColorStyles(original?.['Expected Outcome'] ?? '');
                  const revisedOutcome = stripColorStyles(revised?.['Expected Outcome'] ?? '');

                  const baseCellClass = `px-4 py-3 text-sm border-b border-gray-200 whitespace-pre-wrap break-words align-top ${categoryClass ? '' : 'text-gray-800'}`;
                  
                  if (mode === 'step') {
                    const stepOrder = stripColorStyles(original?.['Step Order'] ?? revised?.['Step Order'] ?? '');
                    return (
                        <tr key={key} className={finalRowClass}>
                            <td className={`${baseCellClass.replace('align-top', 'align-middle')} text-center font-bold border-r border-gray-200`} dangerouslySetInnerHTML={{ __html: stepOrder }}/>
                            
                            <td className={`${baseCellClass} border-r border-gray-200`} dangerouslySetInnerHTML={{ __html: originalProc }}/>
                            <td className={`${baseCellClass} border-r border-gray-200`} dangerouslySetInnerHTML={{ __html: originalOutcome }}/>

                            <td className={`${baseCellClass} border-r border-gray-200`}>
                                {status === ChangeType.MODIFIED && !categoryClass && originalProc !== revisedProc ? (
                                <TextDiff originalText={originalProc} revisedText={revisedProc} />
                                ) : (
                                <span dangerouslySetInnerHTML={{ __html: revisedProc }}/>
                                )}
                            </td>
                            <td className={baseCellClass}>
                                {status === ChangeType.MODIFIED && !categoryClass && originalOutcome !== revisedOutcome ? (
                                <TextDiff originalText={originalOutcome} revisedText={revisedOutcome} />
                                ) : (
                                <span dangerouslySetInnerHTML={{ __html: revisedOutcome }}/>
                                )}
                            </td>
                        </tr>
                    );
                  } else { // mode === 'content'
                    const originalStepOrder = stripColorStyles(original?.['Step Order'] ?? '');
                    const revisedStepOrder = stripColorStyles(revised?.['Step Order'] ?? '');
                    const isStepModified = status === ChangeType.MODIFIED && originalStepOrder !== revisedStepOrder && !categoryClass;
                    return (
                        <tr key={key} className={finalRowClass}>
                            <td className={`${baseCellClass.replace('align-top', 'align-middle')} text-center font-bold border-r border-gray-200`} dangerouslySetInnerHTML={{ __html: originalStepOrder }}/>
                            <td className={`${baseCellClass} border-r border-gray-200`} dangerouslySetInnerHTML={{ __html: originalProc }}/>
                            <td className={`${baseCellClass} border-r border-gray-200`} dangerouslySetInnerHTML={{ __html: originalOutcome }}/>

                            <td className={`${baseCellClass} border-r border-gray-200`}>
                                {status === ChangeType.MODIFIED && !categoryClass && originalProc !== revisedProc ? (
                                    <TextDiff originalText={originalProc} revisedText={revisedProc} />
                                ) : (
                                    <span dangerouslySetInnerHTML={{ __html: revisedProc }}/>
                                )}
                            </td>
                            <td className={`${baseCellClass} border-r border-gray-200`}>
                                {status === ChangeType.MODIFIED && !categoryClass && originalOutcome !== revisedOutcome ? (
                                    <TextDiff originalText={originalOutcome} revisedText={revisedOutcome} />
                                ) : (
                                    <span dangerouslySetInnerHTML={{ __html: revisedOutcome }}/>
                                )}
                            </td>
                            <td className={`${baseCellClass.replace('align-top', 'align-middle')} text-center font-bold ${isStepModified ? 'bg-amber-100/80' : ''}`}>
                                <span dangerouslySetInnerHTML={{ __html: revisedStepOrder }} />
                            </td>
                        </tr>
                    );
                  }
              })}
            </tbody>
          </table>
        </div>
        
        {filteredRows.length === 0 && (
             <p className="p-6 text-center text-gray-500">{showOnlyChanges ? "No changes found." : "No data to display."}</p>
        )}
      </div>
    </div>
  );
};