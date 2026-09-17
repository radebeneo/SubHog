import type { ImageSourcePropType } from "react-native";

import { icons } from "@/constants/icons";

const ICONIFY_SEARCH_URL = "https://api.iconify.design/search";
const ICONIFY_API_URL = "https://api.iconify.design";

interface IconifySearchResponse {
  icons?: string[];
}

const normalize = (value: string) =>
  value.toLowerCase().replace(/[^a-z0-9]/g, "");

const iconUri = (iconName: string) => {
  const [prefix, name] = iconName.split(":");
  return `${ICONIFY_API_URL}/${encodeURIComponent(prefix)}/${encodeURIComponent(name)}.svg`;
};

export const findSubscriptionIcon = async (
  subscriptionName: string,
): Promise<ImageSourcePropType> => {
  const name = subscriptionName.trim();
  if (!name) return icons.wallet;

  try {
    const response = await fetch(
      `${ICONIFY_SEARCH_URL}?query=${encodeURIComponent(name)}&limit=30`,
    );
    if (!response.ok) return icons.wallet;

    const data = (await response.json()) as IconifySearchResponse;
    const results = data.icons ?? [];
    const normalizedName = normalize(name);
    const matchingIcons = results.filter((result) => result.includes(":"));
    const exactMatch = matchingIcons.find(
      (result) => normalize(result.split(":")[1]) === normalizedName,
    );
    const simpleIconMatch = matchingIcons.find((result) =>
      result.startsWith("simple-icons:"),
    );
    const selectedIcon = exactMatch ?? simpleIconMatch ?? matchingIcons[0];

    return selectedIcon ? { uri: iconUri(selectedIcon) } : icons.wallet;
  } catch {
    return icons.wallet;
  }
};
