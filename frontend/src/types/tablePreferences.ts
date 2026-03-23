import type { DataTableColumn } from '../components/shared/DataTable';

export interface ColumnPreference {
  key: string;
  visible: boolean;
  width?: number;
  order: number;
}

export interface TablePreferences {
  tableId: string;
  columns: ColumnPreference[];
  updatedAt: string;
  version: number;
}

export interface UseTablePreferencesReturn<T> {
  columns: DataTableColumn<T>[];
  preferences: ColumnPreference[];
  toggleColumn: (key: string) => void;
  setColumnWidth: (key: string, width: number) => void;
  reorderColumns: (fromIndex: number, toIndex: number) => void;
  resetToDefaults: () => void;
  visibleColumns: string[];
  hiddenColumns: string[];
}
