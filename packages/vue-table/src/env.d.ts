declare interface AtscriptMetadata {}
declare type AtscriptPrimitiveTags = string;

declare module "*.vue" {
  import type { DefineComponent } from "vue";
  const component: DefineComponent;
  export default component;
}
