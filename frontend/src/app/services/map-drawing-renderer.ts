import { Feature } from 'ol';
import OLMap from 'ol/Map';
import { transform } from 'ol/proj';
import VectorSource from 'ol/source/Vector';
import VectorLayer from 'ol/layer/Vector';
import { LineString, Point } from 'ol/geom';
import { Modify, Snap } from 'ol/interaction';
import { Fill, Stroke, Style, Circle as CircleStyle, Text } from 'ol/style';
import GeoJSON from 'ol/format/GeoJSON';
import { MapAnimatorService } from './map-animator.service';
import { EventEmitter } from '@angular/core';
import { LV95_Coordinates, LV95_Waypoint } from '../helpers/coordinates';
import Overlay from 'ol/Overlay';
import { Subscription } from 'rxjs';
import { GeometryUtils } from '../utils/geometry.utils';
import { braetlistellenData } from '../../assets/braetlistellen';

export class MapDrawingRenderer {
  private map: OLMap;
  private map_animator: MapAnimatorService;

  // Active Drawing Layers
  private path_layer_source = new VectorSource();
  private path_layer = new VectorLayer({
    source: this.path_layer_source,
    zIndex: 10,
  });

  private anchor_points_layer_source = new VectorSource();
  private anchor_points_layer = new VectorLayer({
    source: this.anchor_points_layer_source,
    zIndex: 11,
  });

  private pointer_layer_source = new VectorSource();
  private pointer_layer = new VectorLayer({
    source: this.pointer_layer_source,
    zIndex: 100,
  });

  private pointer: number[] | null = null;
  public is_modifying: boolean = false;

  private modifyInteraction!: Modify;
  private snapInteraction!: Snap;
  private tooltipOverlay!: Overlay;
  private tooltipElement!: HTMLDivElement;
  private infoOverlay!: Overlay;
  private infoElement!: HTMLDivElement;
  private hovered_anchor: LV95_Waypoint | undefined;
  private is_hovering_interactive_feature: boolean = false;
  private hoverIdentifyTimeout: any;
  private is_hovering_tooltip: boolean = false;
  private interactive_feature_cache: {
    x: number;
    y: number;
    html: string;
    data?: any;
  }[] = [];
  private negative_identify_cache: { x: number; y: number; time: number }[] =
    [];
  private is_mouse_over_dom_tooltip: boolean = false;
  private dragged_anchor: LV95_Waypoint | null = null;
  private modifystart_coord: number[] | null = null;

  // Optimization Properties
  private stationboardCache = new Map<string, { data: any; expiry: number }>();
  private inFlightIdentifyRequests = new Set<string>();
  private lastIdentifyCoord: number[] | null = null;
  private currentIdentifyAbortController: AbortController | null = null;
  private currentStationboardAbortControllers = new Map<
    string,
    AbortController
  >();

  public onRouteModified = new EventEmitter<{
    new_coords: number[][];
    dragged_anchor: LV95_Waypoint | null;
    mousedown_coord: number[];
  }>();
  public onWaypointAdded = new EventEmitter<LV95_Coordinates>();
  public onWaypointDeleted = new EventEmitter<LV95_Waypoint>();
  public onUndoRequested = new EventEmitter<void>();

  private path_sub!: Subscription;
  private external_pointer_layer_source = new VectorSource();
  private external_pointer_layer = new VectorLayer({
    source: this.external_pointer_layer_source,
    zIndex: 100,
  });

  private highlight_layer_source = new VectorSource();
  private highlight_layer = new VectorLayer({
    source: this.highlight_layer_source,
    style: (feature) => {
      const geomType = feature.getGeometry()?.getType();
      if (geomType === 'Point' || geomType === 'MultiPoint') {
        return new Style({
          image: new CircleStyle({
            radius: 14,
            stroke: new Stroke({ color: '#2a5ba8', width: 3 }),
            fill: new Fill({ color: 'rgba(42, 91, 168, 0.25)' }),
          }),
        });
      }
      return new Style({
        stroke: new Stroke({ color: '#A864A8', width: 4 }),
        fill: new Fill({ color: 'rgba(168, 100, 168, 0.25)' }),
      });
    },
    properties: { name: 'highlight_layer' },
    zIndex: 150,
  });

  private export_mode_sub!: Subscription;
  private anchor_points_sub!: Subscription;

  constructor(map: OLMap, animator: MapAnimatorService) {
    this.map = map;
    this.map_animator = animator;
    this.map.addLayer(this.path_layer);
    this.map.addLayer(this.anchor_points_layer);
    this.map.addLayer(this.pointer_layer);
    this.map.addLayer(this.external_pointer_layer);
    this.map.addLayer(this.highlight_layer);

    this.setupInteractions();
    this.setupSubscriptions();

    document.addEventListener('closeMapPopup', () => {
      this.infoElement.style.display = 'none';
      this.infoOverlay.setPosition(undefined);
      this.highlight_layer_source.clear();
    });

    // Clear pointer when mouse leaves the map viewport
    this.map.getViewport().addEventListener('pointerleave', () => {
      this.map_animator.move_pointer(null);
    });
  }

  private setupInteractions() {
    this.setupTooltipOverlay();
    this.setupInfoOverlay();
    this.setupModifyInteraction();
    this.setupSnapInteraction();
    this.setupHoverLogic();
    this.setupUndoInteraction();
    this.setupDrawInteraction();
  }

  private setupTooltipOverlay() {
    this.tooltipElement = document.createElement('div');
    this.tooltipElement.className = 'ol-tooltip ol-tooltip-measure';
    this.tooltipElement.style.background = 'rgba(60, 60, 60, 0.9)';
    this.tooltipElement.style.color = 'white';
    this.tooltipElement.style.padding = '4px 8px';
    this.tooltipElement.style.borderRadius = '4px';
    this.tooltipElement.style.fontFamily = '"Open Sans", sans-serif';
    this.tooltipElement.style.fontSize = '12px';
    this.tooltipElement.style.whiteSpace = 'nowrap';
    this.tooltipElement.style.pointerEvents = 'auto';

    this.tooltipElement.addEventListener(
      'mouseenter',
      () => (this.is_mouse_over_dom_tooltip = true),
    );
    this.tooltipElement.addEventListener(
      'mouseleave',
      () => (this.is_mouse_over_dom_tooltip = false),
    );

    this.tooltipOverlay = new Overlay({
      element: this.tooltipElement,
      offset: [15, 15],
      positioning: 'top-left',
    });
    this.map.addOverlay(this.tooltipOverlay);
  }

  private setupInfoOverlay() {
    this.infoElement = document.createElement('div');
    this.infoElement.className = 'ol-popup';
    this.infoElement.style.background = 'white';
    this.infoElement.style.padding = '8px';
    this.infoElement.style.borderRadius = '12px';
    this.infoElement.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)';
    this.infoElement.style.fontFamily = '"Open Sans", sans-serif';
    this.infoElement.style.fontSize = '13px';
    this.infoElement.style.color = '#333';
    this.infoElement.style.display = 'none';
    this.infoElement.style.maxWidth = '380px';
    this.infoElement.style.lineHeight = '1.4';
    this.infoElement.style.wordWrap = 'break-word';

    this.infoElement.addEventListener('mouseenter', () => {
      this.is_mouse_over_dom_tooltip = true;
    });
    this.infoElement.addEventListener('mouseleave', () => {
      this.is_mouse_over_dom_tooltip = false;
    });

