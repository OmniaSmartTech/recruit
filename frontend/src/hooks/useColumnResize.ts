import { useState, useCallback, useEffect, useRef } from 'react';

const MIN_WIDTH = 50;
const MAX_WIDTH = 800;

interface ResizeState { columnKey: string; startX: number; startWidth: number; }

export interface UseColumnResizeReturn {
  resizingColumn: string | null;
  startResize: (columnKey: string, startX: number, currentWidth: number) => void;
  getResizeHandleProps: (columnKey: string, currentWidth: number) => {
    onMouseDown: (e: React.MouseEvent) => void;
    className: string;
  };
}

export function useColumnResize(onResize: (columnKey: string, width: number) => void): UseColumnResizeReturn {
  const [resizeState, setResizeState] = useState<ResizeState | null>(null);
  const resizeRef = useRef<ResizeState | null>(null);

  useEffect(() => { resizeRef.current = resizeState; }, [resizeState]);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    const state = resizeRef.current;
    if (!state) return;
    const newWidth = Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, state.startWidth + (e.clientX - state.startX)));
    onResize(state.columnKey, newWidth);
  }, [onResize]);

  const handleMouseUp = useCallback(() => {
    setResizeState(null);
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
  }, []);

  useEffect(() => {
    if (resizeState) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
      };
    }
  }, [resizeState, handleMouseMove, handleMouseUp]);

  const startResize = useCallback((columnKey: string, startX: number, currentWidth: number) => {
    setResizeState({ columnKey, startX, startWidth: currentWidth });
  }, []);

  const getResizeHandleProps = useCallback((columnKey: string, currentWidth: number) => ({
    onMouseDown: (e: React.MouseEvent) => { e.preventDefault(); e.stopPropagation(); startResize(columnKey, e.clientX, currentWidth); },
    className: `data-table__resize-handle${resizeState?.columnKey === columnKey ? ' data-table__resize-handle--active' : ''}`,
  }), [startResize, resizeState]);

  return { resizingColumn: resizeState?.columnKey ?? null, startResize, getResizeHandleProps };
}
