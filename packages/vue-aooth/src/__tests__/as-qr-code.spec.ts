import { flushPromises, mount } from "@vue/test-utils";
import { describe, expect, it, vi } from "vitest";

// Stub the optional `qrcode` peer dep so unit tests don't compute a real
// QR matrix — we only assert that the returned SVG markup is rendered.
vi.mock("qrcode", () => ({
  default: {
    toString: vi.fn(async () => '<svg data-test="stub"></svg>'),
  },
}));

import AsQrCode from "../components/as-qr-code.vue";

function baseProps(overrides: Record<string, unknown> = {}) {
  // Display-only component: model carries the otpauth:// URI; the rest of
  // the prop surface mirrors AsPasswordRules' test shape so the contract
  // stays consistent across wf field defaults.
  return {
    onBlur: () => {},
    model: { value: undefined as string | undefined },
    type: "qr-code",
    path: "totpUri",
    inputId: "qr-input",
    errorId: "qr-input-err",
    descId: "qr-input-desc",
    ...overrides,
  };
}

const URI_WITH_SECRET =
  "otpauth://totp/Example:alice@example.com?secret=JBSWY3DPEHPK3PXP&issuer=Example";

describe("AsQrCode", () => {
  it("renders the generated SVG when model.value is a non-empty URI", async () => {
    // WHY: the QR image is the entire surface — if the dynamic-import
    // pipeline doesn't propagate to `v-html`, users see a blank field
    // and have no way to enrol their authenticator.
    const wrapper = mount(AsQrCode, {
      props: baseProps({ model: { value: URI_WITH_SECRET } }),
    });
    // Wait for the immediate watcher's async render to complete.
    await flushPromises();
    await flushPromises();
    const svgHost = wrapper.find(".as-qr-code-svg");
    expect(svgHost.exists()).toBe(true);
    expect(svgHost.html()).toContain('data-test="stub"');
  });

  it("renders nothing inside the shell when model.value is empty", async () => {
    // WHY: an empty value is a real transient state (workflow hasn't
    // returned the URI yet). Rendering a phantom QR placeholder would
    // mislead users into scanning garbage.
    const wrapper = mount(AsQrCode, {
      props: baseProps({ model: { value: undefined } }),
    });
    await flushPromises();
    expect(wrapper.find(".as-qr-code-svg").exists()).toBe(false);
    expect(wrapper.find(".as-qr-code-secret").exists()).toBe(false);
  });

  it("renders the parsed ?secret= when manualSecret is true", async () => {
    // WHY: scanning fails on shared screens / SSH sessions; the manual
    // secret is the documented fallback. If we don't surface it, those
    // users are blocked.
    const wrapper = mount(AsQrCode, {
      props: baseProps({ model: { value: URI_WITH_SECRET } }),
    });
    await flushPromises();
    await flushPromises();
    const sec = wrapper.find(".as-qr-code-secret");
    expect(sec.exists()).toBe(true);
    expect(sec.text()).toBe("JBSWY3DPEHPK3PXP");
  });

  it("omits the secret when manualSecret is false", async () => {
    // WHY: some integrators want the QR only (kiosk / managed-device
    // policy). The toggle must actually suppress the secret string.
    const wrapper = mount(AsQrCode, {
      props: baseProps({ model: { value: URI_WITH_SECRET }, manualSecret: false }),
    });
    await flushPromises();
    await flushPromises();
    expect(wrapper.find(".as-qr-code-secret").exists()).toBe(false);
  });

  it("silently skips the secret line when the value carries no secret param", async () => {
    // WHY: the component now extracts the secret via regex, not `new URL(...)`,
    // so non-URL strings don't throw. But values that DO parse must still omit
    // the manual-secret block when no `secret=` is present.
    const wrapper = mount(AsQrCode, {
      props: baseProps({ model: { value: "not a url" } }),
    });
    await flushPromises();
    await flushPromises();
    expect(wrapper.find(".as-qr-code-svg").exists()).toBe(true);
    expect(wrapper.find(".as-qr-code-secret").exists()).toBe(false);
  });

  it("renders props.value (phantom path) when model.value is undefined", async () => {
    // WHY: the canonical wf-demo flow uses `ui.paragraph` + `@ui.form.fn.value`,
    // which puts the resolved URI on `props.value`, not `model.value`. A
    // regression in the fallback chain breaks the entire phantom-field
    // contract — only this test catches it.
    const wrapper = mount(AsQrCode, {
      props: baseProps({ model: { value: undefined }, value: URI_WITH_SECRET }),
    });
    await flushPromises();
    await flushPromises();
    expect(wrapper.find(".as-qr-code-svg").exists()).toBe(true);
    expect(wrapper.find(".as-qr-code-secret").text()).toBe("JBSWY3DPEHPK3PXP");
  });
});
