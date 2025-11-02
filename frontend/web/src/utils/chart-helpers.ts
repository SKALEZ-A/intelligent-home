export interface ChartDataPoint {
  x: number | string | Date;
  y: number;
  label?: string;
}

export interface ChartSeries {
  name: string;
  data: ChartDataPoint[];
  color?: string;
  type?: 'line' | 'bar' | 'area' | 'scatter';
}

export interface ChartOptions {
  title?: string;
  xAxisLabel?: string;
  yAxisLabel?: string;
  showLegend?: boolean;
  showGrid?: boolean;
  animate?: boolean;
  responsive?: boolean;
}

export class ChartHelpers {
  static generateTimeSeriesData(
    startDate: Date,
    endDate: Date,
    interval: 'hour' | 'day' | 'week' | 'month',
    valueGenerator: (date: Date) => number
  ): ChartDataPoint[] {
    const data: ChartDataPoint[] = [];
    let currentDate = new Date(startDate);

    while (currentDate <= endDate) {
      data.push({
        x: new Date(currentDate),
        y: valueGenerator(currentDate)
      });

      switch (interval) {
        case 'hour':
          currentDate.setHours(currentDate.getHours() + 1);
          break;
        case 'day':
          currentDate.setDate(currentDate.getDate() + 1);
          break;
        case 'week':
          currentDate.setDate(currentDate.getDate() + 7);
          break;
        case 'month':
          currentDate.setMonth(currentDate.getMonth() + 1);
          break;
      }
    }

    return data;
  }

  static aggregateData(
    data: ChartDataPoint[],
    bucketSize: number,
    aggregation: 'sum' | 'avg' | 'min' | 'max' | 'count' = 'avg'
  ): ChartDataPoint[] {
    if (data.length === 0) return [];

    const buckets: Map<number, number[]> = new Map();

    data.forEach(point => {
      const bucketKey = Math.floor(Number(point.x) / bucketSize) * bucketSize;
      if (!buckets.has(bucketKey)) {
        buckets.set(bucketKey, []);
      }
      buckets.get(bucketKey)!.push(point.y);
    });

    const aggregated: ChartDataPoint[] = [];

    buckets.forEach((values, key) => {
      let aggregatedValue: number;

      switch (aggregation) {
        case 'sum':
          aggregatedValue = values.reduce((sum, val) => sum + val, 0);
          break;
        case 'avg':
          aggregatedValue = values.reduce((sum, val) => sum + val, 0) / values.length;
          break;
        case 'min':
          aggregatedValue = Math.min(...values);
          break;
        case 'max':
          aggregatedValue = Math.max(...values);
          break;
        case 'count':
          aggregatedValue = values.length;
          break;
      }

      aggregated.push({ x: key, y: aggregatedValue });
    });

    return aggregated.sort((a, b) => Number(a.x) - Number(b.x));
  }

  static smoothData(data: ChartDataPoint[], windowSize: number = 5): ChartDataPoint[] {
    if (data.length < windowSize) return data;

    const smoothed: ChartDataPoint[] = [];
    const halfWindow = Math.floor(windowSize / 2);

    for (let i = 0; i < data.length; i++) {
      const start = Math.max(0, i - halfWindow);
      const end = Math.min(data.length, i + halfWindow + 1);
      const window = data.slice(start, end);
      
      const avg = window.reduce((sum, point) => sum + point.y, 0) / window.length;
      
      smoothed.push({
        x: data[i].x,
        y: avg,
        label: data[i].label
      });
    }

    return smoothed;
  }

  static calculateMovingAverage(data: ChartDataPoint[], period: number): ChartDataPoint[] {
    if (data.length < period) return data;

    const result: ChartDataPoint[] = [];

    for (let i = period - 1; i < data.length; i++) {
      const window = data.slice(i - period + 1, i + 1);
      const avg = window.reduce((sum, point) => sum + point.y, 0) / period;
      
      result.push({
        x: data[i].x,
        y: avg,
        label: `MA(${period})`
      });
    }

    return result;
  }

