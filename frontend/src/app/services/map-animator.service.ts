import {Injectable} from '@angular/core';
import {LV95_Coordinates, LV95_Waypoint} from "../helpers/coordinates";
import {BehaviorSubject, combineLatest, Observable} from "rxjs";
import {decode, encode, LatLngTuple} from "@googlemaps/polyline-codec";
import {environment} from "../../environments/environment";
import {take} from "rxjs/operators";
import {transform} from "ol/proj";

@Injectable({
  providedIn: 'root'
})
export class MapAnimatorService {

  private static VALHALLA_URL = environment.VALHALLA_URL;
  private static BASE_URL = environment.API_URL;
  private static DEFAULT_MAP_CENTER = {x: 2719675, y: 1216320};

  private readonly _path$: BehaviorSubject<LV95_Waypoint[]>;
  private readonly _way_points$: BehaviorSubject<LV95_Waypoint[]>;
  private readonly _pois$: BehaviorSubject<LV95_Waypoint[]>;
  private readonly _map_center$: BehaviorSubject<LV95_Coordinates>;
  private _error_handler: (err: string) => void;

  public has_route = false;

  private readonly _pointer$: BehaviorSubject<LV95_Coordinates | null>;
  private auto_waypoints = true;

  constructor() {

    this._path$ = new BehaviorSubject<LV95_Waypoint[]>([]);
    this._way_points$ = new BehaviorSubject<LV95_Waypoint[]>([]);
    this._pois$ = new BehaviorSubject<LV95_Waypoint[]>([]);
    this._map_center$ = new BehaviorSubject<LV95_Coordinates>(MapAnimatorService.DEFAULT_MAP_CENTER)
    this._pointer$ = new BehaviorSubject<LV95_Coordinates | null>(null);
    this._error_handler = (err: string) => console.error(err);

  }

  public set_error_handler(handler: (err: string) => void) {
    this._error_handler = handler;
  }

  public get path$(): Observable<LV95_Waypoint[]> {
    return this._path$;
  }

  public get pois$(): Observable<LV95_Waypoint[]> {
    return this._pois$;
  }


  public get map_center$(): Observable<LV95_Coordinates> {
    return this._map_center$;
  }

  public get way_points$(): Observable<LV95_Waypoint[]> {
    return this._way_points$;
  }

  public get pointer$(): Observable<LV95_Coordinates | null> {
    return this._pointer$;
  }


  public clear() {
    this.has_route = false;
    this._path$.next([]);
    this._way_points$.next([]);
    this._pois$.next([]);
    this._map_center$.next(MapAnimatorService.DEFAULT_MAP_CENTER);
  }


  public add_point_of_interest(pkt: LV95_Waypoint) {

    this.pois$.pipe(take(1)).subscribe(pois => {
      pois.push(pkt);
      this._pois$.next(pois);
    });

    combineLatest([this._path$, this._pois$]).pipe(take(1))
      .subscribe(([path, pois]) =>
        this.create_walk_time_table(path, pois, this.auto_waypoints).catch(err => this._error_handler(err))
      );

  }

  public move_pointer(coordinates: LV95_Waypoint | null) {
    this._pointer$.next(coordinates);
  }

  public async download_map(settings: any): Promise<number> {

    console.log('settings', settings);
    localStorage['form_values'] = JSON.stringify(settings);

    return new Promise<number>((resolve, reject) =>
      combineLatest([this.path$, this.pois$, this.way_points$]).pipe(take(1))
        .subscribe(([path, pois, way_points]) => {

          const export_request = {
            'settings': settings,
            'flags': [], // TODO: implement flags

            'encoding': 'polyline',

            'route': encode(path.map(p => [p.x, p.y]), 0),
            'route_elevation': encode(path.map(p => [p.accumulated_distance * 1_000, p.h]), 0),

            'way_points': encode(way_points.map(p => [p.x, p.y]), 0),
            'way_points_elevation': encode(way_points.map(p => [p.accumulated_distance * 1_000, p.h]), 0),

            'pois_distance': pois
              .sort((a, b) => a.accumulated_distance - b.accumulated_distance)
              .map(p => `${p.accumulated_distance * 1_000}`).join(',')

          }

          const url = MapAnimatorService.BASE_URL + 'create_map';

          let formData = new FormData();
          formData.append("options", JSON.stringify(export_request));

          fetch(url, {
            method: "POST",
            headers: {
              ContentType: 'multipart/form-data',
              Accept: 'application/json',
            },
            body: formData
          })
            .then(response => response.json())
            .then((resp: any) => {
              console.log('resp', resp);

              if (resp.status === 'running')
                resolve(resp.uuid);
              else
                reject(resp);
            });

        }));


  }

