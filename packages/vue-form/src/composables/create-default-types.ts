import type { TAsTypeComponents } from "../components/types";
import {
  AsInput,
  AsSelect,
  AsRadio,
  AsCheckbox,
  AsParagraph,
  AsAction,
  AsObject,
  AsArray,
  AsUnion,
  AsTuple,
  AsRef,
} from "../components/defaults";

/**
 * Returns a fresh type-to-component map pre-filled with all built-in defaults.
 *
 * Spread or assign additional entries to extend with custom field types:
 * ```ts
 * const types = { ...createDefaultTypes(), rating: MyRatingComponent }
 * ```
 */
export function createDefaultTypes(): TAsTypeComponents {
  return {
    text: AsInput,
    textarea: AsInput,
    password: AsInput,
    number: AsInput,
    select: AsSelect,
    radio: AsRadio,
    checkbox: AsCheckbox,
    paragraph: AsParagraph,
    action: AsAction,
    object: AsObject,
    array: AsArray,
    union: AsUnion,
    tuple: AsTuple,
    ref: AsRef,
  };
}
