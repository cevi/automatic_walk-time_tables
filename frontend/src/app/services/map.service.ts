import { Injectable } from '@angular/core';
import { Layer } from 'ol/layer';
import Map from 'ol/Map';
import { Feature } from 'ol';
import VectorSource from 'ol/source/Vector';
import VectorLayer from 'ol/layer/Vector';
import { Point } from 'ol/geom';
import { MapAnimatorService } from './map-animator.service';
import { Style, Icon } from 'ol/style';
import { transformExtent } from 'ol/proj';
import { bbox } from 'ol/loadingstrategy';
import { SwisstopoMap } from '../helpers/swisstopo-map';
import { MapDrawingRenderer } from './map-drawing-renderer';
import { MapExportRenderer } from './map-export-renderer';

@Injectable({
  providedIn: 'root',
})
export class MapService extends SwisstopoMap {
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
  private map_animator: MapAnimatorService | undefined;
  private drawingRenderer!: MapDrawingRenderer;
  private exportRenderer!: MapExportRenderer;

  public link_animator(map_animator: MapAnimatorService) {
    this.map_animator = map_animator;

    // adjust the map center to the route
    map_animator.map_center$.subscribe((center) =>
      this.map?.getView().setCenter([center.x, center.y]),
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
    const bgLayer = layerLabel;
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
    if (wmtsLayer_overlay) layers.push(wmtsLayer_overlay);

    this.map = this.create_map_from_layers(layers, target_canvas);

    if (oldCenter && oldResolution) {
      this.map.getView().setCenter(oldCenter);
      this.map.getView().setResolution(oldResolution);
    } else {
      const url = new URL(window.location.href);
      const centerUrl = url.searchParams.get('center');
      const zUrl = url.searchParams.get('z');
      if (centerUrl) {
        const parts = centerUrl.split(',');
        if (parts.length === 2) {
          this.map
            .getView()
            .setCenter([parseFloat(parts[0]), parseFloat(parts[1])]);
        }
      }
      if (zUrl) {
        this.map.getView().setZoom(parseFloat(zUrl));
      }
    }

    this.map.on('moveend', () => {
      if (!this.map) return;
      const center = this.map.getView().getCenter();
      const zoom = this.map.getView().getZoom();
      const urlObj = new URL(window.location.href);
      if (center) {
        urlObj.searchParams.set(
          'center',
          `${center[0].toFixed(2)},${center[1].toFixed(2)}`,
        );
      }
      if (zoom !== undefined) {
        urlObj.searchParams.set('z', zoom.toFixed(3));
      }
      urlObj.searchParams.set('bgLayer', bgLayer);
      window.history.replaceState(null, '', urlObj.toString());
    });

    if (this.map_animator) {
      const animator = this.map_animator;
      this.drawingRenderer = new MapDrawingRenderer(this.map, animator);
      this.exportRenderer = new MapExportRenderer(this.map, animator);

      // Wire up decoupled interactions from Drawing Mode
      this.drawingRenderer.onWaypointAdded.subscribe((pt) =>
        animator.add_way_point(pt),
      );
      this.drawingRenderer.onWaypointDeleted.subscribe((pt) =>
        animator.delete_route_waypoint(pt),
      );
      this.drawingRenderer.onRouteModified.subscribe(payload =>
        animator.handle_modify_event(payload),
      );
      this.drawingRenderer.onUndoRequested.subscribe(() => {
        if (animator.can_undo()) {
          animator.undo();
        }
      });
    }
  }
}