  /**
   *
   * @param route_file_or_array
   * @returns {Promise<string>} the name of the route
   *
   */
  public async replace_route(route_file_or_array: File | LV95_Coordinates[] | undefined): Promise<string> {

    if (!route_file_or_array) {
      this.clear();
      this.has_route = false;
      throw new Error('No route file selected');
    }

    this.has_route = true;


    // minify XML data
    let xml_string;
    let file_type;
    if (route_file_or_array instanceof File) {
      xml_string = (await route_file_or_array.text()).toString()
      xml_string = xml_string.replace(/>\s*/g, '>');  // Remove space after >
      xml_string = xml_string.replace(/\s*</g, '<');  // Remove space before <
      file_type = route_file_or_array.name.split('.').pop();
    } else {
      xml_string = route_file_or_array.map(p => `${p.x},${p.y}`).join(';');
      file_type = 'array';
    }

    let formData = new FormData();
    formData.append("options", JSON.stringify({
      'encoding': 'polyline',
      'file_type': file_type
    }));
    formData.append("file_content", xml_string);

    const url = MapAnimatorService.BASE_URL + 'parse_route';

    return new Promise<string>((resolve, reject) => {
      fetch(url, {
        method: "POST",
        headers: {
          ContentType: 'multipart/form-data',
          Accept: 'application/json',
        },
        body: formData
      })
        .then(response => response.json())
        .then((resp: any) => {
          this.set_route(resp)
            .then(() => resolve(resp.route_name))
            .catch(err => reject(err));
        }).catch(err => reject(err));
    });

  }

  public set_map_center(coordinates: LV95_Coordinates) {
    this._map_center$.next(coordinates);
  }

  private update_map_center(points: LV95_Coordinates[]) {

    let x_min = points[0].x;
    let y_min = points[0].y;

    let x_max = points[0].x;
    let y_max = points[0].y;

    points.forEach(point => {

      if (point.x < x_min) x_min = point.x;
      if (point.y < y_min) y_min = point.y;
      if (point.x > x_max) x_max = point.x;
      if (point.y > y_max) y_max = point.y;

    });

    this._map_center$?.next({'x': (x_max + x_min) / 2, 'y': (y_max + y_min) / 2});


  }


  async create_walk_time_table(path: LV95_Waypoint[], pois: LV95_Waypoint[], auto_waypoints: boolean) {

    console.log('Updating walk time table')

    if (path == undefined) {
      console.error('No path found')
      return;
    }

    let data: any = {
      'encoding': 'polyline',
      'route': encode(path.map(p => [p.x, p.y]), 0),
      'auto_waypoints': auto_waypoints,
      'elevation_data': encode(path.map(p => [p.accumulated_distance * 1_000, p.h]), 0),
      'pois_distance': pois
        .sort((a, b) => a.accumulated_distance - b.accumulated_distance)
        .map(p => `${p.accumulated_distance * 1_000}`).join(','),
    };

    let formData = new FormData();
    formData.append("options", JSON.stringify(data));

    return fetch(MapAnimatorService.BASE_URL + 'create-walk-time-table', {
      method: "POST",
      headers: {
        ContentType: 'application/json',
        Accept: 'application/json',
      },
      body: formData
    })
      .then(response => response.json())
      .then((resp: any) => {

        if (resp?.status === 'error')
          throw new Error(resp.message)

        if (resp?.pois == undefined)
          throw new Error('Die Datei konnte nicht gelesen werden!');

        if (resp?.pois_elevation == undefined)
          throw new Error('Keine Höhendaten gefunden!');

        const pois = decode(resp?.pois, 0);
        const pois_elevation = decode(resp?.pois_elevation, 0);
        this._pois$.next(this.create_way_points(pois, pois_elevation, resp?.pois_names));

        const selected_way_points = decode(resp?.selected_way_points, 0);
        const selected_way_points_elevation = decode(resp?.selected_way_points_elevation, 0);
        this._way_points$.next(this.create_way_points(selected_way_points, selected_way_points_elevation));

      });
  }


