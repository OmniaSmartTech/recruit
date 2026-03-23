/**
 * @fileoverview Reusable Data Table Component
 *
 * A feature-rich table component built on Ant Design Table with additional
 * capabilities for search, sorting, and filtering. Designed for consistent
 * data display across the application.
 *
 * Key Features:
 * - Global search with debouncing across all searchable columns
 * - Column-level sorting (click header to sort)
 * - Column-level filtering (dropdown or predefined options)
 * - Scrollable body (no pagination) for large datasets
 * - Consistent styling and theming
 * - Refresh button integration
 * - Custom toolbar support
 * - Column visibility toggle (opt-in)
 * - Column resize via drag handles (opt-in)
 * - Column reorder via drag-and-drop (opt-in)
 * - Persistent preferences via localStorage (opt-in)
 *
 * @module components/shared/common/DataTable
 */

import React, { useState, useMemo, useCallback, useEffect, useRef, memo } from 'react';
import { Table, Input, Space, Button, Typography, Empty, Dropdown, Checkbox } from 'antd';
import type { ColumnsType, ColumnType, TableProps } from 'antd/es/table';
import type { ExpandableConfig } from 'antd/es/table/interface';
import type { FilterDropdownProps } from 'antd/es/table/interface';
import {
  SearchOutlined,
  FilterOutlined,
  ReloadOutlined,
  DownloadOutlined,
  FileExcelOutlined,
  FileTextOutlined,
} from '@ant-design/icons';
import { useTablePreferences } from '../../hooks/useTablePreferences';
import { useColumnResize } from '../../hooks/useColumnResize';
import ColumnSettingsPopover from './ColumnSettingsPopover';
import { exportTableToCSV, exportTableToXLSX } from '../../utils/tableExport';
import type { ColumnPreference } from '../../types/tablePreferences';
import '../../styles/components/DataTable.css';

const { Text } = Typography;

/** Debounce delay for search input in milliseconds */
const SEARCH_DEBOUNCE_MS = 300;

/**
 * Debounced search input component.
 * Manages its own state internally to prevent parent re-renders on each keystroke.
 * Only calls onChange after the debounce period.
 */
interface DebouncedSearchInputProps {
  placeholder?: string;
  onDebouncedChange: (value: string) => void;
  className?: string;
}

const DebouncedSearchInput = memo(function DebouncedSearchInput({
  placeholder = 'Search...',
  onDebouncedChange,
  className,
}: DebouncedSearchInputProps) {
  const [localValue, setLocalValue] = useState('');
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setLocalValue(newValue);

    // Clear existing timer
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    // Set new debounce timer
    debounceTimerRef.current = setTimeout(() => {
      onDebouncedChange(newValue);
    }, SEARCH_DEBOUNCE_MS);
  }, [onDebouncedChange]);

  const handleClear = useCallback(() => {
    setLocalValue('');
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    onDebouncedChange('');
  }, [onDebouncedChange]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

  return (
    <Input
      placeholder={placeholder}
      prefix={<SearchOutlined className="data-table__search-prefix-icon" />}
      value={localValue}
      onChange={handleChange}
      allowClear
      onClear={handleClear}
      className={className}
    />
  );
});

/**
 * Extended column definition with DataTable-specific options.
 * Extends Ant Design ColumnType with simplified sorting/filtering configuration.
 *
 * @template T - Row data type
 */
export interface DataTableColumn<T> extends Omit<ColumnType<T>, 'sorter' | 'filters' | 'filterDropdown'> {
  /** Enable sorting for this column */
  sortable?: boolean;
  /** Custom sorter function - used instead of the default when sortable is true */
  sorter?: (a: T, b: T) => number;
  /** Enable filtering for this column - can be boolean or array of filter options */
  filterable?: boolean | { text: string; value: string | number | boolean }[];
  /** Whether this column should be searchable via global search */
  searchable?: boolean;
  /** Custom filter render function */
  filterRender?: (value: unknown, record: T) => string;
  /** Custom export formatter - returns formatted value for CSV/Excel export */
  exportFormatter?: (value: unknown, record: T) => string | number;
}

/**
 * Props for the DataTable component.
 *
 * @template T - Row data type
 *
 * @example
 * interface User { id: number; name: string; email: string; }
 *
 * const columns: DataTableColumn<User>[] = [
 *   { title: 'Name', dataIndex: 'name', sortable: true, searchable: true },
 *   { title: 'Email', dataIndex: 'email', filterable: true },
 * ];
 *
 * <DataTable
 *   columns={columns}
 *   dataSource={users}
 *   rowKey="id"
 *   onRefresh={() => refetch()}
 * />
 */
