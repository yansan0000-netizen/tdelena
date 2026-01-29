/**
 * Forecasting methods for sales prediction
 * Implements: Linear Regression, Exponential Smoothing, Moving Average
 */

export interface ForecastResult {
  method: 'linear_regression' | 'exponential_smoothing' | 'moving_average';
  forecast: number;
  confidence: number; // 0-1 score based on data quality
  trend: 'up' | 'down' | 'stable';
}

export interface MonthlyData {
  period: string; // 'YYYY-MM' format
  quantity: number;
  revenue?: number;
}

/**
 * Linear Regression forecasting
 * Uses least squares method to fit a trend line
 */
export function linearRegressionForecast(data: MonthlyData[], monthsAhead: number = 1): ForecastResult {
  if (data.length < 2) {
    return {
      method: 'linear_regression',
      forecast: data.length === 1 ? data[0].quantity : 0,
      confidence: 0,
      trend: 'stable',
    };
  }

  const n = data.length;
  const quantities = data.map(d => d.quantity);
  
  // X values: 0, 1, 2, ... (time indices)
  const sumX = (n * (n - 1)) / 2;
  const sumY = quantities.reduce((a, b) => a + b, 0);
  const sumXY = quantities.reduce((sum, y, i) => sum + i * y, 0);
  const sumX2 = (n * (n - 1) * (2 * n - 1)) / 6;
  
  // Calculate slope (m) and intercept (b) for y = mx + b
  const denominator = n * sumX2 - sumX * sumX;
  if (denominator === 0) {
    const avg = sumY / n;
    return {
      method: 'linear_regression',
      forecast: Math.max(0, Math.round(avg)),
      confidence: 0.5,
      trend: 'stable',
    };
  }
  
  const slope = (n * sumXY - sumX * sumY) / denominator;
  const intercept = (sumY - slope * sumX) / n;
  
  // Forecast for next period
  const forecastPeriod = n - 1 + monthsAhead;
  const forecast = Math.max(0, slope * forecastPeriod + intercept);
  
  // Calculate R² for confidence
  const yMean = sumY / n;
  const ssTotal = quantities.reduce((sum, y) => sum + Math.pow(y - yMean, 2), 0);
  const ssResidual = quantities.reduce((sum, y, i) => {
    const predicted = slope * i + intercept;
    return sum + Math.pow(y - predicted, 2);
  }, 0);
  const rSquared = ssTotal > 0 ? 1 - ssResidual / ssTotal : 0;
  
  // Determine trend
  let trend: 'up' | 'down' | 'stable';
  const avgValue = yMean;
  const slopePct = avgValue > 0 ? (slope / avgValue) * 100 : 0;
  
  if (slopePct > 5) {
    trend = 'up';
  } else if (slopePct < -5) {
    trend = 'down';
  } else {
    trend = 'stable';
  }
  
  return {
    method: 'linear_regression',
    forecast: Math.round(forecast),
    confidence: Math.max(0, Math.min(1, rSquared)),
    trend,
  };
}

/**
 * Exponential Smoothing (Simple Exponential Smoothing)
 * Weights recent observations more heavily
 */
