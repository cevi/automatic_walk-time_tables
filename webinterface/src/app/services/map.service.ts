import {Injectable} from '@angular/core';
import {get, ProjectionLike} from "ol/proj";
import {WMTS} from "ol/source";
import WMTSTileGrid from "ol/tilegrid/WMTS";
import proj4 from "proj4";
import {register} from "ol/proj/proj4";
import {Tile} from "ol/layer";
import Map from "ol/Map";
import {View} from "ol";
import {defaults, MousePosition, ScaleLine} from "ol/control";
import {createStringXY} from "ol/coordinate";
import VectorSource from "ol/source/Vector";
import VectorLayer from "ol/layer/Vector";
import {Geometry} from "ol/geom";

@Injectable({
  providedIn: 'root'
})
export class MapService {

  // OpenLayers settings
  RESOLUTIONS = [4000, 3750, 3500, 3250, 3000, 2750, 2500, 2250, 2000, 1750, 1500, 1250,
    1000, 750, 650, 500, 250, 100, 50, 20, 10, 5, 2.5, 2, 1.5, 1, 0.5];
  EXTEND = [2420000, 130000, 2900000, 1350000];

  // See https://api3.geo.admin.ch/rest/services/api/MapServer/layersConfig
  layerConfigs: any = {
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

  private vector_source: VectorSource<Geometry> = new VectorSource({wrapX: false});

  constructor() {

    // Define the "EPSG:2056" projection (LV95 coordinate system)
    // and register it to the OpenLayers library
    proj4.defs("EPSG:2056", "+proj=somerc +lat_0=46.9524055555556 +lon_0=7.43958333333333 " +
      "+k_0=1 +x_0=2600000 +y_0=1200000 +ellps=bessel +towgs84=674.374,15.056,405.346,0,0,0,0 " +
      "+units=m +no_defs +type=crs");
    register(proj4);

  }

  public getMap(layerLabel: string = 'pixelkarte') {

    // get the projection object for the "EPSG:2056" projection
    const projection = get('EPSG:2056');
    if (projection === null) return;
    projection.setExtent(this.EXTEND);

    const wmtsLayer = new Tile({
      source: this.createWMTSSource(this.layerConfigs[layerLabel], projection),
    });

    const mousePosition = document.getElementById('mousePosition');
    if (mousePosition == null) return;

    // create overlay drawing layer
    const vectorLayer = new VectorLayer({
      source: this.vector_source
    });

    return new Map({
      layers: [wmtsLayer, vectorLayer],
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

  }

  private createWMTSSource(layerConfig: any, projection: ProjectionLike): WMTS {

    const matrixIds: string[] = [];
    for (let i = 0; i < this.RESOLUTIONS.length; i++) {
      matrixIds.push(String(i));
    }

    const resolutions = layerConfig.resolutions || this.RESOLUTIONS;

    const tileGrid = new WMTSTileGrid({
      origin: [this.EXTEND[0], this.EXTEND[3]],
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
      requestEncoding: 'REST',
      attributions: ['© Daten: swisstopo']
    });
  };

  public getVectorSource() {
    return this.vector_source;
  }

}
