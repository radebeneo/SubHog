import { SUBSCRIPTION_CATEGORIES, SUBSCRIPTION_LIMITS } from "../constants/subscriptions";
import type {
  SubscriptionCategory,
  SubscriptionFields,
  SubscriptionFieldsInput,
  SubscriptionIcon,
  SubscriptionValidationResult,
} from "../types/subscription-record";

const amountMessage = "Enter an amount from R0.01 to R99,999.99 with at most two decimal places.";

export function isValidAmountCents(value: number): boolean {
  return Number.isSafeInteger(value)
    && value >= SUBSCRIPTION_LIMITS.minAmountCents
    && value <= SUBSCRIPTION_LIMITS.maxAmountCents;
}

// Parse the two decimal components separately; never multiply a floating price.
export function parseZarAmountCents(input: string): SubscriptionValidationResult<number> {
  const match = /^(\d+)(?:\.(\d{1,2}))?$/.exec(input.trim());
  if (!match) return { ok: false, field: "amountCents", message: amountMessage };
  const cents = Number(match[1]) * 100 + Number((match[2] ?? "").padEnd(2, "0"));
  return isValidAmountCents(cents)
    ? { ok: true, value: cents }
    : { ok: false, field: "amountCents", message: amountMessage };
}

export function isCalendarDate(value: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (year < 1 || month < 1 || month > 12) return false;
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const monthDays = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return day >= 1 && day <= monthDays[month - 1];
}

function optionalText(value: string | undefined): string | undefined {
  return value?.trim() || undefined;
}

function isCategory(value: string): value is SubscriptionCategory {
  return SUBSCRIPTION_CATEGORIES.some((category) => category === value);
}

function validEmail(value: string): boolean {
  // Practical mailbox validation, not a deliverability check.
  const parts = value.split("@");
  if (parts.length !== 2) return false;
  const [local, domain] = parts;
  if (!local || local.length > 64 || local.startsWith(".") || local.endsWith(".")
    || local.includes("..") || !/^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+$/.test(local)) {
    return false;
  }
  const labels = domain.split(".");
  return labels.length >= 2 && labels.every(
    (label) => /^[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?$/.test(label),
  );
}

export function validateSubscriptionFields(
  input: SubscriptionFieldsInput,
): SubscriptionValidationResult<SubscriptionFields> {
  const name = input.name.trim();
  if (!name || Array.from(name).length > SUBSCRIPTION_LIMITS.name) {
    return { ok: false, field: "name", message: "Enter a name from 1 to 80 characters." };
  }
  if (!isValidAmountCents(input.amountCents)) {
    return { ok: false, field: "amountCents", message: amountMessage };
  }
  if (input.billingCycle !== "monthly" && input.billingCycle !== "yearly") {
    return { ok: false, field: "billingCycle", message: "Choose Monthly or Yearly." };
  }

  const plan = optionalText(input.plan);
  const paymentMethod = optionalText(input.paymentMethod);
  const reminderEmail = optionalText(input.reminderEmail);
  for (const [field, text, limit] of [
    ["plan", plan, SUBSCRIPTION_LIMITS.plan],
    ["paymentMethod", paymentMethod, SUBSCRIPTION_LIMITS.paymentMethod],
    ["reminderEmail", reminderEmail, SUBSCRIPTION_LIMITS.reminderEmail],
  ] as const) {
    if (text && Array.from(text).length > limit) {
      return { ok: false, field, message: `Use at most ${limit} characters.` };
    }
  }
  if (reminderEmail && !validEmail(reminderEmail)) {
    return { ok: false, field: "reminderEmail", message: "Enter a valid reminder email." };
  }

  const category = optionalText(input.category);
  if (category !== undefined && !isCategory(category)) {
    return { ok: false, field: "category", message: "Choose one of the available categories." };
  }
  const startDate = input.startDate.trim();
  const renewalDate = optionalText(input.renewalDate);
  if (!isCalendarDate(startDate)) {
    return { ok: false, field: "startDate", message: "Enter a valid start date as YYYY-MM-DD." };
  }
  if (renewalDate && (!isCalendarDate(renewalDate) || renewalDate < startDate)) {
    return {
      ok: false,
      field: "renewalDate",
      message: "Enter a valid renewal date on or after the start date as YYYY-MM-DD.",
    };
  }

  return {
    ok: true,
    value: {
      name,
      amountCents: input.amountCents,
      billingCycle: input.billingCycle,
      startDate,
      renewalDate,
      plan,
      category,
      paymentMethod,
      reminderEmail,
    },
  };
}

export function validateSubscriptionIcon(
  icon: SubscriptionIcon | undefined,
): SubscriptionValidationResult<SubscriptionIcon> {
  if (!icon || icon.kind === "wallet") return { ok: true, value: { kind: "wallet" } };
  if (icon.kind === "iconify" && icon.name.length <= 128
    && /^[a-z0-9]+(?:-[a-z0-9]+)*:[a-z0-9]+(?:-[a-z0-9]+)*$/.test(icon.name)) {
    return { ok: true, value: { kind: "iconify", name: icon.name } };
  }
  return { ok: false, field: "icon", message: "Choose a valid subscription icon." };
}
