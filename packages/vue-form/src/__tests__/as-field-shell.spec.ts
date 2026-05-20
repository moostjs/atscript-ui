import { mount } from "@vue/test-utils";
import { describe, it, expect } from "vitest";
import AsFieldShell from "../components/defaults/as-field-shell.vue";

// Minimum prop set the shell needs. AsField normally provides these; we
// stub them so the shell can mount in isolation.
function baseProps(overrides: Record<string, unknown> = {}) {
  return {
    onBlur: () => {},
    model: { value: "" },
    type: "text",
    path: "",
    inputId: "shell-input",
    errorId: "shell-input-err",
    descId: "shell-input-desc",
    ...overrides,
  };
}

describe("AsFieldShell — formAction footer link", () => {
  it("renders alt action link below the input when formAction is set", () => {
    // WHY: the link must live in the footer row, not the header. A
    // regression that rendered it next to the label would still pass a
    // "link exists somewhere" assertion, so we anchor on the footer's
    // class and verify ordering relative to the input slot.
    const wrapper = mount(AsFieldShell as any, {
      props: baseProps({
        label: "Password",
        formAction: { id: "forgot-password", label: "Forgot password?" },
      }),
      slots: {
        default: '<input data-testid="ctrl" />',
      },
    });

    const footer = wrapper.find(".as-field-footer-row");
    expect(footer.exists()).toBe(true);

    const link = footer.find(".as-field-action-link");
    expect(link.exists()).toBe(true);
    expect(link.text()).toBe("Forgot password?");
    expect(link.attributes("type")).toBe("button");

    // Footer must come AFTER the input row in the DOM (visually "below").
    const inputRow = wrapper.find(".as-field-input-row");
    expect(inputRow.exists()).toBe(true);
    const position = inputRow.element.compareDocumentPosition(footer.element);
    expect(position & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("emits 'action' with the action id when the link is clicked", async () => {
    // WHY: the wire contract is the id, not the label. AsWfForm forwards
    // the emitted name to `useWfForm().action(id)` on the server. Asserting
    // only "click registered" would let an id/label swap slip through.
    const wrapper = mount(AsFieldShell as any, {
      props: baseProps({
        formAction: { id: "forgot-password", label: "Forgot password?" },
      }),
      slots: {
        default: "<input />",
      },
    });

    await wrapper.find(".as-field-action-link").trigger("click");

    const events = wrapper.emitted("action");
    expect(events).toBeTruthy();
    expect(events).toHaveLength(1);
    expect(events![0]).toEqual(["forgot-password"]);
  });
});
