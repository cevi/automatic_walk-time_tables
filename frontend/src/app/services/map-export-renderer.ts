import { Feature } from 'ol';
import { Subscription } from 'rxjs';
import Map from 'ol/Map';
import VectorSource from 'ol/source/Vector';
import VectorLayer from 'ol/layer/Vector';
import { Point } from 'ol/geom';
import { Fill, Stroke, Style, Text, Icon } from 'ol/style';
import { MapAnimatorService } from './map-animator.service';

export class MapExportRenderer {
  private way_points_layer_source = new VectorSource({ wrapX: false });
  public way_points_layer = new VectorLayer({ source: this.way_points_layer_source, zIndex: 20 });

  private map: Map;
  private map_animator: MapAnimatorService;

  constructor(map: Map, animator: MapAnimatorService) {
    this.map = map;
    this.map_animator = animator;
    this.map.addLayer(this.way_points_layer);

    this.setupSubscriptions();
  }

  private sub1!: Subscription;
  private sub2!: Subscription;
  private sub3!: Subscription;

  private setupSubscriptions() {
    this.sub1 = this.map_animator.way_points$.subscribe(() => {
      if (this.map_animator.export_mode) {
         this.refreshMarkers();
      }
    });

    this.sub2 = this.map_animator.pois$.subscribe(() => {
      if (this.map_animator.export_mode) {
         this.refreshMarkers();
      }
    });

    this.sub3 = this.map_animator.export_mode$.subscribe((is_export) => {
      this.way_points_layer.setVisible(is_export);
      if (is_export) {
         this.refreshMarkers();
      } else {
         this.way_points_layer_source.clear();
      }
    });
  }

  private refreshMarkers() {
    this.way_points_layer_source.clear();

    // Render Waypoints (Pink Markers)
    const way_points = this.map_animator.way_points;
    way_points.forEach((way_point) => {
      const feature = new Feature({
        geometry: new Point([way_point.x, way_point.y]),
      });

      feature.setStyle(
        new Style({
          image: new Icon({
            src: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="32" height="32" fill="%23d32f2f"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" stroke="white" stroke-width="1.5"/></svg>',
            anchor: [0.5, 1],
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

    // Render POIs (Blue Markers)
    const pois = this.map_animator.pois.filter((p: any) => !p.is_waypoint);
    pois.forEach((poi: any) => {
      const feature = new Feature({
        geometry: new Point([poi.x, poi.y]),
      });

      feature.setStyle(
        new Style({
          image: new Icon({
            src: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" fill="%231976d2"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" stroke="white" stroke-width="1"/></svg>',
            anchor: [0.5, 1],
          }),
          text: new Text({
            text: poi.name,
            fill: new Fill({ color: '#333' }),
            stroke: new Stroke({ color: '#fff', width: 3 }),
            font: '14px Open Sans',
            offsetY: 15,
          }),
        }),
      );
      this.way_points_layer_source.addFeature(feature);
    });
  }

  public destroy() {
    this.sub1?.unsubscribe();
    this.sub2?.unsubscribe();
    this.sub3?.unsubscribe();
    if (this.map) {
      this.map.removeLayer(this.way_points_layer);
    }
  }
}

