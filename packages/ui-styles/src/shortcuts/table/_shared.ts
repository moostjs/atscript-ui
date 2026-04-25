import { strongText } from "../common/_shared";

export { strongText };

export const dialogOverlay = "fixed inset-0 bg-black/30 z-[100]";

export const dialogBase =
  "layer-0 fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[101] " +
  "rounded-r3 shadow-popup " +
  "flex flex-col outline-none border-1";

export const smallInputBase =
  "scope-primary flex-1 h-fingertip-s px-$s min-w-[8em] outline-none " +
  "border-1 layer-0 rounded-base current-outline-hl " +
  `${strongText} placeholder:text-current/50`;

export const chipBase =
  "inline-flex items-center px-$s py-[0.15em] rounded-r0 text-callout whitespace-nowrap";

export const searchWrap = "relative flex-1 min-w-0 flex items-stretch";

export const searchIcon =
  "absolute left-$s top-1/2 -translate-y-1/2 text-current/50 pointer-events-none inline-flex text-body";

export const menuItemIconHl = "[&_.as-column-menu-item-icon]:text-current-hl";
