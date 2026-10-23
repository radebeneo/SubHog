import SubscriptionIcon from "@/components/SubscriptionIcon";
import {
    formatCurrency,
    formatStatusLabel,
    formatSubscriptionDateTime,
} from "@/lib/utils";
import clsx from "clsx";
import { Pressable, Text, View } from "react-native";

const SubscriptionCard = ({
  name,
  price,
  currency,
  icon,
  billing,
  color,
  category,
  plan,
  paymentMethod,
  reminderEmail,
  renewalDate,
  startDate,
  status,
  expanded,
  onPress,
  onEditPress,
  onDeletePress,
}: SubscriptionCardProps) => {
  const fallback = "Not provided";

  return (
    <View
      className={clsx("sub-card", expanded ? "sub-card-expanded" : "bg-card")}
      style={!expanded && color ? { backgroundColor: color } : undefined}
    >
      <Pressable
        className="sub-head"
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={`${expanded ? "Collapse" : "Expand"} ${name} details`}
        accessibilityState={{ expanded }}
      >
        <View className="sub-main">
          <SubscriptionIcon source={icon} size={64} className="sub-icon" />
          <View className="sub-copy">
            <Text numberOfLines={1} className="sub-title">
              {name}
            </Text>
            <Text numberOfLines={1} ellipsizeMode="tail" className="sub-meta">
              {category?.trim() ||
                plan?.trim() ||
                (renewalDate ? formatSubscriptionDateTime(renewalDate) : "")}
            </Text>
          </View>
        </View>
        <View className="sub-price-box">
          <Text className="sub-price">{formatCurrency(price, currency)}</Text>
          <Text className="sub-billing">{billing}</Text>
        </View>
      </Pressable>
      {expanded && (
        <View className="sub-body">
          <View className="sub-details">
            <View className="sub-row">
              <View className="sub-row-copy">
                <Text className="sub-label">Category:</Text>
                <Text
                  className="sub-value"
                  numberOfLines={1}
                  ellipsizeMode="tail"
                >
                  {category?.trim() || plan?.trim() || fallback}
                </Text>
              </View>
            </View>

            <View className="sub-row">
              <View className="sub-row-copy">
                <Text className="sub-label">Started:</Text>
                <Text
                  className="sub-value"
                  numberOfLines={1}
                  ellipsizeMode="tail"
                >
                  {startDate ? formatSubscriptionDateTime(startDate) : fallback}
                </Text>
              </View>
            </View>

            <View className="sub-row">
              <View className="sub-row-copy">
                <Text className="sub-label">Renewal date:</Text>
                <Text
                  className="sub-value"
                  numberOfLines={1}
                  ellipsizeMode="tail"
                >
                  {renewalDate
                    ? formatSubscriptionDateTime(renewalDate)
                    : fallback}
                </Text>
              </View>
            </View>
            <View className="sub-row">
              <View className="sub-row-copy">
                <Text className="sub-label">Status:</Text>
                <Text
                  className="sub-value"
                  numberOfLines={1}
                  ellipsizeMode="tail"
                >
                  {status ? formatStatusLabel(status) : fallback}
                </Text>
              </View>
            </View>
            <View className="sub-row">
              <View className="sub-row-copy">
                <Text className="sub-label">Payment:</Text>
                <Text
                  className="sub-value"
                  numberOfLines={1}
                  ellipsizeMode="tail"
                >
                  {paymentMethod?.trim() || fallback}
                </Text>
              </View>
            </View>
            {plan?.trim() && (
              <View className="sub-row">
                <View className="sub-row-copy">
                  <Text className="sub-label">Plan:</Text>
                  <Text className="sub-value">{plan.trim()}</Text>
                </View>
              </View>
            )}
            <View className="sub-row">
              <View className="sub-row-copy">
                <Text className="sub-label">Reminder email:</Text>
                <Text className="sub-value">
                  {reminderEmail?.trim() || fallback}
                </Text>
              </View>
            </View>
          </View>
          {reminderEmail?.trim() && (
            <Text className="auth-helper">
              Email stored only. Reminders are not sent yet.
            </Text>
          )}
          {(onEditPress || onDeletePress) && (
            <View className="subscription-actions__row">
              {onEditPress && (
                <Pressable
                  className="subscription-actions__edit"
                  accessibilityRole="button"
                  accessibilityLabel={`Edit ${name}`}
                  onPress={onEditPress}
                >
                  <Text className="sub-cancel-text">Edit</Text>
                </Pressable>
              )}
              {onDeletePress && (
                <Pressable
                  className="subscription-actions__delete"
                  accessibilityRole="button"
                  accessibilityLabel={`Delete ${name}`}
                  onPress={onDeletePress}
                >
                  <Text className="subscription-actions__delete-text">Delete</Text>
                </Pressable>
              )}
            </View>
          )}
        </View>
      )}
    </View>
  );
};

export default SubscriptionCard;
