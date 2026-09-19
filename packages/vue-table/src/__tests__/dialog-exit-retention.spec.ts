// @vitest-environment happy-dom
//
// Regression — `createRequestSlot` nulls its request ref synchronously on
// accept/dismiss, but Reka keeps the dialog content mounted until the exit
// animation ends. The dialogs read the live nullable request, so the copy /
// form schema / draft vanished mid-fade. They now render a `display` request
// (the last non-null one) and clear it on the content's `after-leave`, while
// open/accept/dismiss still go through the CURRENT request only.
//
// Reka's `<Presence>` only suspends the unmount when the content is actually
// animating, so `armExit()` gives the surface an animation name first —
// without it happy-dom tears the content out in the same tick and there is
// no exit window to observe.
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { nextTick } from "vue";
import { flushPromises } from "@vue/test-utils";
import AsConfirmDialog from "../components/defaults/as-confirm-dialog.vue";
import AsActionFormDialog from "../components/defaults/as-action-form-dialog.vue";
import type { ReactiveTableState, TVueTableActionInfo } from "../types";
import { mockColumn, mountTableState, mountWithTableContext, stubClient } from "./helpers";

// happy-dom hands back a real `CSSStyleDeclaration`, which throws
// ("Receiver must be an instance of class CSSStyleDeclaration") once Reka
// stores it in a `ref` and reads `.display` through the reactive proxy. A
// plain-object stub keeps the animation-name plumbing that drives
// `<Presence>` while side-stepping that.
const realGetComputedStyle = window.getComputedStyle;

beforeAll(() => {
  window.getComputedStyle = ((el: Element) => ({
    animationName: (el as HTMLElement).style?.animationName || "none",
    display: "block",
    getPropertyValue: () => "",
  })) as unknown as typeof window.getComputedStyle;
});

afterAll(() => {
  window.getComputedStyle = realGetComputedStyle;
});

function mountDialog(component: unknown): { state: ReactiveTableState } {
  const { state } = mountWithTableContext(component, {
    columns: [mockColumn("id")],
    client: stubClient({ getActionForm: () => Promise.resolve(null) }),
  });
  return { state };
}

function surface(selector: string): HTMLElement {
  const el = document.body.querySelector<HTMLElement>(selector);
  if (!el) throw new Error(`${selector} not mounted`);
  return el;
}

/** Make the surface "animating" so Presence suspends its unmount on close. */
function armExit(el: HTMLElement): void {
  el.style.animationName = "as-dialog-exit";
}

/** The `after-leave` Reka dispatches on the content node when the exit ends. */
function fireAfterLeave(el: HTMLElement): void {
  el.dispatchEvent(new CustomEvent("after-leave", { bubbles: false, cancelable: false }));
}

/** Close, then let Presence observe the change and enter its exit state. */
async function settleExit(): Promise<void> {
  await nextTick();
  await nextTick();
}

afterEach(() => {
  document.body.innerHTML = "";
});

describe("<AsConfirmDialog> exit retention", () => {
  it("keeps the prompt copy rendered while the surface leaves", async () => {
    const { state } = mountDialog(AsConfirmDialog);
    void state.prompt("Delete item 42?", { confirmButton: "Delete" });
    await nextTick();
    const content = surface(".as-confirm-dialog-content");
    armExit(content);
    expect(content.textContent).toContain("Delete item 42?");

    state.dismissPrompt();
    await settleExit();

    expect(state.confirmRequest.value).toBeNull();
    expect(document.body.contains(content)).toBe(true);
    expect(content.textContent).toContain("Delete item 42?");
    expect(content.textContent).toContain("Delete");
  });

  it("clears the retained copy on after-leave", async () => {
    const { state } = mountDialog(AsConfirmDialog);
    void state.prompt("Delete item 42?");
    await nextTick();
    const content = surface(".as-confirm-dialog-content");
    armExit(content);

    state.dismissPrompt();
    await settleExit();
    fireAfterLeave(content);
    await nextTick();

    expect(content.textContent).not.toContain("Delete item 42?");
  });

  it("does not let the leaving surface resolve a stale accept", async () => {
    const { state } = mountDialog(AsConfirmDialog);
    const answered = state.prompt("Delete item 42?");
    await nextTick();
    const content = surface(".as-confirm-dialog-content");
    armExit(content);

    state.dismissPrompt();
    await settleExit();
    // The retained copy still renders its buttons — clicking one must not
    // reopen or re-answer the already-settled request.
    content.querySelector<HTMLElement>(".as-confirm-dialog-confirm")?.click();
    await nextTick();

    expect(await answered).toBe(false);
    expect(state.confirmRequest.value).toBeNull();
  });

  it("a request raised during the exit replaces the retained copy", async () => {
    const { state } = mountDialog(AsConfirmDialog);
    void state.prompt("First prompt?");
    await nextTick();
    const content = surface(".as-confirm-dialog-content");
    armExit(content);

    state.dismissPrompt();
    await settleExit();
    void state.prompt("Second prompt?");
    await nextTick();

    expect(document.body.textContent).toContain("Second prompt?");
    expect(document.body.textContent).not.toContain("First prompt?");
  });

  it("a late after-leave from the previous cycle leaves the reopened copy intact", async () => {
    const { state } = mountDialog(AsConfirmDialog);
    void state.prompt("First prompt?");
    await nextTick();
    const content = surface(".as-confirm-dialog-content");
    armExit(content);

    state.dismissPrompt();
    await settleExit();
    void state.prompt("Second prompt?");
    await nextTick();

    fireAfterLeave(content);
    await nextTick();

    expect(document.body.textContent).toContain("Second prompt?");
  });
});

