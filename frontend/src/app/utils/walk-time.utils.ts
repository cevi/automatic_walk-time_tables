/** Way points of one A4 page of the J+S walk-time table (the Excel export). */
export const WAY_POINTS_PER_PAGE = 21;

/** The export continues on a second A4 page, see backend walk_table.MAX_WAY_POINTS. */
export const MAX_WAY_POINTS = 2 * WAY_POINTS_PER_PAGE;

/**
 * Leistungskilometer of a leg, as calculated by the J+S template of the Excel export (column F):
 * 1 Lkm = 1 km distance = 100 m ascent; on a descent steeper than 20 %, 150 m of descent count as 1 Lkm.
 *
 * @param distanceKm horizontal distance of the leg in km
 * @param deltaHeightM height difference of the leg in m (negative for a descent)
 */
export function leistungskilometer(
  distanceKm: number,
  deltaHeightM: number,
): number {
  const gradient = distanceKm > 0 ? deltaHeightM / (distanceKm * 10) : 0;
  if (gradient < -20) return distanceKm - deltaHeightM / 150;
  if (gradient < 0) return distanceKm;
  return distanceKm + Math.max(deltaHeightM, 0) / 100;
}