  private async set_route(resp: any) {

    if (resp?.status == 'error')
      throw new Error(resp.message);

    if (resp?.route == undefined)
      throw new Error('Die Datei konnte nicht gelesen werden!');

    if (resp?.elevation_data == undefined)
      throw new Error('Keine Höhendaten gefunden!');

    const path = decode(resp?.route, 0);
    const elevation = decode(resp?.elevation_data, 0);

    // If route is empty, we cleat all data
    if (path.length == 0) {
      this.clear();
      return;
    }

    if (path.length != elevation.length)
      throw new Error('Die Route und die Höhendaten haben unterschiedliche Länge!');

    const way_points = this.create_way_points(path, elevation);

    this.update_map_center(way_points);
    this._path$?.next(way_points);
    this._pois$?.next([]);

    return new Promise<void>((resolve, reject) =>
      combineLatest([this._path$, this._pois$]).pipe(take(1))
        .subscribe(([path, pois]) =>
          this.create_walk_time_table(path, pois, this.auto_waypoints).then(() => resolve()).catch(err => reject(err))
        )
    );

  }

  public async add_way_point(point: LV95_Coordinates) {

    const WGS84 = transform([point.x, point.y], 'EPSG:2056', 'EPSG:4326');
    console.log('Adding way point', point, WGS84);

    const path = this._path$.getValue();

    const pois = this._pois$.getValue();
    pois.push({
      'x': point.x,
      'y': point.y,
      'h': 0,
      'accumulated_distance': 0,
      'name': ''
    });
    this._pois$.next(pois);

    if (path.length == 0) {

      path.push({
        'x': point.x,
        'y': point.y,
        'h': 0,
        'accumulated_distance': 0,
      });

      this._path$.next(path);
      return;

    }

    const old_WGS84 = transform([path[path.length - 1].x, path[path.length - 1].y], 'EPSG:2056', 'EPSG:4326');

    // fetch path from valhalla/valhalla
    // TODO: use environment variable
    const url = `${MapAnimatorService.VALHALLA_URL}route?json=` + encodeURIComponent(JSON.stringify({
      locations: [
        {lat: old_WGS84[1], lon: old_WGS84[0]},
        {lat: WGS84[1], lon: WGS84[0]}
      ],
      costing: 'pedestrian',
      directions_type: 'none',
      radius: 25
    }));

    // fetch path from valhalla/valhalla at localhost:8002
    const data = await fetch(url, {method: 'POST'}).then(response => response.json());
    const shape: string = data.trip.legs[0].shape;

    const decoded_path = decode(shape, 6).map(p =>
      transform([p[1], p[0]], 'EPSG:4326', 'EPSG:2056'));

    decoded_path.forEach(p => {
      path.push({
        'x': p[0],
        'y': p[1],
        'h': 0,
        'accumulated_distance': 0,
      });
    });

    this._path$.next(path);

  }

  private create_way_points(path: LatLngTuple[], elevation: LatLngTuple[], names: string[] = []): LV95_Waypoint[] {

    return path.map((p: any, i: number) => {
      return {
        'x': p[0],
        'y': p[1],
        'h': elevation[i][1],
        'accumulated_distance': elevation[i][0] / 1_000,
        'name': (names && names.length > 0) ? names[i] : ''
      };
    });

  }

  public delete_poi(point: LV95_Waypoint) {

    this.pois$.pipe(take(1)).subscribe(pois => {
      this._pois$.next(pois.filter(p => p.x != point.x || p.y != point.y));
    });

    combineLatest([this._path$, this._pois$, this.way_points$]).pipe(take(1))
      .subscribe(([path, pois, way_points]) =>
        this.create_walk_time_table(path, pois, this.auto_waypoints).catch(err => this._error_handler(err))
      );

  }


  /**
   * Finish drawing the route, does the same as the replace_route function but without the file
   */
  async finish_drawing() {

    this.has_route = true;

    // clear pois: as we used them to draw the route
    this._pois$.next([]);

    const path = this._path$.getValue().map(p =>
      ({x: p.x, y: p.y} as LV95_Coordinates));
    await this.replace_route(path);

  }

  set_automatic_waypoint_selection(val: boolean) {
    this.auto_waypoints = val;

    // call create_walk_time_table to update the walk time table
    combineLatest([this._path$, this._pois$, this.way_points$]).pipe(take(1))
      .subscribe(([path, pois, way_points]) =>
        this.create_walk_time_table(path, pois, this.auto_waypoints).catch(err => this._error_handler(err))
      );

  }

}
