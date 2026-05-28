// AsQrCode + AsCopy (from @atscript/vue-aooth) render server-supplied values
// (a TOTP otpauth URI and a magic-link URL). The schema declares both fields
// as `ui.paragraph` (phantom — no roundtrip), with `@ui.form.fn.value` reading
// from the workflow context. `@wf.context.pass` ships ctx.totpUri / ctx.magicLink
// to the client; the form library resolves the phantom values from there.
import { randomBytes } from "node:crypto";
import { Controller } from "moost";
import { Workflow, Step, WorkflowSchema, WorkflowParam } from "@moostjs/event-wf";
import { useAtscriptWf, finishWf } from "@atscript/moost-wf";
import { QrCopyDemoForm } from "../forms/qr-copy-demo-form.as";

interface Ctx {
  totpUri?: string;
  magicLink?: string;
  confirmed?: boolean;
}

function base32(buf: Buffer): string {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  let bits = 0;
  let value = 0;
  let out = "";
  for (const byte of buf) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += alphabet[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += alphabet[(value << (5 - bits)) & 31];
  return out;
}

@Controller()
export class WfQrAndCopyDemoWorkflow {
  @Workflow("wf-demo/qr-and-copy")
  @WorkflowSchema<Ctx>([{ id: "wfd-qr-generate" }, { id: "wfd-qr-confirm" }])
  flow() {}

  // Seed ctx the first time through; on resume (form-submit) values stay set
  // because ctx is persisted by the state strategy.
  @Step("wfd-qr-generate")
  generate(@WorkflowParam("context") ctx: Ctx) {
    if (!ctx.totpUri) {
      const secret = base32(randomBytes(20));
      const issuer = "atscript-ui demo";
      const account = "demo@example.com";
      ctx.totpUri =
        `otpauth://totp/${encodeURIComponent(`${issuer}:${account}`)}` +
        `?secret=${secret}&issuer=${encodeURIComponent(issuer)}` +
        `&algorithm=SHA1&digits=6&period=30`;
      const token = randomBytes(16).toString("hex");
      ctx.magicLink = `https://example.com/invite/${token}`;
    }
    return;
  }

  @Step("wfd-qr-confirm")
  confirm(@WorkflowParam("context") ctx: Ctx) {
    // Pause once on the QR/copy form; the user submits to advance.
    if (!ctx.confirmed) {
      const wf = useAtscriptWf(QrCopyDemoForm);
      // resolveInput throws StepRetriableError when input is missing; on the
      // second pass (after submit) it returns the echoed values and we finish.
      wf.resolveInput();
      ctx.confirmed = true;
    }
    finishWf({
      message: {
        level: "success",
        text: "Done — in a real flow this would activate the device & send the invite.",
      },
    });
    return;
  }
}
