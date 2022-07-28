import {Injectable} from '@angular/core';
import {LV95_Coordinates} from "../helpers/coordinates";
import {BehaviorSubject, Observable, Subject} from "rxjs";

@Injectable({
  providedIn: 'root'
})
export class MapAnimatorService {

  private readonly _path$: Subject<LV95_Coordinates[]>;
  private readonly _map_center$: BehaviorSubject<LV95_Coordinates>;
  private readonly _bbox$: BehaviorSubject<[LV95_Coordinates, LV95_Coordinates]>;

  constructor() {

    this._path$ = new Subject<LV95_Coordinates[]>();
    this._map_center$ = new BehaviorSubject<LV95_Coordinates>({x: 2719675, y: 1216320})
    this._bbox$ = new BehaviorSubject<[LV95_Coordinates, LV95_Coordinates]>([{x: 2718500, y: 1216000}, {
      x: 2720000,
      y: 1217000
    }]);

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

  distance_between(pkt1: LV95_Coordinates, pkt2: LV95_Coordinates) {
    return Math.sqrt(Math.pow(pkt1.x - pkt2.x, 2) + Math.pow(pkt1.y - pkt2.y, 2));
  }

  async add_route_json(route_as_json: string) {

    const route = JSON.parse(route_as_json.replace(/'/g, '"'));

    const total_distance = route['way_points'].at(-1)['accumulated_distance'];
    console.log('total_distance', total_distance);

    // map  route['way_points'] to Point objects
    const points = route['way_points'].map((way_point: any) => {
      return {'x': way_point['point']['lat'], 'y': way_point['point']['lon']};
    });

    this.update_map_center(points);

    // Returns a Promise that resolves after "ms" Milliseconds
    const timer = (ms: number) => new Promise(res => setTimeout(res, ms))

    const delay = 10_000 / total_distance;

    // add coordinates to path array, in LV95 format
    const path: LV95_Coordinates[] = []
    path.push(points[0])

    for (let i = 1; i < points.length; i++) {

      path.push(points[i])
      this._path$?.next(path);

      await timer(delay * this.distance_between(path[i - 1], path[i]));

    }


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

    this._bbox$?.next([
      {'x': x_min, 'y': y_min},
      {'x': x_max, 'y': y_max}
    ]);


    this._map_center$?.next({'x': (x_max + x_min) / 2, 'y': (y_max + y_min) / 2});


  }

}
