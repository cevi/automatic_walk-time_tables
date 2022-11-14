import {Injectable} from '@angular/core';
import {WMTS} from "ol/source";
import {Tile} from "ol/layer";
import Map from "ol/Map";
import {Feature, MapBrowserEvent} from "ol";
import VectorSource from "ol/source/Vector";
import VectorLayer from "ol/layer/Vector";
import {Circle, Geometry, LineString} from "ol/geom";
import {MapAnimatorService} from "./map-animator.service";
import {Fill, Stroke, Style, Text} from "ol/style";
import {Extent} from "ol/extent";
import {getRenderPixel} from "ol/render";
import {take} from "rxjs/operators";
import {LV95_Waypoint} from "../helpers/coordinates";
import {SwisstopoMap} from "../helpers/swisstopo-map";
import {combineLatest} from "rxjs";


@Injectable({
  providedIn: 'root'
})
export class MapService extends SwisstopoMap {

  private path_layer_source: VectorSource<Geometry> = new VectorSource({wrapX: false});
  private pointer_layer_source: VectorSource<Geometry> = new VectorSource({wrapX: false});
  private way_points_layer_source: VectorSource<Geometry> = new VectorSource({wrapX: false});

  private map: Map | undefined;
  private pointer: number[] | undefined | null;
  private map_animator: MapAnimatorService | undefined;

  public link_animator(map_animator: MapAnimatorService) {

    this.map_animator = map_animator;

    // adjust the map center to the route
    map_animator.map_center$.subscribe(center =>
      this.map?.getView().setCenter([center.x, center.y])
    );

    map_animator.path$.subscribe(path => {

      const feature = new Feature({
        geometry: new LineString(path.map(p => [p.x, p.y]))
      });

      feature.setStyle(new Style({
        stroke: new Stroke({color: '#efa038', width: 5})
      }));

      this.path_layer_source.clear();
      this.path_layer_source.addFeature(feature);

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

      const extend: Extent | undefined = this.map?.getView().calculateExtent(this.map?.getSize())
      if (extend == null) return;

      // Calculate the relative border size based on the current map extent and scale.
      const extent = this.map?.getView().calculateExtent(this.map?.getSize());
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
        this.map?.render(); // We need to rerender the map anyway to show the new pointer location.
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

  public draw_map(layerLabel: string = 'pixelkarte', target_canvas: string = 'map-canvas') {

    // get base layers
    const wmtsLayer = this.get_base_WMTS_layer(layerLabel);
    const wmtsLayer_overlay = this.get_base_WMTS_layer(layerLabel);
    if (wmtsLayer == null || wmtsLayer_overlay == null) return;

    this.map = this.create_map_from_layers([
      wmtsLayer,
      new VectorLayer({source: this.path_layer_source}),
      wmtsLayer_overlay,
      new VectorLayer({source: this.pointer_layer_source}),
      new VectorLayer({source: this.way_points_layer_source}),
    ], target_canvas);

    this.render_pointer(wmtsLayer_overlay);
    this.register_listeners();

  }

  private register_listeners() {

    this.map?.on('pointermove', async (evt) => {

      const [nearest_point, dist] = await this.get_nearest_way_point(evt);
      if (dist <= 50 && nearest_point) this.map_animator?.move_pointer(nearest_point);
      else this.map_animator?.move_pointer(null);

    });

    this.map?.on('click', async (evt) => {

      const [nearest_point, dist] = await this.get_nearest_way_point(evt);
      if (dist <= 50 && nearest_point) this.map_animator?.add_point_of_interest(nearest_point);

    });

  }


  private async get_nearest_way_point(event: MapBrowserEvent<any>): Promise<[LV95_Waypoint | null, number]> {

    const p = event.coordinate;

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

        const pointer = this.map?.getPixelFromCoordinate(this.pointer);

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

}
