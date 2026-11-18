import { Injectable } from '@angular/core';
import { environment } from '../../environments/environment';
import { LV95_Coordinates, LV95_Waypoint } from '../helpers/coordinates';
import { transform } from 'ol/proj';
import { decode, encode } from '@googlemaps/polyline-codec';

export interface RouteStats {
  dist: number;
  up: number;
  down: number;
  duration: number;
}

export interface DailyRouteStatistic {
  date: string;
  routesCount: number;
  totalLengthM: number;
}

/** A way point as returned by the /waypoints endpoints (LV95, distances in meters). */
export interface ApiWaypoint {
  x: number;
  y: number;
  h: number;
  accumulated_distance: number;
  name: string;
  name_type: string;
  landmark: { score: number; types: string[]; reasons: string[] } | null;
}

export interface RouteGenerationStatistics {
  days: number;
  rangeStart: string;
  rangeEnd: string;
  dailyStats: DailyRouteStatistic[];
  totalRoutes: number;
  totalLengthM: number;
}

@Injectable({
  providedIn: 'root',
})
export class RouteApiService {
  private static readonly VALHALLA_URL = environment.VALHALLA_URL;
  private static readonly BASE_URL = environment.API_URL;
  private static readonly ELEVATION_CACHE_SIZE = 20;

  // The backend already retries geo.admin.ch itself, so we only retry once
  // on top of that to avoid amplifying a rate limit.
  private static readonly MAX_ATTEMPTS = 2;
  private static readonly RETRY_STATUS = [502, 503, 504];
  private static readonly DEFAULT_RETRY_DELAY_MS = 3_000;
  private static readonly MAX_RETRY_DELAY_MS = 10_000;

  // Elevation profiles the backend fetched from geo.admin.ch, keyed by the
  // encoded route they were fetched for. Lets us skip the (rate-limited)
  // elevation lookup when the same geometry is requested again, e.g. after
  // undo/redo or when toggling the automatic waypoint selection.
  private readonly elevationCache = new Map<
    string,
    { route: string; elevation_data: string }
  >();

  public async fetchValhallaRoute(
    locations: LV95_Coordinates[],
  ): Promise<LV95_Coordinates[]> {
    if (locations.length < 2) return locations;

    const valhalla_locations = locations.map((p) => {
      const wgs = transform([p.x, p.y], 'EPSG:2056', 'EPSG:4326');
      return { lat: wgs[1], lon: wgs[0] };
    });

    const url =
      `${RouteApiService.VALHALLA_URL}route?json=` +
      encodeURIComponent(
        JSON.stringify({
          locations: valhalla_locations,
          costing: 'pedestrian',
          directions_type: 'none',
          radius: 10,
        }),
      );

    const response = await fetch(url, { method: 'POST' });
    if (!response.ok) {
      throw new Error(`Valhalla mapping failed: ${response.statusText}`);
    }
    const data = await response.json();

    let path: any[] = [];
    for (const leg of data.trip.legs) {
      let decoded_leg_wgs = decode(leg.shape, 6);

      // Fetch trace attributes for this segment to get surface
      let leg_surfaces = new Array(decoded_leg_wgs.length).fill('unknown');
      let leg_names = new Array(decoded_leg_wgs.length).fill('');
      try {
        const traceUrl = `${RouteApiService.VALHALLA_URL}trace_attributes`;
        const traceResp = await fetch(traceUrl, {
          method: 'POST',
          body: JSON.stringify({
            encoded_polyline: leg.shape,
            costing: 'pedestrian',
            shape_match: 'edge_walk',
            filters: {
              attributes: [
                'edge.surface',
                'edge.names',
                'edge.begin_shape_index',
                'edge.end_shape_index',
              ],
              action: 'include',
            },
          }),
        });
        if (traceResp.ok) {
          const traceData = await traceResp.json();
          if (traceData.edges) {
            for (const edge of traceData.edges) {
              for (
                let i = edge.begin_shape_index;
                i <= edge.end_shape_index;
                i++
              ) {
                if (i < leg_surfaces.length) {
                  leg_surfaces[i] = edge.surface || 'unknown';
                  if (edge.names && edge.names.length > 0) {
                    leg_names[i] = edge.names[0];
                  }
                }
              }
            }
          }
        }
      } catch (e) {
        console.error('Failed to trace surface', e);
      }

      const decoded_leg = decoded_leg_wgs.map((p, idx) => {
        const lv95 = transform([p[1], p[0]], 'EPSG:4326', 'EPSG:2056');
        return {
          x: lv95[0],
          y: lv95[1],
          surface: leg_surfaces[idx],
          road_name: leg_names[idx],
        } as any;
      });

      if (path.length > 0) {
        decoded_leg.shift();
      }
      path = path.concat(decoded_leg);
    }
    return path;
  }

