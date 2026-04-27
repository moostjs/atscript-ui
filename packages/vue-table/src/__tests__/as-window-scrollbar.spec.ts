import { describe, it, expect } from "vitest";
import { mount } from "@vue/test-utils";
import AsWindowScrollbar from "../components/internal/as-window-scrollbar.vue";
import { stubRect } from "./helpers";

describe("<AsWindowScrollbar>", () => {
  it("renders nothing when totalCount <= viewportRowCount (no scroll needed)", () => {
    const wrapper = mount(AsWindowScrollbar, {
      props: { topIndex: 0, viewportRowCount: 20, totalCount: 5 },
    });
    expect(wrapper.find(".as-window-scrollbar").exists()).toBe(false);
  });

  it("renders track + thumb when scroll is needed", () => {
    const wrapper = mount(AsWindowScrollbar, {
      props: { topIndex: 0, viewportRowCount: 20, totalCount: 1000 },
    });
    expect(wrapper.find(".as-window-scrollbar").exists()).toBe(true);
    expect(wrapper.find(".as-window-scrollbar-track").exists()).toBe(true);
    expect(wrapper.find(".as-window-scrollbar-thumb").exists()).toBe(true);
  });

  it("track click below thumb emits +viewport top-index-change (page jump)", async () => {
    const wrapper = mount(AsWindowScrollbar, {
      props: { topIndex: 0, viewportRowCount: 20, totalCount: 1000 },
    });
    const track = wrapper.find(".as-window-scrollbar-track");
    stubRect(track.element, 0, 20, 600);
    await track.trigger("click", { clientY: 590 }); // far below thumb
    const events = wrapper.emitted("top-index-change");
    expect(events).toBeTruthy();
    expect(events?.[0][0]).toBe(20); // pages by viewportRowCount
  });

  it("track click above thumb emits -viewport top-index-change", async () => {
    const wrapper = mount(AsWindowScrollbar, {
      props: { topIndex: 100, viewportRowCount: 20, totalCount: 1000 },
    });
    const track = wrapper.find(".as-window-scrollbar-track");
    stubRect(track.element, 0, 20, 600);
    await track.trigger("click", { clientY: 0 });
    const events = wrapper.emitted("top-index-change");
    expect(events).toBeTruthy();
    expect(events?.[0][0]).toBe(80); // 100 - 20 = 80
  });
});