export interface DataTableProps<T> {
  /** Column definitions with extended options */
  columns: DataTableColumn<T>[];
  /** Data source array */
  dataSource: T[];
  /** Unique key for each row - field name or function */
  rowKey: string | ((record: T) => string);
  /** Loading state - shows spinner overlay */
  loading?: boolean;
  /** Callback when refresh button is clicked */
  onRefresh?: () => void;
  /** Whether to show the global search bar (default: true) */
  showSearch?: boolean;
  /** Placeholder text for the search input */
  searchPlaceholder?: string;
  /** Message shown when no data available */
  emptyText?: string | React.ReactNode;
  /** Additional toolbar content (rendered left of search) */
  toolbar?: React.ReactNode;
  /** Row selection configuration for checkboxes */
  rowSelection?: TableProps<T>['rowSelection'];
  /** Expandable row configuration */
  expandable?: ExpandableConfig<T>;
  /** Additional Ant Design table props */
  tableProps?: Omit<TableProps<T>, 'columns' | 'dataSource' | 'rowKey' | 'loading' | 'pagination' | 'scroll' | 'expandable' | 'virtual'>;
  /** Max height for scrollable table body (default: 400, set to 0 to disable) */
  scrollHeight?: number;
  /** Table size variant */
  size?: 'small' | 'middle' | 'large';
  /** Whether to show the toolbar (default: true) */
  showToolbar?: boolean;
  /** Whether to show the footer count (default: true) */
  showFooter?: boolean;
  /** Custom CSS class name */
  className?: string;
  /** Enable virtual scrolling for large datasets (auto-enabled when >100 rows) */
  virtual?: boolean;
  /** Enable column customization features (visibility, resize, reorder) */
  customizable?: boolean;
  /** Unique identifier for localStorage persistence (required when customizable=true) */
  tableId?: string;
  /** Column keys to hide by default on first load */
  defaultHiddenColumns?: string[];
  /** Enable column resize via drag handles (default: true when customizable) */
  resizable?: boolean;
  /** Enable column reorder via settings popover (default: true when customizable) */
  reorderable?: boolean;
  /** Callback when preferences change */
  onPreferencesChange?: (preferences: ColumnPreference[]) => void;
  /** Enable CSV export button in toolbar */
  exportable?: boolean;
  /** Filename for CSV export (without extension). Defaults to tableId or 'export' */
  exportFilename?: string;
}

/**
 * Reusable data table with search, sort, and filter capabilities.
 *
 * Built on Ant Design Table with additional features for common use cases.
 * Displays all data in a scrollable body without pagination.
 *
 * @component
 * @template T - Row data type (must be an object)
 *
 * @example
 * // Basic usage
 * <DataTable
 *   columns={[
 *     { title: 'Name', dataIndex: 'name', sortable: true },
 *     { title: 'Status', dataIndex: 'status', filterable: [
 *       { text: 'Active', value: 'active' },
 *       { text: 'Inactive', value: 'inactive' },
 *     ]},
 *   ]}
 *   dataSource={data}
 *   rowKey="id"
 * />
 *
 * @example
 * // With toolbar and refresh
 * <DataTable
 *   columns={columns}
 *   dataSource={vehicles}
 *   rowKey="id"
 *   toolbar={<Button onClick={handleAdd}>Add Vehicle</Button>}
 *   onRefresh={refetchVehicles}
 *   loading={isLoading}
 * />
 */
/** Threshold for auto-enabling virtual scrolling */
const VIRTUAL_SCROLL_THRESHOLD = 100;

/**
 * Get the column key from a DataTableColumn.
 */
function getColumnKey<T>(col: DataTableColumn<T>): string {
  if (typeof col.key === 'string') return col.key;
  if (typeof col.dataIndex === 'string') return col.dataIndex;
  return String(col.key || col.dataIndex || '');
}

