import React from 'react';

interface TextDiffProps {
  originalText: string;
  revisedText: string;
}

enum DiffType {
  COMMON = 'COMMON',
  ADDED = 'ADDED',
  DELETED = 'DELETED',
}

interface DiffSegment {
  type: DiffType;
  value: string;
}

// Word-based diffing logic using LCS algorithm, now aware of HTML tags
const createDiff = (original: string, revised: string): DiffSegment[] => {
  const splitRegex = /(<[^>]+>|\s+)/; // Split by HTML tags or whitespace
  const originalWords = original.split(splitRegex).filter(Boolean);
  const revisedWords = revised.split(splitRegex).filter(Boolean);

  const m = originalWords.length;
  const n = revisedWords.length;

  // DP table for LCS lengths
  const dp = Array(m + 1).fill(null).map(() => Array(n + 1).fill(0));
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (originalWords[i - 1] === revisedWords[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
  }

  // Backtrack to build the diff
  const diff: DiffSegment[] = [];
  let i = m;
  let j = n;
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && originalWords[i - 1] === revisedWords[j - 1]) {
      diff.unshift({ type: DiffType.COMMON, value: originalWords[i - 1] });
      i--;
      j--;
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      diff.unshift({ type: DiffType.ADDED, value: revisedWords[j - 1] });
      j--;
    } else if (i > 0 && (j === 0 || dp[i][j - 1] < dp[i - 1][j])) {
      diff.unshift({ type: DiffType.DELETED, value: originalWords[i - 1] });
      i--;
    } else {
      break; 
    }
  }

  return diff;
};


export const TextDiff: React.FC<TextDiffProps> = ({ originalText, revisedText }) => {
  if (originalText === revisedText) {
    return <span dangerouslySetInnerHTML={{ __html: originalText }} />;
  }
  
  const diffs = createDiff(originalText, revisedText);

  return (
    <span>
      {diffs.map((part, index) => {
        switch (part.type) {
          case DiffType.ADDED:
            return <span key={index} className="bg-green-200 text-black rounded-[3px]" dangerouslySetInnerHTML={{ __html: part.value }} />;
          case DiffType.DELETED:
            return <del key={index} className="bg-red-200/60 rounded-[3px] decoration-red-400" dangerouslySetInnerHTML={{ __html: part.value }} />;
          default:
            return <span key={index} dangerouslySetInnerHTML={{ __html: part.value }} />;
        }
      })}
    </span>
  );
};