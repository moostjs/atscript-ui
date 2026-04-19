import type { Ref } from "vue";
import { onBeforeUnmount, watch } from "vue";

/**
 * Pointer-drag horizontal scroll for a container. Listens for pointerdown on
 * the container, then attaches pointermove / pointerup / pointercancel to
 * `window` so drag stays smooth even when the pointer leaves the container
 * (including dragging over an input or outside the viewport).
 */
export function useDragScroll(el: Ref<HTMLElement | null>) {
  let startX = 0;
  let startScroll = 0;
  let dragging = false;
  let pointerId: number | null = null;

  function onMove(e: PointerEvent) {
    if (pointerId !== e.pointerId || !el.value) return;
    const dx = e.clientX - startX;
    if (!dragging) {
      if (Math.abs(dx) < 4) return;
      dragging = true;
    }
    el.value.scrollLeft = startScroll - dx;
    e.preventDefault();
  }

  function onUp(e: PointerEvent) {
    if (pointerId !== e.pointerId) return;
    window.removeEventListener("pointermove", onMove);
    window.removeEventListener("pointerup", onUp);
    window.removeEventListener("pointercancel", onUp);
    pointerId = null;
    dragging = false;
  }

  function onDown(e: PointerEvent) {
    const target = e.target as HTMLElement | null;
    if (!el.value || !target) return;
    if (target.closest("input, textarea, button, [role=button], a")) return;
    if (e.button !== 0) return;
    startX = e.clientX;
    startScroll = el.value.scrollLeft;
    pointerId = e.pointerId;
    dragging = false;
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
  }

  // Convert vertical wheel to horizontal scroll; native horizontal wheel
  // (touchpad two-finger swipe) just scrolls the container directly.
  function onWheel(e: WheelEvent) {
    if (!el.value) return;
    const dx = e.deltaX;
    const dy = e.deltaY;
    if (Math.abs(dy) > Math.abs(dx)) {
      el.value.scrollLeft += dy;
      e.preventDefault();
    }
  }

  const attach = (node: HTMLElement) => {
    node.addEventListener("pointerdown", onDown);
    node.addEventListener("wheel", onWheel, { passive: false });
  };
  const detach = (node: HTMLElement) => {
    node.removeEventListener("pointerdown", onDown);
    node.removeEventListener("wheel", onWheel);
  };

  watch(
    el,
    (node, prev) => {
      if (prev) detach(prev);
      if (node) attach(node);
    },
    { immediate: true },
  );

  onBeforeUnmount(() => {
    if (el.value) detach(el.value);
    window.removeEventListener("pointermove", onMove);
    window.removeEventListener("pointerup", onUp);
    window.removeEventListener("pointercancel", onUp);
  });
}
