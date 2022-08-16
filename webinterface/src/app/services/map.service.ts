import {Injectable} from '@angular/core';
import {WMTS} from "ol/source";
import {Tile} from "ol/layer";
import Map from "ol/Map";
import {Feature} from "ol";
import VectorSource from "ol/source/Vector";
import VectorLayer from "ol/layer/Vector";
import {Circle, Geometry, LineString} from "ol/geom";
import {MapAnimatorService} from "./map-animator.service";
import {Fill, Stroke, Style, Text} from "ol/style";
import {Extent} from "ol/extent";
import {getRenderPixel} from "ol/render";
import {take} from "rxjs/operators";
import {LV95_Coordinates, LV95_Waypoint} from "../helpers/coordinates";
import {SwisstopoMap} from "../helpers/swisstopo-map";
import {combineLatest} from "rxjs";
import {transform} from "ol/proj";
import {decode} from "@googlemaps/polyline-codec";
import {Coordinate} from "ol/coordinate";


@Injectable({
  providedIn: 'root'
})
export class MapService extends SwisstopoMap {


  private _path_layer_source: VectorSource<Geometry> = new VectorSource({wrapX: false});
  private pointer_layer_source: VectorSource<Geometry> = new VectorSource({wrapX: false});
  private way_points_layer_source: VectorSource<Geometry> = new VectorSource({wrapX: false});
  private path_changes_layer_source: VectorSource<Geometry> = new VectorSource({wrapX: false});

  private _map: Map | undefined;
  private pointer: number[] | undefined | null;
  private map_animator: MapAnimatorService | undefined;

  private dragging: boolean = false;
  private drag_start_point: LV95_Waypoint | undefined;
  private drag_end_point: LV95_Coordinates | undefined;
  private drag_start_before: LV95_Waypoint | undefined;
  private drag_start_after: LV95_Waypoint | undefined;

  public link_animator(map_animator: MapAnimatorService) {

    this.map_animator = map_animator;

    // adjust the map center to the route
    map_animator.map_center$.subscribe(center =>
      this._map?.getView().setCenter([center.x, center.y])
    );

    map_animator.path$.subscribe(path => {

      const feature = new Feature({
        geometry: new LineString(path.map(p => [p.x, p.y]))
      });

      feature.setStyle(new Style({
        stroke: new Stroke({color: '#efa038', width: 5})
      }));

      this._path_layer_source.clear();
      this._path_layer_source.addFeature(feature);

    });


    /*
     * Check if the map center must be updated, after the pointer has moved.
     * We will update the map center if the pointer is close to the edge of the map extent.
     *
     */
    map_animator.pointer$.subscribe(p => {

      if (p == null) {
        this.pointer = null;
        return
      }

      this.pointer = [p?.x, p?.y];

      const extend: Extent | undefined = this._map?.getView().calculateExtent(this._map?.getSize())
      if (extend == null) return;

      // Calculate the relative border size based on the current map extent and scale.
      const extent = this._map?.getView().calculateExtent(this._map?.getSize());
      if (extent == null) return;
      const min_border = Math.min(extent[2] - extent[0], extent[3] - extent[1]) * 0.05;

      // calculate the offset of the map center to the pointer coordinates
      const map_center = [(extend[2] + extend[0]) / 2, (extend[3] + extend[1]) / 2];
      const max_offset = [(extend[2] - extend[0]) / 2 - min_border, (extend[3] - extend[1]) / 2 - min_border];
      const offset = [p.x - map_center[0], p.y - map_center[1]];

      // build up the new map center
      const new_center = [...map_center];
      if (offset[0] > max_offset[0]) {
        new_center[0] = map_center[0] + (offset[0] - max_offset[0]);
      } else if (offset[0] < -max_offset[0]) {
        new_center[0] = map_center[0] + (offset[0] + max_offset[0]);
      }
      if (offset[1] > max_offset[1]) {
        new_center[1] = map_center[1] + (offset[1] - max_offset[1]);
      } else if (offset[1] < -max_offset[1]) {
        new_center[1] = map_center[1] + (offset[1] + max_offset[1]);
      }


      // Check if the map center has moved.
      if (new_center[0] == map_center[0] && new_center[1] == map_center[1]) {
        this._map?.render(); // We need to rerender the map anyway to show the new pointer location.
        return;
      }

      this.map_animator?.set_map_center({x: new_center[0], y: new_center [1]});

    });


    combineLatest([map_animator.way_points$, map_animator.pois$])
      .subscribe(([way_points, pois]) => {

        this.way_points_layer_source.clear();

        way_points.forEach(way_point => {

          const feature = new Feature({
            geometry: new Circle([way_point.x, way_point.y], 25)
          });

          feature.setStyle(new Style({
            stroke: new Stroke({color: '#f13c3c', width: 5})
          }));

          this.way_points_layer_source.addFeature(feature);

        });


        pois.forEach(way_point => {

          const feature = new Feature({
            geometry: new Circle([way_point.x, way_point.y], 30)
          });

          feature.setStyle(new Style({
            stroke: new Stroke({color: '#2043d7', width: 5}),
            text: new Text({
              text: way_point.name,
              fill: new Fill({color: '#f13c3c'}),
              font: 'bold 16px Open Sans'
            })
          }));

          this.way_points_layer_source.addFeature(feature);

        });


      });

  }

