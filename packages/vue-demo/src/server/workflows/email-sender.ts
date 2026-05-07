/**
 * Console email sender used by `createEmailOutlet`.
 * Logs the template name, target, passed context (OTP codes, etc.)
 * and a magic-link for flows that resume via URL.
 */
export function consoleEmailSender(payload: {
  target: string;
  template: string;
  context: Record<string, unknown>;
  token: string;
}): Promise<void> {
  const baseUrl = process.env.DEMO_BASE_URL ?? `http://localhost:${process.env.PORT ?? 3200}`;
  const link =
    payload.template === "user-invite"
      ? `${baseUrl}/invite/${encodeURIComponent(payload.token)}`
      : `${baseUrl}/wf/resume?wfs=${encodeURIComponent(payload.token)}`;
  // eslint-disable-next-line no-console
  console.log(
    `\n📧 [${payload.template}] → ${payload.target}\n` +
      `    context: ${JSON.stringify(payload.context)}\n` +
      `    link:    ${link}\n`,
  );
  return Promise.resolve();
}
