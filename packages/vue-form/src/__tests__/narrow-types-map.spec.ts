import { describe, expect, it } from "vitest";
import AsInput from "../components/defaults/as-input.vue";
import AsObject from "../components/defaults/as-object.vue";
import type { TAsTypeComponents } from "../components/types";
import { mountForm, objectType, stringProp } from "./helpers";

describe("a narrow types map", () => {
  // Only the field kinds the app's forms use: the other default components
  // (and their CSS) stay out of the bundle. Typed: the map need not list
  // every built-in type (`object` renders the form's root).
  const types: TAsTypeComponents = { object: AsObject, text: AsInput };

  it("renders the forms it covers", () => {
    const { wrapper } = mountForm(objectType({ name: stringProp() }), { types });
    expect(wrapper.findAll("input")).toHaveLength(1);
  });
});
