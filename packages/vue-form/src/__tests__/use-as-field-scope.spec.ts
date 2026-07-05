import { beforeAll, describe, expect, it } from "vitest";
import { UI_FORM_FN_HINT, UI_FORM_HINT, type FormDef, type FormFieldDef } from "@atscript/ui";
import { installDynamicResolver } from "@atscript/ui-fns";
import { computed, defineComponent, h, nextTick, provide } from "vue";
import { PATH_PREFIX_KEY } from "../composables/internal-keys";
import { useAsFieldScope, type UseAsFieldScopeReturn } from "../composables/use-as-field-scope";
import { ContainerForm } from "./fixtures/container-renderer.as";
import { mountFormWithProbe } from "./helpers";

beforeAll(() => {
  installDynamicResolver();
});

function field(def: FormDef, path: string): FormFieldDef {
  const f = def.fields.find((x) => x.path === path);
  if (!f) throw new Error(`field ${path} not found`);
  return f;
}

/**
 * Mount a probe calling `useAsFieldScope` inside the form. When `pathPrefix`
 * is given, an intermediate provider seeds `PATH_PREFIX_KEY` (mirroring what a
 * nested structured AsField does) so `absolutePath` joins under it.
 */
function mountScope(pathPrefix?: string, initialValue?: unknown) {
  const out: { scope?: UseAsFieldScopeReturn } = {};
  const Probe = defineComponent({
    setup() {
      out.scope = useAsFieldScope();
      return () => h("div");
    },
  });
  const slot = () => {
    if (pathPrefix === undefined) return h(Probe);
    const Prefix = defineComponent({
      setup(_, { slots }) {
        provide(
          PATH_PREFIX_KEY,
          computed(() => pathPrefix),
        );
        return () => slots.default?.();
      },
    });
    return h(Prefix, null, { default: () => h(Probe) });
  };
  const { def, formData } = mountFormWithProbe(ContainerForm, slot, { initialValue });
  return { scope: out.scope as UseAsFieldScopeReturn, def, formData };
}

describe("useAsFieldScope – absolutePath", () => {
  it("returns the bare field path at the root prefix", () => {
    const { scope, def } = mountScope();
    expect(scope.absolutePath(field(def, "hinted"))).toBe("hinted");
  });

  it("joins the field path under a nested path prefix", () => {
    const { scope, def } = mountScope("profile");
    expect(scope.absolutePath(field(def, "hinted"))).toBe("profile.hinted");
  });
});

describe("useAsFieldScope – resolveProp", () => {
  it("returns undefined when neither the fn nor the static key is present", () => {
    const { scope, def } = mountScope();
    // `title` carries no hint annotation at all.
    expect(scope.resolveProp(field(def, "title"), UI_FORM_FN_HINT, UI_FORM_HINT)).toBeUndefined();
  });

  it("returns the static value when only the static key is present", () => {
    const { scope, def } = mountScope();
    expect(scope.resolveProp(field(def, "staticHinted"), UI_FORM_FN_HINT, UI_FORM_HINT)).toBe(
      "only static",
    );
  });

  it("resolves the fn against the child's value (`v` read at its absolute path)", () => {
    const { scope, def } = mountScope(undefined, { hinted: "X" });
    // fn hint is `(v) => "v=" + String(v)`.
    expect(scope.resolveProp(field(def, "hinted"), UI_FORM_FN_HINT, UI_FORM_HINT)).toBe("v=X");
  });

  it("is reactive when wrapped in a computed and the field value changes", async () => {
    const { scope, def, formData } = mountScope(undefined, { hinted: "A" });
    const hint = computed(() =>
      scope.resolveProp<string>(field(def, "hinted"), UI_FORM_FN_HINT, UI_FORM_HINT),
    );
    expect(hint.value).toBe("v=A");

    formData.value.hinted = "B";
    await nextTick();
    expect(hint.value).toBe("v=B");
  });
});

describe("useAsFieldScope – scopeFor withEntry", () => {
  it("omits `entry` by default and populates it when `withEntry` is set", () => {
    const { scope, def } = mountScope();
    const f = field(def, "hinted");
    expect(scope.scopeFor(f).entry).toBeUndefined();
    expect(scope.scopeFor(f, { withEntry: true }).entry).toBeDefined();
  });
});
