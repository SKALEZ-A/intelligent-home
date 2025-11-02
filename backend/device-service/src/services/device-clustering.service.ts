export class DeviceClusteringService {
  private clusters: Map<string, any[]>;

  constructor() {
    this.clusters = new Map();
  }

  public async clusterDevices(devices: any[], features: string[]): Promise<Map<string, any[]>> {
    const normalizedData = this.normalizeFeatures(devices, features);
    const k = Math.min(5, Math.floor(Math.sqrt(devices.length / 2)));
    
    return this.kMeansClustering(normalizedData, k);
  }

  private normalizeFeatures(devices: any[], features: string[]): number[][] {
    const data: number[][] = [];
    const mins: number[] = [];
    const maxs: number[] = [];

    features.forEach((feature, idx) => {
      const values = devices.map(d => d[feature] || 0);
      mins[idx] = Math.min(...values);
      maxs[idx] = Math.max(...values);
    });

    devices.forEach(device => {
      const normalized = features.map((feature, idx) => {
        const value = device[feature] || 0;
        return maxs[idx] !== mins[idx] ? (value - mins[idx]) / (maxs[idx] - mins[idx]) : 0;
      });
      data.push(normalized);
    });

    return data;
  }

  private kMeansClustering(data: number[][], k: number): Map<string, any[]> {
    let centroids = this.initializeCentroids(data, k);
    let assignments = new Array(data.length).fill(0);
    let changed = true;
    let iterations = 0;
    const maxIterations = 100;

    while (changed && iterations < maxIterations) {
      changed = false;
      iterations++;

      for (let i = 0; i < data.length; i++) {
        const newAssignment = this.findClosestCentroid(data[i], centroids);
        if (newAssignment !== assignments[i]) {
          assignments[i] = newAssignment;
          changed = true;
        }
      }

      centroids = this.updateCentroids(data, assignments, k);
    }

    const clusters = new Map<string, any[]>();
    for (let i = 0; i < k; i++) {
      clusters.set(`cluster_${i}`, []);
    }

    assignments.forEach((cluster, idx) => {
      clusters.get(`cluster_${cluster}`)!.push(data[idx]);
    });

    return clusters;
  }

  private initializeCentroids(data: number[][], k: number): number[][] {
    const centroids: number[][] = [];
    const used = new Set<number>();

    while (centroids.length < k) {
      const idx = Math.floor(Math.random() * data.length);
      if (!used.has(idx)) {
        centroids.push([...data[idx]]);
        used.add(idx);
      }
    }

    return centroids;
  }

  private findClosestCentroid(point: number[], centroids: number[][]): number {
    let minDist = Infinity;
    let closest = 0;

    centroids.forEach((centroid, idx) => {
      const dist = this.euclideanDistance(point, centroid);
      if (dist < minDist) {
        minDist = dist;
        closest = idx;
      }
    });

    return closest;
  }

  private euclideanDistance(a: number[], b: number[]): number {
    return Math.sqrt(a.reduce((sum, val, idx) => sum + Math.pow(val - b[idx], 2), 0));
  }

  private updateCentroids(data: number[][], assignments: number[], k: number): number[][] {
    const centroids: number[][] = [];
    
    for (let i = 0; i < k; i++) {
      const clusterPoints = data.filter((_, idx) => assignments[idx] === i);
      
      if (clusterPoints.length === 0) {
        centroids.push(data[Math.floor(Math.random() * data.length)]);
      } else {
        const centroid = clusterPoints[0].map((_, featureIdx) => {
          const sum = clusterPoints.reduce((s, point) => s + point[featureIdx], 0);
          return sum / clusterPoints.length;
        });
        centroids.push(centroid);
      }
    }

    return centroids;
  }

  public async getClusterInsights(clusterId: string): Promise<any> {
    const cluster = this.clusters.get(clusterId);
    if (!cluster) return null;

    return {
      size: cluster.length,
      centroid: this.calculateCentroid(cluster),
      variance: this.calculateVariance(cluster),
      density: this.calculateDensity(cluster),
    };
  }

  private calculateCentroid(points: number[][]): number[] {
    if (points.length === 0) return [];
    
    return points[0].map((_, idx) => {
      return points.reduce((sum, point) => sum + point[idx], 0) / points.length;
    });
  }

  private calculateVariance(points: number[][]): number {
    const centroid = this.calculateCentroid(points);
    const distances = points.map(point => this.euclideanDistance(point, centroid));
    const mean = distances.reduce((sum, d) => sum + d, 0) / distances.length;
    return distances.reduce((sum, d) => sum + Math.pow(d - mean, 2), 0) / distances.length;
  }

  private calculateDensity(points: number[][]): number {
    if (points.length < 2) return 0;
    
    let totalDistance = 0;
    let count = 0;

    for (let i = 0; i < points.length; i++) {
      for (let j = i + 1; j < points.length; j++) {
        totalDistance += this.euclideanDistance(points[i], points[j]);
        count++;
      }
    }

    return count > 0 ? totalDistance / count : 0;
  }
}
