import { Injectable } from '@angular/core';
import { WMTS } from 'ol/source';
import { Layer, Tile } from 'ol/layer';
import Map from 'ol/Map';
import { Feature, MapBrowserEvent } from 'ol';
import VectorSource from 'ol/source/Vector';
import VectorLayer from 'ol/layer/Vector';
import { Circle, Geometry, LineString, Point } from 'ol/geom';
import { MapAnimatorService } from './map-animator.service';
import {
  Fill,
  Stroke,
  Style,
  Text,
  Icon,
  Circle as CircleStyle,
} from 'ol/style';
import { Extent } from 'ol/extent';
import { getRenderPixel } from 'ol/render';
import { take } from 'rxjs/operators';
import { transformExtent } from 'ol/proj';
import { bbox } from 'ol/loadingstrategy';
import { LV95_Waypoint } from '../helpers/coordinates';
import { SwisstopoMap } from '../helpers/swisstopo-map';
import { combineLatest } from 'rxjs';
import { Modify } from 'ol/interaction';
import Overlay from 'ol/Overlay';

@Injectable({
  providedIn: 'root',
})
export class MapService extends SwisstopoMap {
  private path_layer_source = new VectorSource({ wrapX: false });
  private pointer_layer_source = new VectorSource({ wrapX: false });
  private way_points_layer_source = new VectorSource({ wrapX: false });

  private fountains_layer_source = new VectorSource({
    loader: (extent, resolution, projection, success, failure) => {
      // Only load if resolution is small enough (zoomed in enough, > 100 is too far out)
      if (resolution > 100) {
        if (success) success([]);
        return;
      }

      const ext4326 = transformExtent(extent, projection, 'EPSG:4326');
      const query = `[out:json];(nwr[amenity~"drinking_water|fountain|water_point"](${ext4326[1]},${ext4326[0]},${ext4326[3]},${ext4326[2]});nwr[man_made~"water_well|water_tap"](${ext4326[1]},${ext4326[0]},${ext4326[3]},${ext4326[2]}););out qt center;`;
      const url =
        'https://overpass.osm.ch/api/interpreter?data=' +
        encodeURIComponent(query);

      fetch(url)
        .then((response) => response.json())
        .then((data) => {
          const features: Feature[] = [];
          data.elements.forEach((el: any) => {
            let coords;
            if (el.type === 'node') coords = [el.lon, el.lat];
            else if (el.center) coords = [el.center.lon, el.center.lat];

            if (coords) {
              const pt = new Point(coords).transform('EPSG:4326', projection);
              const feature = new Feature({ geometry: pt, ...el.tags });
              features.push(feature);
            }
          });
          this.fountains_layer_source.addFeatures(features);
          if (success) success(features as any);
        })
        .catch((err) => {
          console.error(err);
          if (failure) failure();
        });
    },
    strategy: bbox,
  });

  private map: Map | undefined;
  private pointer: number[] | undefined | null;
  private map_animator: MapAnimatorService | undefined;

