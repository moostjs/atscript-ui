import { renderSlot, type FunctionalComponent, type Slots } from "vue";

/**
 * Renders the slot `name` of a slots object owned by ANOTHER component, with
 * `scope` as its props — `<AsTableRow>` uses it to render `<AsTableBase>`'s
 * cell slots. Unlike a forwarding `<slot>`, it leaves the row's own slots
 * stable, so rows are not force-updated on every parent pass.
 *
 * @internal
 */
export const AsTableSlot: FunctionalComponent<{
  slots: Slots;
  name: string;
  scope: Record<string, unknown>;
}> = (props) => renderSlot(props.slots, props.name, props.scope);

AsTableSlot.props = ["slots", "name", "scope"];
