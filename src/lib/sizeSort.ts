/**
 * Natural size sorting utility.
 * Handles numeric sizes (40, 42, 44), text sizes (XS, S, M, L, XL, XXL),
 * and mixed formats (e.g. "42-44", "M/L").
 */

const TEXT_SIZE_ORDER: Record<string, number> = {
  'xxs': 1, 'xs': 2, 's': 3, 'm': 4, 'l': 5, 'xl': 6,
  'xxl': 7, '2xl': 7, 'xxxl': 8, '3xl': 8, '4xl': 9, '5xl': 10,
};

/**
 * Parse a size string into a numeric value for comparison.
 * Returns a number that can be used for ascending sort.
 */
export function parseSizeValue(size: string | null | undefined): number {
  if (!size) return 99999;
  
  const s = size.trim().toLowerCase();
  
  // Check text sizes first
  if (TEXT_SIZE_ORDER[s] !== undefined) {
    return TEXT_SIZE_ORDER[s];
  }
  
  // Try parsing as number (handles "42", "128", etc.)
  const num = parseFloat(s);
  if (!isNaN(num)) return num;
  
  // Handle range like "42-44" — use the first number
  const rangeMatch = s.match(/^(\d+)/);
  if (rangeMatch) return parseFloat(rangeMatch[1]);
  
  // Fallback: sort alphabetically at the end
  return 99998;
}

/**
 * Compare two size strings for ascending sort (smallest first).
 */
export function compareSizesAsc(a: string | null | undefined, b: string | null | undefined): number {
  return parseSizeValue(a) - parseSizeValue(b);
}
