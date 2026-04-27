import { defineShortcuts } from "vunor/theme";

// Match vunor's native `::-webkit-scrollbar` preflight exactly: 10px wide,
// rgba black @ 5%/20%/30% opacities (255-mirror in dark), 5px radius, thumb
// with 2px transparent border + `background-clip: padding-box` so the thumb
// reads as a "pill" inside the track.
export const asWindowScrollbarShortcuts = defineShortcuts({
  "as-window-scrollbar": "relative flex-shrink-0 w-[10px] select-none",
  "as-window-scrollbar-track": {
    "": "relative h-full w-full rounded-[5px] cursor-pointer bg-[rgba(0,0,0,0.05)]",
    "dark:": "bg-[rgba(255,255,255,0.05)]",
  },
  "as-window-scrollbar-thumb": {
    "":
      "absolute left-0 right-0 rounded-[5px] border-2 border-transparent bg-clip-padding " +
      "bg-[rgba(0,0,0,0.2)] transition-colors duration-100",
    "hover:": "bg-[rgba(0,0,0,0.3)]",
    "[&[data-active=true]]:": "bg-[rgba(0,0,0,0.3)] cursor-ns-resize",
    "dark:": "bg-[rgba(255,255,255,0.2)]",
    "dark:hover:": "bg-[rgba(255,255,255,0.3)]",
    "[&[data-active=true]]:dark:": "bg-[rgba(255,255,255,0.3)]",
  },
});
