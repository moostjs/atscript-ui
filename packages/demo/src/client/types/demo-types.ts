import { createDefaultTypes, type TAsTypeComponents } from "@atscript/vue-form";

export function createDemoTypes(): TAsTypeComponents {
  return { ...createDefaultTypes() };
}
