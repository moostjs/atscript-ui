import type { ColumnDef, MetaResponse, TableDef } from "@atscript/ui";
import { defineAnnotatedType, serializeAnnotatedType } from "@atscript/typescript/utils";
import type { Client } from "@atscript/db-client";
import { vi } from "vitest";

/**
 * Override `getBoundingClientRect()` on a single element so happy-dom returns
 * deterministic geometry for drag-position math.
 */
export function stubRect(el: Element, left: number, width: number) {
  el.getBoundingClientRect = () =>
    ({
      left,
      width,
      top: 0,
      right: left + width,
      bottom: 24,
      height: 24,
      x: left,
      y: 0,
      toJSON: () => ({}),
    }) as DOMRect;
}

/** Resolve the rendered `<th>` for a column path; throws if not found. */
export function thByPath(root: ParentNode, path: string): HTMLElement {
  const th = root.querySelector(`th[data-column-path="${path}"]`);
  if (!th) throw new Error(`<th> for path "${path}" not found`);
  return th as HTMLElement;
}

/** Stubs `setPointerCapture` since happy-dom doesn't implement pointer capture. */
export function handleOf(th: HTMLElement): HTMLElement {
  const handle = th.querySelector(".as-th-resize-handle") as HTMLElement | null;
  if (!handle) throw new Error("resize handle not found in th");
  if (!(handle as HTMLElement & { setPointerCapture?: unknown }).setPointerCapture) {
    (handle as unknown as { setPointerCapture: () => void }).setPointerCapture = () => {};
  }
  return handle;
}

/** happy-dom doesn't implement PointerEvent — fill the gap with property injection. */
export function pointerEvent(type: string, init: Partial<PointerEvent> = {}) {
  const ev = new Event(type, { bubbles: true, cancelable: true }) as PointerEvent;
  Object.assign(ev, { pointerId: 1, pointerType: "mouse", isPrimary: true }, init);
  return ev;
}

/**
 * Build a synthetic native DragEvent with a stub DataTransfer. happy-dom does
 * not implement DragEvent / DataTransfer; this fills the gap for unit tests.
 */
export function dragEvent(type: string, init: Partial<DragEvent> = {}) {
  const ev = new Event(type, { bubbles: true, cancelable: true }) as DragEvent;
  Object.defineProperty(ev, "dataTransfer", {
    value: {
      effectAllowed: "",
      dropEffect: "",
      setData: () => {},
      getData: () => "",
    },
    writable: false,
  });
  Object.assign(ev, init);
  return ev;
}

/**
 * Build a simple MetaResponse for testing.
 * Creates an object type with the given field names (all string, sortable, filterable).
 */
export function createMockMeta(fieldNames: string[]): MetaResponse {
  const h = defineAnnotatedType("object");
  for (const name of fieldNames) {
    const prop = defineAnnotatedType().designType("string");
    prop.annotate("meta.label" as keyof AtscriptMetadata, name as never);
    h.prop(name, prop.$type);
  }
  const serialized = serializeAnnotatedType(h.$type);

  const fields: Record<string, { sortable: boolean; filterable: boolean }> = {};
  for (const name of fieldNames) {
    fields[name] = { sortable: true, filterable: true };
  }

  return {
    type: serialized,
    fields,
    primaryKeys: ["id"],
    readOnly: false,
    searchable: false,
    vectorSearchable: false,
    searchIndexes: [],
    relations: [],
  };
}

/**
 * Create a mock client for testing.
 * Returns a client whose meta() returns the given MetaResponse
 * and pages() returns the given data/count.
 */
export function createMockClient(opts: {
  meta: MetaResponse;
  data?: Record<string, unknown>[];
  count?: number;
}): { client: Client; pagesFn: ReturnType<typeof vi.fn> } {
  const pagesFn = vi.fn().mockResolvedValue({
    data: opts.data ?? [],
    count: opts.count ?? opts.data?.length ?? 0,
    page: 1,
    itemsPerPage: 50,
    pages: 1,
  });
  return {
    client: {
      meta: () => Promise.resolve(opts.meta),
      pages: pagesFn,
    } as unknown as Client,
    pagesFn,
  };
}

/** Create a minimal ColumnDef for testing. */
export function mockColumn(path: string, overrides?: Partial<ColumnDef>): ColumnDef {
  return {
    path,
    label: path,
    type: "text",
    sortable: true,
    filterable: true,
    visible: true,
    order: 0,
    ...overrides,
  };
}

/** Create a minimal TableDef for testing. */
export function mockTableDef(columns: ColumnDef[]): TableDef {
  return {
    type: defineAnnotatedType("object").$type,
    columns,
    primaryKeys: ["id"],
    readOnly: false,
    searchable: false,
    vectorSearchable: false,
    searchIndexes: [],
    relations: [],
  };
}
