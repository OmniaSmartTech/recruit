import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import type { DataTableColumn } from '../components/shared/DataTable';
import type { ColumnPreference, TablePreferences, UseTablePreferencesReturn } from '../types/tablePreferences';

const STORAGE_KEY_PREFIX = 'rs_table_prefs_';
const CURRENT_VERSION = 1;
const SAVE_DEBOUNCE_MS = 500;

function getColumnKey<T>(col: DataTableColumn<T>): string {
  if (typeof col.key === 'string') return col.key;
  if (typeof col.dataIndex === 'string') return col.dataIndex;
  return String(col.key || col.dataIndex || '');
}

function loadPreferences(tableId: string): TablePreferences | null {
  try {
    const stored = localStorage.getItem(`${STORAGE_KEY_PREFIX}${tableId}`);
    if (!stored) return null;
    const prefs = JSON.parse(stored) as TablePreferences;
    if (!prefs.tableId || !Array.isArray(prefs.columns)) return null;
    return prefs;
  } catch { return null; }
}

function savePreferences(tableId: string, columns: ColumnPreference[]): void {
  try {
    localStorage.setItem(`${STORAGE_KEY_PREFIX}${tableId}`, JSON.stringify({
      tableId, columns, updatedAt: new Date().toISOString(), version: CURRENT_VERSION,
    }));
  } catch { console.warn(`Failed to save table preferences for ${tableId}`); }
}

function createDefaultPreferences<T>(columns: DataTableColumn<T>[], defaultHidden: string[] = []): ColumnPreference[] {
  return columns.map((col, index) => ({
    key: getColumnKey(col),
    visible: !defaultHidden.includes(getColumnKey(col)),
    width: typeof col.width === 'number' ? col.width : undefined,
    order: index,
  }));
}

function mergePreferences<T>(stored: ColumnPreference[], columns: DataTableColumn<T>[], defaultHidden: string[] = []): ColumnPreference[] {
  const storedMap = new Map(stored.map((p) => [p.key, p]));
  const result: ColumnPreference[] = [];

  columns.forEach((col, index) => {
    const key = getColumnKey(col);
    const storedPref = storedMap.get(key);
    if (storedPref) {
      result.push({ ...storedPref, order: storedPref.order >= 0 ? storedPref.order : index });
    } else {
      result.push({ key, visible: !defaultHidden.includes(key), width: typeof col.width === 'number' ? col.width : undefined, order: index + stored.length });
    }
  });

  result.sort((a, b) => a.order - b.order);
  result.forEach((pref, index) => { pref.order = index; });
  return result;
}

export function useTablePreferences<T>(
  tableId: string, columns: DataTableColumn<T>[], defaultHidden: string[] = [],
  onPreferencesChange?: (preferences: ColumnPreference[]) => void
): UseTablePreferencesReturn<T> {
  const columnKeysRef = useRef<string>('');
  const currentColumnKeys = useMemo(() => columns.map(getColumnKey).join(','), [columns]);

  const [preferences, setPreferences] = useState<ColumnPreference[]>(() => {
    const stored = loadPreferences(tableId);
    if (stored) return mergePreferences(stored.columns, columns, defaultHidden);
    return createDefaultPreferences(columns, defaultHidden);
  });

  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const debouncedSave = useCallback((prefs: ColumnPreference[]) => {
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(() => {
      savePreferences(tableId, prefs);
      onPreferencesChange?.(prefs);
    }, SAVE_DEBOUNCE_MS);
  }, [tableId, onPreferencesChange]);

  useEffect(() => { return () => { if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current); }; }, []);

  useEffect(() => {
    const prevKeys = columnKeysRef.current;
    if (prevKeys !== currentColumnKeys) {
      columnKeysRef.current = currentColumnKeys;
      if (prevKeys !== '') setPreferences((prev) => mergePreferences(prev, columns, defaultHidden));
    }
  }, [currentColumnKeys, columns, defaultHidden]);

  const toggleColumn = useCallback((key: string) => {
    setPreferences((prev) => { const u = prev.map((p) => p.key === key ? { ...p, visible: !p.visible } : p); debouncedSave(u); return u; });
  }, [debouncedSave]);

  const setColumnWidth = useCallback((key: string, width: number) => {
    setPreferences((prev) => { const u = prev.map((p) => p.key === key ? { ...p, width: Math.max(50, width) } : p); debouncedSave(u); return u; });
  }, [debouncedSave]);

  const reorderColumns = useCallback((fromIndex: number, toIndex: number) => {
    setPreferences((prev) => {
      const u = [...prev]; const [removed] = u.splice(fromIndex, 1); u.splice(toIndex, 0, removed);
      u.forEach((p, i) => { p.order = i; }); debouncedSave(u); return u;
    });
  }, [debouncedSave]);

  const resetToDefaults = useCallback(() => {
    const d = createDefaultPreferences(columns, defaultHidden); setPreferences(d); debouncedSave(d);
  }, [columns, defaultHidden, debouncedSave]);

  const preferenceMap = useMemo(() => new Map(preferences.map((p) => [p.key, p])), [preferences]);

  const processedColumns = useMemo(() => {
    const withOrder = columns.map((col) => {
      const key = getColumnKey(col);
      const pref = preferenceMap.get(key);
      return { col, key, order: pref?.order ?? columns.indexOf(col), visible: pref?.visible ?? true, width: pref?.width };
    });
    withOrder.sort((a, b) => a.order - b.order);
    return withOrder.filter((item) => item.visible).map((item) => ({ ...item.col, width: item.width ?? item.col.width }));
  }, [columns, preferenceMap]);

  return {
    columns: processedColumns, preferences, toggleColumn, setColumnWidth, reorderColumns, resetToDefaults,
    visibleColumns: useMemo(() => preferences.filter((p) => p.visible).map((p) => p.key), [preferences]),
    hiddenColumns: useMemo(() => preferences.filter((p) => !p.visible).map((p) => p.key), [preferences]),
  };
}
