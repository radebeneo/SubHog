import { icons } from "@/config/icons";
import type { SubscriptionDto } from "@subhog/contracts";

const frequencyLabels: Record<SubscriptionDto["frequency"], string> = {
  daily: "Daily",
  weekly: "Weekly",
  monthly: "Monthly",
  yearly: "Yearly",
};

export function toDisplaySubscription(dto: SubscriptionDto): Subscription {
  return {
    id: dto._id,
    icon: icons.wallet,
    name: dto.name,
    category: dto.category,
    paymentMethod: dto.paymentMethod,
    status: dto.status,
    startDate: dto.startDate,
    price: dto.price,
    currency: dto.currency,
    frequency: dto.frequency,
    billing: frequencyLabels[dto.frequency],
    renewalDate: dto.renewalDate,
  };
}
