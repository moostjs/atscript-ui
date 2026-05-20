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

  @Step("wfd-multi-name")
  askName(
    @WorkflowParam("input") input: { name?: string } | undefined,
    @WorkflowParam("context") ctx: Ctx,
  ) {
    ctx.step = 1;
    if (!input || !input.name) {
      throw useAtscriptWf(MultiStepNameForm).requireInput();
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
      throw useAtscriptWf(MultiStepColorForm).requireInput();
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
      throw useAtscriptWf(MultiStepConfirmForm).requireInput();
    }
    finishWf({
      data: { name: ctx.name, color: ctx.color },
      message: { level: "success", text: "All three steps complete." },
    });
    return;
  }
}
