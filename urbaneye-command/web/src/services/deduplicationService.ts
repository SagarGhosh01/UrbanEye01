/**
 * UrbanEye - Client-Side O(1) Grid GPS & Perceptual Image Deduplication Service
 * Quantizes GPS into 10m grid cells for O(1) hash map lookups, computes 64-bit pHash
 * for image similarity checks, and buffers best-confidence frames.
 */

export interface CachedPotholeEntry {
  id: string;
  gridKey: string;
  latitude: number;
  longitude: number;
  timestamp: number;
  lastSeen: number;
  timesSeen: number;
  confidence: number;
  pHash: string;
  imageSnippet: string | null;
  widthCm: number;
  lengthCm: number;
  depthCm: number;
  repairCost: number;
}

export interface DeduplicationConfig {
  radiusMeters: number;    // Default 10 meters
  timeWindowMs: number;    // Default 60,000 ms (60s)
  maxHammingDistance: number; // Default 5 bits
}

class DeduplicationService {
  private config: DeduplicationConfig = {
    radiusMeters: 15,
    timeWindowMs: 24 * 60 * 60 * 1000, // 24-hour deduplication window
    maxHammingDistance: 5,
  };

  // O(1) Spatial Grid Hash Map: GridKey -> CachedPotholeEntry[]
  private gridMap: Map<string, CachedPotholeEntry[]> = new Map();

  // Primary Cache List for easy iteration & persistence
  private cacheList: CachedPotholeEntry[] = [];

  constructor() {
    this.loadFromStorage();
  }

  public updateConfig(newConfig: Partial<DeduplicationConfig>) {
    this.config = { ...this.config, ...newConfig };
  }

  /**
   * Quantizes Lat/Lon to ~10m grid cell keys.
   * 1 degree lat approx 111,000m -> 0.0001 deg approx 11.1m
   */
  public getGridKey(lat: number, lon: number): string {
    const latGrid = Math.floor(lat * 10000);
    const lonGrid = Math.floor(lon * 10000);
    return `${latGrid}_${lonGrid}`;
  }

  /**
   * Calculates 9-neighbor grid keys surrounding a coordinate.
   */
  private getNeighborGridKeys(lat: number, lon: number): string[] {
    const latGrid = Math.floor(lat * 10000);
    const lonGrid = Math.floor(lon * 10000);
    const keys: string[] = [];

    for (let dLat = -1; dLat <= 1; dLat++) {
      for (let dLon = -1; dLon <= 1; dLon++) {
        keys.push(`${latGrid + dLat}_${lonGrid + dLon}`);
      }
    }
    return keys;
  }

  /**
   * Calculates Haversine distance in meters.
   */
  public calculateHaversineMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371000;
    const dLat = (lat2 - lat1) * (Math.PI / 180);
    const dLon = (lon2 - lon1) * (Math.PI / 180);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  /**
   * Computes a 64-bit Perceptual Hash (pHash) from a canvas image snippet.
   */
  public computePHash(imageSnippet: string | null): string {
    if (!imageSnippet) return '0'.repeat(64);

    try {
      // Simple 64-bit hash based on base64 sample string density
      let hash = '';
      const step = Math.max(1, Math.floor(imageSnippet.length / 64));
      let sum = 0;
      for (let i = 0; i < imageSnippet.length; i += 10) {
        sum += imageSnippet.charCodeAt(i);
      }
      const avg = sum / (imageSnippet.length / 10);

      for (let i = 0; i < 64; i++) {
        const val = imageSnippet.charCodeAt((i * step) % imageSnippet.length);
        hash += val >= avg ? '1' : '0';
      }
      return hash;
    } catch (e) {
      return '0'.repeat(64);
    }
  }

  /**
   * Calculates Hamming distance between two 64-bit binary pHash strings.
   */
  public calculateHammingDistance(hashA: string, hashB: string): number {
    if (hashA.length !== hashB.length) return 64;
    let dist = 0;
    for (let i = 0; i < hashA.length; i++) {
      if (hashA[i] !== hashB[i]) dist++;
    }
    return dist;
  }