function DataTable<T extends object>({
  columns,
  dataSource,
  rowKey,
  loading = false,
  onRefresh,
  showSearch = true,
  searchPlaceholder = 'Search...',
  emptyText = 'No data available',
  toolbar,
  rowSelection,
  expandable,
  tableProps,
  scrollHeight = 400,
  size,
  showToolbar = true,
  showFooter = true,
  className,
  virtual,
  customizable = false,
  tableId,
  defaultHiddenColumns = [],
  resizable = true,
  reorderable = true,
  onPreferencesChange,
  exportable = false,
  exportFilename,
}: DataTableProps<T>): React.ReactElement {
  // Search text is now managed by DebouncedSearchInput component
  // This state only receives the debounced value, so table doesn't re-render on each keystroke
  const [searchText, setSearchText] = useState('');

  // Stable callback for the debounced search input
  const handleDebouncedSearch = useCallback((value: string) => {
    setSearchText(value);
  }, []);

  // Table customization via useTablePreferences hook
  // Only active when customizable=true and tableId is provided
  const shouldCustomize = customizable && !!tableId;

  const {
    columns: customizedColumns,
    preferences,
    toggleColumn,
    setColumnWidth,
    reorderColumns,
    resetToDefaults,
  } = useTablePreferences(
    tableId || 'default',
    columns,
    defaultHiddenColumns,
    onPreferencesChange
  );

  // Column resize handling
  const { resizingColumn, getResizeHandleProps } = useColumnResize(setColumnWidth);

  // Use customized columns when enabled, otherwise use original columns
  const effectiveColumns = shouldCustomize ? customizedColumns : columns;

  // Get searchable column keys (from effective columns)
  const searchableColumns = useMemo(() =>
    effectiveColumns.filter(col => col.searchable !== false && col.dataIndex).map(col => ({
      key: col.dataIndex as string,
      filterRender: col.filterRender,
    })),
    [effectiveColumns]
  );

  // Filter data based on global search (searchText is already debounced)
  const filteredData = useMemo(() => {
    if (!searchText.trim()) return dataSource ?? [];

    const lowerSearch = searchText.toLowerCase();

    return (dataSource ?? []).filter(record => {
      return searchableColumns.some(({ key, filterRender }) => {
        const value = (record as Record<string, unknown>)[key];
        if (value === null || value === undefined) return false;

        const displayValue = filterRender
          ? filterRender(value, record)
          : String(value);

        return displayValue.toLowerCase().includes(lowerSearch);
      });
    });
  }, [dataSource, searchText, searchableColumns]);

  // Build Ant Design columns with sorting, filtering, and optional resize handles
  const tableColumns: ColumnsType<T> = useMemo(() => {
    return effectiveColumns.map(col => {
      const antCol: ColumnType<T> = {
        ...col,
      };

      const colKey = getColumnKey(col);

      // Add sorting if enabled
      if (col.sortable) {
        if (col.sorter) {
          // Use custom sorter when provided (e.g., for nested object fields)
          antCol.sorter = col.sorter as ColumnType<T>['sorter'];
        } else {
          antCol.sorter = (a: T, b: T) => {
            let aVal: unknown;
            let bVal: unknown;

            // Use filterRender to get comparable values when available
            // This handles columns like 'status' where dataIndex is an object
            // but the displayed/filtered value is a computed string
            if (col.filterRender) {
              const aRaw = (a as Record<string, unknown>)[col.dataIndex as string];
              const bRaw = (b as Record<string, unknown>)[col.dataIndex as string];
              aVal = col.filterRender(aRaw, a);
              bVal = col.filterRender(bRaw, b);
            } else {
              aVal = (a as Record<string, unknown>)[col.dataIndex as string];
              bVal = (b as Record<string, unknown>)[col.dataIndex as string];
            }

            if (aVal === null || aVal === undefined) return 1;
            if (bVal === null || bVal === undefined) return -1;

            if (typeof aVal === 'number' && typeof bVal === 'number') {
              return aVal - bVal;
            }

            return String(aVal).localeCompare(String(bVal));
          };
        }
        antCol.sortDirections = ['ascend', 'descend'];
      }

      // Add filtering if enabled
      if (col.filterable) {
        if (Array.isArray(col.filterable)) {
          // Predefined filter options with Select All checkbox
          const filterOptions = col.filterable;
          const allValues = filterOptions.map(f => String(f.value));

          antCol.filterDropdown = ({ setSelectedKeys, selectedKeys, confirm, clearFilters }: FilterDropdownProps) => {
            const selectedStrings = selectedKeys.map(String);
            const allSelected = allValues.length > 0 && allValues.every(v => selectedStrings.includes(v));
            const someSelected = selectedStrings.length > 0 && !allSelected;

            return (
              <div className="data-table__filter-dropdown-container" onKeyDown={e => e.stopPropagation()}>
                <div className="data-table__filter-select-all">
                  <Checkbox
                    checked={allSelected}
                    indeterminate={someSelected}
                    onChange={(e) => {
                      setSelectedKeys(e.target.checked ? allValues : []);
                    }}
                  >
                    Select All
                  </Checkbox>
                </div>
                <div className="data-table__filter-options">
                  {filterOptions.map(option => (
                    <div key={String(option.value)} className="data-table__filter-option">
                      <Checkbox
                        checked={selectedStrings.includes(String(option.value))}
                        onChange={(e) => {
                          const val = String(option.value);
                          if (e.target.checked) {
                            setSelectedKeys([...selectedKeys, val]);
                          } else {
                            setSelectedKeys(selectedKeys.filter(k => String(k) !== val));
                          }
                        }}
                      >
                        {option.text}
                      </Checkbox>
                    </div>
                  ))}
                </div>
                <div className="data-table__filter-actions">
                  <Button
                    size="small"
                    onClick={() => { clearFilters?.(); confirm(); }}
                    className="data-table__filter-button"
                  >
                    Reset
                  </Button>
                  <Button
                    size="small"
                    type="primary"
                    onClick={() => confirm()}
                    className="data-table__filter-button"
                  >
                    OK
                  </Button>
                </div>
              </div>
            );
          };

          antCol.filterIcon = (filtered: boolean) => (
            <FilterOutlined className={filtered ? 'data-table__filter-icon--active' : 'data-table__filter-icon'} />
          );

          antCol.onFilter = (value, record) => {
            const recordVal = (record as Record<string, unknown>)[col.dataIndex as string];
            // Handle array values (e.g., skills, tags) - check if array contains the filter value
            if (Array.isArray(recordVal)) {
              return recordVal.includes(value);
            }
            // Handle filterRender for custom string conversion
            if (col.filterRender) {
              const displayValue = col.filterRender(recordVal, record);
              return displayValue.toLowerCase().includes(String(value).toLowerCase());
            }
            return String(recordVal) === String(value);
          };
        } else {
          // Text-based filter dropdown
          antCol.filterDropdown = ({ setSelectedKeys, selectedKeys, confirm, clearFilters }: FilterDropdownProps) => (
            <div className="data-table__filter-dropdown-container" onKeyDown={e => e.stopPropagation()}>
              <Input
                placeholder={`Filter ${col.title}`}
                value={selectedKeys[0]}
                onChange={e => setSelectedKeys(e.target.value ? [e.target.value] : [])}
                onPressEnter={() => confirm()}
                className="data-table__filter-input"
              />
              <Space>
                <Button
                  type="primary"
                  onClick={() => confirm()}
                  icon={<SearchOutlined />}
                  size="small"
                  className="data-table__filter-button"
                >
                  Filter
                </Button>
                <Button
                  onClick={() => {
                    clearFilters?.();
                    confirm();
                  }}
                  size="small"
                  className="data-table__filter-button"
                >
                  Reset
                </Button>
              </Space>
            </div>
          );
          antCol.filterIcon = (filtered: boolean) => (
            <FilterOutlined className={filtered ? 'data-table__filter-icon--active' : 'data-table__filter-icon'} />
          );
          antCol.onFilter = (value, record) => {
            const recordVal = (record as Record<string, unknown>)[col.dataIndex as string];
            if (recordVal === null || recordVal === undefined) return false;

            const displayValue = col.filterRender
              ? col.filterRender(recordVal, record)
              : String(recordVal);

            return displayValue.toLowerCase().includes(String(value).toLowerCase());
          };
        }
      }

      // Add resize handle to header when resizable is enabled
      if (shouldCustomize && resizable && colKey !== 'actions') {
        const originalTitle = antCol.title;
        const currentWidth = typeof col.width === 'number' ? col.width : 150;

        // Wrap title in a div with resize handle
        // Handle both ReactNode and function titles
        antCol.title = typeof originalTitle === 'function'
          ? originalTitle
          : (
            <div className="data-table__header-cell">
              <span className="data-table__header-title">{originalTitle as React.ReactNode}</span>
              <div {...getResizeHandleProps(colKey, currentWidth)} />
            </div>
          );
      }

      return antCol;
    });
  }, [effectiveColumns, shouldCustomize, resizable, getResizeHandleProps]);

  // Export handlers
  const handleExportCSV = useCallback(() => {
    const filename = exportFilename || tableId || 'export';
    exportTableToCSV(effectiveColumns, filteredData, filename);
  }, [exportFilename, tableId, effectiveColumns, filteredData]);

  const handleExportXLSX = useCallback(() => {
    const filename = exportFilename || tableId || 'export';
    exportTableToXLSX(effectiveColumns, filteredData, filename);
  }, [exportFilename, tableId, effectiveColumns, filteredData]);

  const exportMenuItems = useMemo(() => [
    { key: 'xlsx', icon: <FileExcelOutlined />, label: 'Export as Excel (.xlsx)', onClick: handleExportXLSX },
    { key: 'csv', icon: <FileTextOutlined />, label: 'Export as CSV (.csv)', onClick: handleExportCSV },
  ], [handleExportCSV, handleExportXLSX]);

  // Determine if toolbar should be visible
  const hasToolbarContent = toolbar || showSearch || onRefresh || shouldCustomize || exportable;
  const shouldShowToolbar = showToolbar && hasToolbarContent;

  // Build CSS class names for the table
  const tableClassNames = useMemo(() => {
    const classes = ['data-table'];
    if (shouldCustomize) classes.push('data-table--customizable');
    if (shouldCustomize && resizable) classes.push('data-table--resizable');
    if (resizingColumn) classes.push('data-table--resizing');
    return classes.join(' ');
  }, [shouldCustomize, resizable, resizingColumn]);

  return (
    <div className={`data-table-container ${className || ''}`}>
      {/* Toolbar */}
      {shouldShowToolbar && (
        <div className="data-table-toolbar">
          <div className="data-table-toolbar-left">
            {toolbar}
          </div>
          <div className="data-table-toolbar-right">
            {showSearch && (
              <DebouncedSearchInput
                placeholder={searchPlaceholder}
                onDebouncedChange={handleDebouncedSearch}
                className="data-table-search"
              />
            )}
            {shouldCustomize && (
              <ColumnSettingsPopover
                columns={columns}
                preferences={preferences}
                onToggleColumn={toggleColumn}
                onReorderColumns={reorderColumns}
                onReset={resetToDefaults}
                reorderable={reorderable}
              />
            )}
            {exportable && (
              <Dropdown
                menu={{ items: exportMenuItems }}
                trigger={['click']}
                placement="bottomRight"
              >
                <Button
                  icon={<DownloadOutlined />}
                  title="Export data"
                  className="data-table__export-btn"
                />
              </Dropdown>
            )}
            {onRefresh && (
              <Button
                icon={<ReloadOutlined />}
                onClick={onRefresh}
                loading={loading}
                title="Refresh data"
              />
            )}
          </div>
        </div>
      )}

      {/* Results count */}
      {searchText && (
        <div className="data-table-results-info">
          <Text type="secondary">
            Showing {filteredData.length} of {(dataSource ?? []).length} results
          </Text>
        </div>
      )}

      {/* Table - no pagination, scrollable with optional virtualization */}
      <Table<T>
        columns={tableColumns}
        dataSource={filteredData}
        rowKey={rowKey}
        loading={loading}
        rowSelection={rowSelection}
        expandable={expandable}
        pagination={false}
        scroll={scrollHeight > 0
          ? { y: scrollHeight, x: (virtual ?? filteredData.length > VIRTUAL_SCROLL_THRESHOLD) ? undefined : 'max-content' }
          : { x: (virtual ?? filteredData.length > VIRTUAL_SCROLL_THRESHOLD) ? undefined : 'max-content' }}
        size={size}
        virtual={virtual ?? filteredData.length > VIRTUAL_SCROLL_THRESHOLD}
        locale={{
          emptyText: typeof emptyText === 'string' ? (
            <Empty
              description={emptyText}
              image={Empty.PRESENTED_IMAGE_SIMPLE}
            />
          ) : emptyText,
        }}
        className={tableClassNames}
        {...tableProps}
      />

      {/* Total count footer */}
      {showFooter && !loading && filteredData.length > 0 && (
        <div className="data-table-footer">
          <Text type="secondary">
            {filteredData.length} {filteredData.length === 1 ? 'item' : 'items'}
            {searchText && ` (filtered from ${dataSource.length})`}
          </Text>
        </div>
      )}
    </div>
  );
}

export default DataTable;
