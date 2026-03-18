import { ref, watch, onBeforeUnmount, type Ref } from "vue";

export function useDropdown(containerRef: Ref<HTMLElement | null>) {
  const isOpen = ref(false);

  function toggle() {
    isOpen.value = !isOpen.value;
  }

  function close() {
    isOpen.value = false;
  }

  function select(callback: () => void) {
    callback();
    close();
  }

  function onClickOutside(event: MouseEvent) {
    if (containerRef.value && !containerRef.value.contains(event.target as Node)) {
      close();
    }
  }

  // Lazy listener: only active while the dropdown is open
  watch(isOpen, (open) => {
    if (open) {
      document.addEventListener("click", onClickOutside, true);
    } else {
      document.removeEventListener("click", onClickOutside, true);
    }
  });

  onBeforeUnmount(() => document.removeEventListener("click", onClickOutside, true));

  return { isOpen, toggle, close, select };
}
