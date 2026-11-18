import proj4 from 'proj4';

/**
 * Parses coordinates typed into the search bar, following the formats the
 * official map viewer accepts (geoadmin/web-mapviewer, coordinateExtractors.js).
 *
 * Accepted:
 * - LV95: `2600000 1200000`, `2'600'000, 1'200'000`, `1200000/2600000`
 * - LV03: `600000 200000`, `600'000.5 200'000.5`
 * - WGS 84: `46.95 7.44`, `46.95°N 7.44°E`, `N46.95 E7.44`,
 *   `46°57.06' 7°26.4'`, `46°57'3.6"N 7°26'24"E`, `46 57 3.6 N 7 26 24 E`
 *
 * The input must contain the coordinates only. Values outside of Switzerland
 * (the LV95 bounds) are rejected, so `2023 2024` still runs a name search.
 */

export type CoordinateSystem = 'LV95' | 'LV03' | 'WGS84';

export interface ParsedCoordinate {
  /** the system the user typed the coordinate in */
  system: CoordinateSystem;
  /** [easting, northing] in LV95 */
  lv95: [number, number];
  /** [lon, lat] in WGS 84 */
  wgs84: [number, number];
}

const LV95_DEF =
  '+proj=somerc +lat_0=46.9524055555556 +lon_0=7.43958333333333 ' +
  '+k_0=1 +x_0=2600000 +y_0=1200000 +ellps=bessel +towgs84=674.374,15.056,405.346,0,0,0,0 ' +
  '+units=m +no_defs +type=crs';

// Bounds of LV95 as used by geoadmin (@geoadmin/coordinates)
const LV95_BOUNDS = {
  minX: 2420000,
  maxX: 2900000,
  minY: 1030000,
  maxY: 1350000,
};
const LV03_BOUNDS = { minX: 420000, maxX: 900000, minY: 30000, maxY: 350000 };
// LV95 bounds expressed in WGS 84 (rounded outwards)
const WGS84_BOUNDS = { minX: 5.14, maxX: 11.48, minY: 45.39, maxY: 48.24 };

type Bounds = typeof LV95_BOUNDS;
const inBounds = (b: Bounds, x: number, y: number) =>
  x >= b.minX && x <= b.maxX && y >= b.minY && y <= b.maxY;

const DEG = '\\d{1,3}(?:\\.\\d+)?';
const MIN = '\\d{1,2}(?:\\.\\d+)?';
const SEC = '\\d{1,2}(?:\\.\\d+)?';
const DEG_ID = '\\s*°\\s*';
const MIN_ID = "\\s*['‘’‛′]\\s*";
const SEC_ID = '\\s*(?:["“”‟″]|[\'‘’‛′]{2})\\s*';
const CARD = '[NSEW]';
const SEP = '\\s*?[ \\t,/;]\\s*';

/** one WGS 84 value: degrees with optional minutes and seconds */
const value = (i: number) =>
  `(?<deg${i}>${DEG})(?:${DEG_ID}|\\s+|(?=${SEP})|(?=\\s*${CARD})|$)` +
  `(?:(?<min${i}>${MIN})(?:${MIN_ID}|\\s+|(?=${SEP})|(?=\\s*${CARD})|$)` +
  `(?:(?<sec${i}>${SEC})(?:${SEC_ID})?)?)?`;

const REGEX_WGS84_SUFFIX = new RegExp(
  `^${value(1)}\\s*(?<card1>${CARD})?${SEP}${value(2)}\\s*(?<card2>${CARD})?$`,
  'i',
);
const REGEX_WGS84_PREFIX = new RegExp(
  `^(?<card1>${CARD})\\s*${value(1)}${SEP}(?<card2>${CARD})\\s*${value(2)}$`,
  'i',
);

const THOUSANDS = "['`’´ ]";
const METRIC = `\\d{1,3}(?:${THOUSANDS}?\\d{3})*(?:\\.\\d+)?`;
const REGEX_METRIC = new RegExp(
  `^(?<c1>${METRIC})\\s*[,/;\\s]\\s*(?<c2>${METRIC})$`,
);

function ensureLv95Registered() {
  if (!proj4.defs('EPSG:2056')) proj4.defs('EPSG:2056', LV95_DEF);
}

