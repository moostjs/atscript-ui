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
  const link = `http://localhost:3200/wf/resume?wfs=${encodeURIComponent(payload.token)}`;
  // eslint-disable-next-line no-console
  console.log(
    `\n📧 [${payload.template}] → ${payload.target}\n` +
      `    context: ${JSON.stringify(payload.context)}\n` +
      `    link:    ${link}\n`,
  );
  return Promise.resolve();
}
