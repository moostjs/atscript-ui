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
