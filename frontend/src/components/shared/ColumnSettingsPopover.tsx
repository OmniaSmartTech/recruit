/**
 * @fileoverview Column Settings Popover Component
 *
 * UI component for DataTable column customization. Provides a popover with
 * checkboxes to toggle column visibility and drag handles to reorder columns.
 *
 * Key Features:
 * - Checkbox list for column visibility
 * - Drag-and-drop reordering via @dnd-kit/sortable
 * - Reset to defaults button
 * - Integrates with useTablePreferences hook
 *
 * @module components/shared/common/ColumnSettingsPopover
 */

import React, { useCallback } from 'react';
import { Button, Checkbox, Popover, Typography } from 'antd';
import { SettingOutlined, HolderOutlined, UndoOutlined } from '@ant-design/icons';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { ColumnPreference } from '../../types/tablePreferences';
import type { DataTableColumn } from './DataTable';
;

const { Text } = Typography;

/**
 * Props for SortableColumnItem component.
 */
interface SortableColumnItemProps {
  preference: ColumnPreference;
  title: string;
  onToggle: (key: string) => void;
  reorderable: boolean;
}

/**
 * Single sortable column item with checkbox and drag handle.
 */
const SortableColumnItem: React.FC<SortableColumnItemProps> = ({
  preference,
  title,
  onToggle,
  reorderable,
}) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: preference.key });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`column-settings__item${isDragging ? ' column-settings__item--dragging' : ''}`}
    >
      {reorderable && (
        <span
          {...attributes}
          {...listeners}
          className="column-settings__drag-handle"
        >
          <HolderOutlined />
        </span>
      )}
      <Checkbox
        checked={preference.visible}
        onChange={() => onToggle(preference.key)}
        className="column-settings__checkbox"
      >
        <Text className="column-settings__label">{title}</Text>
      </Checkbox>
    </div>
  );
};

/**
 * Recursively extract text content from a React node tree.
 */
function extractText(node: React.ReactNode): string {
  if (typeof node === 'string') return node;
  if (typeof node === 'number') return String(node);
  if (!node) return '';
  if (Array.isArray(node)) return node.map(extractText).join('');
  if (React.isValidElement(node)) {
    const props = node.props as { children?: React.ReactNode; title?: React.ReactNode };
    // For Tooltip, the display text is in children, not the title prop
    return extractText(props?.children);
  }
  return '';
}

/**
 * Get column title as string from DataTableColumn.
 */
function getColumnTitle<T>(col: DataTableColumn<T>): string {
  if (typeof col.title === 'string') return col.title;
  if (React.isValidElement(col.title)) {
    const text = extractText(col.title).trim();
    if (text) return text;
  }
  // Fall back to key
  return String(col.key || col.dataIndex || 'Column');
}

/**
 * Get column key from DataTableColumn.
 */
function getColumnKey<T>(col: DataTableColumn<T>): string {
  if (typeof col.key === 'string') return col.key;
  if (typeof col.dataIndex === 'string') return col.dataIndex;
  return String(col.key || col.dataIndex || '');
}

/**
 * Props for ColumnSettingsPopover component.
 */
export interface ColumnSettingsPopoverProps<T> {
  /** Original column definitions (for titles) */
  columns: DataTableColumn<T>[];
  /** Current column preferences */
  preferences: ColumnPreference[];
  /** Callback to toggle column visibility */
  onToggleColumn: (key: string) => void;
  /** Callback to reorder columns */
  onReorderColumns: (fromIndex: number, toIndex: number) => void;
  /** Callback to reset to defaults */
  onReset: () => void;
  /** Whether reordering is enabled */
  reorderable?: boolean;
}

/**
 * Popover component for table column settings.
 *
 * @component
 * @template T - Row data type for the table
 *
 * @example
 * <ColumnSettingsPopover
 *   columns={columns}
 *   preferences={preferences}
 *   onToggleColumn={toggleColumn}
 *   onReorderColumns={reorderColumns}
 *   onReset={resetToDefaults}
 *   reorderable
 * />
 */
function ColumnSettingsPopover<T>({
  columns,
  preferences,
  onToggleColumn,
  onReorderColumns,
  onReset,
  reorderable = true,
}: ColumnSettingsPopoverProps<T>): React.ReactElement {
  // Build column title map
  const columnTitleMap = React.useMemo(() => {
    const map = new Map<string, string>();
    columns.forEach((col) => {
      const key = getColumnKey(col);
      map.set(key, getColumnTitle(col));
    });
    return map;
  }, [columns]);

  // DnD sensors
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Handle drag end
  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over || active.id === over.id) return;

      const oldIndex = preferences.findIndex((p) => p.key === active.id);
      const newIndex = preferences.findIndex((p) => p.key === over.id);

      if (oldIndex !== -1 && newIndex !== -1) {
        onReorderColumns(oldIndex, newIndex);
      }
    },
    [preferences, onReorderColumns]
  );

  // Filter out action columns from settings
  const settablePreferences = preferences.filter((p) => p.key !== 'actions');

  const content = (
    <div className="column-settings__content">
      <div className="column-settings__header">
        <Text strong>Columns</Text>
        <Button
          type="text"
          size="small"
          icon={<UndoOutlined />}
          onClick={onReset}
          className="column-settings__reset-btn"
        >
          Reset
        </Button>
      </div>
      <div className="column-settings__list">
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={settablePreferences.map((p) => p.key)}
            strategy={verticalListSortingStrategy}
          >
            {settablePreferences.map((pref) => (
              <SortableColumnItem
                key={pref.key}
                preference={pref}
                title={columnTitleMap.get(pref.key) || pref.key}
                onToggle={onToggleColumn}
                reorderable={reorderable}
              />
            ))}
          </SortableContext>
        </DndContext>
      </div>
    </div>
  );

  return (
    <Popover
      content={content}
      title={null}
      trigger="click"
      placement="bottomRight"
      classNames={{ root: "column-settings__popover" }}
    >
      <Button
        icon={<SettingOutlined />}
        className="data-table__settings-btn"
        title="Column settings"
      />
    </Popover>
  );
}

export default ColumnSettingsPopover;
