/**
 * UrbanEye Detection Category Registry
 * =====================================
 * SINGLE SOURCE OF TRUTH for all detection category metadata.
 *
 * Rules:
 *  - Every component that renders a per-category color MUST import from here.
 *  - No hex color for a detection category may be hardcoded anywhere else.
 *  - Priority 1 = highest urgency (renders on top on the map, sorts first in feeds).
 *  - Phase 2 / Phase 3 entries are RESERVED CONFIG SLOTS only — no detection logic
 *    exists for them yet. They are listed here so color/priority is established before
 *    those phases ship, preventing a full repaint later.
 */

export interface DetectionCategory {
  /** Internal code used in the DB, API, and Android detector output */
  code: string;
  /** Human-readable label shown in badges, legends, and overlays */
  displayName: string;
  /** Implementation phase: 1 = live, 2 = planned, 3 = future */
  phase: 1 | 2 | 3;
  /** Hex color used for badges, map markers (by category), and Android bounding boxes */
  hex: string;
  /**
   * Render priority: 1 = highest urgency.
   * Higher-priority markers always sit visually above lower-priority ones on the map
   * (implemented via Leaflet zIndexOffset).
   */
  priority: number;
}

/**
 * Master category table — ordered by priority ascending (highest urgency first).
 * Update this array ONLY; all consumers derive from it automatically.
 */
export const DETECTION_CATEGORIES: DetectionCategory[] = [
  {
    code: 'HIT_AND_RUN',
    displayName: 'Hit & Run Incident',
    phase: 1,
    hex: '#881337',   // Rose-900 / Dark Red
    priority: 1,
  },
  {
    code: 'RASH_DRIVING',
    displayName: 'Rash / Dangerous Driving',
    phase: 1,
    hex: '#b91c1c',   // Red-700
    priority: 2,
  },
  {
    code: 'TRAFFIC_BOTTLENECK',
    displayName: 'Traffic Bottleneck',
    phase: 1,
    hex: '#dc2626',   // Red-600
    priority: 3,
  },
  {
    code: 'SCHOOL_CHILDREN_CROSSING',
    displayName: 'School Children Crossing',
    phase: 1,
    hex: '#10b981',   // Emerald
    priority: 4,
  },
  {
    code: 'MISSING_DIVIDER',
    displayName: 'Missing Road Divider',
    phase: 1,
    hex: '#0891b2',   // Cyan
    priority: 5,
  },
  {
    code: 'DIVIDER',
    displayName: 'Missing Road Divider',
    phase: 1,
    hex: '#0891b2',   // Cyan
    priority: 5,
  },
  {
    code: 'MISSING_ZEBRA_CROSSING',
    displayName: 'Missing Zebra Crossing',
    phase: 1,
    hex: '#059669',   // Emerald
    priority: 6,
  },
  {
    code: 'ZEBRA_CROSSING',
    displayName: 'Missing Zebra Crossing',
    phase: 1,
    hex: '#059669',   // Emerald
    priority: 6,
  },
  {
    code: 'DAMAGED_SIGNBOARD',
    displayName: 'Damaged/Missing Signboard',
    phase: 1,
    hex: '#ca8a04',   // Gold
    priority: 7,
  },
  {
    code: 'TRAFFIC_SIGN',
    displayName: 'Damaged/Missing Signboard',
    phase: 1,
    hex: '#ca8a04',   // Gold
    priority: 7,
  },
  {
    code: 'POTHOLE',
    displayName: 'Pothole',
    phase: 1,
    hex: '#f97316',   // Orange
    priority: 8,
  },
  {
    code: 'ROAD_CRACK',
    displayName: 'Road Crack',
    phase: 1,
    hex: '#eab308',   // Amber
    priority: 9,
  },
  {
    code: 'SURFACE_DAMAGE',
    displayName: 'Surface Wear',
    phase: 1,
    hex: '#92400e',   // Ochre / Dark Brown
    priority: 10,
  },
  {
    code: 'WATERLOGGING',
    displayName: 'Waterlogging',
    phase: 1,
    hex: '#2563eb',   // Blue
    priority: 11,
  },
  {
    code: 'VEHICLE_FLOW',
    displayName: 'Traffic Stream (density)',
    phase: 1,
    hex: '#7c3aed',   // Purple
    priority: 12,
  },
];

// ── Derived lookup helpers ────────────────────────────────────────────────────

/** Fast O(1) lookup map: category code → DetectionCategory */
const _categoryMap = new Map<string, DetectionCategory>(
  DETECTION_CATEGORIES.map((c) => [c.code, c])
);

/**
 * Returns the hex color for a given category code.
 * Falls back to slate-500 (`#64748b`) for any unknown/future code so the UI
 * never crashes when a new category arrives from the server before the config
 * is updated.
 */
export function getCategoryColor(code: string): string {
  return _categoryMap.get(code)?.hex ?? '#64748b';
}

/**
 * Returns the display name for a given category code.
 * Falls back to a humanised version of the raw code string.
 */
export function getCategoryDisplayName(code: string): string {
  return (
    _categoryMap.get(code)?.displayName ??
    code.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase())
  );
}

/**
 * Returns the priority number (1 = highest) for a given category code.
 * Falls back to 999 so unknown codes sort to the very bottom.
 */
export function getCategoryPriority(code: string): number {
  return _categoryMap.get(code)?.priority ?? 999;
}

/**
 * The maximum priority number in the current config.
 * Used to compute Leaflet zIndexOffset: offset = (MAX_PRIORITY - priority) * 100
 * so priority-1 markers always sit on top of priority-11 markers.
 */
export const MAX_CATEGORY_PRIORITY = Math.max(
  ...DETECTION_CATEGORIES.map((c) => c.priority)
);
