import {Injectable} from '@angular/core';
import {LV95_Coordinates} from "../helpers/coordinates";
import {BehaviorSubject, Observable, Subject} from "rxjs";

@Injectable({
  providedIn: 'root'
})
export class MapAnimatorService {

  private readonly _path$: Subject<LV95_Coordinates[]>;
  private readonly _map_center$: BehaviorSubject<LV95_Coordinates>;

  constructor() {

    this._path$ = new Subject<LV95_Coordinates[]>();
    this._map_center$ = new BehaviorSubject<LV95_Coordinates>({x: 2719675, y: 1216320})


  }

  get path$(): Observable<LV95_Coordinates[]> {
    return this._path$;
  }

  get map_center$(): Observable<LV95_Coordinates> {
    return this._map_center$;
  }


  distance_between(pkt1: LV95_Coordinates, pkt2: LV95_Coordinates) {
    return Math.sqrt(Math.pow(pkt1.x - pkt2.x, 2) + Math.pow(pkt1.y - pkt2.y, 2));
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

}
