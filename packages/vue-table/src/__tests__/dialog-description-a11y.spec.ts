// @vitest-environment happy-dom
//
// Regression — every `DialogContent` must carry a `Description`. Reka always
// writes `aria-describedby="<generated id>"` on the surface; when no
// `DialogDescription` renders, that id resolves to nothing (screen readers
// announce no description) and Reka logs "Missing `Description` …". The
// config and filter dialogs had none at all, and the action-form dialog only
// rendered one when the action declared a description.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { nextTick } from "vue";
import { flushPromises } from "@vue/test-utils";
import AsConfigDialog from "../components/defaults/as-config-dialog.vue";
import AsFilterDialog from "../components/defaults/as-filter-dialog.vue";
import AsConfirmDialog from "../components/defaults/as-confirm-dialog.vue";
import AsActionFormDialog from "../components/defaults/as-action-form-dialog.vue";
import type { ReactiveTableState, TVueTableActionInfo } from "../types";
import { mockColumn, mountWithTableContext, stubClient } from "./helpers";

/** Mount one dialog with a live table context; `open` runs after init. */
async function mountDialog(
  component: unknown,
  open: (state: ReactiveTableState) => void,
): Promise<void> {
  mountWithTableContext(component, {
    columns: [mockColumn("id"), mockColumn("name")],
    client: stubClient({
      action: () => Promise.resolve({ ok: true }),
      getActionForm: () => Promise.resolve(null),
    } as never),
    onReady: (state) => {
      state.columnNames.value = ["id", "name"];
      open(state);
    },
  });
  await flushPromises();
  await nextTick();
}

/** The portalled dialog surfaces currently in the document. */
function surfaces(): HTMLElement[] {
  return Array.from(
    document.body.querySelectorAll<HTMLElement>("[role=dialog], [role=alertdialog]"),
  );
}

function expectDescribed(): void {
  const found = surfaces();
  expect(found.length).toBeGreaterThan(0);
  for (const el of found) {
    const id = el.getAttribute("aria-describedby");
    expect(id).toBeTruthy();
    expect(id).not.toBe("undefined");
    // The id must resolve — an unresolvable id is exactly what Reka warns about.
    expect(document.getElementById(id as string)).not.toBeNull();
  }
}

let warn: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  warn = vi.spyOn(console, "warn").mockImplementation(() => {});
});

afterEach(() => {
  warn.mockRestore();
  document.body.innerHTML = "";
});

function expectNoDescriptionWarning(): void {
  const messages = warn.mock.calls.map((c: unknown[]) => String(c[0]));
  expect(messages.filter((m: string) => m.includes("Missing `Description`"))).toEqual([]);
}

describe("dialog accessible descriptions", () => {
  it("config dialog renders a resolvable description", async () => {
    await mountDialog(AsConfigDialog, (state) => {
      state.configDialogOpen.value = true;
    });
    expectDescribed();
    expectNoDescriptionWarning();
  });

  it("filter dialog renders a resolvable description", async () => {
    await mountDialog(AsFilterDialog, (state) => {
      state.openFilterDialog(mockColumn("name"));
    });
    expectDescribed();
    expectNoDescriptionWarning();
  });

  it("confirm dialog renders a resolvable description", async () => {
    await mountDialog(AsConfirmDialog, (state) => {
      void state.prompt("Delete item 1?");
    });
    expectDescribed();
    expectNoDescriptionWarning();
  });

  it("action-form dialog describes an action that declares no description", async () => {
    const action: TVueTableActionInfo = {
      name: "reschedule",
      label: "Reschedule",
      level: "row",
      processor: "backend",
      value: "/x/reschedule",
      inputForm: "RescheduleInput",
    };
    await mountDialog(AsActionFormDialog, (state) => {
      void state.requestActionInput(action, { identifiers: [{ id: 1 }], preferredId: ["id"] });
    });
    expectDescribed();
    expectNoDescriptionWarning();
  });
});
