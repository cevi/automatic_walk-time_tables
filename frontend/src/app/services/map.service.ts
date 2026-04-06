import { Injectable, OnDestroy } from '@angular/core';
import { Layer } from 'ol/layer';
import Map from 'ol/Map';
import { Feature } from 'ol';
import VectorSource from 'ol/source/Vector';
import VectorLayer from 'ol/layer/Vector';
import { Point } from 'ol/geom';
import { MapAnimatorService } from './map-animator.service';
import { Style, Icon, Stroke, Fill, Text, RegularShape } from 'ol/style';
import { transformExtent } from 'ol/proj';
import { bbox } from 'ol/loadingstrategy';
import { SwisstopoMap } from '../helpers/swisstopo-map';
import { MapDrawingRenderer } from './map-drawing-renderer';
import { MapExportRenderer } from './map-export-renderer';
import Overlay from 'ol/Overlay';
import { braetlistellenData } from '../../assets/braetlistellen';
import TileLayer from 'ol/layer/Tile';
import XYZ from 'ol/source/XYZ';
import GeoJSON from 'ol/format/GeoJSON';

export interface MapOverlays {
  fountains: boolean;
  haltestellen: boolean;
  hangneigung: boolean;
  wanderwege: boolean;
  sperrungen: boolean;
  schutzgebiete: boolean;
  schiessanzeigen: boolean;
  herdenschutzhunde: boolean;
  notfall: boolean;
  feuerstellen: boolean;
  shelter: boolean;
}

