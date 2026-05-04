/** Reserved id namespace for synthetic system presets; rejected on write. */
export const SYSTEM_PRESET_PREFIX = "sys:";

/** Deterministic id prefix for `type='userConf'` rows: `uc:${user}:${app}:${tableKey}`. */
export const USER_CONF_PREFIX = "uc:";

/** Deterministic id prefix for `type='appConf'` rows: `ac:${user}:${app}`. */
export const APP_CONF_PREFIX = "ac:";

/** All prefixes the server owns; client-supplied ids starting with any of these are rejected. */
export const RESERVED_ID_PREFIXES = [
  SYSTEM_PRESET_PREFIX,
  USER_CONF_PREFIX,
  APP_CONF_PREFIX,
] as const;

/** Always-materialised system preset id; consumer may override label/content. */
export const STANDARD_PRESET_ID = `${SYSTEM_PRESET_PREFIX}standard` as const;

export function userConfId(user: string, app: string, tableKey: string): string {
  return `${USER_CONF_PREFIX}${user}:${app}:${tableKey}`;
}

export function appConfId(user: string, app: string): string {
  return `${APP_CONF_PREFIX}${user}:${app}`;
}

export function isSystemPresetId(id: string | null | undefined): boolean {
  return typeof id === "string" && id.startsWith(SYSTEM_PRESET_PREFIX);
}

/**
 * Auto-prefix a bare system-preset id (`'monitoring'` → `'sys:monitoring'`).
 * Returns the input unchanged if it already carries the prefix.
 */
export function normaliseSystemPresetId(id: string): string {
  if (id.startsWith(SYSTEM_PRESET_PREFIX)) return id;
  return `${SYSTEM_PRESET_PREFIX}${id}`;
}
