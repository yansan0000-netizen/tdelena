/**
 * Unified recommendation logic for ABC-XYZ analysis
 * Synced with SQL function analytics_phase4_plans
 */

export type RecommendationPriority = 'critical' | 'high' | 'medium' | 'low' | 'none';
export type RecommendationAction = 'order_urgent' | 'order_regular' | 'order_careful' | 'reduce_stock' | 'discontinue' | 'monitor';

export interface RecommendationDetails {
  days_left: number;
  stock: number;
  velocity_day: number;
  velocity_month: number;
  plan_qty: number;
  abc: string;
  xyz: string;
  cv: number;
  revenue_share: number;
  margin_pct?: number;
  profit_per_unit?: number;
  potential_profit?: number;
  has_econ_data?: boolean;
}

export interface RecommendationResult {
  priority: RecommendationPriority;
  action: RecommendationAction;
  text: string;
  details: RecommendationDetails;
}

export interface ArticleData {
  abc: string;
  xyz: string;
  daysUntilStockout: number;
  currentStock: number;
  avgMonthlyQty: number;
  plan1m: number;
  cv: number;
  revenueShare: number;
  marginPct?: number;
  profitPerUnit?: number;
}

/**
 * Get recommendation priority based on ABC, XYZ, and stockout days
 */
export function getRecommendationPriority(data: ArticleData): RecommendationPriority {
  const { abc, xyz, daysUntilStockout } = data;
  const xyzGroup = xyz || 'Z';

  // Critical: A-class items running out soon
  if (abc === 'A' && (xyzGroup === 'X' || xyzGroup === 'Y') && daysUntilStockout < 14) return 'critical';
  if (abc === 'A' && daysUntilStockout < 7) return 'critical';

  // High: A-class needs attention or B-class running out
  if (abc === 'A' && xyzGroup === 'X' && daysUntilStockout < 30) return 'high';
  if (abc === 'A' && xyzGroup === 'Y' && daysUntilStockout < 21) return 'high';
  if (abc === 'B' && xyzGroup === 'X' && daysUntilStockout < 14) return 'high';

  // Medium: Regular replenishment needed
  if (abc === 'A' && daysUntilStockout < 45) return 'medium';
  if (abc === 'B' && daysUntilStockout < 30) return 'medium';
  if (abc === 'A' && xyzGroup === 'Z') return 'medium';

  // Low: C-class or excess stock
  if (abc === 'C' && daysUntilStockout > 90) return 'low';
  if (abc === 'B' && daysUntilStockout > 60) return 'low';

  return 'none';
}

/**
 * Get recommendation action
 */
export function getRecommendationAction(data: ArticleData): RecommendationAction {
  const { abc, xyz, daysUntilStockout, plan1m } = data;
  const xyzGroup = xyz || 'Z';

  // Urgent order needed
  if (abc === 'A' && daysUntilStockout < 14) return 'order_urgent';
  if (abc === 'B' && xyzGroup === 'X' && daysUntilStockout < 14) return 'order_urgent';

  // Regular order
  if ((abc === 'A' || abc === 'B') && daysUntilStockout < 30) return 'order_regular';
  if (abc === 'A' && xyzGroup === 'Z' && plan1m > 0) return 'order_careful';

  // Reduce stock / discontinue
  if (abc === 'C' && xyzGroup === 'Z' && daysUntilStockout > 180) return 'discontinue';
  if (abc === 'C' && daysUntilStockout > 90) return 'reduce_stock';
  if (abc === 'B' && xyzGroup === 'Z' && daysUntilStockout > 120) return 'reduce_stock';

  return 'monitor';
}

/**
 * Get human-readable recommendation text with specific numbers
 */
export function getRecommendationText(data: ArticleData): string {
  const { abc, xyz, daysUntilStockout, currentStock, plan1m } = data;
  const xyzGroup = xyz || 'Z';

  // Critical urgent orders
  if (abc === 'A' && (xyzGroup === 'X' || xyzGroup === 'Y') && daysUntilStockout < 14) {
    return `Срочный заказ ${plan1m} ед. — остаток на ${daysUntilStockout} дней`;
  }
  if (abc === 'A' && daysUntilStockout < 7) {
    return `КРИТИЧНО: заказать ${plan1m} ед. немедленно`;
  }

  // High priority orders
  if (abc === 'A' && xyzGroup === 'X' && daysUntilStockout < 30) {
    return `Заказать ${plan1m} ед. в течение недели`;
  }
  if (abc === 'A' && xyzGroup === 'Y' && daysUntilStockout < 21) {
    return `Пополнить ${plan1m} ед. — спрос умеренно стабилен`;
  }
  if (abc === 'B' && xyzGroup === 'X' && daysUntilStockout < 14) {
    return `Заказать ${plan1m} ед. — стабильный B-товар`;
  }

  // Medium priority
  if (abc === 'A' && xyzGroup === 'Z' && plan1m > 0) {
    const carefulQty = Math.max(1, Math.round(plan1m * 0.7));
    return `Осторожный заказ ${carefulQty} ед. — нестабильный спрос`;
  }
  if (abc === 'A' && daysUntilStockout < 45) {
    return `Запланировать заказ ${plan1m} ед.`;
  }
  if (abc === 'B' && daysUntilStockout < 30) {
    return `Пополнить ${plan1m} ед.`;
  }

  // Reduce stock / excess
  if (abc === 'C' && xyzGroup === 'Z' && daysUntilStockout > 180) {
    return 'Вывести из ассортимента — низкая доля и нестаб. спрос';
  }
  if (abc === 'C' && daysUntilStockout > 90) {
    const excess = currentStock - plan1m * 2;
    return `Избыток ~${excess > 0 ? excess : currentStock} ед. — распродать со скидкой`;
  }
  if (abc === 'B' && xyzGroup === 'Z' && daysUntilStockout > 120) {
    return 'Оптимизировать остаток — нестабильный спрос';
  }

  // Standard monitoring
  if (abc === 'A') return 'Ключевой товар — контроль остатков';
  if (abc === 'B' && (xyzGroup === 'X' || xyzGroup === 'Y')) return 'Стандартное пополнение';
  if (abc === 'B') return 'Периодический контроль';
  if (abc === 'C' && xyzGroup === 'X') return 'Минимальный запас — стабильный спрос';

  return 'Кандидат на сокращение ассортимента';
}

