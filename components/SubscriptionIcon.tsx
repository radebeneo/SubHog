import { Image as ExpoImage } from "expo-image";
import type { ImageSourcePropType } from "react-native";
import { Image } from "react-native";

interface SubscriptionIconProps {
  source: ImageSourcePropType;
  size: number;
  className: string;
}

const getRemoteUri = (source: ImageSourcePropType) => {
  if (
    typeof source === "object" &&
    source !== null &&
    !Array.isArray(source) &&
    "uri" in source &&
    typeof source.uri === "string"
  ) {
    return source.uri;
  }

  return null;
};

const SubscriptionIcon = ({
  source,
  size,
  className,
}: SubscriptionIconProps) => {
  const uri = getRemoteUri(source);

  if (uri && /\.svg(?:[?#]|$)/i.test(uri)) {
    // Tint the rendered image so embedded fills and gradients also match
    // the black monochrome icons, including previously saved Iconify URLs.
    return (
      <ExpoImage
        source={{ uri }}
        style={{ width: size, height: size }}
        contentFit="contain"
        tintColor="#000000"
      />
    );
  }

  return <Image source={source} className={className} />;
};

export default SubscriptionIcon;
