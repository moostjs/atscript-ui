import { describe, it, expect } from "vitest";
import { nextTick } from "vue";
import { mountForm } from "./helpers";

// atscript 0.1.103: `null` on an optional `@meta.required` field is rejected
// ("Must not be empty"). Emptied inputs on optional fields therefore commit
// `undefined` (the field is omitted), like the optional toggle does; on a
// required field they keep committing `null`.

async function mountEmptied() {
  const { EmptiedInputs } = await import("./fixtures/field-annotations.as");
  const mounted = mountForm(EmptiedInputs, {
    initialValue: { due: "2026-10-09", start: "2026-10-01", qty: 3 },
  });
  await nextTick();
  return { ...mounted, EmptiedInputs };
}

function inputOf(wrapper: ReturnType<typeof mountForm>["wrapper"], name: string) {
  const input = wrapper
    .findAll<HTMLInputElement>("input")
    .find((i) => i.attributes("name") === name);
  if (!input) throw new Error(`no input named ${name}`);
  return input;
}

describe("emptied inputs", () => {
  it("an optional date commits undefined and passes @meta.required validation", async () => {
    const { wrapper, formData, EmptiedInputs } = await mountEmptied();
    const due = inputOf(wrapper, "due");
    await due.setValue("");
    await due.trigger("change");
    await due.trigger("blur");
    await nextTick();

    expect("due" in formData.value && formData.value.due !== undefined).toBe(false);
    expect(EmptiedInputs.validator().validate(formData.value, true)).toBe(true);
  });

  it("an optional number commits undefined; a required date keeps null", async () => {
    const { wrapper, formData } = await mountEmptied();
    const qty = wrapper.find<HTMLInputElement>(".as-number-input");
    await qty.setValue("");
    await qty.trigger("blur");
    const start = inputOf(wrapper, "start");
    await start.setValue("");
    await start.trigger("change");
    await start.trigger("blur");
    await nextTick();

    expect(formData.value.qty).toBeUndefined();
    expect(formData.value.start).toBeNull();
  });
});
