export const SUBSCRIPTION_CATEGORIES = [
  "Entertainment",
  "Gaming",
  "AI Tools",
  "Developer Tools",
  "Design",
  "Productivity",
  "Cloud",
  "Music",
  "Other",
] as const;

// The existing Create form's palette; persisted once so edits retain the color.
export const SUBSCRIPTION_CATEGORY_COLORS = {
  Entertainment: "#f5c542",
  Gaming: "#f2cc8f",
  "AI Tools": "#b8d4e3",
  "Developer Tools": "#e8def8",
  Design: "#b8e8d0",
  Productivity: "#f4c7ab",
  Cloud: "#c7d9f5",
  Music: "#f0c4d8",
  Other: "#d8d4c8",
} as const;

export const SUBSCRIPTION_LIMITS = {
  minAmountCents: 1,
  maxAmountCents: 9_999_999,
  name: 80,
  plan: 80,
  paymentMethod: 80,
  reminderEmail: 254,
} as const;