  public draw_map(layerLabel: string = 'pixelkarte') {

    // get base layers
    const wmtsLayer = this.get_base_WMTS_layer(layerLabel);
    const wmtsLayer_overlay = this.get_base_WMTS_layer(layerLabel);
    if (wmtsLayer == null || wmtsLayer_overlay == null) return;


    this._map = this.create_map_from_layers([
      wmtsLayer,
      new VectorLayer({source: this._path_layer_source}),
      wmtsLayer_overlay,
      new VectorLayer({source: this.pointer_layer_source}),
      new VectorLayer({source: this.way_points_layer_source}),
      new VectorLayer({source: this.path_changes_layer_source}),
    ]);

    this.render_pointer(wmtsLayer_overlay);
    this.register_listeners();

  }

  public get path_layer_source(): VectorSource<Geometry> | undefined {
    return this._path_layer_source;
  }

  get map(): Map | undefined {
    return this._map;
  }

  private register_listeners() {

    this._map?.on('pointermove', async (evt) => {

      const [nearest_point, dist] = await this.get_nearest_way_point(evt.coordinate);
      if (dist <= 50 && nearest_point) this.map_animator?.move_pointer(nearest_point);
      else this.map_animator?.move_pointer(null);

    });

    this._map?.on('click', async (evt) => {

      const [nearest_point, dist] = await this.get_nearest_way_point(evt.coordinate);
      if (dist <= 50 && nearest_point) this.map_animator?.add_point_of_interest(nearest_point);

    });

    this._map?.getViewport().addEventListener('contextmenu', (evt) => evt.preventDefault());
    document.addEventListener('mouseup', async () => {

      if (this.dragging && this.drag_start_before && this.drag_start_after && this.drag_end_point) {

        this.path_changes_layer_source.clear();
        const [p1, path1] = await this.drawingHandler([this.drag_start_before, this.drag_end_point], true);
        const [p2, path2] = await this.drawingHandler([this.drag_end_point, this.drag_start_after], false);

        this.map_animator?.path$.pipe(take(1)).subscribe(path => {

          // remove all points between p1 and p2 (using the accumulated distance)
          const new_path: any[] = path.filter(p => {
            const dist = p.accumulated_distance;
            return dist <= p1.accumulated_distance || dist >= p2.accumulated_distance;
          });

          // insert path1 after p1
          new_path.splice(new_path.findIndex(p => p.accumulated_distance === p1.accumulated_distance) + 1, 0, ...path1);

          // insert path2 before p2
          new_path.splice(new_path.findIndex(p => p.accumulated_distance === p2.accumulated_distance), 0, ...path2);

          this.map_animator?.update_path(new_path);
          this.path_changes_layer_source.clear();

        });


      }

      this.dragging = false;
      this.drag_start_point = undefined;
      this.drag_end_point = undefined;

    });

    this.map?.on('pointerdrag', async (event) => {

      // check if mouse button is pressed
      if (event.originalEvent.buttons !== 2) return;

      // don't move the map
      event.stopPropagation();


      if (!this.dragging) {

        // check if moved away from path
        const [nearest_point, dist] = await this.get_nearest_way_point(event.coordinate);
        if (dist > 50 || !nearest_point) return;
        this.dragging = true;
        this.drag_start_point = nearest_point;

        console.log('start dragging path...')

      } else {

        if (!this.drag_start_point) return;

        // only if event.coordinate differ significantly from this.drag_start_point
        if (Math.abs(event.coordinate[0] - this.drag_start_point.x) <= 10 ||
          Math.abs(event.coordinate[1] - this.drag_start_point.y) <= 10)
          return;

        const path: LV95_Waypoint[] = await new Promise(resolve => this.map_animator?.path$
          .pipe(take(1)).subscribe(path => resolve(path)));

        const current_acc_dist = this.drag_start_point?.accumulated_distance

        const dist = Math.sqrt(Math.pow(this.drag_start_point.x - event.coordinate[0], 2) +
          Math.pow(this.drag_start_point.y - event.coordinate[1], 2)) / 1_000;

        // get points along the path with a vertical distance of 10 from this.drag_start_point
        this.drag_start_before = path.filter((wp: LV95_Waypoint) => {
          return current_acc_dist - wp.accumulated_distance >= dist;
        }).pop();

        this.drag_start_after = path.filter((wp: LV95_Waypoint) => {
          return wp.accumulated_distance - current_acc_dist >= dist;
        })[0];

        if (!this.drag_start_before || !this.drag_start_after) return;

        const triangle: Coordinate[] = [
          [this.drag_start_before.x, this.drag_start_before.y],
          event.coordinate,
          [this.drag_start_after.x, this.drag_start_after.y]]

        this.drag_end_point = {x: event.coordinate[0], y: event.coordinate[1]};

        const triangleFeature = new Feature({
          geometry: new LineString(triangle)
        });

        triangleFeature.setStyle(new Style({
          stroke: new Stroke({color: '#e127ae', width: 5})
        }));

        this.path_changes_layer_source.clear();
        this.path_changes_layer_source.addFeature(triangleFeature)

      }


    });

  }