  static calculateTrend(data: ChartDataPoint[]): { slope: number; intercept: number } {
    if (data.length < 2) {
      return { slope: 0, intercept: 0 };
    }

    const n = data.length;
    let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;

    data.forEach((point, index) => {
      const x = index;
      const y = point.y;
      sumX += x;
      sumY += y;
      sumXY += x * y;
      sumX2 += x * x;
    });

    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;

    return { slope, intercept };
  }

  static generateTrendLine(data: ChartDataPoint[]): ChartDataPoint[] {
    const { slope, intercept } = this.calculateTrend(data);

    return data.map((point, index) => ({
      x: point.x,
      y: slope * index + intercept,
      label: 'Trend'
    }));
  }

  static normalizeData(data: ChartDataPoint[], min: number = 0, max: number = 1): ChartDataPoint[] {
    const values = data.map(p => p.y);
    const dataMin = Math.min(...values);
    const dataMax = Math.max(...values);
    const range = dataMax - dataMin;

    if (range === 0) return data;

    return data.map(point => ({
      x: point.x,
      y: ((point.y - dataMin) / range) * (max - min) + min,
      label: point.label
    }));
  }

  static fillMissingData(
    data: ChartDataPoint[],
    expectedPoints: number,
    fillMethod: 'zero' | 'forward' | 'backward' | 'interpolate' = 'interpolate'
  ): ChartDataPoint[] {
    if (data.length === 0) return [];
    if (data.length >= expectedPoints) return data;

    const filled: ChartDataPoint[] = [...data];
    const step = (Number(data[data.length - 1].x) - Number(data[0].x)) / (expectedPoints - 1);

    for (let i = 0; i < expectedPoints; i++) {
      const expectedX = Number(data[0].x) + i * step;
      const existing = filled.find(p => Math.abs(Number(p.x) - expectedX) < step / 2);

      if (!existing) {
        let y: number;

        switch (fillMethod) {
          case 'zero':
            y = 0;
            break;
          case 'forward':
            y = filled[filled.length - 1].y;
            break;
          case 'backward':
            y = filled[0].y;
            break;
          case 'interpolate':
            const before = filled.filter(p => Number(p.x) < expectedX).pop();
            const after = filled.find(p => Number(p.x) > expectedX);
            if (before && after) {
              const ratio = (expectedX - Number(before.x)) / (Number(after.x) - Number(before.x));
              y = before.y + ratio * (after.y - before.y);
            } else {
              y = before?.y || after?.y || 0;
            }
            break;
        }

        filled.push({ x: expectedX, y });
      }
    }

    return filled.sort((a, b) => Number(a.x) - Number(b.x));
  }

  static detectOutliers(data: ChartDataPoint[], threshold: number = 2): ChartDataPoint[] {
    const values = data.map(p => p.y);
    const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
    const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
    const stdDev = Math.sqrt(variance);

    return data.filter(point => Math.abs(point.y - mean) > threshold * stdDev);
  }

  static removeOutliers(data: ChartDataPoint[], threshold: number = 2): ChartDataPoint[] {
    const outliers = new Set(this.detectOutliers(data, threshold).map(p => p.x));
    return data.filter(point => !outliers.has(point.x));
  }

  static calculatePercentileValue(data: ChartDataPoint[], percentile: number): number {
    const sorted = [...data].sort((a, b) => a.y - b.y);
    const index = Math.ceil((percentile / 100) * sorted.length) - 1;
    return sorted[Math.max(0, index)].y;
  }

  static groupByCategory(data: ChartDataPoint[]): Map<string, ChartDataPoint[]> {
    const groups = new Map<string, ChartDataPoint[]>();

    data.forEach(point => {
      const category = point.label || 'default';
      if (!groups.has(category)) {
        groups.set(category, []);
      }
      groups.get(category)!.push(point);
    });

    return groups;
  }