export function exponentialSmoothingForecast(
  data: MonthlyData[], 
  alpha: number = 0.3,
  monthsAhead: number = 1
): ForecastResult {
  if (data.length === 0) {
    return {
      method: 'exponential_smoothing',
      forecast: 0,
      confidence: 0,
      trend: 'stable',
    };
  }
  
  if (data.length === 1) {
    return {
      method: 'exponential_smoothing',
      forecast: data[0].quantity,
      confidence: 0.3,
      trend: 'stable',
    };
  }

  const quantities = data.map(d => d.quantity);
  
  // Initialize with first value
  let smoothed = quantities[0];
  const smoothedValues: number[] = [smoothed];
  
  // Apply exponential smoothing
  for (let i = 1; i < quantities.length; i++) {
    smoothed = alpha * quantities[i] + (1 - alpha) * smoothed;
    smoothedValues.push(smoothed);
  }
  
  // For multiple months ahead, the forecast stays the same (simple ES limitation)
  const forecast = Math.max(0, smoothed);
  
  // Calculate confidence based on forecast error
  let totalError = 0;
  for (let i = 1; i < quantities.length; i++) {
    const predicted = smoothedValues[i - 1];
    totalError += Math.abs(quantities[i] - predicted);
  }
  const mape = totalError / (quantities.length - 1) / (smoothed || 1);
  const confidence = Math.max(0, Math.min(1, 1 - mape));
  
  // Determine trend from smoothed values
  let trend: 'up' | 'down' | 'stable';
  if (smoothedValues.length >= 3) {
    const recent = smoothedValues.slice(-3);
    const recentTrend = recent[2] - recent[0];
    const avgRecent = (recent[0] + recent[1] + recent[2]) / 3;
    const trendPct = avgRecent > 0 ? (recentTrend / avgRecent) * 100 : 0;
    
    if (trendPct > 10) {
      trend = 'up';
    } else if (trendPct < -10) {
      trend = 'down';
    } else {
      trend = 'stable';
    }
  } else {
    trend = 'stable';
  }
  
  return {
    method: 'exponential_smoothing',
    forecast: Math.round(forecast),
    confidence,
    trend,
  };
}

/**
 * Moving Average forecasting
 * Uses average of last N periods
 */
export function movingAverageForecast(
  data: MonthlyData[], 
  windowSize: number = 3,
  monthsAhead: number = 1
): ForecastResult {
  if (data.length === 0) {
    return {
      method: 'moving_average',
      forecast: 0,
      confidence: 0,
      trend: 'stable',
    };
  }

  const quantities = data.map(d => d.quantity);
  const effectiveWindow = Math.min(windowSize, quantities.length);
  const recentData = quantities.slice(-effectiveWindow);
  
  // Calculate moving average
  const forecast = recentData.reduce((a, b) => a + b, 0) / effectiveWindow;
  
  // Calculate confidence based on variance in recent data
  const mean = forecast;
  const variance = recentData.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / effectiveWindow;
  const cv = mean > 0 ? Math.sqrt(variance) / mean : 1;
  const confidence = Math.max(0, Math.min(1, 1 - cv));
  
  // Determine trend
  let trend: 'up' | 'down' | 'stable';
  if (quantities.length >= 3) {
    const oldAvg = quantities.slice(0, Math.ceil(quantities.length / 2)).reduce((a, b) => a + b, 0) / Math.ceil(quantities.length / 2);
    const newAvg = quantities.slice(Math.floor(quantities.length / 2)).reduce((a, b) => a + b, 0) / Math.floor(quantities.length / 2);
    const trendPct = oldAvg > 0 ? ((newAvg - oldAvg) / oldAvg) * 100 : 0;
    
    if (trendPct > 10) {
      trend = 'up';
    } else if (trendPct < -10) {
      trend = 'down';
    } else {
      trend = 'stable';
    }
  } else {
    trend = 'stable';
  }
  
  return {
    method: 'moving_average',
    forecast: Math.round(forecast),
    confidence,
    trend,
  };
}

/**
 * Get all forecasts for an article
 */
export function getAllForecasts(data: MonthlyData[], monthsAhead: number = 1): {
  linear: ForecastResult;
  exponential: ForecastResult;
  movingAverage: ForecastResult;
  recommended: ForecastResult;
  consensusForecast: number;
} {
  const linear = linearRegressionForecast(data, monthsAhead);
  const exponential = exponentialSmoothingForecast(data, 0.3, monthsAhead);
  const movingAverage = movingAverageForecast(data, 3, monthsAhead);
  
  // Weighted consensus based on confidence
  const totalWeight = linear.confidence + exponential.confidence + movingAverage.confidence;
  let consensusForecast: number;
  
  if (totalWeight > 0) {
    consensusForecast = Math.round(
      (linear.forecast * linear.confidence +
       exponential.forecast * exponential.confidence +
       movingAverage.forecast * movingAverage.confidence) / totalWeight
    );
  } else {
    consensusForecast = Math.round((linear.forecast + exponential.forecast + movingAverage.forecast) / 3);
  }
  
  // Choose recommended method based on data characteristics
  let recommended: ForecastResult;
  
  // If high confidence in linear regression and clear trend, use it
  if (linear.confidence > 0.7 && linear.trend !== 'stable') {
    recommended = linear;
  }
  // If data is volatile (low confidence), prefer moving average
  else if (exponential.confidence < 0.5 && movingAverage.confidence < 0.5) {
    recommended = movingAverage;
  }
  // Default to exponential smoothing as a good balance
  else {
    recommended = exponential;
  }
  
  return {
    linear,
    exponential,
    movingAverage,
    recommended,
    consensusForecast,
  };
}

