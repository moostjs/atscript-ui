import { defineBeforeInterceptor, TInterceptorPriority } from "moost";

export const latencyInterceptor = defineBeforeInterceptor(async () => {
  const delay = 300 + Math.random() * 300;
  await new Promise((resolve) => setTimeout(resolve, delay));
}, TInterceptorPriority.BEFORE_ALL);
