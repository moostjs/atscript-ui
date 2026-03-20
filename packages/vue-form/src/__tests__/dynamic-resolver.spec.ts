import { describe, it, expect, beforeAll } from "vitest";
import { nextTick } from "vue";
import { installDynamicResolver } from "@atscript/ui-fns";
import {
  UI_FN_LABEL,
  UI_FN_HIDDEN,
  UI_FN_DISABLED,
  UI_FN_VALUE,
  UI_FN_OPTIONS,
} from "@atscript/ui-core";
import { mountForm, objectType, stringProp, phantomProp } from "./helpers";

beforeAll(() => {
  installDynamicResolver();
});

describe("dynamic resolver – ui.fn.label", () => {
  it("resolves initial label", async () => {
    const type = objectType({
      name: stringProp({
        [UI_FN_LABEL]: '(v) => v ? "Editing: " + v : "New"',
      }),
    });
    const { wrapper } = mountForm(type);
    await nextTick();
    expect(wrapper.text()).toContain("New");
  });

  it("updates reactively when data changes", async () => {
    const type = objectType({
      name: stringProp({
        [UI_FN_LABEL]: '(v) => v ? "Editing: " + v : "New"',
      }),
    });
    const { wrapper, formData } = mountForm(type);
    await nextTick();
    expect(wrapper.text()).toContain("New");

    formData.value.name = "Alice";
    await nextTick();
    expect(wrapper.text()).toContain("Editing: Alice");
  });
});

describe("dynamic resolver – ui.fn.hidden", () => {
  it("hides field based on data condition", async () => {
    const type = objectType({
      toggle: stringProp(),
      secret: stringProp({
        [UI_FN_HIDDEN]: '(v, data) => data.toggle === "hide"',
      }),
    });
    const { wrapper, formData } = mountForm(type);
    formData.value.toggle = "hide";
    await nextTick();

    const fields = wrapper.findAll(".as-default-field");
    // The second field (secret) should be hidden via v-show
    const secretField = fields[1]!;
    expect(secretField.attributes("style")).toContain("display: none");
  });

  it("shows field when condition changes", async () => {
    const type = objectType({
      toggle: stringProp(),
      secret: stringProp({
        [UI_FN_HIDDEN]: '(v, data) => data.toggle === "hide"',
      }),
    });
    const { wrapper, formData } = mountForm(type);
    formData.value.toggle = "hide";
    await nextTick();

    const fields = () => wrapper.findAll(".as-default-field");
    expect(fields()[1]!.attributes("style")).toContain("display: none");

    formData.value.toggle = "show";
    await nextTick();
    // After changing condition, field should be visible (no display:none)
    expect(fields()[1]!.attributes("style") ?? "").not.toContain("display: none");
  });
});

describe("dynamic resolver – ui.fn.disabled", () => {
  it("disables field based on data condition", async () => {
    const type = objectType({
      locked: stringProp(),
      target: stringProp({
        [UI_FN_DISABLED]: '(v, data) => data.locked === "yes"',
      }),
    });
    const { wrapper, formData } = mountForm(type);
    formData.value.locked = "yes";
    await nextTick();

    const inputs = wrapper.findAll("input");
    // Second input (target) should be disabled
    expect(inputs[1]!.attributes("disabled")).toBeDefined();
  });

  it("enables field when condition changes", async () => {
    const type = objectType({
      locked: stringProp(),
      target: stringProp({
        [UI_FN_DISABLED]: '(v, data) => data.locked === "yes"',
      }),
    });
    const { wrapper, formData } = mountForm(type);
    formData.value.locked = "yes";
    await nextTick();

    const inputs = () => wrapper.findAll("input");
    expect(inputs()[1]!.attributes("disabled")).toBeDefined();

    formData.value.locked = "no";
    await nextTick();
    expect(inputs()[1]!.attributes("disabled")).toBeUndefined();
  });
});

describe("dynamic resolver – ui.fn.value (phantom)", () => {
  it("resolves phantom paragraph value", async () => {
    const type = objectType({
      name: stringProp(),
      greeting: phantomProp({
        "ui.type": "paragraph",
        [UI_FN_VALUE]: '(v, data) => data.name ? "Hello, " + data.name : "Enter your name"',
      }),
    });
    const { wrapper } = mountForm(type);
    await nextTick();
    expect(wrapper.text()).toContain("Enter your name");
  });

  it("updates reactively", async () => {
    const type = objectType({
      name: stringProp(),
      greeting: phantomProp({
        "ui.type": "paragraph",
        [UI_FN_VALUE]: '(v, data) => data.name ? "Hello, " + data.name : "Enter your name"',
      }),
    });
    const { wrapper, formData } = mountForm(type);
    await nextTick();
    expect(wrapper.text()).toContain("Enter your name");

    formData.value.name = "Bob";
    await nextTick();
    expect(wrapper.text()).toContain("Hello, Bob");
  });
});

describe("dynamic resolver – ui.fn.submit.text", () => {
  it("resolves form button text", async () => {
    const type = objectType(
      { name: stringProp() },
      { "ui.fn.submit.text": '(data) => data.name ? "Update " + data.name : "Create"' },
    );
    const { wrapper } = mountForm(type);
    await nextTick();

    const button = wrapper.find("form > button");
    expect(button.text()).toBe("Create");
  });

  it("updates reactively", async () => {
    const type = objectType(
      { name: stringProp() },
      { "ui.fn.submit.text": '(data) => data.name ? "Update " + data.name : "Create"' },
    );
    const { wrapper, formData } = mountForm(type);
    await nextTick();
    expect(wrapper.find("form > button").text()).toBe("Create");

    formData.value.name = "Alice";
    await nextTick();
    expect(wrapper.find("form > button").text()).toBe("Update Alice");
  });
});

describe("dynamic resolver – ui.fn.options", () => {
  it("resolves options from context", async () => {
    const type = objectType({
      color: stringProp({
        "ui.type": "select",
        [UI_FN_OPTIONS]: "(v, data, context) => context.colors",
      }),
    });
    const { wrapper } = mountForm(type, {
      formContext: {
        colors: [
          { value: "red", label: "Red" },
          { value: "blue", label: "Blue" },
        ],
      },
    });
    await nextTick();

    // Select component should render the options
    const options = wrapper.findAll("option");
    expect(options.length).toBeGreaterThanOrEqual(2);
    expect(wrapper.text()).toContain("Red");
    expect(wrapper.text()).toContain("Blue");
  });
});

describe("dynamic resolver – scope context", () => {
  it("scope receives correct context", async () => {
    const type = objectType({
      greeting: phantomProp({
        "ui.type": "paragraph",
        [UI_FN_VALUE]: '(v, data, context) => "Welcome, " + context.user',
      }),
    });
    const { wrapper } = mountForm(type, {
      formContext: { user: "Admin" },
    });
    await nextTick();
    expect(wrapper.text()).toContain("Welcome, Admin");
  });
});
