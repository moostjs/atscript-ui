// Three sequential input rounds, each with its own form. `@wf.context.pass`
// on each form schema exposes `step` (and prior answers) so the form title
// can reference them and the client can render a step indicator.
import { Controller } from "moost";
import { Workflow, Step, WorkflowSchema, WorkflowParam } from "@moostjs/event-wf";
import { finishWfWithData } from "@atscript/moost-wf";
import {
  MultiStepNameForm,
  MultiStepColorForm,
  MultiStepConfirmForm,
} from "../forms/multi-step-forms.as";
import { httpInputRequired } from "../wf-helpers";

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

  @Step("wfd-multi-name")
  askName(
    @WorkflowParam("input") input: { name?: string } | undefined,
    @WorkflowParam("context") ctx: Ctx,
  ) {
    ctx.step = 1;
    if (!input || !input.name) {
      return httpInputRequired(MultiStepNameForm, ctx);
    }
    ctx.name = input.name;
    return;
  }

  @Step("wfd-multi-color")
  askColor(
    @WorkflowParam("input") input: { color?: string } | undefined,
    @WorkflowParam("context") ctx: Ctx,
  ) {
    ctx.step = 2;
    if (!input || !input.color) {
      return httpInputRequired(MultiStepColorForm, ctx);
    }
    ctx.color = input.color;
    return;
  }

  @Step("wfd-multi-confirm")
  confirm(
    @WorkflowParam("input") input: { confirm?: boolean } | undefined,
    @WorkflowParam("context") ctx: Ctx,
  ) {
    ctx.step = 3;
    if (!input || !input.confirm) {
      return httpInputRequired(MultiStepConfirmForm, ctx);
    }
    finishWfWithData(
      { name: ctx.name, color: ctx.color },
      { level: "success", text: "All three steps complete." },
    );
    return;
  }
}