/**
 * Legacy recommendation for backward compatibility
 */
export function getABCXYZRecommendation(abc: string, xyz: string): string {
  const matrix: Record<string, Record<string, string>> = {
    'A': { 
      'X': 'Стабильный лидер - максимальное наличие', 
      'Y': 'Важный товар - держать запас', 
      'Z': 'Высокая выручка но непредсказуемый - осторожный заказ' 
    },
    'B': { 
      'X': 'Стабильный середняк - регулярное пополнение', 
      'Y': 'Типичный товар - стандартный заказ', 
      'Z': 'Умеренная выручка, нестабильный - минимальный запас' 
    },
    'C': { 
      'X': 'Низкая выручка но стабильный - на заказ', 
      'Y': 'Маргинальный товар - под заказ', 
      'Z': 'Кандидат на вывод - не заказывать' 
    },
  };
  return matrix[abc]?.[xyz] || 'Нет рекомендации';
}

/**
 * Get full recommendation with priority, action, and details
 */
export function getFullRecommendation(data: ArticleData): RecommendationResult {
  const velocityDay = data.avgMonthlyQty / 30;
  
  return {
    priority: getRecommendationPriority(data),
    action: getRecommendationAction(data),
    text: getRecommendationText(data),
    details: {
      days_left: data.daysUntilStockout,
      stock: data.currentStock,
      velocity_day: Math.round(velocityDay * 100) / 100,
      velocity_month: Math.round(data.avgMonthlyQty * 10) / 10,
      plan_qty: data.plan1m,
      abc: data.abc,
      xyz: data.xyz || 'Z',
      cv: Math.round(data.cv * 10) / 10,
      revenue_share: Math.round(data.revenueShare * 100) / 100,
      margin_pct: data.marginPct,
      profit_per_unit: data.profitPerUnit,
      potential_profit: data.profitPerUnit && data.plan1m ? Math.round(data.profitPerUnit * data.plan1m) : undefined,
      has_econ_data: !!(data.marginPct || data.profitPerUnit),
    },
  };
}

/**
 * Priority display configuration
 */
export const priorityConfig: Record<RecommendationPriority, { 
  label: string; 
  emoji: string; 
  className: string;
  badgeVariant: 'destructive' | 'default' | 'secondary' | 'outline';
}> = {
  critical: { 
    label: 'Критично', 
    emoji: '🔴', 
    className: 'bg-destructive text-destructive-foreground',
    badgeVariant: 'destructive',
  },
  high: { 
    label: 'Высокий', 
    emoji: '🟠', 
    className: 'bg-warning text-warning-foreground',
    badgeVariant: 'default',
  },
  medium: { 
    label: 'Средний', 
    emoji: '🟡', 
    className: 'bg-primary/20 text-primary',
    badgeVariant: 'secondary',
  },
  low: { 
    label: 'Низкий', 
    emoji: '🔵', 
    className: 'bg-muted text-muted-foreground',
    badgeVariant: 'outline',
  },
  none: { 
    label: 'Мониторинг', 
    emoji: '⚪', 
    className: 'bg-muted/50 text-muted-foreground',
    badgeVariant: 'outline',
  },
};

/**
 * Action display configuration
 */
export const actionConfig: Record<RecommendationAction, { label: string; icon: string }> = {
  order_urgent: { label: 'Срочный заказ', icon: '⚡' },
  order_regular: { label: 'Плановый заказ', icon: '📦' },
  order_careful: { label: 'Осторожный заказ', icon: '⚠️' },
  reduce_stock: { label: 'Сократить остаток', icon: '📉' },
  discontinue: { label: 'Вывести', icon: '❌' },
  monitor: { label: 'Мониторинг', icon: '👁️' },
};