@Injectable({
  providedIn: 'root',
})
export class MapService extends SwisstopoMap implements OnDestroy {
  private create_osm_source(queryFn: (ext: number[]) => string): VectorSource {
    const source = new VectorSource({
      strategy: bbox,
      attributions:
        '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank">OpenStreetMap contributors</a>',
      loader: (extent, resolution, projection, success, failure) => {
        if (resolution > 100) {
          if (success) success([]);
          return;
        }

        const ext4326 = transformExtent(extent, projection, 'EPSG:4326');
        const query = queryFn(ext4326);
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
            source.addFeatures(features);
            if (success) success(features as any);
          })
          .catch((err) => {
            console.error(err);
            if (failure) failure();
          });
      },
    });
    return source;
  }

  private fountains_layer_source = this.create_osm_source(
    (ext) =>
      `[out:json];(nwr[amenity~"drinking_water|fountain|water_point"](${ext[1]},${ext[0]},${ext[3]},${ext[2]});nwr[man_made~"water_well|water_tap"](${ext[1]},${ext[0]},${ext[3]},${ext[2]}););out qt center;`,
  );

  private notfall_layer_source = this.create_osm_source(
    (ext) =>
      `[out:json];(nwr[amenity~"hospital|clinic|pharmacy"](${ext[1]},${ext[0]},${ext[3]},${ext[2]}););out qt center;`,
  );

  private feuerstellen_layer_source = this.create_osm_source(
    (ext) =>
      `[out:json];(nwr[amenity="bbq"](${ext[1]},${ext[0]},${ext[3]},${ext[2]});nwr[leisure="firepit"](${ext[1]},${ext[0]},${ext[3]},${ext[2]}););out qt center;`,
  );

  private shelter_layer_source = this.create_osm_source(
    (ext) =>
      `[out:json];(nwr[amenity="shelter"](${ext[1]},${ext[0]},${ext[3]},${ext[2]});nwr[tourism="alpine_hut"](${ext[1]},${ext[0]},${ext[3]},${ext[2]});nwr[tourism="wilderness_hut"](${ext[1]},${ext[0]},${ext[3]},${ext[2]}););out qt center;`,
  );

  private map: Map | undefined;
  private map_animator: MapAnimatorService | undefined;
  private drawingRenderer!: MapDrawingRenderer;
  private exportRenderer!: MapExportRenderer;

  public get_map(): Map | undefined {
    return this.map;
  }

  public link_animator(map_animator: MapAnimatorService) {
    this.map_animator = map_animator;

    // adjust the map center to the route
    map_animator.map_center$.subscribe((center) =>
      this.map?.getView().setCenter([center.x, center.y]),
    );
  }

  public updateLayerOpacity(name: string, opacity: number) {
    if (!this.map) return;
    const layers = this.map.getLayers().getArray();
    for (const layer of layers) {
      if (layer.get('name') === name) {
        layer.setOpacity(opacity);
      }
      if (
        name === 'schutzgebiete' &&
        layer.get('name')?.startsWith('schutzgebiete_')
      ) {
        layer.setOpacity(opacity);
      }
    }
  }

  public draw_map(
    layerLabel: string = 'pixelkarte',
    overlays: Partial<MapOverlays> = {},
    target_canvas: string = 'map-canvas',
    opacities: Record<string, number> = {},
  ) {
    let oldCenter: number[] | undefined;
    let oldResolution: number | undefined;

    if (this.map) {
      const view = this.map.getView();
      oldCenter = view.getCenter();
      oldResolution = view.getResolution();
      this.map.setTarget(undefined);
    }

    const bgLayer = layerLabel;

    let wmtsLayer: Layer | null = null;
    if (bgLayer === 'opentopomap') {
      wmtsLayer = new TileLayer({
        source: new XYZ({
          url: 'https://{a-c}.tile.opentopomap.org/{z}/{x}/{y}.png',
          attributions:
            'Map data: &copy; <a href="https://www.openstreetmap.org/copyright" target="_blank">OpenStreetMap</a> contributors, <a href="http://viewfinderpanoramas.org" target="_blank">SRTM</a> | Map style: &copy; <a href="https://opentopomap.org" target="_blank">OpenTopoMap</a> (<a href="https://creativecommons.org/licenses/by-sa/3.0/" target="_blank">CC-BY-SA</a>)',
        }),
        opacity: opacities['opentopomap'] ?? 1.0,
      });
    } else if (layerLabel !== 'keine') {
      wmtsLayer = this.get_base_WMTS_layer(layerLabel) || null;
    }

    const layers: Layer[] = [];
    if (wmtsLayer) layers.push(wmtsLayer);

    const overlayKeys: (keyof MapOverlays)[] = [
      'hangneigung',
      'wanderwege',
      'sperrungen',
      'schiessanzeigen',
      'herdenschutzhunde',
    ];

    overlayKeys.forEach((key) => {
      if (overlays[key]) {
        const layer = this.get_base_WMTS_layer(key, opacities[key] ?? 1.0);
        if (layer) {
          layer.set('name', key);
          layers.push(layer);
        }
      }
    });

    if (overlays.haltestellen) {
      const transitStyleCache: Record<string, Style> = {};

      const getHaltestellenStyle = (feature: any): Style => {
        const m = String(feature.get('verkehrsmittel_de') || feature.get('transport_means_de') || '');
        let letter = 'H';
        if (m.includes('Zug') || m.includes('Train')) letter = 'Z';
        else if (m.includes('Bus')) letter = 'B';
        else if (m.includes('Tram')) letter = 'T';
        else if (m.includes('Schiff') || m.includes('Fähre')) letter = 'S';
        else if (m.includes('seilbahn') || m.includes('Gondel') || m.includes('Sessellift') || m.includes('Standseilbahn')) letter = 'G';
        else if (m.includes('Zahnradbahn') || m.includes('bahn')) letter = 'Z';
        
        const svgPaths: Record<string, string> = {
          'Z': 'M12 2c-4 0-8 .5-8 4v9.5C4 17.43 5.57 19 7.5 19L6 20.5v.5h12v-.5L16.5 19c1.93 0 3.5-1.57 3.5-3.5V6c0-3.5-4-4-8-4zM17 11H7V6h10v5h-6z',
          'B': 'M4 16c0 .88.39 1.67 1 2.22V20c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1h8v1c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1.78c.61-.55 1-1.34 1-2.22V6c0-3.5-3.58-4-8-4s-8 .5-8 4v10zm14-5H6V6h12v5z',
          'T': 'M19 16c0 .88-.39 1.67-1 2.22V20c0 .55-.45 1-1 1h-1c-.55 0-1-.45-1-1v-1H9v1c0 .55-.45 1-1 1H7c-.55 0-1-.45-1-1v-1.78c-.61-.55-1-1.34-1-2.22V6c0-3.5 3.58-4 8-4s8 .5 8 4v10zM18 11H6V6h12v5zM13 1h-2v1h2V1z',
          'S': 'M20 21c-1.39 0-2.78-.47-4-1.32-2.43 1.71-5.56 1.71-8 0C6.78 20.53 5.39 21 4 21H2v2h2c1.38 0 2.74-.35 4-.99 2.52 1.29 5.48 1.29 8 0 1.26.64 2.62.99 4 .99h2v-2h-2zM3.95 19H4c1.6 0 3.11-.55 4.36-1.45L12 14l3.64 3.55c1.25.9 2.76 1.45 4.36 1.45h.05l1.89-6.68C22.09 11.47 21.47 10 20 10h-2V4h-3V2h-5v2H7v6H5c-1.47 0-2.09 1.47-1.94 2.32L3.95 19zM15 10H9V6h6v4z',
          'G': 'M19 14.7c.6 0 1-.4 1-1v-8c0-.6-.4-1-1-1h-6v-2h1c.6 0 1-.4 1-1s-.4-1-1-1h-4c-.6 0-1 .4-1 1s.4 1 1 1h1v2h-6c-.6 0-1 .4-1 1v8c0 .6.4 1 1 1h.3l-.3.7c-.2.5 0 1.1.5 1.3s1.1 0 1.3-.5l1.6-3.5h10.6l1.6 3.5c.2.5.8.7 1.3.5.5-.2.7-.8.5-1.3l-.3-.7h.3zm-13-1.7h-2v-3h2v3zm11 0h-2v-3h2v3z',
          'H': 'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z'
        };

        if (!transitStyleCache[letter]) {
          const path = svgPaths[letter] || svgPaths['H'];
          const svgMarkup = `<svg width="24" height="24" viewBox="0 0 24 24" fill-rule="evenodd" xmlns="http://www.w3.org/2000/svg">
            <rect width="24" height="24" rx="3" fill="#2a5ba8" />
            <path d="${path}" fill="#ffffff" transform="scale(0.8) translate(3,3)" />
          </svg>`;
          
          transitStyleCache[letter] = new Style({
            image: new Icon({
              src: `data:image/svg+xml;utf8,${encodeURIComponent(svgMarkup)}`,
              scale: 0.8,
            })
          });
        }
        return transitStyleCache[letter];
      };

      const haltestellenSource = new VectorSource({
        format: new GeoJSON(),
        strategy: bbox,
        loader: function (extent, resolution, projection, success, failure) {
          const e = extent;
          const url = `https://api3.geo.admin.ch/rest/services/all/MapServer/identify?geometry=${e.join(',')}&geometryFormat=geojson&geometryType=esriGeometryEnvelope&imageDisplay=800,600,96&mapExtent=${e.join(',')}&sr=2056&tolerance=0&layers=all:ch.bav.haltestellen-oev`;
          
          fetch(url)
            .then(res => res.json())
            .then(data => {
              if (data && data.results) {
                const format = new GeoJSON();
                const features = [];
                for (const r of data.results) {
                  if (r.geometry) {
                    const typ = String(r.properties?.betriebspunkttyp_de || '');
                    const lod = String(r.properties?.lod || '0');
                    const name = String(r.properties?.name || '');
                    const isVzw = typ.includes('Verzweigung') || name.includes('(Vzw)');
                    const isGleisende = typ.includes('Gleisende');
                    const isZugeordnet = typ.includes('Zugeordneter Betriebspunkt');
                    const isBedienpunkt = typ === 'Bedienpunkt';
                    const isSpurwechsel = typ.includes('Spurwechsel');
                    const isSpurtrennung = typ.includes('Spurtrennung');
                    const isWendeschleife = typ.includes('Wendeschleife');
                    const isDienststation = typ.includes('Dienststation');
                    const isAusweiche = typ.includes('Ausweiche');
                    const isAnschlusspunkt = typ.includes('Anschlusspunkt');
                    const isMaster = (lod === '0' || lod === 'undefined') && !name.startsWith('ch:');

                    if (isMaster && !isVzw && !isGleisende && !isZugeordnet && !isBedienpunkt && !isSpurwechsel && !isSpurtrennung && !isWendeschleife && !isDienststation && !isAusweiche && !isAnschlusspunkt) {
                      try {
                        const feat = format.readFeature(r, { dataProjection: 'EPSG:2056', featureProjection: 'EPSG:2056' });
                        if (Array.isArray(feat)) features.push(...feat);
                        else features.push(feat);
                      } catch(err) {
                        console.error("GeoJSON parser error", err);
                      }
                    }
                  }
                }
                haltestellenSource.addFeatures(features as Feature<any>[]);
                if (success) success(features as Feature<any>[]);
              } else {
                if (success) success([]);
              }
            })
            .catch(err => {
              console.error(err);
              if (failure) failure();
            });
        }
      });

      const haltestellenLayer = new VectorLayer({
        source: haltestellenSource,
        style: getHaltestellenStyle,
        maxResolution: 100, // Drop from memory when zoomed out to prevent 25k SVG geometry overload
        opacity: opacities['haltestellen'] ?? 1.0,
        properties: { name: 'haltestellen' }, // Uses standard name so toggles stay operative
      });
      layers.push(haltestellenLayer);
    }

    if (overlays.schutzgebiete) {
      const schutzgebiete_layers = [
        'nationalpark',
        'jagdbanngebiete',
        'wildruhezonen',
      ];
      schutzgebiete_layers.forEach((key) => {
        const layer = this.get_base_WMTS_layer(
          key,
          opacities['schutzgebiete'] ?? 1.0,
        );
        if (layer) {
          layer.set('name', 'schutzgebiete_' + key);
          layers.push(layer);
        }
      });

      // Swisstopo's raster WMTS generation completely drops polygons for certain Naturschutzgebiete (e.g. Frauenwinkel).
      // To strictly guarantee mapping parity while maintaining live data without static JSON files, we pivot to a BBOX vector strategy.
      const naturschutzSource = new VectorSource({
        format: new GeoJSON(),
        strategy: bbox,
        loader: function (extent, resolution, projection, success, failure) {
          const e = extent;
          const url = `https://api3.geo.admin.ch/rest/services/all/MapServer/identify?geometry=${e.join(',')}&geometryFormat=geojson&geometryType=esriGeometryEnvelope&imageDisplay=800,600,96&mapExtent=${e.join(',')}&sr=2056&tolerance=0&layers=all:ch.pronatura.naturschutzgebiete`;
          
          fetch(url)
            .then(res => res.json())
            .then(data => {
              if (data && data.results) {
                const format = new GeoJSON();
                const features = [];
                for (const r of data.results) {
                  if (r.geometry) {
                     try {
                        const feat = format.readFeature(r, { dataProjection: 'EPSG:2056', featureProjection: 'EPSG:2056' });
                        if (Array.isArray(feat)) {
                          features.push(...feat);
                        } else {
                          features.push(feat);
                        }
                     } catch(err) {
                        console.error("GeoJSON parser error:", err);
                     }
                  }
                }
                naturschutzSource.addFeatures(features as Feature<any>[]);
                if (success) success(features as Feature<any>[]);
              } else {
                if (success) success([]);
              }
            })
            .catch(err => {
              console.error(err);
              if (failure) failure();
            });
        }
      });

      const naturschutzLayer = new VectorLayer({
        source: naturschutzSource,
        className: 'ol-layer-naturschutzgebiete',
        style: new Style({
          stroke: new Stroke({ color: 'rgba(168, 100, 168, 0.9)', width: 2 }),
          fill: new Fill({ color: 'rgba(168, 100, 168, 0.25)' }) 
        }),
        opacity: opacities['schutzgebiete'] ?? 1.0,
        properties: { name: 'schutzgebiete_naturschutzgebiete' }
      });
      layers.push(naturschutzLayer);
    }

    const addOsmVectorLayer = (
      source: VectorSource,
      name: string,
      svgPath: string,
    ) => {
      layers.push(
        new VectorLayer({
          source: source,
          opacity: opacities[name] ?? 1.0,
          properties: { name: name },
          style: new Style({
            image: new Icon({
              src: `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 -960 960 960" width="26" height="26">${svgPath}</svg>`,
              anchor: [0.5, 0.5],
              scale: 1,
            }),
          }),
        }),
      );
    };

    if (overlays.fountains) {
      addOsmVectorLayer(
        this.fountains_layer_source,
        'fountains',
        '<path d="M480-120q-125 0-212.5-87.5T180-420q0-73 35.5-131T294-656l186-224 186 224q43 51 78.5 109T780-420q0 125-87.5 212.5T480-120Z" fill="%230070FF" stroke="white" stroke-width="40"/>',
      );
    }
    if (overlays.notfall) {
      addOsmVectorLayer(
        this.notfall_layer_source,
        'notfall',
        '<path d="M400-240v-160H240v-160h160v-160h160v160h160v160H560v160H400Z" fill="%23D32F2F" stroke="white" stroke-width="40"/>',
      );
    }
    if (overlays.feuerstellen) {
      addOsmVectorLayer(
        this.feuerstellen_layer_source,
        'feuerstellen',
        '<path d="M480-120q-100 0-170-70t-70-170q0-51 24.5-98.5T332-540q19 14 36 30t32 36q18-35 43-69.5t57-70.5q18 17 38 41t44 57q22-19 32-41.5t10-48.5q32 40 49 86t17 96q0 100-70 170t-170 70Z" fill="%23F57C00" stroke="white" stroke-width="30"/>',
      );
    }
    if (overlays.shelter) {
      addOsmVectorLayer(
        this.shelter_layer_source,
        'shelter',
        '<path d="M160-120v-480l320-240 320 240v480H560v-280H400v280H160Z" fill="%23388E3C" stroke="white" stroke-width="40"/>',
      );
    }

    this.map = this.create_map_from_layers(layers, target_canvas);

    const popupContainer = document.getElementById('feature-popup');
    const popupContent = document.getElementById('feature-popup-content');
    const popupCloser = document.getElementById('feature-popup-closer');

    let popupOverlay: Overlay | null = null;
    if (popupContainer && popupContent && popupCloser) {
      popupOverlay = new Overlay({
        element: popupContainer,
        autoPan: {
          animation: {
            duration: 250,
          },
        },
      });
      popupCloser.onclick = () => {
        popupOverlay?.setPosition(undefined);
        popupCloser.blur();
        return false;
      };
      this.map.addOverlay(popupOverlay);
    }

    this.map.on('singleclick', (evt) => {
      if (!this.map || !popupOverlay || !popupContent) return;
      const feature = this.map.forEachFeatureAtPixel(evt.pixel, (feat, layer) => {
        const lyrName = layer?.get('name');
        if (typeof lyrName === 'string' && (lyrName.startsWith('schutzgebiete_') || lyrName.includes('highlight') || lyrName === 'haltestellen')) {
          return undefined; // Handled exclusively by Swisstopo identify API
        }
        return feat;
      });

      if (feature) {
        const props = feature.getProperties();
        const excludeKeys = ['geometry', 'name'];
        const tags = Object.keys(props).filter(
          (k) => !excludeKeys.includes(k) && props[k] !== undefined,
        );

        if (tags.length > 0 || props['name']) {
          const coords = evt.coordinate;
          let html = '';

          if (props['name']) {
            html += `<h3>${props['name']}</h3>`;
          } else {
            const fallbackName =
              props['amenity'] || props['leisure'] || 'Point of Interest';
            html += `<h3>${fallbackName.toString().charAt(0).toUpperCase() + fallbackName.toString().slice(1)}</h3>`;
          }

          html += '<div style="max-height: 200px; overflow-y: auto;">';
          for (const t of tags) {
            html += `<p><strong>${t}:</strong> ${props[t]}</p>`;
          }

          if (props['amenity'] === 'bbq' || props['leisure'] === 'firepit') {
            let origin = evt.coordinate;
            const geom = feature.getGeometry();
            if (geom && typeof (geom as any).getCoordinates === 'function') {
              const coords = (geom as any).getCoordinates();
              if (coords && coords.length >= 2) {
                origin = coords;
              }
            }

            let closest = null;
            let min_distSq = 2500; // 50m tolerance
            for (const b of braetlistellenData) {
              const dx = b.x - origin[0];
              const dy = b.y - origin[1];
              const distSq = dx * dx + dy * dy;
              if (distSq < min_distSq) {
                min_distSq = distSq;
                closest = b;
              }
            }
            if (closest && closest.url) {
              html += `<p style="margin-top:10px;"><a href="${closest.url}" target="_blank" style="color:#1976D2; text-decoration: underline;">Link zu brätlistellen.ch</a></p>`;
            }
          }

          html += '</div>';

          popupContent.innerHTML = html;
          popupOverlay.setPosition(coords);
        } else {
          popupOverlay.setPosition(undefined);
        }
      } else {
        popupOverlay.setPosition(undefined);
      }
    });

    this.map.getViewport().addEventListener('contextmenu', (evt) => {
      evt.preventDefault();
      if (!this.map || !popupOverlay || !popupContent) return;

      const coords = this.map.getEventCoordinate(evt);
      if (coords) {
        const formatCoord = (val: number) => {
          return Math.round(val)
            .toString()
            .replace(/\B(?=(\d{3})+(?!\d))/g, '’');
        };
        const xStr = formatCoord(coords[0]);
        const yStr = formatCoord(coords[1]);

        let html = `<h3 style="margin-top:0; margin-bottom:8px;">Koordinaten (LV95)</h3>`;
        html += `<p style="margin:2px 0; font-family:monospace; font-size:16px;">${xStr}, ${yStr}</p>`;

        popupContent.innerHTML = html;
        popupOverlay.setPosition(coords);
      }
    });

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

      this.drawingRenderer?.destroy();
      this.exportRenderer?.destroy();

      this.drawingRenderer = new MapDrawingRenderer(this.map, animator);
      this.exportRenderer = new MapExportRenderer(this.map, animator);

      // Wire up decoupled interactions from Drawing Mode
      this.drawingRenderer.onWaypointAdded.subscribe((pt) =>
        animator.add_way_point(pt),
      );
      this.drawingRenderer.onWaypointDeleted.subscribe((pt) =>
        animator.delete_route_waypoint(pt),
      );
      this.drawingRenderer.onRouteModified.subscribe((payload) =>
        animator.handle_modify_event(payload),
      );
      this.drawingRenderer.onUndoRequested.subscribe(() => {
        if (animator.can_undo()) {
          animator.undo();
        }
      });
    }
  }

  ngOnDestroy(): void {
    this.drawingRenderer?.destroy();
    this.exportRenderer?.destroy();
  }
}
