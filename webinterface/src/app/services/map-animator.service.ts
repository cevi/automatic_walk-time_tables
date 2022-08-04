import {Injectable} from '@angular/core';
import {LV95_Coordinates} from "../helpers/coordinates";
import {BehaviorSubject, Observable, Subject} from "rxjs";

@Injectable({
  providedIn: 'root'
})
export class MapAnimatorService {

  private readonly _path$: Subject<LV95_Coordinates[]>;
  private readonly _way_points$: Subject<LV95_Coordinates[]>;
  private readonly _map_center$: BehaviorSubject<LV95_Coordinates>;

  private readonly _current_location$: Subject<LV95_Coordinates>;

  private _path: LV95_Coordinates[] | undefined;

  constructor() {

    this._path$ = new Subject<LV95_Coordinates[]>();
    this._map_center$ = new BehaviorSubject<LV95_Coordinates>({x: 2719675, y: 1216320})
    this._way_points$ = new Subject<LV95_Coordinates[]>();

    this._current_location$ = new Subject<LV95_Coordinates>();

    this._path$.subscribe(path => {
      this._path = path;
    });

  }

  get path$(): Observable<LV95_Coordinates[]> {
    return this._path$;
  }

  get map_center$(): Observable<LV95_Coordinates> {
    return this._map_center$;
  }

  get path(): LV95_Coordinates[] | undefined {
    return this._path;
  }

  get way_points$(): Observable<LV95_Coordinates[]> {
    return this._way_points$;
  }

  get current_location$(): Observable<LV95_Coordinates> {
    return this._current_location$;
  }


  async add_route(route_as_array: number[][]) {

    // map  route['way_points'] to Point objects
    const points = route_as_array.map((pkt: any) => {
      return {'x': pkt[0], 'y': pkt[1]};
    });

    this.update_map_center(points);
    this._path$?.next(points);

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

  add_way_points(selected_way_points: number[][]) {

    const points = selected_way_points.map((pkt: any) => {
      return {'x': pkt[0], 'y': pkt[1]};
    });

    this._way_points$?.next(points);


  }

  set_location(pkt: LV95_Coordinates) {
    this._current_location$.next(pkt);
  }

}
