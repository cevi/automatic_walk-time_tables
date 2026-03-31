import { LV95_Coordinates, LV95_Waypoint } from '../helpers/coordinates';
import { LatLngTuple } from '@googlemaps/polyline-codec';

export class GeometryUtils {
  /**
   * Identifies if a coordinate exists within the active Anchor Points array.
   */
  public static is_anchor(
    point: LV95_Coordinates | LV95_Waypoint,
    anchor_points: LV95_Coordinates[],
  ): boolean {
    if ('is_waypoint' in point && point.is_waypoint === true) return true;
    return anchor_points.some(
      (a) => Math.abs(a.x - point.x) < 2 && Math.abs(a.y - point.y) < 2,
    );
  }

  /**
   * Finds the immediate topological left and right anchor points structurally bounding the modified index.
   */
  public static findAdjacentAnchors(
    path: LV95_Waypoint[],
    anchor_points: LV95_Coordinates[],
    changed_idx: number,
  ): {
    start_anchor: LV95_Waypoint | null;
    start_anchor_idx: number;
    end_anchor: LV95_Waypoint | null;
    end_anchor_idx: number;
  } {
    let start_anchor_idx = 0;
    let found_start = false;
    for (let i = changed_idx - 1; i >= 0; i--) {
      if (this.is_anchor(path[i], anchor_points)) {
        start_anchor_idx = i;
        found_start = true;
        break;
      }
    }

    let end_anchor_idx = path.length - 1;
    let found_end = false;
    for (let i = changed_idx + 1; i < path.length; i++) {
      if (this.is_anchor(path[i], anchor_points)) {
        end_anchor_idx = i;
        found_end = true;
        break;
      }
    }

    if (!found_end && changed_idx < path.length - 1) {
      end_anchor_idx = path.length - 1;
      found_end = true;
    }
    if (!found_start && changed_idx > 0) {
      start_anchor_idx = 0;
      found_start = true;
    }

    return {
      start_anchor: found_start ? path[start_anchor_idx] : null,
      start_anchor_idx: found_start ? start_anchor_idx : -1,
      end_anchor: found_end ? path[end_anchor_idx] : null,
      end_anchor_idx: found_end ? end_anchor_idx : -1,
    };
  }

  /**
   * Assembles the coordinate array for upstream API submittal.
   */
  public static buildRoutingQuery(
    start_anchor: LV95_Coordinates | null,
    dragged_point: LV95_Coordinates | null,
    end_anchor: LV95_Coordinates | null,
    action: 'insert' | 'move' | 'delete',
  ): LV95_Coordinates[] {
    const query_locations: LV95_Coordinates[] = [];
    if (action === 'delete') {
      if (start_anchor) query_locations.push(start_anchor);
      if (end_anchor) query_locations.push(end_anchor);
    } else {
      if (start_anchor) query_locations.push(start_anchor);
      if (dragged_point) query_locations.push(dragged_point);
      if (end_anchor) query_locations.push(end_anchor);
    }
    return query_locations;
  }

  /**
   * Splices the routing segments smoothly together post-calculation.
   */
  public static spliceRoute(
    path: LV95_Waypoint[],
    new_segment: LV95_Coordinates[],
    start_anchor_idx: number,
    end_anchor_idx: number,
    new_point: LV95_Coordinates | null,
    action: 'insert' | 'move' | 'delete',
    moved_pt: LV95_Waypoint | null = null,
  ): LV95_Waypoint[] {
    const head = start_anchor_idx !== -1 ? path.slice(0, start_anchor_idx) : [];
    const tail = end_anchor_idx !== -1 ? path.slice(end_anchor_idx + 1) : [];

    const new_segment_mapped: LV95_Waypoint[] = new_segment.map((p) => ({
      x: p.x,
      y: p.y,
      h: 0,
      accumulated_distance: 0,
      is_waypoint: false,
      name: '',
      break_duration: '',
    }));

    if (start_anchor_idx !== -1 && new_segment_mapped.length > 0) {
      const sa = path[start_anchor_idx];
      new_segment_mapped[0] = {
        ...sa,
        name: sa.name || '',
        x: new_segment_mapped[0].x,
        y: new_segment_mapped[0].y,
      };
    }

    if (end_anchor_idx !== -1 && new_segment_mapped.length > 0) {
      const ea = path[end_anchor_idx];
      new_segment_mapped[new_segment_mapped.length - 1] = {
        ...ea,
        name: ea.name || '',
        x: new_segment_mapped[new_segment_mapped.length - 1].x,
        y: new_segment_mapped[new_segment_mapped.length - 1].y,
      };
    }

    if (action !== 'delete' && new_point) {
      let closest_idx = -1;
      let min_dist = Infinity;
      for (let i = 0; i < new_segment_mapped.length; i++) {
        const d = Math.sqrt(
          (new_segment_mapped[i].x - new_point.x) ** 2 +
            (new_segment_mapped[i].y - new_point.y) ** 2,
        );
        if (d < min_dist) {
          min_dist = d;
          closest_idx = i;
        }
      }
      if (closest_idx !== -1) {
        new_segment_mapped[closest_idx].is_waypoint = true;
        if (action === 'move' && moved_pt) {
          new_segment_mapped[closest_idx] = {
            ...moved_pt,
            name: moved_pt.name || '',
            x: new_segment_mapped[closest_idx].x,
            y: new_segment_mapped[closest_idx].y,
          };
        }
      }
    }

    return head.concat(new_segment_mapped).concat(tail);
  }

  public static create_way_points(
    path: LatLngTuple[],
    elevation: LatLngTuple[],
    names: string[] = [],
  ): LV95_Waypoint[] {
    return path.map((p: any, i: number) => {
      return {
        x: p[0],
        y: p[1],
        h: elevation[i][1],
        accumulated_distance: elevation[i][0] / 1_000,
        name: names && names.length > 0 ? names[i] : '',
        is_waypoint: false,
      };
    });
  }
}
