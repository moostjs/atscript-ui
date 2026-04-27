import { ref } from "vue";
import type { ColumnDef } from "@atscript/ui";
import type { ColumnReorderPosition, ColumnWidthsMap } from "@atscript/ui-table";
import { useRafBatch } from "./use-raf-batch";

export interface UseColumnHeaderDragResizeOptions {
  reorderable: () => boolean;
  resizable: () => boolean;
  columnMinWidth: () => number;
  columnWidths: () => ColumnWidthsMap;
  onReorder: (fromPath: string, toPath: string, position: ColumnReorderPosition) => void;
  onResize: (path: string, width: string) => void;
  /** Optional double-click auto-fit. When omitted, dblclick is a no-op. */
  onAutoFit?: (th: HTMLTableCellElement, path: string) => void;
}

function pathOf(event: Event): string | null {
  return (event.currentTarget as HTMLElement | null)?.dataset.columnPath ?? null;
}

function thFromHandleEvent(event: Event): { th: HTMLTableCellElement; path: string } | null {
  const target = event.currentTarget as HTMLElement | null;
  const th = target?.closest("th") as HTMLTableCellElement | null;
  const path = th?.dataset.columnPath;
  if (!th || !path) return null;
  return { th, path };
}

export function useColumnHeaderDragResize(opts: UseColumnHeaderDragResizeOptions) {
  const dragSourcePath = ref<string | null>(null);
  const dropTarget = ref<{ path: string; position: ColumnReorderPosition } | null>(null);
  const resizingPath = ref<string | null>(null);
  let resizeStartX = 0;
  let resizeStartWidth = 0;
  // pointermove fires >120Hz; coalesce so widthStyle re-evaluates once per frame.
  const resizeBatch = useRafBatch<{ path: string; width: string }>(({ path, width }) =>
    opts.onResize(path, width),
  );

  function onHeaderDragStart(event: DragEvent) {
    if (!opts.reorderable()) return;
    // Suppress native drag-reorder when a pointer-driven resize is in flight.
    // `pointerdown` on the handle fires before `dragstart`, so this catches
    // the real-browser case where `<th draggable=true>` initiates drag even
    // though the gesture started inside `.as-th-resize-handle` (draggable=false).
    if (resizingPath.value !== null) {
      event.preventDefault();
      return;
    }
    const path = pathOf(event);
    if (!path) return;
    dragSourcePath.value = path;
    if (event.dataTransfer) {
      event.dataTransfer.effectAllowed = "move";
      // Firefox requires a non-empty payload to actually start a drag.
      event.dataTransfer.setData("text/plain", path);
    }
  }

  function onHeaderDragOver(event: DragEvent) {
    if (!opts.reorderable() || dragSourcePath.value === null) return;
    const path = pathOf(event);
    if (!path) return;
    event.preventDefault();
    if (event.dataTransfer) event.dataTransfer.dropEffect = "move";
    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
    const position: ColumnReorderPosition =
      event.clientX - rect.left < rect.width / 2 ? "before" : "after";
    if (dropTarget.value?.path !== path || dropTarget.value?.position !== position) {
      dropTarget.value = { path, position };
    }
  }

  function onHeaderDrop(event: DragEvent) {
    if (!opts.reorderable()) return;
    event.preventDefault();
    const path = pathOf(event);
    const source = dragSourcePath.value;
    const target = dropTarget.value;
    if (path && source && target && target.path === path && source !== target.path) {
      opts.onReorder(source, target.path, target.position);
    }
    dragSourcePath.value = null;
    dropTarget.value = null;
  }

  function onHeaderDragEnd() {
    dragSourcePath.value = null;
    dropTarget.value = null;
  }

  function onResizeHandlePointerDown(event: PointerEvent) {
    if (!opts.resizable()) return;
    const found = thFromHandleEvent(event);
    if (!found) return;
    resizingPath.value = found.path;
    resizeStartX = event.clientX;
    resizeStartWidth = found.th.getBoundingClientRect().width;
    (event.currentTarget as HTMLElement).setPointerCapture?.(event.pointerId);
  }

  function onResizeHandlePointerMove(event: PointerEvent) {
    if (!resizingPath.value) return;
    const next = Math.round(
      Math.max(resizeStartWidth + (event.clientX - resizeStartX), opts.columnMinWidth()),
    );
    resizeBatch.schedule({ path: resizingPath.value, width: `${next}px` });
  }

  function onResizeHandleEnd() {
    resizingPath.value = null;
    resizeBatch.flushNow();
  }

  function onResizeHandleDoubleClick(event: MouseEvent) {
    if (!opts.resizable() || !opts.onAutoFit) return;
    const found = thFromHandleEvent(event);
    if (!found) return;
    opts.onAutoFit(found.th, found.path);
  }

  function widthStyle(col: ColumnDef): { width: string } | undefined {
    const entry = opts.columnWidths()[col.path];
    return entry ? { width: entry.w } : undefined;
  }

  function thClasses(path: string): Record<string, boolean> {
    const reorder = opts.reorderable();
    const resize = opts.resizable();
    if (!reorder && !resize) return {};
    return {
      "as-th-reorderable": reorder,
      "as-th-dragging": reorder && dragSourcePath.value === path,
      "as-th-drop-indicator-before":
        reorder && dropTarget.value?.path === path && dropTarget.value?.position === "before",
      "as-th-drop-indicator-after":
        reorder && dropTarget.value?.path === path && dropTarget.value?.position === "after",
      "as-th-resizing": resize && resizingPath.value === path,
    };
  }

  return {
    onHeaderDragStart,
    onHeaderDragOver,
    onHeaderDrop,
    onHeaderDragEnd,
    onResizeHandlePointerDown,
    onResizeHandlePointerMove,
    onResizeHandleEnd,
    onResizeHandleDoubleClick,
    thClasses,
    widthStyle,
  };
}