  public link_animator(map_animator: MapAnimatorService) {
    this.map_animator = map_animator;

    // adjust the map center to the route
    map_animator.map_center$.subscribe((center) =>
      this.map?.getView().setCenter([center.x, center.y]),
    );

    map_animator.path$.subscribe((path) => {
      this.path_layer_source.clear();

      if (!path || path.length === 0) return;

      if (path.length === 1) {
        const feature = new Feature({
          geometry: new Point([path[0].x, path[0].y]),
        });
        feature.setStyle(
          new Style({
            image: new CircleStyle({
              radius: 6,
              fill: new Fill({ color: '#efa038' }),
              stroke: new Stroke({ color: '#fff', width: 2 }),
            }),
          }),
        );
        this.path_layer_source.addFeature(feature);
        return;
      }

      const feature = new Feature({
        geometry: new LineString(path.map((p) => [p.x, p.y])),
      });

      feature.setStyle((feature, resolution) => {
        const styles = [
          new Style({
            stroke: new Stroke({ color: '#fff', width: 7 }),
          }),
          new Style({
            stroke: new Stroke({ color: '#efa038', width: 4 }),
          }),
        ];

        const geometry = feature.getGeometry() as LineString;
        const coords = geometry.getCoordinates();

        // draw an arrow every ~200 pixels
        const interval = 200 * resolution;
        let next_arrow = interval / 2; // offset the first arrow
        let current_distance = 0;

        for (let i = 0; i < coords.length - 1; i++) {
          const start = coords[i];
          const end = coords[i + 1];
          const dx = end[0] - start[0];
          const dy = end[1] - start[1];
          const segment_len = Math.sqrt(dx * dx + dy * dy);

          while (current_distance + segment_len >= next_arrow) {
            const fraction = (next_arrow - current_distance) / segment_len;
            const x = start[0] + dx * fraction;
            const y = start[1] + dy * fraction;
            const rotation = Math.PI / 2 - Math.atan2(dy, dx);

            styles.push(
              new Style({
                geometry: new Point([x, y]),
                image: new Icon({
                  src: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" fill="%23efa038"><polygon points="12,2 22,12 16,12 16,22 8,22 8,12 2,12" stroke="white" stroke-width="1.5" stroke-linejoin="round"/></svg>',
                  anchor: [0.5, 0.5],
                  rotateWithView: true,
                  rotation: rotation,
                }),
              }),
            );

            next_arrow += interval;
          }

          current_distance += segment_len;
        }

        return styles;
      });

      this.path_layer_source.addFeature(feature);
    });

    /*
     * Check if the map center must be updated, after the pointer has moved.
     * We will update the map center if the pointer is close to the edge of the map extent.
     *
     */
    map_animator.pointer$.subscribe((p) => {
      if (p == null) {
        this.pointer = null;
        return;
      }

      this.pointer = [p?.x, p?.y];

      const extend: Extent | undefined = this.map
        ?.getView()
        .calculateExtent(this.map?.getSize());
      if (extend == null) return;

      // Calculate the relative border size based on the current map extent and scale.
      const extent = this.map?.getView().calculateExtent(this.map?.getSize());
      if (extent == null) return;
      const min_border =
        Math.min(extent[2] - extent[0], extent[3] - extent[1]) * 0.05;

      // calculate the offset of the map center to the pointer coordinates
      const map_center = [
        (extend[2] + extend[0]) / 2,
        (extend[3] + extend[1]) / 2,
      ];
      const max_offset = [
        (extend[2] - extend[0]) / 2 - min_border,
        (extend[3] - extend[1]) / 2 - min_border,
      ];
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

      this.map_animator?.set_map_center({ x: new_center[0], y: new_center[1] });
    });

    combineLatest([map_animator.way_points$, map_animator.pois$]).subscribe(
      ([way_points, pois]) => {
        this.way_points_layer_source.clear();

        if (this.map_animator && !this.map_animator.export_mode$.getValue()) {
          // Drawing Mode: Always mark the first and last point of the route
          if (way_points.length > 0) {
            const endpoints =
              way_points.length === 1
                ? [way_points[0]]
                : [way_points[0], way_points[way_points.length - 1]];
            endpoints.forEach((wp) => {
              const feature = new Feature({
                geometry: new Point([wp.x, wp.y]),
              });
              feature.setStyle(
                new Style({
                  image: new CircleStyle({
                    radius: 6,
                    fill: new Fill({ color: '#efa038' }),
                    stroke: new Stroke({ color: '#fff', width: 2 }),
                  }),
                }),
              );
              this.way_points_layer_source.addFeature(feature);
            });
          }
        }

        if (this.map_animator && this.map_animator.export_mode$.getValue()) {
          way_points.forEach((way_point) => {
            const feature = new Feature({
              geometry: new Point([way_point.x, way_point.y]),
            });

            feature.setStyle(
              new Style({
                image: new CircleStyle({
                  radius: 8,
                  fill: new Fill({ color: '#fff' }),
                  stroke: new Stroke({ color: '#efa038', width: 4 }),
                }),
              }),
            );

            this.way_points_layer_source.addFeature(feature);
          });

          pois.forEach((way_point) => {
            const feature = new Feature({
              geometry: new Point([way_point.x, way_point.y]),
            });

            // check if the poi is actually selected
            const is_selected =
              way_points.find(
                (p) => p.x == way_point.x && p.y == way_point.y,
              ) != undefined;

            feature.setStyle(
              new Style({
                image: new CircleStyle({
                  radius: 8,
                  fill: new Fill({ color: '#fff' }),
                  stroke: is_selected
                    ? new Stroke({ color: '#efa038', width: 4 })
                    : new Stroke({ color: '#efa03880', width: 4 }),
                }),
                text: new Text({
                  text: way_point.name,
                  fill: new Fill({ color: '#333' }),
                  stroke: new Stroke({ color: '#fff', width: 3 }),
                  font: 'bold 16px Open Sans',
                  offsetY: 20,
                }),
              }),
            );

            this.way_points_layer_source.addFeature(feature);
          });
        }
      },
    );
  }

