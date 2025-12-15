/**
 * Category normalization and article processing based on the provided script logic
 */

/**
 * Normalize article code for grouping purposes - extract clean article with strict rules
 * Based on normalizeArticleVisual_STRICT_ from the script
 * This is used for ABC/XYZ grouping, NOT for display
 */
export function normalizeArticleStrict(rawValue: string | null | undefined): string {
  if (!rawValue) return '';
  
  let s = String(rawValue).trim();
  // Remove all whitespace and unify dashes
  s = s.replace(/\s+/g, '').replace(/[–—\-]+/g, '-');
  
  if (!s) return '';
  
  // For grouping: extract base article (first numeric part)
  // Example: "10001А" -> "10001", "10001Аа" -> "10001"
  const match = s.match(/^(\d+)/);
  if (match) {
    return match[1];
  }
  
  return s;
}

/**
 * Clean article for display - keeps original but trims and normalizes whitespace
 */
export function cleanArticleForDisplay(rawValue: string | null | undefined): string {
  if (!rawValue) return '';
  return String(rawValue).trim().replace(/\s+/g, ' ');
}

/**
 * Extract product group from article code
 * Based on groupFromArticle_ from the script - uses first 4-5 digits
 */
export function extractGroupFromArticle(rawArticle: string): string {
  const s = String(rawArticle || '').trim();
  
  // Extract first numeric sequence
  const match = s.match(/^(\d+)/);
  if (!match) return 'другая';
  
  const numStr = match[1];
  
  // First digit determines main group
  const firstDigit = numStr[0];
  
  switch (firstDigit) {
    case '1': return 'мужская';
    case '2': return 'детская';
    case '3': return 'женская';
    case '4': return 'ясельная';
    case '5': return 'другая';
    default: return 'другая';
  }
}

/**
 * Extract group code (first 4 digits) for ABC analysis
 */
export function extractGroupCode(rawArticle: string): string {
  const s = String(rawArticle || '').trim();
  const match = s.match(/^(\d{4,5})/);
  if (match) {
    return match[1].substring(0, 4); // First 4 digits
  }
  return s.substring(0, 4);
}

/**
 * Normalize category from "Номенклатура.Группа" column
 * Based on normalizeCategorySmart_ from the script
 */
export function normalizeCategorySmart(src: string | null | undefined): string {
  const s = String(src || '').trim().toLowerCase();
  
  if (!s) return 'Без категории';
  
  if (/футболк/.test(s)) return 'Футболки';
  if (/лонгслив/.test(s)) return 'Лонгсливы';
  if (/майк|борцовк|топ(?!пор)/.test(s)) return 'Майки/Топы';
  if (/тельняш/.test(s)) return 'Тельняшки';
  if (/джемпер|водолазк|свитер/.test(s)) return 'Джемперы/Водолазки';
  if (/толстовк|свитшот|hood/.test(s)) return 'Толстовки';
  if (/брюк|кальсон|лосин|велосипедк|капри|бридж|трико/.test(s)) return 'Брюки/Низ';
  if (/шорт|шоты/.test(s)) return 'Шорты';
  if (/пижам|спальн.*комплект/.test(s)) return 'Пижамы';
  if (/сорочк(?!ая)/.test(s)) return 'Пижамы/Сорочки';
  if (/халат/.test(s)) return 'Халаты';
  if (/костюм.*домаш/.test(s)) return 'Костюмы домашние';
  if (/костюм.*спорт/.test(s)) return 'Костюмы спортивные';
  if (/костюм/.test(s)) return 'Костюмы';
  if (/белье|нижн|комплект.*бель|боди/.test(s)) return 'Белье';
  if (/плать|сарафан/.test(s)) return 'Платья/Сарафаны';
  if (/юбк/.test(s)) return 'Юбки';
  if (/комбинезон|ползунк|распашонк|кофточк|чепчик|шапочк/.test(s)) return 'Детское (ясельное)';
  if (/другие товары|прочие/.test(s)) return 'Прочее';
  
  // Title case for unrecognized categories
  return titleCaseRu(s);
}

/**
 * Convert string to title case (Russian)
 */
function titleCaseRu(s: string): string {
  if (!s) return '';
  return s.replace(/(^|\s|-)([а-яёa-z])/gi, (m, p1, p2) => p1 + p2.toUpperCase());
}

/**
 * Find column index by possible header names (flexible matching)
 */
export function findColIndexFlexible(headers: string[], variants: string[]): number {
  const lower = headers.map(h => String(h || '').toLowerCase());
  
  // Exact match first
  for (const v of variants) {
    const idx = lower.indexOf(v.toLowerCase());
    if (idx !== -1) return idx;
  }
  
  // Partial match
  for (let i = 0; i < lower.length; i++) {
    if (variants.some(v => lower[i].includes(v.toLowerCase()))) {
      return i;
    }
  }
  
  return -1;
}
