import SubscriptionIcon from "@/components/SubscriptionIcon";
import { formatRenewalCountdown } from "@/lib/subscription-summary";
import { formatCurrency } from "@/lib/utils";
import { Text, View } from "react-native";

const UpcomingSubscriptionCard = ({
  name,
  price,
  daysLeft,
  icon,
  currency,
}: UpcomingSubscription) => {
  return (
    <View className="upcoming-card upcoming-card--dynamic">
      <View className="upcoming-row">
        <SubscriptionIcon source={icon} size={56} className="upcoming-icon" />
        <View className="upcoming-card__copy">
          <Text className="upcoming-price" numberOfLines={1} adjustsFontSizeToFit>
            {formatCurrency(price, currency)}
          </Text>
          <Text className="upcoming-meta" numberOfLines={1}>
            {formatRenewalCountdown(daysLeft)}
          </Text>
        </View>
      </View>

      <Text className="upcoming-name" numberOfLines={1}>
        {name}
      </Text>
    </View>
  );
};

export default UpcomingSubscriptionCard;
