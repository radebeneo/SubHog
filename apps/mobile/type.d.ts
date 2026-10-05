import type { ImageSourcePropType } from "react-native";

declare global {
  interface AppTab {
    name: string;
    title: string;
    icon: ImageSourcePropType;
  }

  interface TabIconProps {
    focused: boolean;
    icon: ImageSourcePropType;
  }

  interface Subscription {
    id: string;
    icon: ImageSourcePropType;
    name: string;
    plan?: string;
    category?: string;
    paymentMethod?: string;
    status?: string;
    startDate?: string;
    price: number;
    currency?: string;
    frequency?: "daily" | "weekly" | "monthly" | "yearly";
    billing: string;
    renewalDate?: string | null;
    color?: string;
  }

  interface SubscriptionCardProps extends Omit<Subscription, "id"> {
    expanded?: boolean;
    onPress: () => void;
    onCancelPress?: () => void;
    isCancelling?: boolean;
  }

  interface UpcomingSubscription {
    id: string;
    icon: ImageSourcePropType;
    name: string;
    price: number;
    currency?: string;
    daysLeft: number;
  }

  interface UpcomingSubscriptionCardProps extends Omit<
    UpcomingSubscription,
    "id"
  > {
    onPress: () => void;
  }

  interface ListHeadingProps {
    title: string;
    onPress?: () => void;
    actionLabel?: string;
  }
}

export { };

