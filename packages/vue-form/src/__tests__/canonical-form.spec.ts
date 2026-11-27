import { flushPromises, mount } from "@vue/test-utils";
import { ClientError, VersionMismatchError, type Client } from "@atscript/db-client";
import { describe, expect, it, vi } from "vitest";
import { nextTick } from "vue";
import CanonicalForm from "./fixtures/canonical-form.vue";
import type { ServiceTicket } from "./fixtures/canonical-ticket.as";

/**
 * Mounts the canonical form example (`fixtures/canonical-form.vue`, mirrored in
 * `docs/forms/canonical-example.md`) against a stub client, so the documented
 * wiring is proven end to end: load → patch-only submit → `$cas` → server field
 * errors → version-mismatch rebase.
 */

type Row = {
  id: number;
  subject: string;
  priority: string;
  notes?: string;
  version: number;
};

/**
 * A one-row server: `one()` reads the stored row, `update()` checks `$cas`
 * against the stored version (409 on a stale one, like the db layer), applies
 * the fields and bumps the version. `store()` plays another writer.
 */
function makeClient(initial: Row) {
  let stored = { ...initial };
  const one = vi.fn(async () => ({ ...stored }));
  const update = vi.fn(async (body: Record<string, unknown>) => {
    const { id: _id, $cas, ...fields } = body as { id: number; $cas: { version: number } };
    if ($cas.version !== stored.version) {
      throw new VersionMismatchError(409, {
        message: "Version mismatch",
        statusCode: 409,
        kind: "version_mismatch",
        currentVersion: stored.version,
      });
    }
    stored = { ...stored, ...fields, version: stored.version + 1 };
    return { modified: 1 };
  });
  const client = { one, update } as unknown as Client<typeof ServiceTicket>;
  const store = (next: Row) => (stored = { ...next });
  return { client, one, update, store };
}

function row(overrides: Partial<Row> = {}): Row {
  return { id: 7, subject: "Printer offline", priority: "normal", version: 3, ...overrides };
}

async function mountEditor(initial: Row) {
  const { client, ...server } = makeClient(initial);
  const wrapper = mount(CanonicalForm, { props: { id: 7, client } });
  await flushPromises();
  return { wrapper, ...server };
}

function subjectInput(wrapper: Awaited<ReturnType<typeof mountEditor>>["wrapper"]) {
  return wrapper.findAll("input").find((i) => i.attributes("name") === "subject")!;
}

async function submit(wrapper: Awaited<ReturnType<typeof mountEditor>>["wrapper"]) {
  await wrapper.find("form").trigger("submit");
  await flushPromises();
  await nextTick();
}

describe("canonical form example", () => {
  it("loads the row into the wrapped container and renders the custom priority control", async () => {
    const { wrapper } = await mountEditor(row());

    expect(subjectInput(wrapper).element.value).toBe("Printer offline");
    // The custom control registered under `@ui.type 'priority'` — the default
    // select renderer would have produced a <select>, not these buttons.
    const options = wrapper.findAll("button.ticket-priority-option");
    expect(options.map((b) => b.text())).toEqual(["low", "normal", "high"]);
    expect(options[1]!.attributes("aria-pressed")).toBe("true");
  });

  it("sends NOTHING when an unchanged form is submitted (empty patch ⇒ no $cas, no request)", async () => {
    const { wrapper, update } = await mountEditor(row());

    await submit(wrapper);

    expect(update).not.toHaveBeenCalled();
    expect(wrapper.text()).toContain("No changes");
  });

  it("sends only the edited field plus $cas, never the version column itself", async () => {
    const { wrapper, update } = await mountEditor(row());

    await subjectInput(wrapper).setValue("Printer jammed");
    await submit(wrapper);

    expect(update).toHaveBeenCalledTimes(1);
    expect(update.mock.calls[0]![0]).toEqual({
      id: 7,
      subject: "Printer jammed",
      $cas: { version: 3 },
    });
    expect(wrapper.text()).toContain("Saved");

    // The re-read row was folded in — the form is clean again, so a second
    // submit is a no-op.
    await submit(wrapper);
    expect(update).toHaveBeenCalledTimes(1);
  });

  it("saves twice in a row: the second patch carries the version the first save wrote", async () => {
    // Guards the post-save step: a plain `rebase()` keeps version 3, and the
    // second save would be answered as a version mismatch.
    const { wrapper, update } = await mountEditor(row());

    await subjectInput(wrapper).setValue("Printer jammed");
    await submit(wrapper);
    await subjectInput(wrapper).setValue("Printer jammed again");
    await submit(wrapper);

    expect(update).toHaveBeenCalledTimes(2);
    expect(update.mock.calls[1]![0]).toEqual({
      id: 7,
      subject: "Printer jammed again",
      $cas: { version: 4 },
    });
    expect(wrapper.text()).toContain("Saved");
    expect(wrapper.text()).not.toContain("Row changed on the server");
  });

  it("maps a 400 validation envelope onto the offending field", async () => {
    const { wrapper, update } = await mountEditor(row());
    update.mockRejectedValueOnce(
      new ClientError(400, {
        message: "Validation failed",
        statusCode: 400,
        errors: [{ path: "subject", message: "Subject already used" }],
      }),
    );

    await subjectInput(wrapper).setValue("Printer jammed");
    await submit(wrapper);

    const shown = wrapper.findAll(".as-error-slot").map((n) => n.text());
    expect(shown).toContain("Subject already used");
  });

  it("recovers from a version mismatch: reloads, keeps local edits, re-sends with the fresh $cas", async () => {
    const { wrapper, update, store } = await mountEditor(row());
    // Another writer saves after our load: a new version and a notes value the
    // local user never touched.
    store(row({ notes: "Escalated", version: 4 }));

    await subjectInput(wrapper).setValue("Printer jammed");
    await submit(wrapper);

    // The local edit survived the rebase, and the user was told what happened.
    expect(subjectInput(wrapper).element.value).toBe("Printer jammed");
    expect(wrapper.text()).toContain("Row changed on the server");

    // Retry: same edit, but now `$cas` carries the version we rebased onto.
    await submit(wrapper);

    expect(update).toHaveBeenCalledTimes(2);
    expect(update.mock.calls[1]![0]).toEqual({
      id: 7,
      subject: "Printer jammed",
      $cas: { version: 4 },
    });
    expect(wrapper.text()).toContain("Saved");
  });
});