  public draw_map(
    layerLabel: string = 'pixelkarte',
    showFountains: boolean = false,
    showHaltestellen: boolean = false,
    target_canvas: string = 'map-canvas',
  ) {
    let oldCenter: number[] | undefined;
    let oldResolution: number | undefined;

    if (this.map) {
      const view = this.map.getView();
      oldCenter = view.getCenter();
      oldResolution = view.getResolution();
      this.map.setTarget(undefined);
    }

    // get base layers
    const wmtsLayer =
      layerLabel !== 'keine' ? this.get_base_WMTS_layer(layerLabel) : null;
    const wmtsLayer_overlay =
      layerLabel !== 'keine' ? this.get_base_WMTS_layer(layerLabel) : null;
    const haltestellen_overlay = showHaltestellen
      ? this.get_base_WMTS_layer('haltestellen')
      : null;

    const layers: Layer[] = [];
    if (wmtsLayer) layers.push(wmtsLayer);
    if (haltestellen_overlay) layers.push(haltestellen_overlay);
    layers.push(new VectorLayer({ source: this.path_layer_source }));
    if (wmtsLayer_overlay) layers.push(wmtsLayer_overlay);

    if (showFountains) {
      layers.push(
        new VectorLayer({
          source: this.fountains_layer_source,
          style: new Style({
            image: new Icon({
              src: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 -960 960 960" width="24" height="24"><path d="M480-120q-106 0-180-71.5T226-365q0-67 43-138.5T387-644q20-20 41.5-40t46.5-41q25 21 46.5 41t41.5 40q76 71 119 140.5T734-365q0 102-74 173.5T480-120Z" fill="%230070FF" stroke="white" stroke-width="40"/></svg>',
              anchor: [0.5, 1],
              scale: 1,
            }),
          }),
        }),
      );
    }

    layers.push(new VectorLayer({ source: this.pointer_layer_source }));
    layers.push(new VectorLayer({ source: this.way_points_layer_source }));

    this.map = this.create_map_from_layers(layers, target_canvas);

    if (oldCenter && oldResolution) {
      this.map.getView().setCenter(oldCenter);
      this.map.getView().setResolution(oldResolution);
    }

    if (wmtsLayer_overlay) this.render_pointer(wmtsLayer_overlay);
    this.register_listeners();

    const styleElement = document.createElement('style');
    styleElement.innerHTML = `
      .waypoint-tooltip {
        background: white;
        padding: 5px 10px;
        border-radius: 4px;
        box-shadow: 0 2px 4px rgba(0,0,0,0.2);
        display: flex;
        align-items: center;
        gap: 10px;
        font-family: inherit;
        font-size: 14px;
        pointer-events: auto;
      }
      .waypoint-tooltip button {
        background: white;
        border: 1px solid #ccc;
        border-radius: 4px;
        cursor: pointer;
        padding: 4px;
        display: flex;
        justify-content: center;
        align-items: center;
        color: #d32f2f;
      }
      .waypoint-tooltip button:hover {
        background: #f5f5f5;
      }
    `;
    document.head.appendChild(styleElement);
  }

