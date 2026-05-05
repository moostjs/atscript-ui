import type { Page } from "@playwright/test";

const SINK_KEY = "__e2eClipboardWrites";

/**
 * Patch `navigator.clipboard.writeText` so tests can assert what was copied
 * without the OS "do you want to allow access" prompt. Idempotent — installing
 * twice on the same page just resets the sink.
 *
 * Call this in a `test.beforeEach` (or before the navigation that mounts the
 * code under test). Reads come back via `getClipboardWrites(page)` /
 * `getLastClipboardWrite(page)`.
 *
 * Used by Scenario 8.3 (row action of type `copy` writes a formatted invite
 * link via `navigator.clipboard.writeText`).
 */
export async function installClipboardSink(page: Page): Promise<void> {
  await page.addInitScript((sinkKey: string) => {
    const sink: string[] = [];
    Object.defineProperty(window, sinkKey, { value: sink, configurable: true, writable: false });
    const writeText = (text: string) => {
      sink.push(String(text));
      return Promise.resolve();
    };
    if (!navigator.clipboard) {
      Object.defineProperty(navigator, "clipboard", {
        value: { writeText, readText: () => Promise.resolve(sink[sink.length - 1] ?? "") },
        configurable: true,
      });
    } else {
      navigator.clipboard.writeText = writeText;
    }
  }, SINK_KEY);
}

export async function getClipboardWrites(page: Page): Promise<string[]> {
  return await page.evaluate(
    (sinkKey: string) => ((window as unknown as Record<string, string[]>)[sinkKey] ?? []).slice(),
    SINK_KEY,
  );
}

export async function getLastClipboardWrite(page: Page): Promise<string | null> {
  const writes = await getClipboardWrites(page);
  return writes[writes.length - 1] ?? null;
}