/**
 * Detect seasonality in data
 * Returns the dominant season or null if no clear pattern
 */
export type Season = 'winter' | 'spring' | 'summer' | 'autumn' | 'all_year';

export function detectSeasonality(data: MonthlyData[]): {
  season: Season;
  confidence: number;
  peakMonths: number[];
} {
  if (data.length < 6) {
    return { season: 'all_year', confidence: 0, peakMonths: [] };
  }

  // Group by month (1-12)
  const monthlyTotals: number[] = new Array(12).fill(0);
  const monthlyCounts: number[] = new Array(12).fill(0);
  
  data.forEach(d => {
    const month = parseInt(d.period.split('-')[1]) - 1; // 0-indexed
    if (month >= 0 && month < 12) {
      monthlyTotals[month] += d.quantity;
      monthlyCounts[month] += 1;
    }
  });
  
  // Calculate monthly averages
  const monthlyAvg = monthlyTotals.map((total, i) => 
    monthlyCounts[i] > 0 ? total / monthlyCounts[i] : 0
  );
  
  const overallAvg = monthlyAvg.reduce((a, b) => a + b, 0) / 12;
  
  if (overallAvg === 0) {
    return { season: 'all_year', confidence: 0, peakMonths: [] };
  }
  
  // Find peak months (significantly above average)
  const threshold = overallAvg * 1.3; // 30% above average
  const peakMonths = monthlyAvg
    .map((avg, month) => ({ month: month + 1, avg }))
    .filter(m => m.avg >= threshold)
    .map(m => m.month);
  
  // Determine season based on peak months
  const seasonMonths = {
    winter: [12, 1, 2],
    spring: [3, 4, 5],
    summer: [6, 7, 8],
    autumn: [9, 10, 11],
  };
  
  let bestSeason: Season = 'all_year';
  let bestMatch = 0;
  
  for (const [season, months] of Object.entries(seasonMonths)) {
    const matchCount = peakMonths.filter(m => months.includes(m)).length;
    if (matchCount > bestMatch && matchCount >= 2) {
      bestMatch = matchCount;
      bestSeason = season as Season;
    }
  }
  
  // Calculate confidence based on how concentrated the peaks are
  const peakSum = peakMonths.reduce((sum, m) => sum + monthlyAvg[m - 1], 0);
  const totalSum = monthlyAvg.reduce((a, b) => a + b, 0);
  const concentration = totalSum > 0 ? peakSum / totalSum : 0;
  const confidence = Math.min(1, concentration * 2); // Scale up
  
  return {
    season: bestSeason,
    confidence,
    peakMonths,
  };
}

/**
 * Get season label in Russian
 */
export function getSeasonLabel(season: Season): string {
  const labels: Record<Season, string> = {
    winter: 'Зима',
    spring: 'Весна',
    summer: 'Лето',
    autumn: 'Осень',
    all_year: 'Весь год',
  };
  return labels[season];
}

/**
 * Format trend for display
 */
export function getTrendLabel(trend: 'up' | 'down' | 'stable'): string {
  const labels = {
    up: '↑ Рост',
    down: '↓ Спад',
    stable: '→ Стабильно',
  };
  return labels[trend];
}

/**
 * Get forecast method label in Russian
 */
export function getForecastMethodLabel(method: ForecastResult['method']): string {
  const labels: Record<ForecastResult['method'], string> = {
    linear_regression: 'Линейная регрессия',
    exponential_smoothing: 'Экспон. сглаживание',
    moving_average: 'Скользящее среднее',
  };
  return labels[method];
}
