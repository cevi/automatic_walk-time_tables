import {Layer, Tile} from "ol/layer";
import {get, Projection, ProjectionLike} from "ol/proj";
import {WMTS} from "ol/source";
import WMTSTileGrid from "ol/tilegrid/WMTS";
import proj4 from "proj4";
import {register} from "ol/proj/proj4";
import Map from "ol/Map";
import {View} from "ol";
import {defaults, MousePosition, ScaleLine} from "ol/control";
import {createStringXY} from "ol/coordinate";

export class SwisstopoMap {

  constructor() {

    // Define the "EPSG:2056" projection (LV95 coordinate system)
    // and register it to the OpenLayers library
    proj4.defs("EPSG:2056", "+proj=somerc +lat_0=46.9524055555556 +lon_0=7.43958333333333 " +
      "+k_0=1 +x_0=2600000 +y_0=1200000 +ellps=bessel +towgs84=674.374,15.056,405.346,0,0,0,0 " +
      "+units=m +no_defs +type=crs");
    register(proj4);

  }

  // OpenLayers settings
  protected static RESOLUTIONS = [4000, 3750, 3500, 3250, 3000, 2750, 2500, 2250, 2000, 1750, 1500, 1250,
    1000, 750, 650, 500, 250, 100, 50, 20, 10, 5, 2.5, 2, 1.5, 1, 0.5];

  protected static EXTEND = [2420000, 130000, 2900000, 1350000];

  // See https://api3.geo.admin.ch/rest/services/api/MapServer/layersConfig
  protected layer_configs: any = {
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

  protected get_projection(): Projection {
    return <Projection>get('EPSG:2056');
  }

  protected get_base_WMTS_layer(layerLabel: string) {

    // get the projection object for the "EPSG:2056" projection
    const projection = this.get_projection()
    if (projection === null) return;
    projection.setExtent(SwisstopoMap.EXTEND);


    return new Tile({
      source: this.createWMTSSource(this.layer_configs[layerLabel], projection),
    });

  }

  private createWMTSSource(layerConfig: any, projection: ProjectionLike): WMTS {

    const matrixIds: string[] = [];
    for (let i = 0; i < SwisstopoMap.RESOLUTIONS.length; i++) {
      matrixIds.push(String(i));
    }

    const resolutions = layerConfig.resolutions || SwisstopoMap.RESOLUTIONS;

    const tileGrid = new WMTSTileGrid({
      origin: [SwisstopoMap.EXTEND[0], SwisstopoMap.EXTEND[3]],
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
      attributions: "<a href=\"https://www.admin.ch/gov/de/start/rechtliches.html\" target=\"_blank\">&copy; Daten: Swisstopo</a>"
    });
  };

  protected create_map_from_layers(layers: Layer[], target_canvas: string = 'map-canvas') {

    return new Map({
      layers: layers,
      target: target_canvas,
      view: new View({
        center: [2660000,1190000],
        projection: this.get_projection(),
        resolution: 300
      }),
      controls: defaults({
        attributionOptions: ({
          collapsible: false
        })
      }).extend([
        new ScaleLine({
          units: 'metric'
        })
      ]),
    });

  }


}

