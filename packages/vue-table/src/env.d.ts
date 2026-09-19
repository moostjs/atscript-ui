/** Minimal `process.env` shape — see `utils/dev.ts` for why it is read at all. */
declare const process: { env: { NODE_ENV?: string } };

declare interface AtscriptMetadata {}
declare type AtscriptPrimitiveTags = string;

declare module "*.vue" {
  import type { DefineComponent } from "vue";
  const component: DefineComponent;
  export default component;
}

declare module "*.css" {}
