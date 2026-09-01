/**
 * Formats a given value as a currency string.
 * Defaults to South African Rand (ZAR) formatting.
 *
 * @param value - The numerical or string value to format.
 * @param currency - The currency code to use (default: "ZAR").
 * @returns The formatted currency string.
 */
export const formatCurrency = (value: number | string, currency: string = "ZAR"): string => {
  try {
    const numericValue = typeof value === "string" ? parseFloat(value) : value;

    if (isNaN(numericValue)) {
      throw new Error("Invalid number provided");
    }

    return new Intl.NumberFormat("en-ZA", {
      style: "currency",
      currency: currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(numericValue);
  } catch (error) {
    // Fallback in case of an error (e.g., unsupported currency code or invalid number)
    let safeValue = 0;
    if (typeof value === "number" && !isNaN(value)) {
      safeValue = value;
    } else if (typeof value === "string") {
      const parsed = parseFloat(value);
      if (!isNaN(parsed)) {
        safeValue = parsed;
      }
    }
    
    const prefix = currency === "ZAR" ? "R" : `${currency} `;
    return `${prefix}${safeValue.toFixed(2)}`;
  }
};
