import type { ImageSourcePropType } from "react-native";
import { Image } from "react-native";
import { SvgUri } from "react-native-svg";

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

  if (uri?.endsWith(".svg")) {
    return <SvgUri uri={uri} width={size} height={size} />;
  }

  return <Image source={source} className={className} />;
};

export default SubscriptionIcon;
