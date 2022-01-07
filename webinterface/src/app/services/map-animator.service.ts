import {Injectable} from '@angular/core';
import {LV95_Coordinates} from "../helpers/coordinates";
import * as gpxParser from "gpxparser";
import {Point} from "gpxparser";
import {LV03TransformerService} from "./lv03-transformer.service";
import {BehaviorSubject, Observable, Subject} from "rxjs";

@Injectable({
  providedIn: 'root'
})
export class MapAnimatorService {

  private readonly _path$: Subject<LV95_Coordinates[]>;
  private readonly _map_center$: BehaviorSubject<LV95_Coordinates>;
  private readonly _bbox$: BehaviorSubject<[LV95_Coordinates, LV95_Coordinates]>;

  constructor(private transformer: LV03TransformerService) {

    this._path$ = new Subject<LV95_Coordinates[]>();
    this._map_center$ = new BehaviorSubject<LV95_Coordinates>({x: 2719675, y: 1216320})
    this._bbox$ = new BehaviorSubject<[LV95_Coordinates, LV95_Coordinates]>([{x: 2718500, y: 1216000}, {x: 2720000, y: 1217000}]);

  }

  get path$(): Observable<LV95_Coordinates[]> {
    return this._path$;
  }

  get map_center$(): Observable<LV95_Coordinates> {
    return this._map_center$;
  }

  get bbox$(): Observable<[LV95_Coordinates, LV95_Coordinates]> {
    return this._bbox$;
  }

  add_gpx_file(gpx_file: File) {

    const file_reader = new FileReader();
    file_reader.readAsText(gpx_file);

    file_reader.onload = async () => {

      // Parse GPX file
      // @ts-ignore
      const gpx = new gpxParser();
      gpx.parse(file_reader.result);

      // add coordinates to path array, in LV95 format
      const path: LV95_Coordinates[] = []
      const points = gpx.tracks[0].points;

      this.update_map_center(points);


      // Returns a Promise that resolves after "ms" Milliseconds
      const timer = (ms: number) => new Promise(res => setTimeout(res, ms))

      const delay = 10_000 / gpx.tracks[0].distance.total;

      for (let i = 1; i < points.length; i++) {

        const sec: { lat: number; lon: number; } = points[i];
        path.push(this.transformer.WGStoCH(sec.lat, sec.lon))
        this._path$?.next(path);

        await timer(delay * (gpx.tracks[0].distance.cumul[i] - gpx.tracks[0].distance.cumul[i - 1]));

      }

    };

  }

  private update_map_center(points: Point[]) {

    let x_min = points[0].lat;
    let y_min = points[0].lon;

    let x_max = points[0].lat;
    let y_max = points[0].lon;

    points.forEach(point => {

      if (point.lat < x_min) x_min = point.lat;
      if (point.lon < y_min) y_min = point.lon;
      if (point.lat > x_max) x_max = point.lat;
      if (point.lon > y_max) y_max = point.lon;

    });

    this._bbox$?.next([
      this.transformer.WGStoCH(x_min, y_min),
      this.transformer.WGStoCH(x_max, y_max)
    ]);

    this._map_center$?.next(this.transformer.WGStoCH((x_max + x_min) / 2, (y_max + y_min) / 2));


  }

}