function toWgs84(lv95: [number, number]): [number, number] {
  ensureLv95Registered();
  return proj4('EPSG:2056', 'EPSG:4326', lv95) as [number, number];
}

function toLv95(wgs84: [number, number]): [number, number] {
  ensureLv95Registered();
  return proj4('EPSG:4326', 'EPSG:2056', wgs84) as [number, number];
}

function parseMetric(text: string): ParsedCoordinate | null {
  const m = REGEX_METRIC.exec(text);
  if (!m?.groups) return null;
  const strip = (s: string) =>
    Number(s.replace(new RegExp(THOUSANDS, 'g'), ''));
  const a = strip(m.groups['c1']);
  const b = strip(m.groups['c2']);
  if (Number.isNaN(a) || Number.isNaN(b)) return null;

  for (const [e, n] of [
    [a, b],
    [b, a],
  ]) {
    if (inBounds(LV95_BOUNDS, e, n)) {
      const lv95: [number, number] = [e, n];
      return { system: 'LV95', lv95, wgs84: toWgs84(lv95) };
    }
  }
  for (const [e, n] of [
    [a, b],
    [b, a],
  ]) {
    if (inBounds(LV03_BOUNDS, e, n)) {
      // The official reframe (FINELTRA) differs by less than ~1.5 m from
      // the plain offset, more than precise enough to jump the map there.
      const lv95: [number, number] = [e + 2_000_000, n + 1_000_000];
      return { system: 'LV03', lv95, wgs84: toWgs84(lv95) };
    }
  }
  return null;
}

function parseWgs84(text: string): ParsedCoordinate | null {
  const m = REGEX_WGS84_PREFIX.exec(text) ?? REGEX_WGS84_SUFFIX.exec(text);
  if (!m?.groups) return null;
  const g = m.groups;
  const num = (i: number) =>
    Number(g[`deg${i}`]) +
    Number(g[`min${i}`] ?? 0) / 60 +
    Number(g[`sec${i}`] ?? 0) / 3600;

  let first = num(1);
  let second = num(2);
  const card1 = g['card1']?.toUpperCase();
  const card2 = g['card2']?.toUpperCase();
  if (card1 === 'S' || card1 === 'W') first = -first;
  if (card2 === 'S' || card2 === 'W') second = -second;

  let lon: number;
  let lat: number;
  if (card1 === 'N' || card1 === 'S' || card2 === 'E' || card2 === 'W') {
    [lat, lon] = [first, second];
  } else if (card1 === 'E' || card1 === 'W' || card2 === 'N' || card2 === 'S') {
    [lon, lat] = [first, second];
  } else if (inBounds(WGS84_BOUNDS, second, first)) {
    // without cardinals, "lat lon" (Google Maps order) is the common case
    [lat, lon] = [first, second];
  } else {
    [lon, lat] = [first, second];
  }
  if (!inBounds(WGS84_BOUNDS, lon, lat)) return null;
  const wgs84: [number, number] = [lon, lat];
  const lv95 = toLv95(wgs84);
  if (!inBounds(LV95_BOUNDS, lv95[0], lv95[1])) return null;
  return { system: 'WGS84', lv95, wgs84 };
}

export function parseCoordinate(
  input: string | null | undefined,
): ParsedCoordinate | null {
  if (typeof input !== 'string') return null;
  const text = input.trim();
  if (!text) return null;
  // metric first: "600000 200000" must not be read as degrees
  return parseMetric(text) ?? parseWgs84(text);
}

/** 2600000 -> 2'600'000 */
export function formatSwissNumber(n: number): string {
  return Math.round(n)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, "'");
}

export function formatLv95(lv95: [number, number]): string {
  return `${formatSwissNumber(lv95[0])}, ${formatSwissNumber(lv95[1])}`;
}

export function formatWgs84(wgs84: [number, number]): string {
  const [lon, lat] = wgs84;
  return `${Math.abs(lat).toFixed(5)}° ${lat >= 0 ? 'N' : 'S'}, ${Math.abs(lon).toFixed(5)}° ${lon >= 0 ? 'E' : 'W'}`;
}
