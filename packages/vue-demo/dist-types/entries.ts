// Every published entry resolves to its built declarations.
import type { FormDef } from "@atscript/ui";
import type { TFnScope } from "@atscript/ui-fns";
import type { TAsTypeComponents } from "@atscript/vue-form";
import type { TAsCellTypeComponents } from "@atscript/vue-table";
import type { WfFormError } from "@atscript/vue-wf";
import type { AsWfStore } from "@atscript/moost-wf/store";
import type { WfStateStore } from "@moostjs/event-wf";

export type Entries = [FormDef, TFnScope, TAsTypeComponents, TAsCellTypeComponents, WfFormError];

// The workflow store implements the engine's own store interface.
export const asEngineStore = (store: AsWfStore): WfStateStore => store;