  private register_listeners() {
    const tooltipElement = document.createElement('div');
    tooltipElement.className = 'waypoint-tooltip';
    tooltipElement.innerHTML = `
        <span>Klicken zum Löschen</span>
    `;
    const tooltipOverlay = new Overlay({
      element: tooltipElement,
      offset: [0, -15],
      positioning: 'bottom-center',
      stopEvent: true,
    });
    this.map?.addOverlay(tooltipOverlay);

    let hovered_waypoint: LV95_Waypoint | null = null;
    let is_hovering_tooltip = false;

    tooltipElement.addEventListener(
      'mouseenter',
      () => (is_hovering_tooltip = true),
    );
    tooltipElement.addEventListener('mouseleave', () => {
      is_hovering_tooltip = false;
      tooltipOverlay.setPosition(undefined);
      hovered_waypoint = null;
    });

    // Deletion handler
    const deleteBtn = tooltipElement.querySelector('#delete-waypoint-btn');
    if (deleteBtn) {
      deleteBtn.addEventListener('click', () => {
        if (hovered_waypoint && this.map_animator) {
          this.map_animator.delete_route_waypoint(hovered_waypoint);
          tooltipOverlay.setPosition(undefined);
        }
      });
    }

    const modify = new Modify({
      source: this.path_layer_source,
    });
    modify.on('modifyend', async (evt) => {
      const features = evt.features.getArray();
      if (features.length > 0 && this.map_animator) {
        const geom = features[0].getGeometry() as LineString;
        const coords = geom.getCoordinates();
        await this.map_animator.handle_modify_event(coords);
      }
    });
    this.map?.addInteraction(modify);

    this.map_animator?.export_mode$.subscribe((is_export) => {
      modify.setActive(!is_export);
    });

    // Right-click to undo the last waypoint
    const viewport = this.map?.getViewport();
    if (viewport) {
      viewport.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        if (
          this.map_animator &&
          !this.map_animator.export_mode$.getValue() &&
          this.map_animator.can_undo()
        ) {
          this.map_animator.undo();
        }
      });
    }

    this.map?.on('pointermove', async (evt) => {
      if (this.map_animator && this.map_animator.export_mode$.getValue()) {
        let foundWaypoint = false;
        this.map?.forEachFeatureAtPixel(
          evt.pixel,
          (f, l) => {
            if (l && (l as any).getSource() === this.way_points_layer_source) {
              const geom = f.getGeometry() as Point;
              const center = geom.getCoordinates();
              tooltipOverlay.setPosition(center);
              hovered_waypoint = {
                x: center[0],
                y: center[1],
              } as LV95_Waypoint;
              foundWaypoint = true;
            }
          },
          { hitTolerance: 15 },
        );

        if (!foundWaypoint && !is_hovering_tooltip) {
          tooltipOverlay.setPosition(undefined);
          hovered_waypoint = null;
        }

        const [nearest_point, dist] = await this.get_nearest_path_point(evt);
        if (dist <= 50 && nearest_point)
          this.map_animator?.move_pointer(nearest_point);
        else this.map_animator?.move_pointer(null);
      } else {
        tooltipOverlay.setPosition(undefined);
        hovered_waypoint = null;

        // draw the pointer (we are in the drawing mode)
        this.pointer = evt.coordinate;
        this.pointer_layer_source.clear();
      }
    });

    this.map?.on('click', async (evt) => {
      if (this.map_animator && this.map_animator.export_mode$.getValue()) {
        const [nearest_point, dist] = await this.get_nearest_path_point(evt);
        const [nearest_poi, dist_poi] = await this.get_nearest_poi(evt);

        if (dist <= 50 && nearest_point && dist_poi >= 50)
          this.map_animator?.add_point_of_interest(nearest_point);
        else if (dist_poi <= 50 && nearest_poi)
          this.map_animator?.delete_poi(nearest_poi);

        return;
      }

      await this.map_animator?.add_way_point({
        x: evt.coordinate[0],
        y: evt.coordinate[1],
      });
    });
  }

  private async get_nearest_poi(
    event: MapBrowserEvent<any>,
  ): Promise<[LV95_Waypoint | null, number]> {
    const p = event.coordinate;

    if (this.map_animator == undefined) return [null, Infinity];

    return new Promise((resolve, _) => {
      if (this.map_animator == undefined) return resolve([null, Infinity]);

      this.map_animator?.pois$.pipe(take(1)).subscribe((pois) => {
        if (pois.length == 0) return resolve([null, Infinity]);

        // get the coordinates of the point neares to the p
        const nearest_point = pois.reduce((prev, curr) => {
          const prev_dist = Math.sqrt(
            Math.pow(prev.x - p[0], 2) + Math.pow(prev.y - p[1], 2),
          );
          const curr_dist = Math.sqrt(
            Math.pow(curr.x - p[0], 2) + Math.pow(curr.y - p[1], 2),
          );
          return prev_dist < curr_dist ? prev : curr;
        });

        const dist = Math.sqrt(
          Math.pow(nearest_point.x - p[0], 2) +
            Math.pow(nearest_point.y - p[1], 2),
        );

        resolve([nearest_point, dist]);
      });
    });
  }

  private async get_nearest_path_point(
    event: MapBrowserEvent<any>,
  ): Promise<[LV95_Waypoint | null, number]> {
    const p = event.coordinate;

    if (this.map_animator == undefined) return [null, Infinity];

    return new Promise((resolve, _) => {
      this.map_animator?.path$.pipe(take(1)).subscribe((path) => {
        if (path == null || path.length == 0) return resolve([null, Infinity]);

        // get the coordinates of the point neares to the p
        const nearest_point = path.reduce((prev, curr) => {
          const prev_dist = Math.sqrt(
            Math.pow(prev.x - p[0], 2) + Math.pow(prev.y - p[1], 2),
          );
          const curr_dist = Math.sqrt(
            Math.pow(curr.x - p[0], 2) + Math.pow(curr.y - p[1], 2),
          );
          return prev_dist < curr_dist ? prev : curr;
        });

        const dist = Math.sqrt(
          Math.pow(nearest_point.x - p[0], 2) +
            Math.pow(nearest_point.y - p[1], 2),
        );

        resolve([nearest_point, dist]);
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
            Math.pow(offset[0] - pixel[0], 2) +
              Math.pow(offset[1] - pixel[1], 2),
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
