/**
 * @fileoverview Table Export Utilities
 *
 * Provides CSV and Excel (XLSX) export functionality for DataTable components.
 * Extracts visible column data and formats it for download.
 *
 * @module utils/tableExport
 */

import React from 'react';
import ExcelJS from 'exceljs';
import type { DataTableColumn } from '../components/shared/DataTable';
import { saveBlob } from './download';

/**
 * Recursively extract text content from a React node tree.
 *
 * @param node - React node to extract text from
 * @returns Plain text string
 */
function extractText(node: React.ReactNode): string {
  if (typeof node === 'string') return node;
  if (typeof node === 'number') return String(node);
  if (!node) return '';
  if (Array.isArray(node)) return node.map(extractText).join('');
  if (React.isValidElement(node)) {
    const props = node.props as { children?: React.ReactNode };
    return extractText(props?.children);
  }
  return '';
}

/**
 * Get column title as a plain text string.
 *
 * @param col - DataTable column definition
 * @returns Plain text column title
 */
function getColumnTitle<T>(col: DataTableColumn<T>): string {
  if (typeof col.title === 'string') return col.title;
  if (React.isValidElement(col.title)) {
    const text = extractText(col.title).trim();
    if (text) return text;
  }
  return String(col.key || col.dataIndex || 'Column');
}

/**
 * Get the raw cell value for export, using filterRender when available.
 *
 * @param record - Row data object
 * @param col - Column definition
 * @returns String representation of the cell value
 */
function getCellValue<T>(record: T, col: DataTableColumn<T>): string {
  const dataIndex = col.dataIndex as string;
  if (!dataIndex) return '';

  const raw = (record as Record<string, unknown>)[dataIndex];
  if (raw === null || raw === undefined) return '';

  if (col.exportFormatter) {
    return String(col.exportFormatter(raw, record));
  }

  if (col.filterRender) {
    return col.filterRender(raw, record);
  }

  if (typeof raw === 'object') {
    return JSON.stringify(raw);
  }

  return String(raw);
}

/**
 * Get the raw numeric value for a cell when available (for Excel number formatting).
 *
 * @param record - Row data object
 * @param col - Column definition
 * @returns Numeric value or null if not a number
 */
function getNumericValue<T>(record: T, col: DataTableColumn<T>): number | null {
  const dataIndex = col.dataIndex as string;
  if (!dataIndex) return null;

  const raw = (record as Record<string, unknown>)[dataIndex];

  if (col.exportFormatter) {
    const formatted = col.exportFormatter(raw, record);
    if (typeof formatted === 'number' && !isNaN(formatted)) return formatted;
    return null;
  }

  if (typeof raw === 'number' && !isNaN(raw)) return raw;
  return null;
}

/**
 * Filter out non-exportable columns (action columns, columns without dataIndex).
 */
function getExportColumns<T>(columns: DataTableColumn<T>[]): DataTableColumn<T>[] {
  return columns.filter(col => col.dataIndex && col.key !== 'actions');
}

/**
 * Escape a CSV field value per RFC 4180.
 *
 * @param value - Raw string value
 * @returns Escaped CSV-safe string
 */
function escapeCsvField(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n') || value.includes('\r')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

/**
 * Export table data as a CSV file download.
 *
 * Filters out action columns (no dataIndex) and uses filterRender
 * for display values where available. Includes BOM for Excel compatibility.
 *
 * @param columns - Visible column definitions
 * @param data - Filtered data rows
 * @param filename - Download filename (`.csv` appended if missing)
 *
 * @example
 * exportTableToCSV(visibleColumns, filteredData, 'resources-export');
 */
export function exportTableToCSV<T>(
  columns: DataTableColumn<T>[],
  data: T[],
  filename: string
): void {
  const exportColumns = getExportColumns(columns);

  const headers = exportColumns.map(col => escapeCsvField(getColumnTitle(col)));

  const rows = data.map(record =>
    exportColumns.map(col => escapeCsvField(getCellValue(record, col)))
  );

  const bom = '\uFEFF';
  const csv = bom + [headers.join(','), ...rows.map(row => row.join(','))].join('\n');

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  saveBlob(blob, filename.endsWith('.csv') ? filename : `${filename}.csv`);
}

/**
 * Export table data as an Excel (XLSX) file download.
 *
 * Creates a styled workbook with a header row, auto-sized columns,
 * and numeric formatting where applicable.
 *
 * @param columns - Visible column definitions
 * @param data - Filtered data rows
 * @param filename - Download filename (`.xlsx` appended if missing)
 *
 * @example
 * await exportTableToXLSX(visibleColumns, filteredData, 'resources-export');
 */
export async function exportTableToXLSX<T>(
  columns: DataTableColumn<T>[],
  data: T[],
  filename: string
): Promise<void> {
  const exportColumns = getExportColumns(columns);

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Data');

  // Add header row
  const headerRow = sheet.addRow(exportColumns.map(col => getColumnTitle(col)));
  headerRow.eachCell(cell => {
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4DB8A4' } };
    cell.alignment = { vertical: 'middle', horizontal: 'center' };
    cell.border = {
      bottom: { style: 'thin', color: { argb: 'FF3A9A88' } },
    };
  });

  // Add data rows
  data.forEach(record => {
    const rowValues = exportColumns.map(col => {
      const numVal = getNumericValue(record, col);
      if (numVal !== null) return numVal;
      return getCellValue(record, col);
    });
    sheet.addRow(rowValues);
  });

  // Auto-size columns based on content
  sheet.columns.forEach((col, i) => {
    const headerLength = getColumnTitle(exportColumns[i]).length;
    let maxLength = headerLength;
    col.eachCell?.({ includeEmpty: false }, (cell, rowNumber) => {
      if (rowNumber === 1) return;
      const cellLength = cell.value ? String(cell.value).length : 0;
      if (cellLength > maxLength) maxLength = cellLength;
    });
    col.width = Math.min(Math.max(maxLength + 2, 8), 40);
  });

  // Apply right-alignment for numeric columns
  exportColumns.forEach((col, i) => {
    if (col.align === 'right') {
      sheet.getColumn(i + 1).alignment = { horizontal: 'right' };
    }
  });

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  saveBlob(blob, filename.endsWith('.xlsx') ? filename : `${filename}.xlsx`);
}