  private async get_nearest_way_point(p: Coordinate): Promise<[LV95_Waypoint | null, number]> {

    if (this.map_animator == undefined) return [null, Infinity];

    return new Promise((resolve, _) => {
      this.map_animator?.path$.pipe(take(1))
        .subscribe(path => {

          if (path == null || path.length == 0) return resolve([null, Infinity]);

          // get the coordinates of the point neares to the p
          const nearest_point = path.reduce((prev, curr) => {
            const prev_dist = Math.sqrt(Math.pow(prev.x - p[0], 2) + Math.pow(prev.y - p[1], 2));
            const curr_dist = Math.sqrt(Math.pow(curr.x - p[0], 2) + Math.pow(curr.y - p[1], 2));
            return prev_dist < curr_dist ? prev : curr;
          });

          const dist = Math.sqrt(Math.pow(nearest_point.x - p[0], 2) + Math.pow(nearest_point.y - p[1], 2));

          resolve([nearest_point, dist])

        });

    });

  }

  private render_pointer(wmtsLayer: Tile<WMTS>) {

    const radius = 12;

    // before rendering the layer, do some clipping
    wmtsLayer.on('prerender', (event) => {

      const ctx = event.context as CanvasRenderingContext2D;
      ctx.save();
      ctx.beginPath();

      if (this.pointer != null) {

        const pointer = this._map?.getPixelFromCoordinate(this.pointer);

        if (pointer != null) {
          // only show a circle around the mouse
          const pixel = getRenderPixel(event, pointer);
          const offset = getRenderPixel(event, [
            pointer[0] + radius,
            pointer[1],
          ]);
          const canvasRadius = Math.sqrt(
            Math.pow(offset[0] - pixel[0], 2) + Math.pow(offset[1] - pixel[1], 2)
          );
          ctx.arc(pixel[0], pixel[1], canvasRadius, 0, 2 * Math.PI);
          ctx.lineWidth = (12 * canvasRadius) / radius;
          ctx.strokeStyle = '#EFA038FF';
          ctx.stroke();
        }

      }

      ctx.clip();

    });

    // after rendering the layer, restore the canvas context
    wmtsLayer.on('postrender', function (event) {
      const ctx = event.context as CanvasRenderingContext2D;
      ctx.restore();
    });

  }

  private async drawingHandler(coordinates: LV95_Coordinates[], route_by_start = true) {

    return new Promise<[LV95_Waypoint, LV95_Coordinates[]]>(async (resolve, reject) => {
      const WGS84 = coordinates.map(c => transform([c.x, c.y], 'EPSG:2056', 'EPSG:4326'));

      if (coordinates.length == 2) {

        // fetch path from valhalla/valhalla at localhost:8002 with json in url
        const url = 'http://localhost:8002/route?json=' + encodeURIComponent(JSON.stringify({
          locations: [
            {lat: WGS84[0][1], lon: WGS84[0][0]},
            {lat: WGS84[1][1], lon: WGS84[1][0]},
          ],
          costing: 'pedestrian',
          radius: 25
        }));

        // fetch path from valhalla/valhalla at localhost:8002
        const data = await fetch(url, {method: 'POST'}).then(response => response.json());
        const shape: string = data.trip.legs[0].shape;

        let decoded_path = decode(shape, 6).map(p =>
          transform([p[1], p[0]], 'EPSG:4326', 'EPSG:2056'));

        this.map_animator?.path$.pipe(take(1)).subscribe(async path => {

          if (route_by_start) decoded_path = decoded_path.reverse();

          let near_path = true;
          let last_elem: Coordinate | undefined = undefined;

          // remove points at the beginning of the path
          while (decoded_path.length > 0 && near_path) {

            let [_, dist] = await this.get_nearest_way_point(decoded_path[decoded_path.length - 1]);
            near_path = dist <= 20;
            last_elem = decoded_path.pop();

          }

          if (last_elem != null) {
            let [last_coordinate, _] = await this.get_nearest_way_point(last_elem);
            if (last_coordinate != null) {
              decoded_path.push([last_coordinate.x, last_coordinate.y]);

              if (route_by_start) decoded_path = decoded_path.reverse();

              resolve([last_coordinate, decoded_path.map(c => {
                return {'x': c[0], 'y': c[1]} as LV95_Coordinates;
              })]);

              const feature = new Feature({
                geometry: new LineString(decoded_path)
              });

              feature.setStyle(new Style({
                stroke: new Stroke({color: '#e127ae', width: 5})
              }));

              this.path_changes_layer_source?.addFeature(feature);

            }
          }

        });
      }
    });

  }
}
