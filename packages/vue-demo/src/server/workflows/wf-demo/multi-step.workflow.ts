// Three sequential input rounds, each with its own form. `@wf.context.pass`
// on each form schema exposes `step` (and prior answers) so the form title
// can reference them and the client can render a step indicator.
import { Controller } from "moost";
import { Workflow, Step, WorkflowSchema, WorkflowParam } from "@moostjs/event-wf";
import { finishWf, useAtscriptWf } from "@atscript/moost-wf";
import {
  MultiStepNameForm,
  MultiStepColorForm,
  MultiStepConfirmForm,
} from "../forms/multi-step-forms.as";

interface Ctx {
  step?: number;
  name?: string;
  color?: string;
}

@Controller()
export class WfMultiStepDemoWorkflow {
  @Workflow("wf-demo/multi-step")
  @WorkflowSchema<Ctx>([
    { id: "wfd-multi-name" },
    { id: "wfd-multi-color" },
    { id: "wfd-multi-confirm" },
  ])
  flow() {}

  // Each step seeds its `step` index into ctx BEFORE validating input so the
  // first-entry `requireInput` response carries the `@wf.context.pass`-exposed
  // value used by the form title and the multi-step indicator. @WfInput throws
  // before the body runs, so we resolve manually here.
  @Step("wfd-multi-name")
  askName(@WorkflowParam("context") ctx: Ctx) {
    ctx.step = 1;
    ctx.name = useAtscriptWf(MultiStepNameForm).resolveInput().name;
    return;
  }

  @Step("wfd-multi-color")
  askColor(@WorkflowParam("context") ctx: Ctx) {
    ctx.step = 2;
    ctx.color = useAtscriptWf(MultiStepColorForm).resolveInput().color;
    return;
  }

  @Step("wfd-multi-confirm")
  confirm(@WorkflowParam("context") ctx: Ctx) {
    ctx.step = 3;
    const wf = useAtscriptWf(MultiStepConfirmForm);
    const input = wf.resolveInput();
    // @meta.required covers presence, but `false` is still a valid boolean;
    // require an explicit tick to advance.
    if (!input.confirm) throw wf.requireInput();
    finishWf({
      data: { name: ctx.name, color: ctx.color },
      message: { level: "success", text: "All three steps complete." },
    });
    return;
  }
}