const formAction: TVueTableActionInfo = {
  name: "reschedule",
  label: "Reschedule",
  level: "row",
  processor: "backend",
  value: "/x/reschedule",
  inputForm: "RescheduleInput",
};

describe("<AsActionFormDialog> exit retention", () => {
  it("keeps the title and target ids rendered while the surface leaves", async () => {
    const { state } = mountDialog(AsActionFormDialog);
    void state.requestActionInput(formAction, {
      identifiers: [{ id: "A-1" }],
      preferredId: ["id"],
    });
    await flushPromises();
    const content = surface(".as-action-form-content");
    armExit(content);
    expect(content.textContent).toContain("Reschedule");

    state.dismissActionForm();
    await settleExit();

    expect(state.actionFormRequest.value).toBeNull();
    expect(document.body.contains(content)).toBe(true);
    expect(content.textContent).toContain("Reschedule");
    expect(content.textContent).toContain("A-1");
  });

  it("clears the retained request on after-leave", async () => {
    const { state } = mountDialog(AsActionFormDialog);
    void state.requestActionInput(formAction, {
      identifiers: [{ id: "A-1" }],
      preferredId: ["id"],
    });
    await flushPromises();
    const content = surface(".as-action-form-content");
    armExit(content);

    state.dismissActionForm();
    await settleExit();
    fireAfterLeave(content);
    await nextTick();

    expect(content.textContent).not.toContain("Reschedule");
  });

  it("a request raised during the exit survives the previous cycle's after-leave", async () => {
    const { state } = mountDialog(AsActionFormDialog);
    void state.requestActionInput(formAction, {
      identifiers: [{ id: "A-1" }],
      preferredId: ["id"],
    });
    await flushPromises();
    const content = surface(".as-action-form-content");
    armExit(content);

    state.dismissActionForm();
    await settleExit();
    void state.requestActionInput(
      { ...formAction, name: "cancel-order", label: "Cancel order" },
      { identifiers: [{ id: "B-2" }], preferredId: ["id"] },
    );
    await flushPromises();
    fireAfterLeave(content);
    await nextTick();

    expect(document.body.textContent).toContain("Cancel order");
    expect(document.body.textContent).toContain("B-2");
  });
});

// The retention itself lives on the request slot, not in the dialogs: they
// only render `display` and call `release()` from `after-leave`.
describe("request slot display/release", () => {
  it("retains the answered request until release", () => {
    const { state } = mountTableState();
    void state.prompt("Delete item 42?");
    expect(state.confirmDisplay.value?.message).toBe("Delete item 42?");

    state.dismissPrompt();
    expect(state.confirmRequest.value).toBeNull();
    expect(state.confirmDisplay.value?.message).toBe("Delete item 42?");

    state.releaseConfirm();
    expect(state.confirmDisplay.value).toBeNull();
  });

  it("ignores a late release that lands after the slot was reopened", () => {
    const { state } = mountTableState();
    void state.prompt("First prompt?");
    state.dismissPrompt();
    // The previous surface is still leaving when the next request arrives.
    void state.prompt("Second prompt?");
    expect(state.confirmDisplay.value?.message).toBe("Second prompt?");

    state.releaseConfirm();
    expect(state.confirmDisplay.value?.message).toBe("Second prompt?");
  });

  it("supersedes the retained request when a new one is raised", () => {
    const { state } = mountTableState();
    void state.requestActionInput(formAction, {
      identifiers: [{ id: "A-1" }],
      preferredId: ["id"],
    });
    expect(state.actionFormDisplay.value?.action.name).toBe("reschedule");

    void state.requestActionInput(
      { ...formAction, name: "cancel-order" },
      { identifiers: [{ id: "B-2" }], preferredId: ["id"] },
    );
    expect(state.actionFormDisplay.value?.action.name).toBe("cancel-order");

    state.acceptActionForm({});
    state.releaseActionForm();
    expect(state.actionFormDisplay.value).toBeNull();
  });
});