    this.infoOverlay = new Overlay({
      element: this.infoElement,
      offset: [0, -10],
      positioning: 'bottom-center',
      autoPan: {
        animation: {
          duration: 250,
        },
      },
    });
    this.map.addOverlay(this.infoOverlay);
  }

  private setupModifyInteraction() {
    this.modifyInteraction = new Modify({
      source: this.path_layer_source,
      pixelTolerance: 25,
    });

    this.modifyInteraction.on('modifystart', (evt: any) => {
      this.is_modifying = true;
      this.map_animator.is_modifying = true;

      // Synchronously verify anchor hits to prevent fast-drag ghosting
      let hit_anchor: LV95_Waypoint | null = null;
      const pixel = this.map?.getPixelFromCoordinate(
        evt.mapBrowserEvent.coordinate,
      );
      if (pixel) {
        this.map?.forEachFeatureAtPixel(
          pixel,
          (feature, layer) => {
            if (layer === this.anchor_points_layer) {
              const center = (feature.getGeometry() as Point).getCoordinates();
              hit_anchor = { x: center[0], y: center[1] } as LV95_Waypoint;
            }
          },
          { hitTolerance: 25 },
        );
      }

      this.dragged_anchor = hit_anchor || this.hovered_anchor || null;
      this.modifystart_coord = evt.mapBrowserEvent.coordinate;
      this.tooltipOverlay.setPosition(undefined);
      this.pointer_layer_source.clear();
      this.refreshAnchors();
    });

    this.modifyInteraction.on('modifyend', (evt: any) => {
      this.is_modifying = false;
      this.map_animator.is_modifying = false;
      let new_coords: any = [];
      const features = evt.features.getArray();
      if (features.length > 0) {
        const geom = features[0].getGeometry() as LineString;
        new_coords = geom.getCoordinates();
      }
      this.onRouteModified.emit({
        new_coords,
        dragged_anchor: this.dragged_anchor,
        mousedown_coord: this.modifystart_coord!,
      });
      this.dragged_anchor = null;
      this.modifystart_coord = null;
      this.hovered_anchor = undefined;
      this.is_hovering_tooltip = false;
      this.pointer_layer_source.clear();
      this.tooltipOverlay.setPosition(undefined);
    });

    this.map.addInteraction(this.modifyInteraction);
  }

  private setupSnapInteraction() {
    this.snapInteraction = new Snap({
      source: this.anchor_points_layer_source,
      pixelTolerance: 25,
    });
    this.map.addInteraction(this.snapInteraction);
  }

  private setupHoverLogic() {
    this.map.on('pointermove', (evt) => {
      if (evt.dragging) {
        this.tooltipOverlay.setPosition(undefined);
        return;
      }

      const targetElement = this.map.getTargetElement();
      if (!this.is_mouse_over_dom_tooltip) {
        this.is_hovering_interactive_feature = false;
        targetElement.style.cursor = '';
      }

      // 1. Feature Hover Logic
      let foundAnchor = false;
      let hit_path = false;
      let hit_vector = false;

      if (!this.is_mouse_over_dom_tooltip) {
        this.map.forEachFeatureAtPixel(
          evt.pixel,
          (f, l) => {
            if (l === this.path_layer) hit_path = true;
            if (
              l &&
              [
                'fountains',
                'notfall',
                'feuerstellen',
                'shelter',
                'haltestellen',
              ].includes(l.get('name') as string)
            ) {
              hit_vector = true;
            }
            if (
              l &&
              (l as any).getSource() === this.anchor_points_layer_source
            ) {
              const geom = f.getGeometry() as Point;
              const center = geom.getCoordinates();
              this.tooltipOverlay.setPosition(center);
              this.hovered_anchor = {
                x: center[0],
                y: center[1],
              } as LV95_Waypoint;
              foundAnchor = true;
            }
          },
          { hitTolerance: 25 },
        );
      }

      if (!foundAnchor && !this.is_mouse_over_dom_tooltip) {
        this.hovered_anchor = undefined;
      }

      if (
        !foundAnchor &&
        !hit_path &&
        !this.is_hovering_tooltip &&
        !this.is_mouse_over_dom_tooltip
      ) {
        this.tooltipOverlay.setPosition(undefined);
        // Cancel any pending identify when we stop hovering something likely
        if (this.currentIdentifyAbortController) {
          this.currentIdentifyAbortController.abort();
          this.currentIdentifyAbortController = null;
        }
      }

      // Tooltip handling
      if (this.map_animator.export_mode) {
        this.tooltipOverlay.setPosition(undefined);
      } else if (this.is_modifying) {
        this.tooltipOverlay.setPosition(undefined);
      } else if (foundAnchor) {
        const content = 'Ziehen zum verschieben';
        if (this.tooltipElement.innerHTML !== content) {
          this.tooltipElement.innerHTML = content;
        }
        this.tooltipOverlay.setPosition([
          this.hovered_anchor!.x,
          this.hovered_anchor!.y,
        ]);
      } else if (hit_path && !this.is_mouse_over_dom_tooltip) {
        const content = 'Ziehen zum verschieben';
        if (this.tooltipElement.innerHTML !== content) {
          this.tooltipElement.innerHTML = content;
        }
        this.tooltipOverlay.setPosition(evt.coordinate);
      } else if (this.is_hovering_tooltip) {
        const content = 'Ziehen um Punkt zu erstellen';
        if (this.tooltipElement.innerHTML !== content)
          this.tooltipElement.innerHTML = content;
      } else if (
        this.map_animator.magnetic_paths &&
        !this.is_mouse_over_dom_tooltip
      ) {
        const content = 'Klicken, um Punkt anzuhängen';
        if (this.tooltipElement.innerHTML !== content)
          this.tooltipElement.innerHTML = content;
      } else {
        if (this.tooltipElement.innerHTML !== '')
          this.tooltipElement.innerHTML = '';
        this.tooltipOverlay.setPosition(undefined);
      }

      // Identify & Path Hover Logic (Sync Identify in Background)
      let map_hover_coord: LV95_Waypoint | null = null;
      if (!this.is_modifying && !this.hovered_anchor) {
        if (hit_vector) {
          this.is_hovering_interactive_feature = true;
          targetElement.style.cursor = 'pointer';
        } else {
          // Identify/WMTS Sniffing logic with instant 0ms pixel feedback
          const wmtsLayerNames: Record<string, string> = {
            haltestellen: 'ch.bav.haltestellen-oev',
            schiessanzeigen: 'ch.vbs.schiessanzeigen',
            herdenschutzhunde: 'ch.bafu.alpweiden-herdenschutzhunde',
            schutzgebiete_naturschutzgebiete: 'ch.pronatura.naturschutzgebiete',
            schutzgebiete_jagdbanngebiete: 'ch.bafu.wrz-jagdbanngebiete_select',
            schutzgebiete_wildruhezonen: 'ch.bafu.wrz-wildruhezonen_portal',
          };

          let activeIdentifyLayers: string[] = [];
          let layersToSniff: any[] = [];
          this.map.getLayers().forEach((l) => {
            const name = l.get('name') as string;
            if (name && wmtsLayerNames[name]) {
              activeIdentifyLayers.push(wmtsLayerNames[name]);
              layersToSniff.push(l);
            }
          });

          if (
            activeIdentifyLayers.length > 0 &&
            !this.is_hovering_tooltip &&
            !this.hovered_anchor
          ) {
            // Instant pixel sniffing (0ms cursor pulse)
            let instantHit = false;
            try {
              for (const l of layersToSniff) {
                if (typeof (l as any).getData === 'function') {
                  const data = (l as any).getData(evt.pixel);
                  if (data && data[3] > 0) {
                    instantHit = true;
                    break;
                  }
                }
              }
            } catch (e) {}

            let cachedHit = false;
            for (const hc of this.interactive_feature_cache) {
              const dx = hc.x - evt.coordinate[0];
              const dy = hc.y - evt.coordinate[1];
              if (Math.sqrt(dx * dx + dy * dy) < 25) {
                cachedHit = true;
                break;
              }
            }

            let knownMiss = false;
            if (!cachedHit) {
              const now = Date.now();
              for (
                let i = this.negative_identify_cache.length - 1;
                i >= 0;
                i--
              ) {
                const nc = this.negative_identify_cache[i];
                if (now - nc.time > 30000) {
                  this.negative_identify_cache.splice(i, 1);
                  continue;
                }
                const dx = nc.x - evt.coordinate[0];
                const dy = nc.y - evt.coordinate[1];
                if (Math.sqrt(dx * dx + dy * dy) < 15) {
                  knownMiss = true;
                  break;
                }
              }
            }

            if (instantHit || cachedHit) {
              this.is_hovering_interactive_feature = true;
              targetElement.style.cursor = 'pointer';
            }
          }
        }

        // Magnetic Path logic
        if (
          !this.map_animator.export_mode &&
          hit_path &&
          this.map_animator.path.length > 0
        ) {
          let min_distSq = Infinity;
          for (const wp of this.map_animator.path) {
            const dSq =
              Math.pow(wp.x - evt.coordinate[0], 2) +
              Math.pow(wp.y - evt.coordinate[1], 2);
            if (dSq < min_distSq) {
              min_distSq = dSq;
              map_hover_coord = wp;
            }
          }
        }
      }

      if (!this.map_animator.export_mode) {
        this.pointer = [evt.coordinate[0], evt.coordinate[1]];
        this.render_pointer();
        this.map_animator.move_pointer(map_hover_coord);
      }
    });
  }

  private setupUndoInteraction() {
    const viewport = this.map?.getViewport();
    if (viewport) {
      viewport.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        if (
          this.map_animator &&
          !this.map_animator.export_mode &&
          this.map_animator.can_undo()
        ) {
          this.onUndoRequested.emit();
        }
      });
    }
  }

  private setupDrawInteraction() {
    this.map.on('singleclick', async (evt) => {
      document.dispatchEvent(new CustomEvent('closeMapPopup'));

      if (!this.map_animator.export_mode && this.hovered_anchor) {
        // Explicitly hit an anchor without dragging -> delete it
        this.onWaypointDeleted.emit(this.hovered_anchor);
        this.tooltipOverlay.setPosition(undefined);
        return;
      }

      // 1. Check if user clicked an Interactive Vector feature
      let clickedVector = false;
      let vectorName = '';
      let vectorProperties: any = null;
      let vectorGeometry: any = null;

      this.map.forEachFeatureAtPixel(evt.pixel, (feature, layer) => {
        if (layer) {
          const lName = layer.get('name') as string;
          if (
            ['fountains', 'notfall', 'feuerstellen', 'shelter'].includes(lName)
          ) {
            clickedVector = true;
            vectorName = lName;
            vectorProperties = feature.getProperties();
            vectorGeometry = feature.getGeometry();
          }
        }
      });

      if (clickedVector && vectorProperties) {
        let title = '';
        let subtitle = '';

        if (vectorName === 'fountains') {
          title = 'Brunnen';
          let isDrinkable = 'Unbekannt';
          if (
            vectorProperties['amenity'] === 'drinking_water' ||
            vectorProperties['drinking_water'] === 'yes'
          )
            isDrinkable = 'Ja';
          else if (vectorProperties['drinking_water'] === 'no')
            isDrinkable = 'Nein';
          subtitle = `Trinkwasser: ${isDrinkable}`;
        } else if (vectorName === 'notfall') {
          title = 'Medizinische Einrichtung';
          const typeMap: Record<string, string> = {
            hospital: 'Spital',
            clinic: 'Klinik',
            pharmacy: 'Apotheke',
            doctors: 'Arztpraxis',
            dentist: 'Zahnarzt',
          };
          const rawType =
            vectorProperties['amenity'] ||
            vectorProperties['healthcare'] ||
            'Unbekannt';
          const type = typeMap[rawType] || rawType;

          let name = vectorProperties['name'] || '-';
          let phone =
            vectorProperties['phone'] ||
            vectorProperties['contact:phone'] ||
            '';
          let emergency =
            vectorProperties['emergency'] === 'yes' ? 'Notaufnahme: Ja' : '';

          subtitle = `<b>${type}</b><br>Name: ${name}`;
          if (phone) subtitle += `<br>Tel: ${phone}`;
          if (emergency)
            subtitle += `<br><span style="color:#d32f2f">${emergency}</span>`;
        } else if (vectorName === 'feuerstellen') {
          title = 'Feuerstelle';
          subtitle = vectorProperties['name'] || 'Öffentlicher Grillplatz';

          let origin = evt.coordinate;
          if (
            vectorGeometry &&
            typeof vectorGeometry.getCoordinates === 'function'
          ) {
            const coords = vectorGeometry.getCoordinates();
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
            subtitle += `<br><a href="${closest.url}" target="_blank" style="color:#1976D2; text-decoration: underline;">Link zu brätlistellen.ch</a>`;
          }
        } else if (vectorName === 'shelter') {
          title = 'Unterstand';
          subtitle = vectorProperties['name'] || 'Schutzhütte';

          let details: string[] = [];
          let shelterType =
            vectorProperties['shelter_type'] || vectorProperties['tourism'];

          if (shelterType === 'alpine_hut') {
            title = 'Berghütte';
            subtitle = vectorProperties['name'] || 'SAC-Hütte / Berghütte';
          } else if (shelterType === 'wilderness_hut') {
            title = 'Schutzhütte';
          }

          if (details.length > 0) {
            subtitle +=
              `<br><div style="margin-top: 5px; font-size: 0.9em; line-height: 1.4;">` +
              details.join('<br>') +
              `</div>`;
          }
        }

        const closeIcon = `<svg onclick="document.dispatchEvent(new CustomEvent('closeMapPopup'))" style="cursor: pointer; fill: #999;" width="24" height="24" viewBox="0 0 24 24"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>`;

        this.infoElement.innerHTML = `
          <div style="position: absolute; top: 12px; right: 12px; z-index: 100; background: rgba(255,255,255,0.8); border-radius: 50%; display: flex;">
            ${closeIcon}
          </div>
          <div style="max-height: 440px; overflow-y: auto; overflow-x: hidden; padding-right: 12px;">
            <div style="min-width: 250px; margin-bottom: 8px;">
              <div style="margin-bottom: 8px; padding-right: 24px;">
                <h3 style="margin: 0; color: #000; font-size: 1.4em; font-weight: 800; line-height: 1.1;">${title}</h3>
              </div>
              <div style="padding: 0 4px; font-size: 0.95em; line-height: 1.4;">
                ${subtitle}
              </div>
            </div>
          </div>
        `;
        this.infoElement.style.display = 'block';
        this.infoOverlay.setPosition(evt.coordinate);
        return;
      }

      // 2. Check if user clicked any WMTS Interactive Layers
      const wmtsLayerNames: Record<string, string> = {
        haltestellen: 'ch.bav.haltestellen-oev',
        schiessanzeigen: 'ch.vbs.schiessanzeigen',
        herdenschutzhunde: 'ch.bafu.alpweiden-herdenschutzhunde',
        schutzgebiete_naturschutzgebiete: 'ch.pronatura.naturschutzgebiete',
        schutzgebiete_jagdbanngebiete: 'ch.bafu.wrz-jagdbanngebiete_select',
        schutzgebiete_wildruhezonen: 'ch.bafu.wrz-wildruhezonen_portal',
      };

      let activeIdentifyLayers: string[] = [];
      this.map.getLayers().forEach((l) => {
        const name = l.get('name') as string;
        if (name && wmtsLayerNames[name]) {
          activeIdentifyLayers.push(wmtsLayerNames[name]);
        }
      });

      if (activeIdentifyLayers.length > 0 && !this.is_hovering_tooltip) {
        // Check cache first
        let cachedHit = null;
        for (const hc of this.interactive_feature_cache) {
          const dx = hc.x - evt.coordinate[0];
          const dy = hc.y - evt.coordinate[1];
          if (Math.sqrt(dx * dx + dy * dy) < 25) {
            cachedHit = hc;
            break;
          }
        }

        if (cachedHit) {
          if (cachedHit.data) {
            this.infoElement.innerHTML = this.formatIdentifyResults(
              cachedHit.data,
            );
          } else {
            this.infoElement.innerHTML = cachedHit.html;
          }
          this.infoElement.style.display = 'block';
          this.infoOverlay.setPosition(evt.coordinate);
          return;
        }

        const ext = this.map.getView().calculateExtent(this.map.getSize());
        const size = this.map.getSize() || [800, 600];
        const url = `https://api3.geo.admin.ch/rest/services/all/MapServer/identify?geometry=${evt.coordinate[0]},${evt.coordinate[1]}&geometryFormat=geojson&geometryType=esriGeometryPoint&imageDisplay=${size[0]},${size[1]},96&mapExtent=${ext.join(',')}&sr=2056&tolerance=20&layers=all:${activeIdentifyLayers.join(',')}`;

        fetch(url)
          .then((res) => res.json())
          .then((data) => {
            // Filter: Only keep main stations (LoD 0) to avoid perron/platform clutter
            if (data.results) {
              data.results = data.results.filter((r: any) => {
                if (r.layerBodId === 'ch.bav.haltestellen-oev') {
                  const lod = String(r.properties?.lod || '0');
                  const name = String(
                    r.properties?.name || r.id || r.featureId || '',
                  );
                  const typ = String(r.properties?.betriebspunkttyp_de || '');

                  const isMaster =
                    (lod === '0' || lod === 'undefined') &&
                    !name.startsWith('ch:');
                  const isVzw =
                    typ.includes('Verzweigung') || name.includes('(Vzw)');
                  const isGleisende = typ.includes('Gleisende');
                  const isZugeordnet = typ.includes(
                    'Zugeordneter Betriebspunkt',
                  );
                  const isBedienpunkt = typ === 'Bedienpunkt';
                  const isSpurwechsel = typ.includes('Spurwechsel');
                  const isSpurtrennung = typ.includes('Spurtrennung');
                  const isWendeschleife = typ.includes('Wendeschleife');
                  const isDienststation = typ.includes('Dienststation');
                  const isAusweiche = typ.includes('Ausweiche');
                  const isAnschlusspunkt = typ.includes('Anschlusspunkt');

                  return (
                    isMaster &&
                    !isVzw &&
                    !isGleisende &&
                    !isZugeordnet &&
                    !isBedienpunkt &&
                    !isSpurwechsel &&
                    !isSpurtrennung &&
                    !isWendeschleife &&
                    !isDienststation &&
                    !isAusweiche &&
                    !isAnschlusspunkt
                  );
                }
                return true;
              });
            }

            if (data.results && data.results.length > 0) {
              const pt = data.results[0].geometry.coordinates[0];
              const htmlResult = this.formatIdentifyResults(data);

              this.interactive_feature_cache.push({
                x: pt[0],
                y: pt[1],
                html: htmlResult,
                data: data,
              });

              // Draw dynamic highlight feature geometry
              this.highlight_layer_source.clear();
              const format = new GeoJSON();
              const features = [];
              for (let i = 0; i < data.results.length; i++) {
                if (data.results[i].geometry) {
                  try {
                    const feat = format.readFeature(data.results[i], {
                      dataProjection: 'EPSG:2056',
                      featureProjection: 'EPSG:2056',
                    });
                    if (Array.isArray(feat)) {
                      features.push(...(feat as Feature<any>[]));
                    } else {
                      features.push(feat as Feature<any>);
                    }
                  } catch (err) {
                    console.error('Failed parsing highlight geom', err);
                  }
                }
              }
              if (features.length > 0) {
                this.highlight_layer_source.addFeatures(features);
              }

              this.infoElement.innerHTML = htmlResult;
              this.infoElement.style.display = 'block';
              this.infoOverlay.setPosition(evt.coordinate);
            } else {
              // False alarm, hide overlay and append anchor fallback.
              this.infoElement.style.display = 'none';
              this.infoOverlay.setPosition(undefined);
              if (!this.map_animator.export_mode && !this.is_hovering_tooltip) {
                this.pointer_layer_source.clear();
                this.onWaypointAdded.emit({
                  x: evt.coordinate[0],
                  y: evt.coordinate[1],
                });
              }
            }
          })
          .catch((err) => {
            console.error('Identify fetch failed', err);
            document.dispatchEvent(new CustomEvent('closeMapPopup'));
          });

        return;
      }

      if (this.map_animator.export_mode) return;

      if (!this.is_hovering_tooltip) {
        // Hit empty map -> append new anchor
        this.pointer_layer_source.clear();
        this.onWaypointAdded.emit({
          x: evt.coordinate[0],
          y: evt.coordinate[1],
        });
      }
    });
  }

  private setupSubscriptions() {
    this.export_mode_sub = this.map_animator.export_mode$.subscribe(
      (is_export) => {
        this.modifyInteraction.setActive(!is_export);
        this.snapInteraction.setActive(!is_export);
        this.anchor_points_layer.setVisible(!is_export);
        this.pointer_layer.setVisible(!is_export);

        if (is_export) {
          this.tooltipOverlay.setPosition(undefined);
        } else {
          this.map_animator.trigger_path_redraw();
          this.refreshAnchors();
        }
      },
    );

    this.path_sub = this.map_animator.path$.subscribe((path) => {
      this.draw_path(path);
    });

    this.anchor_points_sub = this.map_animator.anchor_points$.subscribe(() => {
      this.refreshAnchors();
    });

    this.map_animator.pointer$.subscribe((coord) => {
      this.external_pointer_layer_source.clear();
      if (
        coord &&
        !this.map_animator.export_mode &&
        !this.hovered_anchor &&
        !this.is_modifying
      ) {
        const feature = new Feature({
          geometry: new Point([coord.x, coord.y]),
        });
        const styles = [
          new Style({
            image: new CircleStyle({
              radius: 6,
              fill: new Fill({ color: '#2196F3' }),
              stroke: new Stroke({ color: '#fff', width: 2 }),
            }),
          }),
        ];

        if (coord.name) {
          styles.push(
            new Style({
              text: new Text({
                text: coord.name,
                fill: new Fill({ color: '#2196F3' }), // Blue text for highlighted POI
                stroke: new Stroke({ color: '#fff', width: 3 }),
                font: 'bold 16px Open Sans',
                offsetY: -15,
              }),
            }),
          );
        }

        feature.setStyle(styles);
        this.external_pointer_layer_source.addFeature(feature);
      }
    });
  }

  private async fetchStationboard(
    uic: string,
    name: string,
    containerId: string,
  ) {
    const cacheKey = uic || name;
    const now = Date.now();
    const cached = this.stationboardCache.get(cacheKey);

    // Check Cache (5-minute TTL)
    if (cached && cached.expiry > now) {
      this.renderStationboard(cached.data, containerId);
      return;
    }

    try {
      // Abort any existing fetch for this container to avoid race conditions
      if (this.currentStationboardAbortControllers.has(containerId)) {
        this.currentStationboardAbortControllers.get(containerId)?.abort();
      }
      const abortController = new AbortController();
      this.currentStationboardAbortControllers.set(
        containerId,
        abortController,
      );

      // Preference: fetch by UIC ID if available, otherwise by name
      const queryParam = uic
        ? `id=${uic}`
        : `station=${encodeURIComponent(name)}`;
      const url = `https://transport.opendata.ch/v1/stationboard?${queryParam}&limit=5`;

      const response = await fetch(url, { signal: abortController.signal });
      if (!response.ok)
        throw new Error(`HTTP error! status: ${response.status}`);

      const data = await response.json();

      // Cache the result for 5 minutes
      this.stationboardCache.set(cacheKey, {
        data,
        expiry: now + 5 * 60 * 1000,
      });

      this.renderStationboard(data, containerId);
    } catch (err: any) {
      if (err.name === 'AbortError') return;
      console.error('Error fetching stationboard:', err);
      const container = document.getElementById(containerId);
      if (container) {
        container.innerHTML =
          '<div style="padding: 10px; color: #d32f2f; font-size: 0.9em; text-align: center;">Fehler beim Laden</div>';
      }
    } finally {
      this.currentStationboardAbortControllers.delete(containerId);
    }
  }

  private renderStationboard(data: any, containerId: string) {
    const container = document.getElementById(containerId);
    if (!container) return; // Element might have been removed (e.g. user stopped hovering)

    if (!data.stationboard || data.stationboard.length === 0) {
      container.innerHTML =
        '<div style="padding: 10px; color: #666; font-size: 0.9em; text-align: center;">Keine Abfahrten gefunden</div>';
      return;
    }

    let html = '';
    data.stationboard.forEach((dep: any) => {
      const departureTime = dep.stop.prognosis?.departure || dep.stop.departure;
      const time = new Date(departureTime).toLocaleTimeString('de-CH', {
        hour: '2-digit',
        minute: '2-digit',
      });
      const category = (dep.category || '').toUpperCase().trim();

      // Refined Line Badge Logic (Viadi/SBB Style)
      let line = '';
      if (['BUS', 'POST', 'BP', 'B', 'T', 'TR'].includes(category)) {
        // Buses and Trams: just the line number (e.g. "3")
        line = dep.number || dep.name || '';
      } else if (category) {
        // Trains and others: Category + Number (e.g. "S1", "RE5")
        const num = dep.number || '';
        // If number already starts with category (some APIs), don't double it
        line = num.toUpperCase().startsWith(category) ? num : category + num;
      } else {
        line = dep.number || dep.name || '';
      }

      // Cleanup: Avoid "null" string or too long technical numbers if we have a better fallback
      if (!line || line === 'null') line = dep.number || dep.name || '?';
      if (line.length > 8 && dep.number && dep.number !== line)
        line = dep.number;

      const destination = dep.to;

      // Detailed Transit Icons (High-Clarity Filled Silhouettes)
      const svgHeader =
        '<svg width="18" height="18" viewBox="0 0 24 24" fill="#000" fill-rule="evenodd" style="display: block;">';

      const busIcon = `${svgHeader}<path d="M4 16c0 .88.39 1.67 1 2.22V20c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1h8v1c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1.78c.61-.55 1-1.34 1-2.22V6c0-3.5-3.58-4-8-4s-8 .5-8 4v10zm14-5H6V6h12v5z"/></svg>`;
      const trainIcon = `${svgHeader}<path d="M12 2c-4 0-8 .5-8 4v9.5C4 17.43 5.57 19 7.5 19L6 20.5v.5h12v-.5L16.5 19c1.93 0 3.5-1.57 3.5-3.5V6c0-3.5-4-4-8-4zM17 11H7V6h10v5h-6z"/></svg>`;
      const tramIcon = `${svgHeader}<path d="M19 16c0 .88-.39 1.67-1 2.22V20c0 .55-.45 1-1 1h-1c-.55 0-1-.45-1-1v-1H9v1c0 .55-.45 1-1 1H7c-.55 0-1-.45-1-1v-1.78c-.61-.55-1-1.34-1-2.22V6c0-3.5 3.58-4 8-4s8 .5 8 4v10zM18 11H6V6h12v5zM13 1h-2v1h2V1z"/></svg>`;
      const shipIcon = `${svgHeader}<path d="M20 21c-1.39 0-2.78-.47-4-1.32-2.43 1.71-5.56 1.71-8 0C6.78 20.53 5.39 21 4 21H2v2h2c1.38 0 2.74-.35 4-.99 2.52 1.29 5.48 1.29 8 0 1.26.64 2.62.99 4 .99h2v-2h-2zM3.95 19H4c1.6 0 3.11-.55 4.36-1.45L12 14l3.64 3.55c1.25.9 2.76 1.45 4.36 1.45h.05l1.89-6.68C22.09 11.47 21.47 10 20 10h-2V4h-3V2h-5v2H7v6H5c-1.47 0-2.09 1.47-1.94 2.32L3.95 19zM15 10H9V6h6v4z"/></svg>`;
      const gondolaIcon = `${svgHeader}<path d="M19 14.7c.6 0 1-.4 1-1v-8c0-.6-.4-1-1-1h-6v-2h1c.6 0 1-.4 1-1s-.4-1-1-1h-4c-.6 0-1 .4-1 1s.4 1 1 1h1v2h-6c-.6 0-1 .4-1 1v8c0 .6.4 1 1 1h.3l-.3.7c-.2.5 0 1.1.5 1.3s1.1 0 1.3-.5l1.6-3.5h10.6l1.6 3.5c.2.5.8.7 1.3.5.5-.2.7-.8.5-1.3l-.3-.7h.3zm-13-1.7h-2v-3h2v3zm11 0h-2v-3h2v3z"/></svg>`;

      let finalIcon = trainIcon;
      if (['BUS', 'POST', 'BP', 'B'].includes(category)) finalIcon = busIcon;
      else if (['T', 'TR'].includes(category)) finalIcon = tramIcon;
      else if (['SHIP', 'F', 'FA', 'BAT', 'GDE'].includes(category))
        finalIcon = shipIcon;
      else if (
        ['G', 'GB', 'LB', 'PB', 'CC', 'FUN', 'C', 'SL'].includes(category)
      )
        finalIcon = gondolaIcon;

      html += `
        <div style="display: flex; align-items: center; padding: 10px 0; border-bottom: 1px solid #f0f0f0; min-height: 44px;">
          <div style="width: 24px; margin-right: 12px; display: flex; justify-content: center;">
            ${finalIcon}
          </div>
          <div style="background: #ffde00; color: #000; padding: 2px 6px; border-radius: 4px; font-weight: 800; font-size: 0.85em; margin-right: 12px; white-space: nowrap; min-width: 40px; text-align: center; font-family: 'Open Sans', sans-serif;">
            ${line}
          </div>
          <div style="flex: 1; color: #333; font-weight: 600; font-size: 0.95em; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; padding-right: 8px;">
            ${destination}
          </div>
          <div style="color: #000; font-weight: 800; font-size: 1em; white-space: nowrap;">
            ${time}
          </div>
        </div>
      `;
    });

    container.innerHTML =
      html +
      `
      <div style="font-size: 0.75em; color: #aaa; margin-top: 10px; text-align: center;">
        Quelle: transport.opendata.ch / opentransportdata.swiss
      </div>
    `;
  }

  private formatIdentifyResults(data: any): string {
    const closeIcon = `<svg onclick="document.dispatchEvent(new CustomEvent('closeMapPopup'))" style="cursor: pointer; fill: #999;" width="24" height="24" viewBox="0 0 24 24"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>`;

    let htmlResult = `
      <div style="position: absolute; top: 12px; right: 12px; z-index: 100; background: rgba(255,255,255,0.8); border-radius: 50%; display: flex;">
        ${closeIcon}
      </div>
      <div style="max-height: 440px; overflow-y: auto; overflow-x: hidden; padding-right: 12px;">
    `;

    const seenNames = new Set<string>();
    let elementCount = 0;

    for (const result of data.results) {
      const props = result.properties || {};
      const layerId = result.layerBodId;

      const stopName =
        props.name || props.uic_name || props.title || result.featureId;
      const dedupeKey = `${layerId}_${stopName}`;
      if (seenNames.has(dedupeKey)) continue;
      seenNames.add(dedupeKey);

      if (elementCount > 0) {
        htmlResult +=
          '<hr style="margin: 16px 0; border: 0; border-top: 1px solid #ccc;">';
      }
      elementCount++;

      // --- PREMIUM STATION CARD 2.0 (INTEGRATED DEPARTURES + VIADI STYLE) ---
      if (layerId === 'ch.bav.haltestellen-oev') {
        const uic = props.uic_code || props.nummer || props.ext_id || '';
        const nameEnc = encodeURIComponent(stopName);

        // Stable ID to avoid losing reference during hover updates
        const containerId = `sb-${uic || stopName.replace(/[^a-z0-9]/gi, '')}`;

        // SBB fahrplan.xhtml deep-links
        const anreiseUrl = `https://www.sbb.ch/de/kaufen/pages/fahrplan/fahrplan.xhtml?nach=${nameEnc}`;
        const rueckreiseUrl = `https://www.sbb.ch/de/kaufen/pages/fahrplan/fahrplan.xhtml?von=${nameEnc}`;

        const now = new Date();
        const dateStr = now.toLocaleDateString('de-CH', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
        });

        // Trigger async fetch for departures with a slight delay to ensure DOM is ready
        setTimeout(
          () => this.fetchStationboard(uic, stopName, containerId),
          50,
        );

        htmlResult += `
          <div style="min-width: 300px;">
            <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 8px; padding: 4px 8px;">
              <h3 style="margin: 0; color: #000; font-size: 1.4em; font-weight: 800; line-height: 1.1; flex: 1; padding-right: 24px;">${stopName}</h3>
            </div>
            
            <div style="padding: 0 8px 12px 8px; border-bottom: 1px solid #f0f0f0;">
              <div style="color: #666; font-size: 0.95em; margin-bottom: 8px;">Im SBB-Fahrplan öffnen:</div>
              <div style="display: flex; gap: 20px; align-items: center;">
                <a href="${anreiseUrl}" target="_blank" style="display: flex; align-items: center; color: #000; text-decoration: none; font-weight: 800; font-size: 1.1em;">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="#d32f2f" style="margin-right: 6px;"><path d="M19 19H5V5h7V3H5c-1.11 0-2 .9-2 2v14c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2v-7h-2v7zM14 3v2h3.59l-9.83 9.83 1.41 1.41L19 6.41V10h2V3h-7z"/></svg>
                  Anreise
                </a>
                <a href="${rueckreiseUrl}" target="_blank" style="display: flex; align-items: center; color: #000; text-decoration: none; font-weight: 800; font-size: 1.1em;">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="#d32f2f" style="margin-right: 6px;"><path d="M19 19H5V5h7V3H5c-1.11 0-2 .9-2 2v14c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2v-7h-2v7zM14 3v2h3.59l-9.83 9.83 1.41 1.41L19 6.41V10h2V3h-7z"/></svg>
                  Rückreise
                </a>
              </div>
              <div style="margin-top: 12px; font-weight: 800; font-size: 1.1em; color: #000;">${dateStr}</div>
            </div>
            
            <div id="${containerId}" style="max-height: 400px; overflow-y: auto; padding: 4px 8px 8px 8px;">
               <div style="padding: 20px; text-align: center; color: #999;">
                 <div style="display: inline-block; width: 24px; height: 24px; border: 3px solid #eee; border-top: 3px solid #d32f2f; border-radius: 50%; animation: spin 1s linear infinite; margin-bottom: 8px;"></div>
                 <br>Laden...
               </div>
            </div>
          </div>
          <style>
            @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
          </style>
        `;
        continue;
      }

      // --- GENERIC POPOVER FOR OTHER LAYERS ---
      let title = layerId || 'Metadaten';
      if (title === 'ch.vbs.schiessanzeigen') title = 'Schiessanzeigen';
      else if (title === 'ch.bafu.alpweiden-herdenschutzhunde')
        title = 'Herdenschutzhunde';
      else if (title.includes('schutzgebiete') || title.includes('wrz'))
        title = 'Schutzgebiet';

      let subtitle =
        props.wrz_name ||
        props.jb_name ||
        props.name ||
        props.nom ||
        props.titre ||
        props.title ||
        '';

      htmlResult += `
        <div style="min-width: 250px; margin-bottom: 8px;">
          <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 8px; padding: 4px 8px;">
            <div style="flex: 1; padding-right: 24px;">
              <h3 style="margin: 0; color: #000; font-size: 1.4em; font-weight: 800; line-height: 1.1;">${title}</h3>
              ${subtitle ? `<div style="font-size: 0.9em; color: #666; margin-top: 4px;">${subtitle}</div>` : ''}
            </div>
          </div>
          <div style="padding: 0 8px; font-size: 0.95em;">
            ${this.formatPopupProperties(props, layerId)}
          </div>
        </div>
      `;
    }

    htmlResult += `</div>`;
    return htmlResult;
  }

  /**
   * Refined property formatter to filter technical junk and use friendly labels.
   */
  private formatPopupProperties(props: any, layerBodId: string): string {
    let result = '';
    const excludeKeys = [
      'id',
      'featureId',
      'layerBodId',
      'layerName',
      'symbolId',
      'imageDisplay',
      'mapExtent',
      'geometry',
      'geometryType',
      'sr',
      'tolerance',
      'label',
      'st_area_shape',
      'st_length_shape',
      'wrz_id',
      'jb_id',
    ];

    for (const key of Object.keys(props)) {
      if (
        excludeKeys.includes(key) ||
        props[key] === null ||
        props[key] === undefined ||
        typeof props[key] === 'object' ||
        props[key] === ''
      ) {
        continue;
      }

      let displayKey = key;
      let val = props[key];

      // Layer-specific filters
      if (layerBodId === 'ch.bav.haltestellen-oev') {
        const ovExclude = [
          'uic_name',
          'uic_code',
          'bav_name',
          'betriebspunkttyp',
          'betriebspunkttyp_de',
          'betriebspunkttyp_fr',
          'lod',
          'nummer_text',
          'betrieblichebezeichnung',
        ];
        if (ovExclude.includes(key)) continue;
        if (key === 'tuabkuerzung') displayKey = 'Verkehrsunternehmen';
        if (key === 'transport_means_de') displayKey = 'Verkehrsmittel';
      }

      if (layerBodId === 'ch.bafu.alpweiden-herdenschutzhunde') {
        // ... (existing herdenschutzhunde handling)
        const keyMap: Record<string, string> = {
          code_refverhalten: 'Verhaltensregeln',
          code_hundepraesenz: 'Anwesenheit Schutzhunde',
          code_hinweis: 'Hinweis',
          refmeldungbeweidungszone: 'Aktuelle Beweidungszone',
          kontname: 'Kontakt Name',
          konttel: 'Kontakt Telefon',
          kontemail: 'Kontakt E-Mail',
          name: 'Objektname',
        };
        if (keyMap[key]) displayKey = keyMap[key];

        if (key === 'code_refverhalten') {
          val =
            'http://www.protectiondestroupeaux.ch/de/herdenschutzhunde/tourismus-und-herdenschutzhunde/sichere-begegnungen-mit-herdenschutzhunden/';
        } else if (key === 'code_hundepraesenz') {
          const pMap: Record<number, string> = {
            1000: 'Es ist ganzjährig mit der Anwesenheit von Herdenschutzhunden zu rechnen.',
            1001: 'In der Regel von Anfang Juni bis Ende September.',
            1008: 'In der Regel von Anfang Juni bis Ende September. Beachten Sie nach Möglichkeit die aktuellen Präsenzangaben auf den Infotafeln vor Ort.',
            1010: 'In der Regel zwischen Anfang Juni und Ende September.',
            1011: 'In der Regel zwischen Anfang Juni und Mitte September. Beachten Sie nach Möglichkeit die aktuellen Präsenzangaben auf den Infotafeln vor Ort.',
            1014: 'In der Regel zwischen Ende Mai bis Bettag (ca. Mitte September).',
            1016: 'In der Regel zwischen Ende Mai und Ende September. Auf dem Alpinwanderweg Vorderjoch - Gandispitz - Zingel ist nicht mit Begegnungen mit Herdenschutzhunden zu rechnen.',
            1017: 'In der Regel zwischen Ende Mai und Mitte Oktober.',
            1018: 'In der Regel zwischen Mitte April und Anfang Dezember.',
            1019: 'In der Regel zwischen Mitte Juni und Ende September.',
            1020: 'In der Regel zwischen Mitte Juni und Ende September. Beachten Sie nach Möglichkeit die aktuellen Präsenzangaben auf den Infotafeln vor Ort.',
            1021: 'In der Regel zwischen Mitte Juni und Mitte September.',
            1022: 'Von Anfang August bis Mitte September ist auf dem Wanderweg von der Canalbrücke aus Richtung Zapporthütte damit zu rechnen, auf Herdenschutzhunde zu treffen.',
            1024: 'In der Regel zwischen Anfang Juni und Mitte September.',
            1025: 'In der Regel Ende Mai bis Ende Juni auf der Weide Lavanchy-Poy. Mitte Juni bis Ende September auf der Alp Taveyanne.',
            1026: 'In der Regel Ende Mai bis Mitte Juni auf dem unteren Teil der Alpweide. Mitte August bis Anfang Oktober auf der ganzen Alp.',
            1027: 'In der Regel Anfang Juni bis Mitte Oktober. Die Herde mit den Herdenschutzhunden befindet sich im August in der Region um die Seen.',
            1028: 'Mitte April - Mitte Juni: Weiden Rossboden und Älpli bei Malans. Mitte Juni - Anfang Juli und September: Grüscheralp (Alpweide um Golrosa, Cavell, Schafbüel). Ab Juli - Anfang September: Alp Drusa (Alpweide rund um Carschinahütte und Schafberg).',
            1032: 'In der Regel Mitte Mai bis Ende Juni (Gommer Höhenweg) und Ende September bis Ende Oktober (Hofmatte).',
            1033: 'In der Regel zwischen Anfang Juni und Anfang Juli und im Oktober auf der Weiden zwischen Vercorin und Le Crêt du Midi. Und zwischen Anfang Juli bis Ende September auf der Weiden zwischen Le Crêt du Midi und le Roc d&#39;Orzival.',
            1034: 'In der Regel von Anfang Mai bis Ende Mai für die Weiden um das Dorf Ramosch. Von Ende Mai bis Ende September für die Alp Russena. Und von Ende September bis Anfang November für die Alp Arina.',
            1035: 'In der Regel von Anfang Juni bis Mitte Juli für den Sektor Cani und Sanalada und von Mitte Juli bis Ende September für den oberen Teil der Alp. Beachten Sie nach Möglichkeit die aktuellen Präsenzangaben auf den Infotafeln vor Ort.',
            1036: 'Die Herde und die Herdenschutzhunde sind von Anfang Juni bis Mitte Septembre in Lavaz und von Mitte September bis Mitte Oktober in Val Plattas anzutreffen. Beachten Sie nach Möglichkeit die aktuellen Präsenzangaben auf den Infotafeln vor Ort.',
            1037: 'In der Regel zwischen Mitte Mai und Ende September.',
            1038: 'In der Regel zwischen Mitte Mai und Mitte Oktober.',
            1039: 'In der Regel zwischen Ende Juli und Ende September.',
            1040: 'In der Regel zwischen Mitte Juni und Ende Juli.',
            1041: 'In der Regel Anfang Juni bis Mitte August auf der Alp Curtegns. Mitte August bis Ende September auf der Alp Val Nandro.',
            1042: 'In der Regel, Anfang Juni - Mitte Juli und Anfang September - Mitte September: Alp Schärm Obergross Stäfe (Studen). Mitte Juli - Anfang September: Hochalp Silbern.',
            1043: 'In der Regel zwischen Anfang Mai und Ende Oktober.',
            1044: 'In der Regel zwischen Anfang Mai bis Ende Juni und im Oktober.',
            1045: 'In der Regel zwischen Mitte Mai und Ende September.',
            1046: 'In der Regel. Juni: Combi. Juli - September: Balachaux.',
            1047: 'In der Regel zwischen Anfang Mai und Ende Mai. Und zwischen Anfang September und Mitte November.',
            1048: 'In der Regel zwischen Anfang Juni und Mitte Oktober.',
            1049: 'In der Regel zwischen Mitte Juni und Mitte Oktober.',
            1050: 'In der Regel zwischen Mitte Juni und Ende September.',
            1051: 'In der Regel zwischen Mitte Mai und Mitte Oktober.',
            1052: 'In der Regel zwischen Anfang Juli und Ende September.',
            1053: 'In der Regel zwischen Anfang Juni und Ende Oktober.',
            1055: 'In der Regel zwischen Anfang Mai und Mitte November.',
            1056: 'In der Regel zwischen Anfang Juli und Mitte Oktober.',
          };
          val = pMap[val as number] || val;
        } else if (key === 'code_hinweis') {
          const hMap: Record<number, string> = {
            0: 'n.n.',
            4: 'Der Wanderweg am Lag da Pigniu ist bei Anwesenheit der Herdenschutzhunde ausgezäunt, so dass Sie in der Regel nicht direkt auf die geschützte Herde treffen. Mit Begleithunden - unbedingt angeleint - bitte zügig an der geschützten Weide vorbeigehen.',
            30: 'Der Weg durch die Combe de Dreveneuse ist während der Zeit, in der die Herde dort weidet, gesperrt.',
            36: 'Der direkte Wanderweg zum Fürstein ist jeweils während der Beweidungsdauer (2 Wochen) temporär gesperrt. Der Wanderweg ist über die Ostseite umgeleitet.',
            37: 'Um Interaktionen zwischen Herdenschutzhunden und Touristen zu minimieren, können einige Wanderwege vorübergehend geschlossen und umgeleitet werden.',
            45: 'Der eingezäunten, geschützten Herde auf dem Guferli kann problemlos ausgewichen werden.',
            51: 'Die Wanderwege sind ausgezäunt, so dass Sie in der Regel nicht direkt auf die geschützte Herde treffen. Mit Begleithunden - unbedingt angeleint - bitte zügig an der geschützten Weide vorbeigehen.',
            60: 'Der Wanderweg südlich des Bärried ist abgezäunt. Mit Begleithunden - unbedingt angeleint - bitte zügig an der geschützten Weide vorbeigehen.',
            77: 'Der WW vom Bruchgeereberg über Pkt. 1652 und weiter Richtung Chummli ist ausgezäunt. Einzig während rund 2 Wochen ist auf dem Wegabschnitt Pkt. 1652-Chummli damit zu rechnen, direkt auf die geschützte Herde zu treffen (Auskünfte: NP Diemtigtal).',
            92: 'Empfehlungen zum korrekten Verhalten bei Begegnungen mit Mutterkuhherden finden Sie auf der Website der Schweizer Wanderwege.',
            123: 'im Sektor Lavanchy-Poy, die Strasse ist ausgezäunt - es ist nicht damit zu rechnen, direkt auf die geschützte Herde zu treffen.',
            135: 'Als Alternative zum Weg Unteri Rippa - Bremingard - Col du Chamois wird bei Präsenz Hunde die Route Unteri Rippa - Cerniets - Col du Chamois empfohlen. Zwischen dem Col du Chamois und Cerniets wurde diese Alternativroute im Feld neu gekennzeichnet.',
            138: 'Der tiefer verlaufende Weg von der Niwenalp zum Stafel ist ausgezäunt; der höher parallel verlaufende Weg über Nibubedu hingegen quert in den Mt. Juni u. Sept. die geschützte Herde (Juli/Aug. befindet sich die Herde in höher gelegenen Weidesektoren).',
            145: 'Die Herde und die Herdenschutzhunde sind zwar während dem Sommer einige Tage auf dem Kaiseregg-Pass, jedoch ausschliesslich unter der Woche.',
            150: 'Der Weg vom Vord. Sänntum zum Turtmannsee (westl. der Turtmänna) sowie der Höhenweg über Biele zur Turtmannhütte (östl. der Turtmänna) sind ausgezäunt. Für Juli wird empfohlen, den Weg vom Vord. Sänntum über Holustei nach Biele nicht zu nutzen.',
            154: 'Um die Sömmerung der Schafe auf der Alp Rappental zu ermöglichen, wurde der Herdenschutz verstärkt. Um Interaktionen zwischen den Herdenschutzhunden und den Touristen zu minimieren, werden einige Wanderwege vorübergehend umgeleitet oder gesperrt.',
            163: 'Befindet sich die geschützte Herde in der Nähe des Wanderweges, so ist dieser ausgezäunt, so dass Sie in der Regel nicht auf die geschützte Herde treffen. Vom Mitführen von Hunden wird abgeraten.',
            174: 'Um die Interaktionen zwischen den HSHs und den Touristen zu minimieren, wird der Wanderweg entlang des Glattgrats während der Beweidungsdauer (Anfang Juni bis Mitte Juli) vorübergehend umgeleitet.',
            220: 'Auf dem markierten Gebiet im Val Segnas ist nur im Oktober damit zu rechnen, Herdenschutzhunde anzutreffen.',
            226: 'Der Mountainbiketrail ist ausgezäunt, so dass Sie in der Regel nicht direkt auf die geschützte Herde treffen. Mit Begleithunden - unbedingt angeleint - bitte zügig an der geschützten Weide vorbeigehen.',
            252: 'Der Bergwanderweg durch das Rappenloch ist von Anfang Juni bis Mitte Juni gesperrt.',
          };
          val = hMap[val as number] || val;
        }
      }

      // Language filter and clean key extraction
      if (
        key.endsWith('_fr') ||
        key.endsWith('_it') ||
        key.endsWith('_en') ||
        key.endsWith('_rm')
      )
        continue;

      let cleanKey = key;
      if (key.endsWith('_de')) {
        cleanKey = key.replace('_de', '');
      }

      // Hide internal redundant BAFU regulation codes (e.g. R90) since 'best_de' provides the human-readable text.
      if (cleanKey === 'bestimmung') continue;

      displayKey = cleanKey;

      if (
        layerBodId === 'ch.bafu.wrz-jagdbanngebiete_select' ||
        layerBodId === 'ch.bafu.wrz-wildruhezonen_portal' ||
        layerBodId === 'ch.bafu.schutzgebiete-schweizerischer_nationalpark'
      ) {
        const keyMap: Record<string, string> = {
          jb_name: 'Name',
          wrz_name: 'Name',
          schutzs: 'Schutzstatus',
          best: 'Zusatzbestimmungen',
          kanton: 'Kanton',
          beschlussjahr: 'Beschlussjahr',
          grundlage: 'Grundlage',
          name: 'Name', // Fallback for nationalpark
        };
        if (keyMap[cleanKey]) displayKey = keyMap[cleanKey];
      }

      if (typeof val === 'string') {
        if (val.startsWith('http')) {
          val = `<a href="${val}" target="_blank" style="color:#1976D2; text-decoration: underline;">Detail-Infos</a>`;
        } else if (val.includes(';')) {
          const listItems = val
            .split(';')
            .map((s) => s.trim())
            .filter((s) => s)
            .join(';</li><li style="margin-bottom: 4px;">');
          val = `<ul style="margin: 4px 0 0 0; padding-left: 18px; line-height: 1.35;"><li style="margin-bottom: 4px;">${listItems}</li></ul>`;
        }
      }

      displayKey = displayKey.replace(/_/g, ' ');
      displayKey = displayKey.charAt(0).toUpperCase() + displayKey.slice(1);

      // Inline block so the ul drops nicely below or stays inline if it's plain text
      result += `<div style="margin-bottom: 6px; line-height: 1.35;"><strong>${displayKey}:</strong> ${val}</div>`;
    }

    // No special action buttons needed here anymore as Haltestellen are handled above
    if (layerBodId !== 'ch.bav.haltestellen-oev' && layerBodId) {
      const view = this.map.getView();
      const center = view.getCenter();

      let e = 2600000;
      let n = 1200000;
      if (center) {
        e = center[0];
        n = center[1];
      }

      const currentRes = view.getResolution() || 250;
      const geoAdminResolutions = [
        4000, 2000, 1000, 500, 250, 100, 50, 20, 10, 5, 2.5, 2, 1.5, 1, 0.5,
      ];
      let swisstopoZoom = 4;
      let minDiff = Infinity;
      for (let i = 0; i < geoAdminResolutions.length; i++) {
        const diff = Math.abs(geoAdminResolutions[i] - currentRes);
        if (diff < minDiff) {
          minDiff = diff;
          swisstopoZoom = i;
        }
      }

      const externalIcon = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right: 4px; vertical-align: text-bottom;"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path><polyline points="15 3 21 3 21 9"></polyline><line x1="10" y1="14" x2="21" y2="3"></line></svg>`;
      const swisstopoUrl = `https://map.geo.admin.ch/?layers=${layerBodId}&lang=de&E=${e}&N=${n}&zoom=${swisstopoZoom}`;

      result += `<p style="margin:8px 0 2px 0;">
        <a href="${swisstopoUrl}" target="_blank" style="color:#1976D2; text-decoration: none; display: inline-flex; align-items: center; font-weight: 600;">
          ${externalIcon} <span style="text-decoration: underline;">map.geo.admin.ch</span>
        </a>
      </p>`;
    }

    return result;
  }

  private draw_path(path: LV95_Waypoint[]) {
    this.path_layer_source.clear();
    if (!path || path.length === 0) return;

    if (path.length === 1) {
      this.path_layer_source.addFeature(
        this.create_single_point_feature(path[0]),
      );
      return;
    }

    const feature = new Feature({
      geometry: new LineString(path.map((p) => [p.x, p.y])),
    });

    feature.setStyle((feature, resolution) => {
      const geometry = feature.getGeometry() as LineString;
      const coords = geometry.getCoordinates();

      if (this.is_modifying && this.map_animator) {
        const changed_idx = this.find_changed_index(path, coords);
        if (changed_idx !== -1) {
          return this.build_modification_styles(path, coords, changed_idx);
        }
      }

      return this.get_default_path_styles();
    });

    this.path_layer_source.addFeature(feature);
  }

  private create_single_point_feature(point: LV95_Waypoint): Feature {
    const feature = new Feature({ geometry: new Point([point.x, point.y]) });
    feature.setStyle(
      new Style({
        image: new CircleStyle({
          radius: 6,
          fill: new Fill({ color: '#efa038' }),
          stroke: new Stroke({ color: '#fff', width: 2 }),
        }),
      }),
    );
    return feature;
  }

  private get_default_path_styles(): Style[] {
    return [
      new Style({ stroke: new Stroke({ color: '#fff', width: 9 }) }),
      new Style({ stroke: new Stroke({ color: '#efa038', width: 5 }) }),
    ];
  }

  private find_changed_index(
    path: LV95_Waypoint[],
    coords: number[][],
  ): number {
    const is_insert = coords.length > path.length;
    let dragged_idx = -1;

    if (is_insert) {
      for (let i = 0; i < path.length; i++) {
        if (
          Math.abs(coords[i][0] - path[i].x) > 0.1 ||
          Math.abs(coords[i][1] - path[i].y) > 0.1
        ) {
          return i;
        }
      }
      return coords.length - 1;
    } else {
      let max_dist = 0;
      for (let i = 0; i < Math.min(coords.length, path.length); i++) {
        const dist =
          Math.pow(coords[i][0] - path[i].x, 2) +
          Math.pow(coords[i][1] - path[i].y, 2);
        if (dist > max_dist) {
          max_dist = dist;
          dragged_idx = i;
        }
      }
      return dragged_idx;
    }
  }

  private get_preview_bounds(
    path: LV95_Waypoint[],
    coords: number[][],
    changed_idx: number,
  ) {
    let start_idx = -1;
    let found_start = false;
    let end_idx = -1;
    let found_end = false;

    let is_insert = coords.length > path.length;

    if (!is_insert && this.dragged_anchor) {
      // MOVES: Strict Topological Lookup for preview bounds
      let target_anchor_idx = -1;
      let anchor_count = 0;

      for (let i = 0; i < path.length; i++) {
        if (path[i].is_waypoint) {
          if (GeometryUtils.pointsMatch(path[i], this.dragged_anchor)) {
            target_anchor_idx = anchor_count;
          }
          anchor_count++;
        }
      }

      if (target_anchor_idx !== -1) {
        let current_anchor_count = 0;
        for (let i = 0; i < path.length; i++) {
          if (path[i].is_waypoint) {
            if (current_anchor_count === target_anchor_idx - 1) {
              start_idx = i;
              found_start = true;
            }
            if (current_anchor_count === target_anchor_idx + 1) {
              end_idx = i;
              found_end = true;
            }
            current_anchor_count++;
          }
        }
      }
    } else {
      // INSERTS: Spatial scanning
      for (let i = changed_idx - 1; i >= 0; i--) {
        if (path[i].is_waypoint) {
          start_idx = i;
          found_start = true;
          break;
        }
      }
      let search_fw_start = is_insert ? changed_idx : changed_idx + 1;
      for (let i = search_fw_start; i < path.length; i++) {
        if (path[i].is_waypoint) {
          end_idx = i;
          found_end = true;
          break;
        }
      }
    }

    return {
      start_anchor_idx: start_idx,
      found_start,
      end_anchor_idx: end_idx,
      found_end,
    };
  }

  private create_line_segment_style(
    coords: number[][],
    color: string,
    width: number,
  ): Style {
    return new Style({
      geometry: new LineString(coords),
      stroke: new Stroke({ color, width }),
    });
  }

  private build_modification_styles(
    path: LV95_Waypoint[],
    coords: number[][],
    changed_idx: number,
  ): Style[] {
    const styles: Style[] = [];
    const { start_anchor_idx, found_start, end_anchor_idx, found_end } =
      this.get_preview_bounds(path, coords, changed_idx);

    // Head original segment
    if (found_start && start_anchor_idx > 0) {
      const headCoords = path
        .slice(0, start_anchor_idx + 1)
        .map((p: any) => [p.x, p.y]);
      if (headCoords.length >= 2) {
        styles.push(this.create_line_segment_style(headCoords, '#fff', 9));
        styles.push(this.create_line_segment_style(headCoords, '#efa038', 5));
      }
    }

    // Tail original segment
    if (found_end && end_anchor_idx < path.length - 1) {
      const tailCoords = path.slice(end_anchor_idx).map((p: any) => [p.x, p.y]);
      if (tailCoords.length >= 2) {
        styles.push(this.create_line_segment_style(tailCoords, '#fff', 9));
        styles.push(this.create_line_segment_style(tailCoords, '#efa038', 5));
      }
    }

    // Semi-transparent original segment
    const sliceStart = found_start ? start_anchor_idx : 0;
    const sliceEnd = found_end ? end_anchor_idx : path.length - 1;
    const oldSegment = path
      .slice(sliceStart, sliceEnd + 1)
      .map((p: any) => [p.x, p.y]);
    if (oldSegment.length >= 2) {
      styles.push(
        this.create_line_segment_style(
          oldSegment,
          'rgba(255, 255, 255, 0.4)',
          9,
        ),
      );
      styles.push(
        this.create_line_segment_style(
          oldSegment,
          'rgba(239, 160, 56, 0.4)',
          5,
        ),
      );
    }

    // V shape preview
    const draggedPoint = coords[changed_idx];
    const V_Coords = [];
    if (found_start)
      V_Coords.push([path[start_anchor_idx].x, path[start_anchor_idx].y]);
    V_Coords.push(draggedPoint);
    if (found_end)
      V_Coords.push([path[end_anchor_idx].x, path[end_anchor_idx].y]);

    if (V_Coords.length >= 2) {
      styles.push(this.create_line_segment_style(V_Coords, '#fff', 9));
      styles.push(this.create_line_segment_style(V_Coords, '#efa038', 5));
    }

    return styles;
  }

  private refreshAnchors() {
    this.anchor_points_layer_source.clear();
    const anchors = this.map_animator.anchor_points;
    anchors.forEach((pt: any) => {
      if (
        this.is_modifying &&
        this.dragged_anchor &&
        GeometryUtils.pointsMatch(pt, this.dragged_anchor)
      ) {
        return; // Suppress duplicate rendering under the interaction point
      }
      const feature = new Feature({ geometry: new Point([pt.x, pt.y]) });
      feature.setStyle(
        new Style({
          image: new CircleStyle({
            radius: 6,
            fill: new Fill({ color: '#efa038' }),
            stroke: new Stroke({ color: '#fff', width: 2 }),
          }),
        }),
      );
      this.anchor_points_layer_source.addFeature(feature);
    });
  }

  private render_pointer() {
    this.pointer_layer_source.clear();
    if (
      this.pointer != null &&
      !this.map_animator?.export_mode &&
      !this.hovered_anchor &&
      !this.is_modifying
    ) {
      if (this.is_hovering_interactive_feature) return;

      const feature = new Feature({ geometry: new Point(this.pointer) });
      feature.setStyle(
        new Style({
          image: new CircleStyle({
            radius: 8,
            fill: new Fill({ color: 'transparent' }),
            stroke: new Stroke({ color: '#efa038', width: 3 }),
          }),
        }),
      );
      this.pointer_layer_source.addFeature(feature);

      if (this.tooltipElement.innerHTML !== '') {
        this.tooltipOverlay.setPosition(this.pointer);
      } else {
        this.tooltipOverlay.setPosition(undefined);
      }
    }
  }

  public destroy() {
    this.path_sub?.unsubscribe();
    this.anchor_points_sub?.unsubscribe();
    this.export_mode_sub?.unsubscribe();
    if (this.map) {
      this.map.removeLayer(this.path_layer);
      this.map.removeLayer(this.anchor_points_layer);
      this.map.removeLayer(this.pointer_layer);
      this.map.removeInteraction(this.modifyInteraction);
      this.map.removeInteraction(this.snapInteraction);
      this.map.removeOverlay(this.tooltipOverlay);
      this.map.removeOverlay(this.infoOverlay);
    }
  }
}
