import { describe, it, expect } from "vitest";
import { SelectionState } from "./selection-state";

const row = (id: number) => ({ id, name: `row-${id}` });
const idFn = (r: Record<string, unknown>) => r.id;

describe("SelectionState", () => {
  describe("mode: none", () => {
    it("toggle is a no-op", () => {
      const s = new SelectionState({ mode: "none" });
      s.toggle(row(1));
      expect(s.selected.size).toBe(0);
    });

    it("isSelected always returns false", () => {
      const s = new SelectionState({ mode: "none" });
      expect(s.isSelected(row(1))).toBe(false);
    });

    it("select is a no-op", () => {
      const s = new SelectionState({ mode: "none" });
      s.select(row(1));
      expect(s.selectedCount).toBe(0);
    });

    it("selectAll is a no-op", () => {
      const s = new SelectionState({ mode: "none" });
      s.selectAll([row(1), row(2)]);
      expect(s.selectedCount).toBe(0);
    });
  });

  describe("mode: single", () => {
    it("toggle selects a row", () => {
      const s = new SelectionState({ mode: "single", rowValueFn: idFn });
      s.toggle(row(1));
      expect(s.isSelected(row(1))).toBe(true);
      expect(s.selectedCount).toBe(1);
    });

    it("toggle deselects a selected row", () => {
      const s = new SelectionState({ mode: "single", rowValueFn: idFn });
      s.toggle(row(1));
      s.toggle(row(1));
      expect(s.isSelected(row(1))).toBe(false);
      expect(s.selectedCount).toBe(0);
    });

    it("selecting a second row clears the first", () => {
      const s = new SelectionState({ mode: "single", rowValueFn: idFn });
      s.toggle(row(1));
      s.toggle(row(2));
      expect(s.isSelected(row(1))).toBe(false);
      expect(s.isSelected(row(2))).toBe(true);
      expect(s.selectedCount).toBe(1);
    });

    it("select() clears previous and adds new", () => {
      const s = new SelectionState({ mode: "single", rowValueFn: idFn });
      s.select(row(1));
      s.select(row(2));
      expect(s.getSelectedValues()).toEqual([2]);
    });

    it("selectAll is a no-op in single mode", () => {
      const s = new SelectionState({ mode: "single", rowValueFn: idFn });
      s.selectAll([row(1), row(2)]);
      expect(s.selectedCount).toBe(0);
    });
  });

  describe("mode: multi", () => {
    it("toggle adds rows without clearing", () => {
      const s = new SelectionState({ mode: "multi", rowValueFn: idFn });
      s.toggle(row(1));
      s.toggle(row(2));
      expect(s.selectedCount).toBe(2);
      expect(s.isSelected(row(1))).toBe(true);
      expect(s.isSelected(row(2))).toBe(true);
    });

    it("toggle removes an already selected row", () => {
      const s = new SelectionState({ mode: "multi", rowValueFn: idFn });
      s.toggle(row(1));
      s.toggle(row(2));
      s.toggle(row(1));
      expect(s.selectedCount).toBe(1);
      expect(s.isSelected(row(1))).toBe(false);
      expect(s.isSelected(row(2))).toBe(true);
    });

    it("selectAll adds all rows", () => {
      const s = new SelectionState({ mode: "multi", rowValueFn: idFn });
      s.selectAll([row(1), row(2), row(3)]);
      expect(s.selectedCount).toBe(3);
    });

    it("deselectAll clears everything", () => {
      const s = new SelectionState({ mode: "multi", rowValueFn: idFn });
      s.selectAll([row(1), row(2)]);
      s.deselectAll();
      expect(s.selectedCount).toBe(0);
    });

    it("deselect removes a specific row", () => {
      const s = new SelectionState({ mode: "multi", rowValueFn: idFn });
      s.selectAll([row(1), row(2), row(3)]);
      s.deselect(row(2));
      expect(s.getSelectedValues()).toEqual([1, 3]);
    });
  });

  describe("rowValueFn", () => {
    it("defaults to identity (entire row object)", () => {
      const s = new SelectionState({ mode: "single" });
      const r = row(1);
      s.toggle(r);
      expect(s.isSelected(r)).toBe(true);
      expect(s.getRowValue(r)).toBe(r);
    });

    it("uses custom rowValueFn", () => {
      const s = new SelectionState({
        mode: "multi",
        rowValueFn: (r) => `${String(r.id)}-${String(r.name)}`,
      });
      s.toggle(row(1));
      expect(s.getSelectedValues()).toEqual(["1-row-1"]);
    });
  });

  describe("reconcileAfterRefresh", () => {
    it("clears selection when keepAfterRefresh is false", () => {
      const s = new SelectionState({ mode: "multi", rowValueFn: idFn });
      s.selectAll([row(1), row(2)]);
      s.reconcileAfterRefresh([row(1), row(3)]);
      expect(s.selectedCount).toBe(0);
    });

    it("keeps only matching values when keepAfterRefresh is true", () => {
      const s = new SelectionState({
        mode: "multi",
        rowValueFn: idFn,
        keepAfterRefresh: true,
      });
      s.selectAll([row(1), row(2), row(3)]);
      s.reconcileAfterRefresh([row(2), row(4)]);
      expect(s.getSelectedValues()).toEqual([2]);
    });

    it("clears all when no matching rows remain", () => {
      const s = new SelectionState({
        mode: "multi",
        rowValueFn: idFn,
        keepAfterRefresh: true,
      });
      s.selectAll([row(1), row(2)]);
      s.reconcileAfterRefresh([row(3), row(4)]);
      expect(s.selectedCount).toBe(0);
    });

    it("is a no-op when selection is already empty", () => {
      const s = new SelectionState({
        mode: "multi",
        rowValueFn: idFn,
        keepAfterRefresh: true,
      });
      s.reconcileAfterRefresh([row(1)]);
      expect(s.selectedCount).toBe(0);
    });
  });

  describe("getSelectedValues", () => {
    it("returns values in insertion order", () => {
      const s = new SelectionState({ mode: "multi", rowValueFn: idFn });
      s.toggle(row(3));
      s.toggle(row(1));
      s.toggle(row(2));
      expect(s.getSelectedValues()).toEqual([3, 1, 2]);
    });
  });
});
