export type RowData = { 
  [key: string]: any;
};

export enum ChangeType {
  ADDED = 'ADDED',
  DELETED = 'DELETED',
  MODIFIED = 'MODIFIED',
  UNCHANGED = 'UNCHANGED',
}

export interface ComparisonRow {
  status: ChangeType;
  data: RowData;
  originalData?: RowData;
}

export interface ComparisonRowPair {
  status: ChangeType;
  original: RowData | null;
  revised: RowData | null;
  key: string | number;
}

export interface ComparisonResult {
  headers: string[];
  rows: ComparisonRowPair[];
}