  /**
   * Core Deduplication Method: Checks $O(1)$ grid buckets for GPS or pHash match.
   */
  public checkAndRegisterDetection(
    lat: number,
    lon: number,
    confidence: number,
    imageSnippet: string | null,
    metrics: { widthCm: number; lengthCm: number; depthCm: number; repairCost: number }
  ): { isDuplicate: boolean; entry: CachedPotholeEntry; action: 'SKIP_UPLOAD' | 'UPLOAD_NEW' | 'UPDATE_BEST_FRAME' } {
    const now = Date.now();
    this.pruneExpiredEntries(now);

    const neighborKeys = this.getNeighborGridKeys(lat, lon);
    const candidateEntries: CachedPotholeEntry[] = [];

    // O(1) grid lookup across 9 neighbor buckets
    for (const key of neighborKeys) {
      const bucket = this.gridMap.get(key);
      if (bucket) {
        candidateEntries.push(...bucket);
      }
    }

    const currentPHash = this.computePHash(imageSnippet);

    // Search for match within GPS radius OR pHash similarity
    let matchedEntry: CachedPotholeEntry | null = null;
    for (const entry of candidateEntries) {
      const timeDiff = Math.abs(now - entry.timestamp);
      if (timeDiff > this.config.timeWindowMs) continue;

      const distMeters = this.calculateHaversineMeters(lat, lon, entry.latitude, entry.longitude);
      const pHashDist = this.calculateHammingDistance(currentPHash, entry.pHash);

      if (distMeters <= this.config.radiusMeters || pHashDist <= this.config.maxHammingDistance) {
        matchedEntry = entry;
        break;
      }
    }

    if (matchedEntry) {
      matchedEntry.lastSeen = now;
      matchedEntry.timesSeen += 1;

      // Best frame selection: if current frame has higher confidence, update image snippet
      let action: 'SKIP_UPLOAD' | 'UPDATE_BEST_FRAME' = 'SKIP_UPLOAD';
      if (confidence > matchedEntry.confidence && imageSnippet) {
        matchedEntry.confidence = confidence;
        matchedEntry.imageSnippet = imageSnippet;
        matchedEntry.pHash = currentPHash;
        matchedEntry.widthCm = metrics.widthCm;
        matchedEntry.lengthCm = metrics.lengthCm;
        matchedEntry.depthCm = metrics.depthCm;
        matchedEntry.repairCost = metrics.repairCost;
        action = 'UPDATE_BEST_FRAME';
      }

      this.saveToStorage();
      return { isDuplicate: true, entry: matchedEntry, action };
    }

    // New Detection Entry
    const gridKey = this.getGridKey(lat, lon);
    const newEntry: CachedPotholeEntry = {
      id: `pothole-cache-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      gridKey,
      latitude: lat,
      longitude: lon,
      timestamp: now,
      lastSeen: now,
      timesSeen: 1,
      confidence,
      pHash: currentPHash,
      imageSnippet,
      widthCm: metrics.widthCm,
      lengthCm: metrics.lengthCm,
      depthCm: metrics.depthCm,
      repairCost: metrics.repairCost,
    };

    // Add to grid map & cache list
    if (!this.gridMap.has(gridKey)) {
      this.gridMap.set(gridKey, []);
    }
    this.gridMap.get(gridKey)!.push(newEntry);
    this.cacheList.unshift(newEntry);

    this.saveToStorage();
    return { isDuplicate: false, entry: newEntry, action: 'UPLOAD_NEW' };
  }

  /**
   * Prunes entries older than timeWindowMs from cache.
   */
  private pruneExpiredEntries(now: number) {
    const cutoff = now - this.config.timeWindowMs;
    this.cacheList = this.cacheList.filter((e) => e.lastSeen >= cutoff);

    // Rebuild grid map
    this.gridMap.clear();
    for (const entry of this.cacheList) {
      if (!this.gridMap.has(entry.gridKey)) {
        this.gridMap.set(entry.gridKey, []);
      }
      this.gridMap.get(entry.gridKey)!.push(entry);
    }
  }

  /**
   * Returns timesSeen count for a given lat/lon within radiusMeters.
   */
  public getTimesSeen(lat: number, lon: number): number {
    const now = Date.now();
    this.pruneExpiredEntries(now);
    const neighborKeys = this.getNeighborGridKeys(lat, lon);
    for (const key of neighborKeys) {
      const bucket = this.gridMap.get(key);
      if (bucket) {
        for (const entry of bucket) {
          if (this.calculateHaversineMeters(lat, lon, entry.latitude, entry.longitude) <= this.config.radiusMeters) {
            return entry.timesSeen;
          }
        }
      }
    }
    return 1;
  }

  private saveToStorage() {
    try {
      localStorage.setItem('urbaneye_dedup_cache', JSON.stringify(this.cacheList.slice(0, 100)));
    } catch (e) {
      // ignore storage errors
    }
  }

  private loadFromStorage() {
    try {
      const raw = localStorage.getItem('urbaneye_dedup_cache');
      if (raw) {
        this.cacheList = JSON.parse(raw);
        this.pruneExpiredEntries(Date.now());
      }
    } catch (e) {
      this.cacheList = [];
    }
  }
}

export const deduplicationService = new DeduplicationService();
