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

@Injectable({
  providedIn: 'root',
})
export class RouteApiService {
  private static readonly VALHALLA_URL = environment.VALHALLA_URL;
  private static readonly BASE_URL = environment.API_URL;

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

    let path: LV95_Coordinates[] = [];
    for (const leg of data.trip.legs) {
      const decoded_leg = decode(leg.shape, 6).map((p) =>
        transform([p[1], p[0]], 'EPSG:4326', 'EPSG:2056'),
      );
      if (path.length > 0) {
        decoded_leg.shift();
      }
      path = path.concat(decoded_leg.map((p) => ({ x: p[0], y: p[1] })));
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

    const response = await fetch(RouteApiService.BASE_URL + 'parse_route', {
      method: 'POST',
      headers: { Accept: 'application/json' },
      body: formData,
    });
    return response.json();
  }

  public async createWalkTimeTable(
    path: LV95_Waypoint[],
    pois: LV95_Waypoint[],
    auto_waypoints: boolean,
  ): Promise<any> {
    if (path.length === 0) return null;

    let data: any = {
      encoding: 'polyline',
      route: encode(
        path.map((p) => [p.x, p.y]),
        0,
      ),
      auto_waypoints: auto_waypoints,
      pois_distance: pois
        .sort((a, b) => a.accumulated_distance - b.accumulated_distance)
        .map((p) => `${p.accumulated_distance * 1_000}`)
        .join(','),
    };

    if (!path.some((p) => p.h === 0)) {
      data['elevation_data'] = encode(
        path.map((p) => [p.accumulated_distance * 1_000, p.h]),
        0,
      );
    }

    const formData = new FormData();
    formData.append('options', JSON.stringify(data));

    const response = await fetch(
      RouteApiService.BASE_URL + 'create-walk-time-table',
      {
        method: 'POST',
        headers: { Accept: 'application/json' },
        body: formData,
      },
    );
    return response.json();
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
}
