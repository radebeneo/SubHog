import type { ImageSourcePropType } from "react-native";

import { icons } from "@/constants/icons";

const ICONIFY_SEARCH_URL = "https://api.iconify.design/search";
const ICONIFY_API_URL = "https://api.iconify.design";

interface IconifySearchResponse {
  icons?: string[];
}

interface IconCandidates {
  exactMatch?: string;
  simpleIconMatch?: string;
  firstResult?: string;
}

const normalize = (value: string) =>
  value.toLowerCase().replace(/[^a-z0-9]/g, "");

const iconUri = (iconName: string) => {
  const [prefix, name] = iconName.split(":");
  return `${ICONIFY_API_URL}/${encodeURIComponent(prefix)}/${encodeURIComponent(name)}.svg`;
};

const searchIconify = async (query: string): Promise<IconCandidates> => {
  const response = await fetch(
    `${ICONIFY_SEARCH_URL}?query=${encodeURIComponent(query)}&limit=30`,
  );
  if (!response.ok) return {};

  const data = (await response.json()) as IconifySearchResponse;
  const results = data.icons ?? [];
  const normalizedQuery = normalize(query);
  const matchingIcons = results.filter((result) => result.includes(":"));

  return {
    exactMatch: matchingIcons.find(
      (result) => normalize(result.split(":")[1]) === normalizedQuery,
    ),
    simpleIconMatch: matchingIcons.find((result) =>
      result.startsWith("simple-icons:"),
    ),
    firstResult: matchingIcons[0],
  };
};

// "Confident" = either the icon's own name matches exactly, or it's a
// simple-icons brand logo. Both are safe to trust without a fallback.
const confidentMatch = (candidates: IconCandidates) =>
  candidates.exactMatch ?? candidates.simpleIconMatch;

export const findSubscriptionIcon = async (
  subscriptionName: string,
): Promise<ImageSourcePropType> => {
  const name = subscriptionName.trim();
  if (!name) return icons.wallet;

  try {
    const fullNameCandidates = await searchIconify(name);
    let selectedIcon = confidentMatch(fullNameCandidates);

    // Subscription names often tack on a plan/tier word ("Pro", "Plus",
    // "Premium", "Family", "One", "Ads", "Cloud"...) that pollutes
    // Iconify's fuzzy search and buries the real brand icon. If the full
    // name didn't produce a confident hit, retry with just the first
    // word — almost always the brand itself: "Canva Pro" -> "Canva",
    // "Uber One" -> "Uber", "Youtube Premium" -> "Youtube".
    const firstWord = name.split(/\s+/)[0];
    let firstWordCandidates: IconCandidates = {};
    if (!selectedIcon && firstWord !== name) {
      firstWordCandidates = await searchIconify(firstWord);
      selectedIcon = confidentMatch(firstWordCandidates);
    }

    // Last resort: whichever raw top result we found, full name first.
    selectedIcon ??=
      fullNameCandidates.firstResult ?? firstWordCandidates.firstResult;

    return selectedIcon ? { uri: iconUri(selectedIcon) } : icons.wallet;
  } catch {
    return icons.wallet;
  }
};
