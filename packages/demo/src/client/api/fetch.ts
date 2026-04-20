// P4 stub — P8 replaces with full 401/403/410/500 error mapping.
export const sharedFetch: typeof fetch = (input, init = {}) =>
  fetch(input, { ...init, credentials: "include" });
