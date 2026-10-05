import SubscriptionIcon from "@/components/SubscriptionIcon";
import {
  formatCurrency,
  formatRenewalDueLabel,
} from "@/features/subscriptions/utils";
import { Pressable, Text, View } from "react-native";

const UpcomingSubscriptionCard = ({
  name,
  price,
  daysLeft,
  icon,
  currency,
  onPress,
}: UpcomingSubscriptionCardProps) => {
  return (
    <Pressable
      className="upcoming-card"
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`View ${name} subscription`}
    >
      <View className="upcoming-row">
        <SubscriptionIcon source={icon} size={56} className="upcoming-icon" />
        <View>
          <Text className="upcoming-price">
            {formatCurrency(price, currency)}
          </Text>
          <Text className="upcoming-meta" numberOfLines={1}>
            {formatRenewalDueLabel(daysLeft)}
          </Text>
        </View>
      </View>

      <Text className="upcoming-name" numberOfLines={1}>
        {name}
      </Text>
    </Pressable>
  );
};

export default UpcomingSubscriptionCard;
