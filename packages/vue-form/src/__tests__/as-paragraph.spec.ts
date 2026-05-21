import { mount } from "@vue/test-utils";
import { describe, it, expect } from "vitest";
import AsParagraph from "../components/defaults/as-paragraph.vue";

function baseProps(overrides: Record<string, unknown> = {}) {
  return {
    onBlur: () => {},
    model: { value: "" },
    type: "paragraph",
    path: "",
    inputId: "p-input",
    errorId: "p-input-err",
    descId: "p-input-desc",
    ...overrides,
  };
}

describe("AsParagraph", () => {
  it("forwards class onto <p> so grid classes apply at runtime", () => {
    // WHY: AsField composes the per-field grid footprint (`col-span-*`,
    // `error`, etc.) into `:class` and passes it through. Without forwarding,
    // a `ui.paragraph` field rendered inside `as-form-grid` collapses to a
    // single grid cell because the column spec never lands on the DOM.
    const wrapper = mount(AsParagraph, {
      props: baseProps({
        value: "hi",
        class: "col-span-12 error",
      }),
    });

    const el = wrapper.element as HTMLParagraphElement;
    expect(el.tagName).toBe("P");
    expect(el.classList.contains("col-span-12")).toBe(true);
    expect(el.classList.contains("error")).toBe(true);
    // Always wears the grid-item base class so the default `col-span-full`
    // applies even when no @ui.form.grid.* override is present.
    expect(el.classList.contains("as-default-field")).toBe(true);
  });

  it("forwards style onto <p>", () => {
    const wrapper = mount(AsParagraph, {
      props: baseProps({
        value: "hi",
        style: { color: "red" },
      }),
    });
    expect((wrapper.element as HTMLElement).style.color).toBe("red");
  });
});