  public async parseRouteFile(
    fileContent: string,
    fileType: string,
  ): Promise<any> {
    const formData = new FormData();
    formData.append(
      'options',
      JSON.stringify({ encoding: 'polyline', file_type: fileType }),
    );
    formData.append('file_content', fileContent);

    return this.postToBackend('parse_route', formData);
  }

  /**
   * The route as sent to the /waypoints endpoints (LV95 polyline, plus elevation if known). Without elevation (while
   * drawing), the profile the backend fetched for the same route before is reused, see cacheElevation.
   */
  private encodeRoute(path: LV95_Waypoint[]): {
    key: string;
    data: { route: string; elevation?: string };
  } {
    const route = encode(
      path.map((p) => [p.x, p.y]),
      0,
    );
    if (!path.some((p) => p.h === 0)) {
      const elevation = encode(
        path.map((p) => [p.accumulated_distance * 1_000, p.h]),
        0,
      );
      return { key: route, data: { route, elevation } };
    }
    const cached = this.elevationCache.get(route);
    return {
      key: route,
      data: cached
        ? { route: cached.route, elevation: cached.elevation_data }
        : { route },
    };
  }

  /** POSTs a route to a /waypoints endpoint and keeps the elevation profile the backend fetched for it. */
  private async postRoute(
    endpoint: string,
    path: LV95_Waypoint[],
    body: object,
  ): Promise<any> {
    const { key, data } = this.encodeRoute(path);
    const result = await this.postToBackend(endpoint, { ...data, ...body });
    if (result?.route && result?.elevation) {
      this.cacheElevation(key, result.route, result.elevation);
    }
    return result;
  }

  /**
   * Automatic mode: the backend selects and names the way points of the route.
   */
  public async autoWaypoints(path: LV95_Waypoint[]): Promise<ApiWaypoint[]> {
    if (path.length === 0) return [];
    const result = await this.postRoute('waypoints/auto', path, {});
    return result.waypoints;
  }

  /**
   * Manual mode: places way points chosen by the user on the route and names them.
   *
   * @param positions the way points, by accumulated distance [km] or, if that is not known yet (while drawing),
   *   by coordinates
   * @param includeStartEnd also return the start and end of the route if no way point is there
   */
  public async manualWaypoints(
    path: LV95_Waypoint[],
    positions: (LV95_Coordinates & { accumulated_distance?: number })[],
    includeStartEnd = false,
  ): Promise<ApiWaypoint[]> {
    if (path.length === 0) return [];
    const result = await this.postRoute('waypoints/manual', path, {
      waypoints: positions.map((p) =>
        Number.isFinite(p.accumulated_distance)
          ? { accumulated_distance: (p.accumulated_distance as number) * 1_000 }
          : { x: p.x, y: p.y },
      ),
      include_start_end: includeStartEnd,
    });
    return result.waypoints;
  }

  /** Names for LV95 coordinates, '' where nothing is close enough. */
  public async names(points: LV95_Coordinates[]): Promise<string[]> {
    if (points.length === 0) return [];
    const result = await this.postToBackend('names', {
      points: points.map((p) => [p.x, p.y]),
    });
    return result.names.map((n: any) => n.name || '');
  }

  /**
   * POSTs to the backend (a form or, for any other body, JSON) and returns the parsed JSON body. Retries once on
   * temporary failures (gateway errors, unavailable elevation service, network errors) and throws an Error carrying
   * the backend's message otherwise.
   */
  private async postToBackend(
    endpoint: string,
    body: FormData | object,
  ): Promise<any> {
    const is_form = body instanceof FormData;
    const headers: Record<string, string> = { Accept: 'application/json' };
    if (!is_form) headers['Content-Type'] = 'application/json';
    const payload = is_form ? body : JSON.stringify(body);

    for (let attempt = 1; ; attempt++) {
      const is_last_attempt = attempt >= RouteApiService.MAX_ATTEMPTS;

      let response: Response;
      try {
        response = await fetch(RouteApiService.BASE_URL + endpoint, {
          method: 'POST',
          headers,
          body: payload,
        });
      } catch (err) {
        if (is_last_attempt) {
          throw new Error(
            'Der Server ist nicht erreichbar. Bitte prüfe deine Internetverbindung.',
          );
        }
        await this.sleep(RouteApiService.DEFAULT_RETRY_DELAY_MS);
        continue;
      }

      if (response.ok) return response.json();

      if (
        !is_last_attempt &&
        RouteApiService.RETRY_STATUS.includes(response.status)
      ) {
        await this.sleep(this.retryDelay(response));
        continue;
      }

      const result = await response.json().catch(() => null);
      throw new Error(
        result?.message ||
          `Ein Fehler ist aufgetreten (Server-Antwort ${response.status}).`,
      );
    }
  }