  static calculateStatistics(data: ChartDataPoint[]): {
    min: number;
    max: number;
    mean: number;
    median: number;
    stdDev: number;
    sum: number;
    count: number;
  } {
    if (data.length === 0) {
      return { min: 0, max: 0, mean: 0, median: 0, stdDev: 0, sum: 0, count: 0 };
    }

    const values = data.map(p => p.y);
    const sorted = [...values].sort((a, b) => a - b);
    
    const min = sorted[0];
    const max = sorted[sorted.length - 1];
    const sum = values.reduce((acc, val) => acc + val, 0);
    const mean = sum / values.length;
    
    const median = sorted.length % 2 === 0
      ? (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2
      : sorted[Math.floor(sorted.length / 2)];
    
    const variance = values.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) / values.length;
    const stdDev = Math.sqrt(variance);

    return { min, max, mean, median, stdDev, sum, count: values.length };
  }

  static formatAxisLabel(value: number | string | Date, format: 'number' | 'currency' | 'percentage' | 'date' | 'time' = 'number'): string {
    switch (format) {
      case 'number':
        return typeof value === 'number' ? value.toLocaleString() : String(value);
      
      case 'currency':
        return typeof value === 'number' ? `$${value.toFixed(2)}` : String(value);
      
      case 'percentage':
        return typeof value === 'number' ? `${value.toFixed(1)}%` : String(value);
      
      case 'date':
        if (value instanceof Date) {
          return value.toLocaleDateString();
        }
        return String(value);
      
      case 'time':
        if (value instanceof Date) {
          return value.toLocaleTimeString();
        }
        return String(value);
      
      default:
        return String(value);
    }
  }

  static generateColorPalette(count: number, baseHue: number = 200): string[] {
    const colors: string[] = [];
    const saturation = 70;
    const lightness = 50;

    for (let i = 0; i < count; i++) {
      const hue = (baseHue + (i * 360 / count)) % 360;
      colors.push(`hsl(${hue}, ${saturation}%, ${lightness}%)`);
    }

    return colors;
  }

  static exportToCSV(series: ChartSeries[]): string {
    if (series.length === 0) return '';

    const headers = ['x', ...series.map(s => s.name)];
    const rows: string[][] = [headers];

    // Get all unique x values
    const xValues = new Set<string>();
    series.forEach(s => s.data.forEach(p => xValues.add(String(p.x))));
    const sortedX = Array.from(xValues).sort();

    // Create rows
    sortedX.forEach(x => {
      const row = [x];
      series.forEach(s => {
        const point = s.data.find(p => String(p.x) === x);
        row.push(point ? String(point.y) : '');
      });
      rows.push(row);
    });

    return rows.map(row => row.join(',')).join('\n');
  }

  static importFromCSV(csv: string): ChartSeries[] {
    const lines = csv.trim().split('\n');
    if (lines.length < 2) return [];

    const headers = lines[0].split(',');
    const xLabel = headers[0];
    const seriesNames = headers.slice(1);

    const series: ChartSeries[] = seriesNames.map(name => ({
      name,
      data: []
    }));

    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(',');
      const x = values[0];

      values.slice(1).forEach((value, index) => {
        if (value && !isNaN(Number(value))) {
          series[index].data.push({
            x,
            y: Number(value)
          });
        }
      });
    }

    return series;
  }

  static downsample(data: ChartDataPoint[], targetPoints: number): ChartDataPoint[] {
    if (data.length <= targetPoints) return data;

    const result: ChartDataPoint[] = [];
    const step = data.length / targetPoints;

    for (let i = 0; i < targetPoints; i++) {
      const index = Math.floor(i * step);
      result.push(data[index]);
    }

    return result;
  }

  static calculateCorrelation(series1: ChartDataPoint[], series2: ChartDataPoint[]): number {
    if (series1.length !== series2.length || series1.length === 0) {
      return 0;
    }

    const n = series1.length;
    const mean1 = series1.reduce((sum, p) => sum + p.y, 0) / n;
    const mean2 = series2.reduce((sum, p) => sum + p.y, 0) / n;

    let numerator = 0;
    let denominator1 = 0;
    let denominator2 = 0;

    for (let i = 0; i < n; i++) {
      const diff1 = series1[i].y - mean1;
      const diff2 = series2[i].y - mean2;
      numerator += diff1 * diff2;
      denominator1 += diff1 * diff1;
      denominator2 += diff2 * diff2;
    }

    const denominator = Math.sqrt(denominator1 * denominator2);
    return denominator === 0 ? 0 : numerator / denominator;
  }
}

export default ChartHelpers;
