import { Resend, vEmailId } from "@convex-dev/resend";
import { components } from "./_generated/api";
import { env, internalMutation } from "./_generated/server";

// Keep real recipients disabled until delivery is deliberately configured.
export const resend: Resend = new Resend(components.resend, {
  apiKey: env.RESEND_API_KEY ?? "",
  webhookSecret: env.RESEND_WEBHOOK_SECRET ?? "",
  testMode: true,
});

// Manually invoked backend test only; this does not schedule renewal reminders.
export const sendTest = internalMutation({
  args: {},
  returns: vEmailId,
  handler: async (ctx) => {
    return await resend.sendEmail(ctx, {
      from: "SubHog <onboarding@resend.dev>",
      to: "delivered@resend.dev",
      subject: "SubHog email setup test",
      text: "This is a SubHog transport test. Renewal reminders are not enabled.",
    });
  },
});
