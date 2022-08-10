import {Injectable} from '@angular/core';
import {get, ProjectionLike} from "ol/proj";
import {WMTS} from "ol/source";
import WMTSTileGrid from "ol/tilegrid/WMTS";
import proj4 from "proj4";
import {register} from "ol/proj/proj4";
import {Tile} from "ol/layer";
import Map from "ol/Map";
import {Feature, View} from "ol";
import {defaults, MousePosition, ScaleLine} from "ol/control";
import {createStringXY} from "ol/coordinate";
import VectorSource from "ol/source/Vector";
import VectorLayer from "ol/layer/Vector";
import {Circle, Geometry, LineString} from "ol/geom";
import {MapAnimatorService} from "./map-animator.service";
import {Fill, Stroke, Style, Text} from "ol/style";
import {combineLatest} from "rxjs";
import {Extent} from "ol/extent";
import {getRenderPixel} from "ol/render";


@Injectable({
  providedIn: 'root'
})
export class MapService {

  // OpenLayers settings
  private static RESOLUTIONS = [4000, 3750, 3500, 3250, 3000, 2750, 2500, 2250, 2000, 1750, 1500, 1250,
    1000, 750, 650, 500, 250, 100, 50, 20, 10, 5, 2.5, 2, 1.5, 1, 0.5];
  private static EXTEND = [2420000, 130000, 2900000, 1350000];

  // See https://api3.geo.admin.ch/rest/services/api/MapServer/layersConfig
  private layer_configs: any = {
    'pixelkarte': {

      "attribution": "swisstopo",
      "format": "jpeg",
      "serverLayerName": "ch.swisstopo.pixelkarte-farbe",
      "attributionUrl": "https://www.swisstopo.admin.ch/internet/swisstopo/fr/home.html",
      "label": "pixelkarte",

      // Use 'current', if you are only interested in the latest data.
      "timestamps": [
        "current",
        "20140620",
        "20131107",
        "20130916",
        "20130422",
        "20120809",
        "20120225",
        "20110914",
        "20110228"
      ]
    }
  };

  private path_layer_source: VectorSource<Geometry> = new VectorSource({wrapX: false});
  private pointer_layer_source: VectorSource<Geometry> = new VectorSource({wrapX: false});
  private way_points_layer_source: VectorSource<Geometry> = new VectorSource({wrapX: false});

  private map: Map | undefined;
  private pointer: number[] | undefined | null;

  constructor() {

    // Define the "EPSG:2056" projection (LV95 coordinate system)
    // and register it to the OpenLayers library
    proj4.defs("EPSG:2056", "+proj=somerc +lat_0=46.9524055555556 +lon_0=7.43958333333333 " +
      "+k_0=1 +x_0=2600000 +y_0=1200000 +ellps=bessel +towgs84=674.374,15.056,405.346,0,0,0,0 " +
      "+units=m +no_defs +type=crs");
    register(proj4);

  }

  public link_animator(map_animator: MapAnimatorService) {

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

      this.path_layer_source.addFeature(feature);

    });


    map_animator.pointer$.subscribe(p => {

      if (p == null) {
        this.pointer = null;
        return
      }

      this.pointer = [p?.x, p?.y];

      const extend: Extent | undefined = this.map?.getView().calculateExtent(this.map?.getSize())
      if (extend == null) return;

      const map_center = [(extend[2] + extend[0]) / 2, (extend[3] + extend[1]) / 2];
      const max_offset = [(extend[2] - extend[0]) / 2 - 250, (extend[3] - extend[1]) / 2 - 250];
      const offset = [p.x - map_center[0], p.y - map_center[1]];

      const new_center = map_center;

      if (offset[0] > max_offset[0]) {
        new_center[0] = map_center[0] + (offset[0] - max_offset[0]);
      }
      if (offset[0] < -max_offset[0]) {
        new_center[0] = map_center[0] + (offset[0] + max_offset[0]);
      }
      if (offset[1] > max_offset[1]) {
        new_center[1] = map_center[1] + (offset[1] - max_offset[1]);
      }
      if (offset[1] < -max_offset[1]) {
        new_center[1] = map_center[1] + (offset[1] + max_offset[1]);
      }

      this.map?.getView().setCenter(new_center);
      this.map?.render()

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
            geometry: new Circle([way_point.x, way_point.y], 25)
          });

          feature.setStyle(new Style({
            stroke: new Stroke({color: '#f13c3c', width: 5}),
            fill: new Fill({color: '#2043d7'}),
            text: new Text({
              text: way_point.name,
              fill: new Fill({color: '#f13c3c'}),
              font: 'bold 16px Calibri'
            })
          }));

          this.way_points_layer_source.addFeature(feature);

        });


      });

  }

  public draw_map(layerLabel: string = 'pixelkarte') {

    // get the projection object for the "EPSG:2056" projection
    const projection = get('EPSG:2056');
    if (projection === null) return;
    projection.setExtent(MapService.EXTEND);

    const wmtsLayer = new Tile({
      source: this.createWMTSSource(this.layer_configs[layerLabel], projection)
    });

    const wmtsLayer_overlay = new Tile({
      source: this.createWMTSSource(this.layer_configs[layerLabel], projection)
    });

    const mousePosition = document.getElementById('mousePosition');
    if (mousePosition == null) return;

    this.map = new Map({
      layers: [
        wmtsLayer,
        new VectorLayer({source: this.path_layer_source}),
        wmtsLayer_overlay,
        new VectorLayer({source: this.pointer_layer_source}),
        new VectorLayer({source: this.way_points_layer_source}),
      ],
      target: 'map-canvas',
      view: new View({
        center: [2719640, 1216329],
        projection: projection,
        resolution: 25
      }),
      controls: defaults({
        attributionOptions: ({
          collapsible: false
        })
      }).extend([
        new ScaleLine({
          units: 'metric'
        }),
        new MousePosition({
          coordinateFormat: createStringXY(4),
          projection: 'EPSG:2056',
          target: mousePosition,
          undefinedHTML: '&nbsp;'
        })
      ]),
    });

    this.render_pointer(wmtsLayer_overlay);

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

  private createWMTSSource(layerConfig: any, projection: ProjectionLike): WMTS {

    const matrixIds: string[] = [];
    for (let i = 0; i < MapService.RESOLUTIONS.length; i++) {
      matrixIds.push(String(i));
    }

    const resolutions = layerConfig.resolutions || MapService.RESOLUTIONS;

    const tileGrid = new WMTSTileGrid({
      origin: [MapService.EXTEND[0], MapService.EXTEND[3]],
      resolutions: resolutions,
      matrixIds: matrixIds
    });

    const extension = layerConfig.format || 'png';
    const timestamp = layerConfig['timestamps'][0];

    return new WMTS({
      matrixSet: "2056",
      style: "default",
      url: '//wmts{1-10}.geo.admin.ch/1.0.0/{Layer}/{style}/' + timestamp +
        '/2056/{TileMatrix}/{TileCol}/{TileRow}.' + extension,
      tileGrid: tileGrid,
      projection: projection,
      layer: layerConfig.serverLayerName,
      requestEncoding: 'REST'
    });
  };


}
