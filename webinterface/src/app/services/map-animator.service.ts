import {Injectable} from '@angular/core';
import {LV95_Coordinates, LV95_Waypoint} from "../helpers/coordinates";
import {BehaviorSubject, combineLatest, Observable, Subject} from "rxjs";
import {decode, encode, LatLngTuple} from "@googlemaps/polyline-codec";
import {environment} from "../../environments/environment";
import {take} from "rxjs/operators";

@Injectable({
  providedIn: 'root'
})
export class MapAnimatorService {

  private static BASE_URL = environment.API_URL;
  private static DEFAULT_MAP_CENTER = {x: 2719675, y: 1216320};

  private readonly _path$: BehaviorSubject<LV95_Waypoint[]>;
  private readonly _way_points$: BehaviorSubject<LV95_Waypoint[]>;
  private readonly _pois$: BehaviorSubject<LV95_Waypoint[]>;
  private readonly _map_center$: BehaviorSubject<LV95_Coordinates>;


  private readonly _pointer$: BehaviorSubject<LV95_Coordinates | null>;


  constructor() {

    this._path$ = new BehaviorSubject<LV95_Waypoint[]>([]);
    this._way_points$ = new BehaviorSubject<LV95_Waypoint[]>([]);
    this._pois$ = new BehaviorSubject<LV95_Waypoint[]>([]);
    this._map_center$ = new BehaviorSubject<LV95_Coordinates>(MapAnimatorService.DEFAULT_MAP_CENTER)
    this._pointer$ = new BehaviorSubject<LV95_Coordinates | null>(null);

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
      .subscribe(([path, pois]) => this.create_walk_time_table(path, pois));

  }

  public move_pointer(coordinates: LV95_Waypoint | null) {
    this._pointer$.next(coordinates);
  }

  public async download_map() {

    /*
    localStorage['form_values'] = JSON.stringify(this.options.value);

    if (!this.route_uploaded || !this.route_file)
      return
*/
    // minify XML data
    // let xml_string = (await this.route_file.text()).toString()
    // xml_string = xml_string.replace(/>\s*/g, '>');  // Remove space after >
    // xml_string = xml_string.replace(/\s*</g, '<');  // Remove space before <

    /*
    let formData = new FormData();
    formData.append("options", JSON.stringify({
      'file_type': this.route_file.name.split('.').pop()
    }));
    formData.append("file_content", xml_string);

    let url = ExportSettingsComponent.baseURL + 'create?';
    url += '--list-of-pois=' + this.pois + 'create-elevation-profile';
    for (const option in this.options.controls) {

      if (['creator-name'].includes(option) && !this.options.controls[option].value.length)
        continue;

      if (option === 'map-scaling' && this.options.controls['auto-scale'].value)
        continue;

      if (option === 'auto-scale')
        continue;

      console.log(this.options.controls[option].value)
      url += '&--' + option + '=' + this.options.controls[option].value.toString().replaceAll('\n', ';')


    }


    fetch(url, {
      method: "POST",
      headers: {
        ContentType: 'multipart/form-data',
        Accept: 'application/json',
      },
      body: formData
    })
      .then(response => response.text())
      .then((resp: any) => {
        const response = JSON.parse(resp)
        this.uuid = response['uuid'];
      })
      .finally(() => this.router.navigate(['pending', this.uuid]));
 */
  }

  public async replace_route(route_file: File | undefined) {

    if (!route_file) {
      this.clear();
      return;
    }

    // minify XML data
    let xml_string = (await route_file.text()).toString()
    xml_string = xml_string.replace(/>\s*/g, '>');  // Remove space after >
    xml_string = xml_string.replace(/\s*</g, '<');  // Remove space before <

    let formData = new FormData();
    formData.append("options", JSON.stringify({
      'encoding': 'polyline',
      'file_type': route_file.name.split('.').pop()
    }));
    formData.append("file_content", xml_string);

    const url = MapAnimatorService.BASE_URL + 'parse_route';

    fetch(url, {
      method: "POST",
      headers: {
        ContentType: 'multipart/form-data',
        Accept: 'application/json',
      },
      body: formData
    })
      .then(response => response.json())
      .then((resp: any) => this.set_route(resp));


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


  async create_walk_time_table(path: LV95_Waypoint[], pois: LV95_Waypoint[]) {

    console.log('Updating walk time table')

    if (path == undefined) {
      console.error('No path found')
      return;
    }

    let data: any = {
      'encoding': 'polyline',
      'route': encode(path.map(p => [p.x, p.y]), 0),
      'elevation_data': encode(path.map(p => [p.accumulated_distance * 1_000, p.h]), 0),
      'pois': pois.map(p => `${p.x},${p.y}`).join(';'),
    };

    let formData = new FormData();
    formData.append("options", JSON.stringify(data));

    fetch(MapAnimatorService.BASE_URL + 'create-walk-time-table', {
      method: "POST",
      headers: {
        ContentType: 'application/json',
        Accept: 'application/json',
      },
      body: formData
    })
      .then(response => response.json())
      .then((resp: any) => {

        if (resp?.pois == undefined)
          throw new Error('File cannot be parsed!');

        if (resp?.pois_elevation == undefined)
          throw new Error('No elevation data found!');

        const pois = decode(resp?.pois, 0);
        const pois_elevation = decode(resp?.pois_elevation, 0);
        this._pois$.next(this.create_way_points(pois, pois_elevation, resp?.pois_names));

        const selected_way_points = decode(resp?.selected_way_points, 0);
        const selected_way_points_elevation = decode(resp?.selected_way_points_elevation, 0);
        this._way_points$.next(this.create_way_points(selected_way_points, selected_way_points_elevation));

      });
  }


  private async set_route(resp: any) {

    if (resp?.route == undefined)
      throw new Error('File cannot be parsed!');

    if (resp?.elevation_data == undefined)
      throw new Error('No elevation data found!');

    const path = decode(resp?.route, 0);
    const elevation = decode(resp?.elevation_data, 0);

    // If route is empty, we cleat all data
    if (path.length == 0) {
      this.clear();
      return;
    }

    if (path.length != elevation.length)
      throw new Error('Route and elevation arrays have different length');

    const way_points = this.create_way_points(path, elevation);

    this.update_map_center(way_points);
    this._path$?.next(way_points);
    this._pois$?.next([]);

    combineLatest([this._path$, this._pois$]).pipe(take(1))
      .subscribe(([path, pois]) => this.create_walk_time_table(path, pois));

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


}
