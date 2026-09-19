/** A cell value after export-time resolution — always a spreadsheet scalar. */
export type ExportScalar = string | number | boolean | null;

/** Options shared by {@link csvCell} and {@link toCsv}. */
export interface CsvOptions {
  /**
   * Prepend a UTF-8 byte-order mark. Excel needs it to detect UTF-8 in a
   * `.csv` opened by double-click; most other tools don't care. Default `false`.
   */
  bom?: boolean;
  /**
   * Prefix a STRING cell starting with `=`, `+`, `-`, `@`, TAB or CR with a
   * single quote so a spreadsheet treats it as text instead of a formula
   * (CSV-injection defence). Numbers and booleans are never touched — a
   * negative number stays numeric. Default `true`; set `false` when the file
   * is consumed by a parser rather than a spreadsheet.
   */
  escapeFormulas?: boolean;
  /** Field delimiter. Default `","`. */
  delimiter?: string;
}

const FORMULA_LEADERS = new Set(["=", "+", "-", "@", "\t", "\r"]);

/** RFC 4180 row separator. */
const CRLF = "\r\n";

/**
 * Render one value as an RFC 4180 field: formula-escaped (unless opted out),
 * then quoted when it contains the delimiter, a quote, CR or LF — with inner
 * quotes doubled.
 */
export function csvCell(value: ExportScalar | undefined, opts: CsvOptions = {}): string {
  const delimiter = opts.delimiter ?? ",";
  let text = value === null || value === undefined ? "" : String(value);
  // Only text can carry a formula: a number's own minus sign is arithmetic the
  // spreadsheet should keep, so `-5` must not come back as `'-5`.
  if (
    typeof value === "string" &&
    opts.escapeFormulas !== false &&
    text.length > 0 &&
    FORMULA_LEADERS.has(text[0]!)
  ) {
    text = `'${text}`;
  }
  const needsQuotes =
    text.includes(delimiter) || text.includes('"') || text.includes("\n") || text.includes("\r");
  return needsQuotes ? `"${text.replaceAll('"', '""')}"` : text;
}

/**
 * Serialise a header row + data rows to an RFC 4180 CSV string (`\r\n` row
 * separators, quoted fields where required, optional UTF-8 BOM).
 *
 * Pure — no DOM, no framework. See {@link csvCell} for the per-field rules.
 */
export function toCsv(
  header: readonly string[],
  rows: readonly (readonly ExportScalar[])[],
  opts: CsvOptions = {},
): string {
  const delimiter = opts.delimiter ?? ",";
  const lines: string[] = [header.map((h) => csvCell(h, opts)).join(delimiter)];
  for (const row of rows) lines.push(row.map((v) => csvCell(v, opts)).join(delimiter));
  const body = lines.join(CRLF) + CRLF;
  return opts.bom ? `﻿${body}` : body;
}
