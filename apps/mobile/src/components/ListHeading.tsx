import { Text, TouchableOpacity, View } from "react-native";

const ListHeading = ({
  title,
  onPress,
  actionLabel = "View All",
}: ListHeadingProps) => {
    return (
        <View className="list-head">
            <Text className="list-title">{title}</Text>
            {onPress && (
              <TouchableOpacity
                className="list-action-btn"
                onPress={onPress}
                accessibilityRole="button"
                accessibilityLabel={`${actionLabel} ${title}`}
              >
                <Text className="list-action-text">{actionLabel}</Text>
              </TouchableOpacity>
            )}
        </View>
    );
};

export default ListHeading;
