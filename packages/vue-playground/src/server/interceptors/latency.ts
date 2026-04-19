import { defineBeforeInterceptor, TInterceptorPriority } from "moost";

export const latencyInterceptor = defineBeforeInterceptor(async () => {
  const delay = 3000 + Math.random() * 2000;
  await new Promise((resolve) => setTimeout(resolve, delay));
}, TInterceptorPriority.BEFORE_ALL);
