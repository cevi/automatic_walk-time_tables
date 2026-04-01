import { Feature } from 'ol';
import { Subscription } from 'rxjs';
import Map from 'ol/Map';
import VectorSource from 'ol/source/Vector';
import VectorLayer from 'ol/layer/Vector';
import { Point } from 'ol/geom';
import { Fill, Stroke, Style, Text } from 'ol/style';
import CircleStyle from 'ol/style/Circle';
import { MapAnimatorService } from './map-animator.service';
import { GeometryUtils } from '../utils/geometry.utils';
import { LV95_Waypoint } from '../helpers/coordinates';

export class MapExportRenderer {
  private pois_layer_source = new VectorSource({ wrapX: false });
  public pois_layer = new VectorLayer({
    source: this.pois_layer_source,
    zIndex: 20,
  });

  private labels_layer_source = new VectorSource({ wrapX: false });
  private labels_layer = new VectorLayer({
    source: this.labels_layer_source,
    zIndex: 21,
    declutter: true,
  });

  private pointer_layer_source = new VectorSource();
  private pointer_layer = new VectorLayer({
    source: this.pointer_layer_source,
    zIndex: 30,
  });

  private map: Map;
  private map_animator: MapAnimatorService;

  constructor(map: Map, animator: MapAnimatorService) {
    this.map = map;
    this.map_animator = animator;
    this.map.addLayer(this.pois_layer);
    this.map.addLayer(this.labels_layer);
    this.map.addLayer(this.pointer_layer);

    this.setupSubscriptions();
    this.setupClickHandler();
    this.setupHoverHandler();
  }

  private sub2!: Subscription;
  private sub3!: Subscription;
  private sub4!: Subscription;

  private setupHoverHandler() {
    this.map.on('pointermove', (evt) => {
      if (
        !this.map_animator.export_mode ||
        this.map_animator.app_mode === 'view'
      ) {
        this.map_animator.move_pointer(null);
        return;
      }

      const path = this.map_animator.path;
      if (!path || path.length === 0) {
        this.map_animator.move_pointer(null);
        return;
      }

      const resolution = this.map.getView().getResolution() || 1;

      let nearest: LV95_Waypoint | null = null;
      let min_dist = Infinity;
      for (const pt of path) {
        const d =
          Math.pow(pt.x - evt.coordinate[0], 2) +
          Math.pow(pt.y - evt.coordinate[1], 2);
        if (d < min_dist) {
          min_dist = d;
          nearest = pt;
        }
      }

      const pixel_dist = Math.sqrt(min_dist) / resolution;
      if (pixel_dist <= 25 && nearest) {
        this.map_animator.move_pointer(nearest);
      } else {
        this.map_animator.move_pointer(null);
      }
    });
  }

  private setupClickHandler() {
    this.map.on('singleclick', (evt) => {
      if (
        !this.map_animator.export_mode ||
        this.map_animator.app_mode === 'view'
      )
        return;

      const path = this.map_animator.path;
      if (!path || path.length === 0) return;

      // Check if we clicked an existing POI first (to delete it)
      const pois = this.map_animator.pois;
      let nearest_poi: LV95_Waypoint | null = null;
      let min_poi_dist = Infinity;
      for (const poi of pois) {
        const d = Math.sqrt(
          Math.pow(poi.x - evt.coordinate[0], 2) +
            Math.pow(poi.y - evt.coordinate[1], 2),
        );
        if (d < min_poi_dist) {
          min_poi_dist = d;
          nearest_poi = poi;
        }
      }

      const resolution = this.map.getView().getResolution() || 1;
      const poi_pixel_dist = min_poi_dist / resolution;

      if (poi_pixel_dist <= 25 && nearest_poi) {
        this.map_animator.delete_poi(nearest_poi);
        return;
      }

      // Otherwise, find nearest path point and add a POI
      let nearest_path: LV95_Waypoint | null = null;
      let min_path_dist = Infinity;
      for (const pt of path) {
        const d = Math.sqrt(
          Math.pow(pt.x - evt.coordinate[0], 2) +
            Math.pow(pt.y - evt.coordinate[1], 2),
        );
        if (d < min_path_dist) {
          min_path_dist = d;
          nearest_path = pt;
        }
      }

      const path_pixel_dist = min_path_dist / resolution;
      if (path_pixel_dist <= 25 && nearest_path) {
        this.map_animator.add_point_of_interest(nearest_path);
      }
    });
  }

  private setupSubscriptions() {
    this.sub2 = this.map_animator.pois$.subscribe(() => {
      if (this.map_animator.export_mode) {
        this.refreshMarkers();
      }
    });

    this.sub3 = this.map_animator.export_mode$.subscribe((is_export) => {
      this.pois_layer.setVisible(is_export);
      this.labels_layer.setVisible(is_export);
      this.pointer_layer.setVisible(is_export);
      if (is_export) {
        this.refreshMarkers();
      } else {
        this.pois_layer_source.clear();
        this.labels_layer_source.clear();
        this.pointer_layer_source.clear();
      }
    });

    this.sub4 = this.map_animator.pointer$.subscribe((coord) => {
      this.pointer_layer_source.clear();
      if (coord && this.map_animator.export_mode) {
        const feature = new Feature({
          geometry: new Point([coord.x, coord.y]),
        });
        feature.setStyle(
          new Style({
            image: new CircleStyle({
              radius: 6,
              fill: new Fill({ color: '#2196F3' }),
              stroke: new Stroke({ color: '#fff', width: 2 }),
            }),
          }),
        );
        this.pointer_layer_source.addFeature(feature);
      }
    });
  }

  private refreshMarkers() {
    this.pois_layer_source.clear();
    this.labels_layer_source.clear();

    const pois = this.map_animator.pois;
    pois.forEach((poi: any) => {
      // Circle marker (always visible)
      const circleFeature = new Feature({
        geometry: new Point([poi.x, poi.y]),
      });
      circleFeature.setStyle(
        new Style({
          image: new CircleStyle({
            radius: 6,
            fill: new Fill({ color: '#d32f2f' }),
            stroke: new Stroke({ color: '#fff', width: 2 }),
          }),
        }),
      );
      this.pois_layer_source.addFeature(circleFeature);

      // Text label (decluttered)
      if (poi.name) {
        const labelFeature = new Feature({
          geometry: new Point([poi.x, poi.y]),
        });
        labelFeature.setStyle(
          new Style({
            text: new Text({
              text: poi.name,
              fill: new Fill({ color: '#d32f2f' }),
              stroke: new Stroke({ color: '#fff', width: 3 }),
              font: 'bold 16px Open Sans',
              offsetY: -15,
            }),
          }),
        );
        this.labels_layer_source.addFeature(labelFeature);
      }
    });
  }

  public destroy() {
    this.sub2?.unsubscribe();
    this.sub3?.unsubscribe();
    this.sub4?.unsubscribe();
    if (this.map) {
      this.map.removeLayer(this.pois_layer);
      this.map.removeLayer(this.labels_layer);
      this.map.removeLayer(this.pointer_layer);
    }
  }
}
