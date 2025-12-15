/**
 * Category normalization and article processing based on the provided script logic
 */

/**
 * Normalize article code - extract clean article with strict rules
 * Based on normalizeArticleVisual_STRICT_ from the script
 */
export function normalizeArticleStrict(rawValue: string | null | undefined): string {
  if (!rawValue) return '';
  
  let s = String(rawValue).trim();
  // Remove all whitespace and unify dashes
  s = s.replace(/\s+/g, '').replace(/[–—\-]+/g, '-');
  
  if (!s) return '';
  
  // Prefix with М if starts with latin M or doesn't start with М
  if (s[0] === 'M') {
    s = 'М' + s.slice(1);
  } else if (s[0] !== 'М') {
    s = 'М' + s;
  }
  
  // Remove all lowercase letters (both Latin and Cyrillic)
  s = s.replace(/[a-zа-яё]+/g, '');
  
  // Remove trailing dashes/underscores
  s = s.replace(/[-_]+$/, '');
  
  return s;
}

/**
 * Extract product group from normalized article
 * Based on groupFromArticle_ from the script
 */
export function extractGroupFromArticle(rawNormArticle: string): string {
  const s = String(rawNormArticle || '').toUpperCase();
  
  if (/^МП/.test(s)) return 'женская';
  
  const prefix = s.substring(0, 2);
  switch (prefix) {
    case 'М1': return 'мужская';
    case 'М2': return 'детская';
    case 'М3': return 'женская';
    case 'М4': return 'ясельная';
    case 'М5': return 'другая';
    default: return 'другая';
  }
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