  private retryDelay(response: Response): number {
    const retry_after = Number(response.headers.get('Retry-After'));
    const delay =
      retry_after > 0
        ? retry_after * 1_000
        : RouteApiService.DEFAULT_RETRY_DELAY_MS;
    return Math.min(delay, RouteApiService.MAX_RETRY_DELAY_MS);
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private cacheElevation(key: string, route: string, elevation_data: string) {
    this.elevationCache.delete(key);
    this.elevationCache.set(key, { route, elevation_data });
    if (this.elevationCache.size > RouteApiService.ELEVATION_CACHE_SIZE) {
      const oldest = this.elevationCache.keys().next().value;
      if (oldest !== undefined) this.elevationCache.delete(oldest);
    }
  }

  public async retrieveDataStatus(uuid: string): Promise<number> {
    const response = await fetch(
      RouteApiService.BASE_URL + 'retrieve/' + uuid,
      {
        method: 'GET',
        headers: { Accept: 'application/json' },
      },
    );
    const result = await response.json();
    if (result.status === 'running' || result.status === 'success') {
      return result.uuid;
    }
    throw result;
  }

  public async getRouteGenerationStatistics(
    days: number = 30,
  ): Promise<RouteGenerationStatistics> {
    const response = await fetch(
      RouteApiService.BASE_URL + `statistics?days=${days}`,
      {
        method: 'GET',
        headers: { Accept: 'application/json' },
      },
    );

    if (!response.ok) {
      throw new Error('Die Statistiken konnten nicht geladen werden.');
    }

    return response.json();
  }

  public async exportPdf(
    path: LV95_Waypoint[],
    pois: LV95_Waypoint[],
    settings: any,
    tableJson: any,
  ): Promise<any> {
    const export_request: any = {
      settings: settings,
      flags: [],
      encoding: 'polyline',
      route: encode(
        path.map((p) => [p.x, p.y]),
        0,
      ),
      route_elevation: encode(
        path.map((p) => [p.accumulated_distance * 1_000, p.h]),
        0,
      ),
      // In the new architecture, the frontend POIs act as the way_points for the table
      way_points: encode(
        pois.map((p) => [p.x, p.y]),
        0,
      ),
      way_points_elevation: encode(
        pois.map((p) => [p.accumulated_distance * 1_000, p.h]),
        0,
      ),
      way_points_details: tableJson,
      table: tableJson,
    };

    if (pois.length > 0) {
      export_request['pois'] = encode(
        pois.map((p) => [p.x, p.y]),
        0,
      );
      export_request['pois_elevation'] = encode(
        pois.map((p) => [p.accumulated_distance * 1_000, p.h]),
        0,
      );
      export_request['pois_distance'] = pois
        .sort((a, b) => a.accumulated_distance - b.accumulated_distance)
        .map((p) => `${p.accumulated_distance * 1_000}`)
        .join(',');
    }

    const response = await fetch(RouteApiService.BASE_URL + 'create_map', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(export_request),
    });
    return response.json();
  }

  public async applyValhallaSurfaces(path: LV95_Waypoint[]): Promise<void> {
    if (path.length < 2) return;

    try {
      const valhalla_locations = path.map((p) => {
        const wgs = transform([p.x, p.y], 'EPSG:2056', 'EPSG:4326');
        return [wgs[1], wgs[0]]; // Valhalla encode expects [lat, lng]
      });
      const encoded_polyline = encode(valhalla_locations, 6);

      const traceUrl = `${RouteApiService.VALHALLA_URL}trace_attributes`;
      const traceResp = await fetch(traceUrl, {
        method: 'POST',
        body: JSON.stringify({
          encoded_polyline,
          costing: 'pedestrian',
          shape_match: 'map_snap',
          filters: {
            attributes: [
              'edge.surface',
              'edge.names',
              'edge.begin_shape_index',
              'edge.end_shape_index',
            ],
            action: 'include',
          },
        }),
      });

      if (!traceResp.ok) return;

      const traceData = await traceResp.json();
      if (traceData.edges) {
        for (const edge of traceData.edges) {
          for (let i = edge.begin_shape_index; i <= edge.end_shape_index; i++) {
            if (i < path.length) {
              path[i].surface = edge.surface || 'unknown';
              if (edge.names && edge.names.length > 0) {
                path[i].road_name = edge.names[0] || path[i].road_name;
              }
            }
          }
        }
      }
    } catch (e) {
      console.warn('Failed to apply valhalla surfaces geoprojection', e);
    }
  }
}
