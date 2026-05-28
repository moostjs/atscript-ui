import { Moost, createProvideRegistry } from "moost";
import { MoostHttp } from "@moostjs/event-http";
import { MoostWf } from "@moostjs/event-wf";
import { MoostArbac, ArbacUserProvider } from "@moostjs/arbac";
import { validatorPipe } from "@atscript/moost-validator";
// Use moost-db's `validationErrorTransform` (BEFORE_ALL priority) instead of
// moost-validator's (CATCH_ERROR). The BEFORE_ALL variant registers its
// `error` callback FIRST in the interceptor stack, so it fires for
// `ValidatorError`s thrown by higher-priority `before` interceptors too —
// notably moost-db's action-gate at AFTER_GUARD which throws on bad-shape
// `ids` payloads. moost-validator's CATCH_ERROR variant only catches
// pipe-stage throws (after all `before`s have registered their callbacks).
// Same `transformValidationError` body in both packages — just different
// priority. See atscript-db SECURITY_REPORT.md finding 3c.
import { validationErrorTransform } from "@atscript/moost-db";
import { AuthController, MeController } from "./controllers/auth.controller";
import { UsersController } from "./controllers/users.controller";
import { RolesController } from "./controllers/roles.controller";
import { CategoriesController } from "./controllers/categories.controller";
import { ProductsController } from "./controllers/products.controller";
import { CustomersController } from "./controllers/customers.controller";
import { OrdersController } from "./controllers/orders.controller";
import { AuditLogController } from "./controllers/audit-log.controller";
import { WfStatesController } from "./controllers/wf-states.controller";
import { PresetsController } from "./controllers/presets.controller";
import { TestController } from "./controllers/test.controller";
import { WorkflowsController } from "./controllers/workflows.controller";
import { LoginWorkflow } from "./workflows/auth/login.workflow";
import { RegisterWorkflow } from "./workflows/auth/register.workflow";
import { ChangePasswordWorkflow } from "./workflows/security/change-password.workflow";
import { EditProfileWorkflow } from "./workflows/profile/edit.workflow";
import { InviteWorkflow } from "./workflows/users/invite.workflow";
import { WfFinishImmediateDemoWorkflow } from "./workflows/wf-demo/finish-immediate.workflow";
import { WfFinishAutoDemoWorkflow } from "./workflows/wf-demo/finish-auto.workflow";
import { WfFinishManualDemoWorkflow } from "./workflows/wf-demo/finish-manual.workflow";
import { WfFinishDataDemoWorkflow } from "./workflows/wf-demo/finish-data.workflow";
import { WfFinishMessageDemoWorkflow } from "./workflows/wf-demo/finish-message.workflow";
import { WfFinishAbortedDemoWorkflow } from "./workflows/wf-demo/finish-aborted.workflow";
import { WfMultiStepDemoWorkflow } from "./workflows/wf-demo/multi-step.workflow";
import { WfValidationErrorsDemoWorkflow } from "./workflows/wf-demo/validation-errors.workflow";
import { WfOutletPauseDemoWorkflow } from "./workflows/wf-demo/outlet-pause.workflow";
import { WfQrAndCopyDemoWorkflow } from "./workflows/wf-demo/qr-and-copy.workflow";
import { DemoArbacUserProvider } from "./auth/arbac-user.provider";
import { registerDemoRoles } from "./auth/arbac-policy";
import { auditInterceptor } from "./auth/audit";
import { latencyInterceptor } from "./interceptors/latency";
import type { DemoScope, DemoUserAttrs } from "./auth/arbac-scope";

const arbac = new MoostArbac<DemoUserAttrs, DemoScope>();
registerDemoRoles(arbac);

const app = new Moost({ globalPrefix: "api" });
app.setProvideRegistry(
  createProvideRegistry(
    [MoostArbac, () => arbac],
    [ArbacUserProvider, () => new DemoArbacUserProvider()],
  ),
);
const PORT = Number(process.env.PORT ?? 3200);
void app.adapter(new MoostHttp()).listen(PORT);
app.adapter(new MoostWf());
// `validationErrorTransform()` (CATCH_ERROR priority) catches ValidatorError
// throws from the global `validatorPipe()` during arg-resolve — controller-
// level `@UseValidationErrorTransform()` only catches errors thrown FROM
// controller method bodies, not from pipe-stage validation. Without this
// global registration, pipe-stage validation throws bubble as HTTP 500.
app.applyGlobalInterceptors(validationErrorTransform(), auditInterceptor, latencyInterceptor);
// Validate `@InputForm` payloads (and any other params stamped with an
// atscript-type meta marker via `@atscript/moost-db`'s typed mate getter)
// against their compiled .as schemas.
app.applyGlobalPipes(validatorPipe());
app.registerControllers(
  AuthController,
  MeController,
  WorkflowsController,
  LoginWorkflow,
  RegisterWorkflow,
  ChangePasswordWorkflow,
  EditProfileWorkflow,
  InviteWorkflow,
  WfFinishImmediateDemoWorkflow,
  WfFinishAutoDemoWorkflow,
  WfFinishManualDemoWorkflow,
  WfFinishDataDemoWorkflow,
  WfFinishMessageDemoWorkflow,
  WfFinishAbortedDemoWorkflow,
  WfMultiStepDemoWorkflow,
  WfValidationErrorsDemoWorkflow,
  WfOutletPauseDemoWorkflow,
  WfQrAndCopyDemoWorkflow,
  UsersController,
  RolesController,
  CategoriesController,
  ProductsController,
  CustomersController,
  OrdersController,
  AuditLogController,
  WfStatesController,
  PresetsController,
);
// Test-only controller (`POST /api/_test/reset-seed`) — only registered when
// `DEMO_TEST_MODE=1`. Set by `tests/e2e/global-setup.ts` so the e2e
// `resetSeed()` helper can wipe + reseed the demo db on the live connection
// without unlinking the file underneath the dev server (which would flip
// better-sqlite3 to read-only mid-flight). Never wire this in production.
if (process.env.DEMO_TEST_MODE === "1") {
  app.registerControllers(TestController);
}
void app.init();
