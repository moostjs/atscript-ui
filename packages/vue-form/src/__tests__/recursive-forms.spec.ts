import { describe, expect, it } from "vitest";
import { nextTick } from "vue";
import { mountForm } from "./helpers";

describe("recursive types in AsForm", () => {
  it("renders a self-recursive tree to the depth of its data and submits it", async () => {
    const { TreeForm } = await import("./fixtures/recursive-forms.as");
    const value = { name: "root", children: [{ name: "a", children: [{ name: "b" }] }] };
    const { wrapper } = mountForm(TreeForm, { initialValue: value });
    await nextTick();

    const values = wrapper.findAll("input").map((i) => (i.element as HTMLInputElement).value);
    expect(values).toEqual(expect.arrayContaining(["root", "a", "b"]));

    await wrapper.find("form").trigger("submit");
    await nextTick();
    expect(wrapper.emitted("submit")?.[0]?.[0]).toEqual(value);
  });

  it("leaves navigation fields out of the form", async () => {
    const { ShelfForm } = await import("./fixtures/recursive-forms.as");
    const { wrapper } = mountForm(ShelfForm, {
      initialValue: { name: "s", items: [{ title: "t" }] },
    });
    await nextTick();

    const values = wrapper.findAll("input").map((i) => (i.element as HTMLInputElement).value);
    expect(values).toEqual(["s"]);

    // Related rows loaded with the row are not submitted.
    await wrapper.find("form").trigger("submit");
    await nextTick();
    expect(wrapper.emitted("submit")?.[0]?.[0]).toEqual({ name: "s" });
  });
});
