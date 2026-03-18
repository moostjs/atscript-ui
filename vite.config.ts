import { defineConfig } from "vite-plus";

export default defineConfig({
  staged: {
    "*": "vp check --fix",
  },
  lint: {
    categories: {
      correctness: "error",
      suspicious: "warn",
      perf: "warn",
      style: "off",
      pedantic: "off",
      restriction: "off",
      nursery: "off",
    },
    options: { typeAware: true, typeCheck: true },
    rules: {
      "no-unsafe-type-assertion": "off",
      "no-await-in-loop": "off",
      "no-new": "off",
      "no-unnecessary-type-assertion": "off",
      "no-misused-spread": "off",
      "no-shadow": "off",
    },
  },
});
