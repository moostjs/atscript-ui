import { defineBeforeInterceptor, TInterceptorPriority } from "moost";

export const latencyInterceptor = defineBeforeInterceptor(async () => {
  const delay = 1000 + Math.random() * 1000;
  await new Promise((resolve) => setTimeout(resolve, delay));
}, TInterceptorPriority.BEFORE_ALL);
