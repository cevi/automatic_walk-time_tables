import {Injectable} from '@angular/core';
import {LV95_Coordinates} from "../helpers/coordinates";
import * as gpxParser from "gpxparser";
import {LV03TransformerService} from "./lv03-transformer.service";
import {Observable, Subscriber} from "rxjs";
import {Point} from "gpxparser";

@Injectable({
  providedIn: 'root'
})
export class MapAnimatorService {

  private path_Observer: Subscriber<LV95_Coordinates[]> | undefined
  path: Observable<LV95_Coordinates[]>;

  private map_center_Observer: Subscriber<LV95_Coordinates> | undefined
  map_center: Observable<LV95_Coordinates>;

  constructor(private transformer: LV03TransformerService) {

    this.path = new Observable<LV95_Coordinates[]>(sub => {
      this.path_Observer = sub;
    });

    this.map_center = new Observable<LV95_Coordinates>(sub => {
      this.map_center_Observer = sub;
    });

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

      for (let i = 1; i < points.length; i ++){

        const sec: { lat: number; lon: number; } = points[i];
        path.push(this.transformer.WGStoCH(sec.lat, sec.lon))
        this.path_Observer?.next(path);

        await timer(delay * (gpx.tracks[0].distance.cumul[i] - gpx.tracks[0].distance.cumul[i-1]));

      }


    };

  }

  private update_map_center(points: Point[]) {
    let x = 0;
    let y = 0;
    let count = 0;
    for (let i = 0; i < points.length; i += 100, count++) {

      x += points[i].lat;
      y += points[i].lon;

    }

    this.map_center_Observer?.next(this.transformer.WGStoCH(x / count, y / count));

  }
}
