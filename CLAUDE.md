# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

HTML Version Comparator is a React-based web application that compares two versions of HTML test case documents and generates AI-powered summaries of changes. The application specifically targets HTML files containing test case tables with "Step Order", "Procedure", and "Expected Outcome" columns.

## Development Commands

- **Install dependencies**: `npm install`
- **Run development server**: `npm run dev` (runs on port 3000)
- **Build for production**: `npm run build`
- **Preview production build**: `npm run preview`

## Environment Configuration

The application requires the Gemini API key to be set in `.env.local`:
```
GEMINI_API_KEY=your_api_key_here
```

The Vite configuration (vite.config.ts:14-15) exposes this as `process.env.API_KEY` and `process.env.GEMINI_API_KEY` to the application.

## Architecture Overview

### Core Comparison Algorithm

The application implements an LCS (Longest Common Subsequence) based diff algorithm in `App.tsx:performLcsDiff()` that supports two comparison modes:

1. **Step Mode** (`mode='step'`): Matches rows by "Step Order" field, then checks for content modifications in Procedure and Expected Outcome
2. **Content Mode** (`mode='content'`): Matches rows by the first two lines of the Procedure field content, allowing detection of step order changes

The comparison process:
1. HTML files are parsed in `services/excelParser.ts` to extract table data as 2D arrays
2. Raw data is processed in `App.tsx:processRawData()` to:
   - Locate the header row containing required columns
   - Merge continuation rows (rows without Step Order that extend previous test steps)
   - Identify category rows (rows with Procedure only, no Step Order or Expected Outcome)
3. The LCS algorithm matches rows between versions, producing `ComparisonRowPair` objects with statuses: ADDED, DELETED, MODIFIED, or UNCHANGED
4. Changed rows are sent to Gemini API (`services/geminiService.ts`) for natural language summary generation

### Data Flow

```
HTML File Upload → parseHtmlFile() → processRawData() → performLcsDiff() →
→ ComparisonResult + diffSummary → getChangesSummary() → Display
```

### Key Technical Details

- **HTML Preservation**: The application preserves original HTML formatting from cells (bold, italic, lists) by storing cell.innerHTML rather than textContent
- **Category Row Detection** (App.tsx:68-72, ComparisonResultDisplay.tsx:25-47): Rows without Step Order or Expected Outcome are treated as category headers and styled differently (blue for primary, green for subcategories)
- **Continuation Row Merging** (App.tsx:77-92): Content from rows without Step Order is appended to the last valid test step row
- **Color Style Stripping** (ComparisonResultDisplay.tsx:55-83): Inline color styles are removed to ensure readability with app-defined backgrounds

### Components Structure

- `App.tsx`: Main application logic, file handling, comparison orchestration
- `components/FileUploader.tsx`: File selection UI component
- `components/ComparisonResultDisplay.tsx`: Table display with filtering and inline text diffs
- `components/TextDiff.tsx`: Word-level diff visualization for modified cells
- `components/icons.tsx`: SVG icon components
- `services/excelParser.ts`: HTML table parsing and data extraction
- `services/geminiService.ts`: Gemini API integration for AI summaries
- `types.ts`: TypeScript type definitions

### TypeScript Configuration

The project uses module resolution "bundler" with path alias `@/*` pointing to the project root (tsconfig.json:21-24, vite.config.ts:18-20).

## Important Implementation Notes

- The app expects HTML files with tables containing exactly these header columns: "Step Order", "Procedure", "Expected Outcome"
- Multiple tables in an HTML file are supported - the parser finds the first table with matching headers
- When changing comparison modes after an initial comparison, the app automatically re-runs the comparison (App.tsx:275-279)
- The Gemini summary is limited to the first 10 changed rows to keep API calls efficient (App.tsx:258)
- The comparison table supports "Show only changes" toggle to filter out unchanged rows
