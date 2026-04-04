import { Feature } from 'ol';
import OLMap from 'ol/Map';
import { transform } from 'ol/proj';
import VectorSource from 'ol/source/Vector';
import VectorLayer from 'ol/layer/Vector';
import { LineString, Point } from 'ol/geom';
import { Modify, Snap } from 'ol/interaction';
import { Fill, Stroke, Style, Circle as CircleStyle, Text } from 'ol/style';
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
  private interactive_feature_cache: { x: number; y: number; html: string }[] =
    [];
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
  private currentStationboardAbortControllers = new Map<string, AbortController>();
  
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

  private export_mode_sub!: Subscription;
  private anchor_points_sub!: Subscription;

  constructor(map: OLMap, animator: MapAnimatorService) {
    this.map = map;
    this.map_animator = animator;
    this.map.addLayer(this.path_layer);
    this.map.addLayer(this.anchor_points_layer);
    this.map.addLayer(this.pointer_layer);
    this.map.addLayer(this.external_pointer_layer);

    this.setupInteractions();
    this.setupSubscriptions();

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
    this.infoElement.style.padding = '8px 12px';
    this.infoElement.style.borderRadius = '4px';
    this.infoElement.style.border = '1px solid #ccc';
    this.infoElement.style.boxShadow = '0 2px 4px rgba(0,0,0,0.2)';
    this.infoElement.style.fontFamily = '"Open Sans", sans-serif';
    this.infoElement.style.fontSize = '13px';
    this.infoElement.style.color = '#333';
    this.infoElement.style.display = 'none';
    this.infoElement.style.maxWidth = '380px';
    this.infoElement.style.lineHeight = '1.4';
    this.infoElement.style.wordWrap = 'break-word';

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
      source: this.anchor_points_layer_source,
      pixelTolerance: 20,
    });

    this.modifyInteraction.on('modifystart', (evt: any) => {
      this.is_modifying = true;
      const coords = evt.features.getArray()[0].getGeometry().getCoordinates();
      this.modifystart_coord = coords;
      this.dragged_anchor = { x: coords[0], y: coords[1] } as any;
    });

    this.modifyInteraction.on('modifyend', (evt: any) => {
      this.is_modifying = false;
      const feature = evt.features.getArray()[0];
      const new_coords = feature.getGeometry().getCoordinates();

      this.onRouteModified.emit({
        new_coords: [new_coords],
        dragged_anchor: this.dragged_anchor,
        mousedown_coord: this.modifystart_coord!,
      });

      this.dragged_anchor = null;
      this.modifystart_coord = null;
    });

    this.map.addInteraction(this.modifyInteraction);
  }

  private setupSnapInteraction() {
    this.snapInteraction = new Snap({
      source: this.anchor_points_layer_source,
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

      // 1. Anchor Hover Logic
      let foundAnchor = false;
      if (!this.is_mouse_over_dom_tooltip) {
        this.map.forEachFeatureAtPixel(
          evt.pixel,
          (f, l) => {
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

      if (!foundAnchor && !this.is_hovering_tooltip && !this.is_mouse_over_dom_tooltip) {
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
        const content =
          'Ziehen zum verschieben<br><span style="color:#ff5252; cursor:pointer" id="delete-anchor-btn">Klicken zum Löschen</span>';
        if (this.tooltipElement.innerHTML !== content) {
          this.tooltipElement.innerHTML = content;
          const deleteBtn =
            this.tooltipElement.querySelector('#delete-anchor-btn');
          if (deleteBtn) {
            deleteBtn.addEventListener(
              'pointerdown',
              (e) => {
                e.stopPropagation();
                if (this.hovered_anchor) {
                  this.onWaypointDeleted.emit(this.hovered_anchor);
                  this.tooltipOverlay.setPosition(undefined);
                }
              },
              { once: true },
            );
          }
        }
        this.tooltipOverlay.setPosition([
          this.hovered_anchor!.x,
          this.hovered_anchor!.y,
        ]);
      } else if (this.is_hovering_tooltip) {
        const content = 'Ziehen um Punkt zu erstellen';
        if (this.tooltipElement.innerHTML !== content)
          this.tooltipElement.innerHTML = content;
      } else if (this.map_animator.magnetic_paths) {
        const content = 'Klicken um Punkt anzuhängen';
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
        let hit_path = false;
        let hit_vector = false;

        this.map.forEachFeatureAtPixel(
          evt.pixel,
          (f, l) => {
            if (l === this.path_layer) hit_path = true;
            if (
              l &&
              ['fountains', 'notfall', 'feuerstellen', 'shelter'].includes(
                l.get('name') as string,
              )
            ) {
              hit_vector = true;
            }
          },
          { hitTolerance: 20 },
        );

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
              for (let i = this.negative_identify_cache.length - 1; i >= 0; i--) {
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

            // Sync identify in background with optimization
            const now = Date.now();
            let distanceMove = Infinity;
            if (this.lastIdentifyCoord) {
              const dx = this.lastIdentifyCoord[0] - evt.coordinate[0];
              const dy = this.lastIdentifyCoord[1] - evt.coordinate[1];
              distanceMove = Math.sqrt(dx * dx + dy * dy);
            }

            // Only trigger if mouse has moved at least 20m from the last attempt (reduce noise)
            if (!cachedHit && !knownMiss && distanceMove > 20) {
              clearTimeout(this.hoverIdentifyTimeout);
              this.hoverIdentifyTimeout = setTimeout(async () => {
                const queryLayers = activeIdentifyLayers.join(',');
                const identifyKey = `${evt.coordinate[0].toFixed(1)},${evt.coordinate[1].toFixed(1)}:${queryLayers}`;
                
                if (this.inFlightIdentifyRequests.has(identifyKey)) return;

                // Abort previous in-flight identify
                if (this.currentIdentifyAbortController) {
                  this.currentIdentifyAbortController.abort();
                }
                this.currentIdentifyAbortController = new AbortController();

                const ext = this.map.getView().calculateExtent(this.map.getSize());
                const sz = this.map.getSize() || [800, 600];
                const url = `https://api3.geo.admin.ch/rest/services/all/MapServer/identify?geometry=${evt.coordinate[0]},${evt.coordinate[1]}&geometryFormat=geojson&geometryType=esriGeometryPoint&imageDisplay=${sz[0]},${sz[1]},96&mapExtent=${ext.join(',')}&sr=2056&tolerance=15&layers=all:${queryLayers}`;
                
                try {
                  this.inFlightIdentifyRequests.add(identifyKey);
                  this.lastIdentifyCoord = evt.coordinate;
                  const res = await fetch(url, { signal: this.currentIdentifyAbortController.signal });
                  if (res.ok) {
                    let data = await res.json();
                    
                    // Filter: Only keep main stations (LoD 0) to avoid perron/platform clutter
                    if (data.results) {
                      data.results = data.results.filter((r: any) => {
                        if (r.layerBodId === 'ch.bav.haltestellen-oev') {
                          const lod = r.properties?.lod;
                          const name = String(r.properties?.name || '');
                          const typ = String(r.properties?.betriebspunkttyp_de || '');
                          
                          // lod '0' is the master station. Avoid technical ch: names
                          const isMaster = lod === '0' || (lod === undefined && !name.startsWith('ch:'));
                          // Filter out junctions / Vzw
                          const isVzw = typ.includes('Verzweigung') || name.includes('(Vzw)');
                          
                          return isMaster && !isVzw;
                        }
                        return true;
                      });
                    }

                    if (data.results && data.results.length > 0) {
                      const pt = data.results[0].geometry.coordinates[0];
                      const htmlRes = this.formatIdentifyResults(data);
                      this.interactive_feature_cache.push({ x: pt[0], y: pt[1], html: htmlRes });
                      this.is_hovering_interactive_feature = true;
                      this.map.getTargetElement().style.cursor = 'pointer';
                      this.render_pointer();
                    } else {
                      this.negative_identify_cache.push({ x: evt.coordinate[0], y: evt.coordinate[1], time: now });
                    }
                  }
                } catch (e: any) {
                  if (e.name === 'AbortError') return;
                } finally {
                  this.inFlightIdentifyRequests.delete(identifyKey);
                }
              }, 250); // Increased debounce to 250ms
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
      this.infoElement.style.display = 'none';
      this.infoOverlay.setPosition(undefined);

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
          if (vectorGeometry && typeof vectorGeometry.getCoordinates === 'function') {
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
          let shelterType = vectorProperties['shelter_type'] || vectorProperties['tourism'];
          
          if (shelterType === 'alpine_hut') {
            title = 'Berghütte';
            subtitle = vectorProperties['name'] || 'SAC-Hütte / Berghütte';
          } else if (shelterType === 'wilderness_hut') {
            title = 'Schutzhütte';
          }

          if (details.length > 0) {
              subtitle += `<br><div style="margin-top: 5px; font-size: 0.9em; line-height: 1.4;">` + details.join('<br>') + `</div>`;
          }
        }

        this.infoElement.innerHTML = `<b>${title}</b><br>${subtitle}`;
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
          this.infoElement.innerHTML = cachedHit.html;
          this.infoElement.style.display = 'block';
          this.infoOverlay.setPosition(evt.coordinate);
          return;
        }

        // Show loading instantly & perform async check
        this.infoElement.innerHTML = `<b>Metadaten</b><br><span style="color:#666">Laden...</span>`;
        this.infoElement.style.display = 'block';
        this.infoOverlay.setPosition(evt.coordinate);

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
                     const lod = r.properties?.lod;
                     const name = String(r.properties?.name || '');
                     const typ = String(r.properties?.betriebspunkttyp_de || '');
                     
                     const isMaster = lod === '0' || (lod === undefined && !name.startsWith('ch:'));
                     const isVzw = typ.includes('Verzweigung') || name.includes('(Vzw)');
                     
                     return isMaster && !isVzw;
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
                 });
                 this.infoElement.innerHTML = htmlResult;
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
            this.infoElement.style.display = 'none';
            this.infoOverlay.setPosition(undefined);
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
        feature.setStyle(
          new Style({
            image: new CircleStyle({
              radius: 6,
              fill: new Fill({ color: '#2196F3' }),
              stroke: new Stroke({ color: '#fff', width: 2 }),
            }),
          }),
        );
        this.external_pointer_layer_source.addFeature(feature);
      }
    });
  }

  private async fetchStationboard(uic: string, name: string, containerId: string) {
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
      this.currentStationboardAbortControllers.set(containerId, abortController);

      // Preference: fetch by UIC ID if available, otherwise by name
      const queryParam = uic ? `id=${uic}` : `station=${encodeURIComponent(name)}`;
      const url = `https://transport.opendata.ch/v1/stationboard?${queryParam}&limit=5`;
      
      const response = await fetch(url, { signal: abortController.signal });
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      
      const data = await response.json();
      
      // Cache the result for 5 minutes
      this.stationboardCache.set(cacheKey, { 
        data, 
        expiry: now + (5 * 60 * 1000) 
      });

      this.renderStationboard(data, containerId);
    } catch (err: any) {
      if (err.name === 'AbortError') return;
      console.error('Error fetching stationboard:', err);
      const container = document.getElementById(containerId);
      if (container) {
        container.innerHTML = '<div style="padding: 10px; color: #d32f2f; font-size: 0.9em; text-align: center;">Fehler beim Laden</div>';
      }
    } finally {
      this.currentStationboardAbortControllers.delete(containerId);
    }
  }

  private renderStationboard(data: any, containerId: string) {
    const container = document.getElementById(containerId);
    if (!container) return; // Element might have been removed (e.g. user stopped hovering)

    if (!data.stationboard || data.stationboard.length === 0) {
      container.innerHTML = '<div style="padding: 10px; color: #666; font-size: 0.9em; text-align: center;">Keine Abfahrten gefunden</div>';
      return;
    }

    let html = '';
    data.stationboard.forEach((dep: any) => {
      const departureTime = dep.stop.prognosis?.departure || dep.stop.departure;
      const time = new Date(departureTime).toLocaleTimeString('de-CH', { hour: '2-digit', minute: '2-digit' });
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
      if (line.length > 8 && dep.number && dep.number !== line) line = dep.number;
      
      const destination = dep.to;
      
      // Detailed Transit Icons (High-Clarity Filled Silhouettes)
      const svgHeader = '<svg width="18" height="18" viewBox="0 0 24 24" fill="#000" style="display: block;">';
      
      const busIcon = `${svgHeader}<path d="M4 16c0 .88.39 1.67 1 2.22V20c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1h8v1c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1.78c.61-.55 1-1.34 1-2.22V6c0-3.5-3.58-4-8-4s-8 .5-8 4v10zm14-5H6V6h12v5z"/></svg>`;
      const trainIcon = `${svgHeader}<path d="M12 2c-4 0-8 .5-8 4v9.5C4 17.43 5.57 19 7.5 19L6 20.5v.5h12v-.5L16.5 19c1.93 0 3.5-1.57 3.5-3.5V6c0-3.5-4-4-8-4zM17 11H7V6h10v5h-6z"/></svg>`;
      const tramIcon = `${svgHeader}<path d="M19 16c0 .88-.39 1.67-1 2.22V20c0 .55-.45 1-1 1h-1c-.55 0-1-.45-1-1v-1H9v1c0 .55-.45 1-1 1H7c-.55 0-1-.45-1-1v-1.78c-.61-.55-1-1.34-1-2.22V6c0-3.5 3.58-4 8-4s8 .5 8 4v10zM18 11H6V6h12v5zM13 1h-2v1h2V1z"/></svg>`;
      const shipIcon = `${svgHeader}<path d="M20 21c-1.39 0-2.78-.47-4-1.32-2.43 1.71-5.56 1.71-8 0C6.78 20.53 5.39 21 4 21H2v2h2c1.38 0 2.74-.35 4-.99 2.52 1.29 5.48 1.29 8 0 1.26.64 2.62.99 4 .99h2v-2h-2zM3.95 19H4c1.6 0 3.11-.55 4.36-1.45L12 14l3.64 3.55c1.25.9 2.76 1.45 4.36 1.45h.05l1.89-6.68C22.09 11.47 21.47 10 20 10h-2V4h-3V2h-5v2H7v6H5c-1.47 0-2.09 1.47-1.94 2.32L3.95 19zM15 10H9V6h6v4z"/></svg>`;
      const gondolaIcon = `${svgHeader}<path d="M19 14.7c.6 0 1-.4 1-1v-8c0-.6-.4-1-1-1h-6v-2h1c.6 0 1-.4 1-1s-.4-1-1-1h-4c-.6 0-1 .4-1 1s.4 1 1 1h1v2h-6c-.6 0-1 .4-1 1v8c0 .6.4 1 1 1h.3l-.3.7c-.2.5 0 1.1.5 1.3s1.1 0 1.3-.5l1.6-3.5h10.6l1.6 3.5c.2.5.8.7 1.3.5.5-.2.7-.8.5-1.3l-.3-.7h.3zm-13-1.7h-2v-3h2v3zm11 0h-2v-3h2v3z"/></svg>`;

      let finalIcon = trainIcon;
      if (['BUS', 'POST', 'BP', 'B'].includes(category)) finalIcon = busIcon;
      else if (['T', 'TR'].includes(category)) finalIcon = tramIcon;
      else if (['SHIP', 'F', 'FA', 'BAT', 'GDE'].includes(category)) finalIcon = shipIcon;
      else if (['G', 'GB', 'LB', 'PB', 'CC', 'FUN', 'C', 'SL'].includes(category)) finalIcon = gondolaIcon;

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
    
    container.innerHTML = html + `
      <div style="font-size: 0.75em; color: #aaa; margin-top: 10px; text-align: center;">
        Quelle: transport.opendata.ch / opentransportdata.swiss
      </div>
    `;
  }

  private formatIdentifyResults(data: any): string {
    let htmlResult = '';
    const seenNames = new Set<string>();

    for (const result of data.results) {
      const props = result.properties || {};
      const layerId = result.layerBodId;
      
      const stopName = props.name || props.uic_name || props.title || result.featureId;
      const dedupeKey = `${layerId}_${stopName}`;
      if (seenNames.has(dedupeKey)) continue;
      seenNames.add(dedupeKey);

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
        const dateStr = now.toLocaleDateString('de-CH', { day: '2-digit', month: '2-digit', year: 'numeric' });

        // Trigger async fetch for departures with a slight delay to ensure DOM is ready
        setTimeout(() => this.fetchStationboard(uic, stopName, containerId), 50);

        htmlResult += `
          <div style="background: white; border-radius: 12px; font-family: 'Open Sans', sans-serif; min-width: 300px; padding: 4px;">
            <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 8px; padding: 4px 8px;">
              <h3 style="margin: 0; color: #000; font-size: 1.4em; font-weight: 800; line-height: 1.1; flex: 1;">${stopName}</h3>
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
      else if (title === 'ch.bafu.alpweiden-herdenschutzhunde') title = 'Herdenschutzhunde';
      else if (title.includes('schutzgebiete') || title.includes('wrz')) title = 'Schutzgebiet';

      let subtitle = props.wrz_name || props.jb_name || props.name || props.nom || props.titre || props.title || '';

      htmlResult += `<b>${title}</b>`;
      if (subtitle) htmlResult += `<br>${subtitle}`;
      
      htmlResult += '<div style="max-height: 200px; overflow-y: auto; margin-top: 5px; font-size: 0.92em;">';
      htmlResult += this.formatPopupProperties(props, layerId);
      htmlResult += '</div><hr style="margin:8px 0; border:0; border-top: 1px solid #eee;">';
    }
    return htmlResult;
  }

  /**
   * Refined property formatter to filter technical junk and use friendly labels.
   */
  private formatPopupProperties(props: any, layerBodId: string): string {
    let result = '';
    const excludeKeys = [
      'id', 'featureId', 'layerBodId', 'layerName', 'symbolId', 'imageDisplay', 
      'mapExtent', 'geometry', 'geometryType', 'sr', 'tolerance', 'label', 
      'st_area_shape', 'st_length_shape', 'wrz_id', 'jb_id'
    ];

    for (const key of Object.keys(props)) {
      if (excludeKeys.includes(key) || props[key] === null || props[key] === undefined || typeof props[key] === 'object') {
        continue;
      }

      let displayKey = key;
      let val = props[key];

      // Layer-specific filters
      if (layerBodId === 'ch.bav.haltestellen-oev') {
        const ovExclude = ['uic_name', 'uic_code', 'bav_name', 'betriebspunkttyp', 'lod', 'nummer_text', 'betrieblichebezeichnung'];
        if (ovExclude.includes(key)) continue;
        if (key === 'tuabkuerzung') displayKey = 'Verkehrsunternehmen';
        if (key === 'transport_means_de') displayKey = 'Verkehrsmittel';
        if (key === 'betriebspunkttyp_de') displayKey = 'Betriebspunkttyp';
      }

      if (layerBodId === 'ch.bafu.alpweiden-herdenschutzhunde') {
        if (key === 'code_refverhalten') {
          displayKey = 'Verhaltensregeln';
          val = 'http://www.protectiondestroupeaux.ch/de/herdenschutzhunde/tourismus-und-herdenschutzhunde/sichere-begegnungen-mit-herdenschutzhunden/';
        }
      }

      // Language filter
      if (key.endsWith('_fr') || key.endsWith('_it') || key.endsWith('_en') || key.endsWith('_rm')) continue;
      if (key.endsWith('_de')) displayKey = key.replace('_de', '');

      if (typeof val === 'string') {
        if (val.startsWith('http')) {
          val = `<a href="${val}" target="_blank" style="color:#1976D2; text-decoration: underline;">Detail-Infos</a>`;
        } else {
          val = val.replace(/;\s+/g, ';<br>');
        }
      }

      displayKey = displayKey.replace(/_/g, ' ');
      displayKey = displayKey.charAt(0).toUpperCase() + displayKey.slice(1);
      result += `<p style="margin:2px 0;"><strong>${displayKey}:</strong> ${val}</p>`;
    }

    // No special action buttons needed here anymore as Haltestellen are handled above
    if (layerBodId !== 'ch.bav.haltestellen-oev' && layerBodId) {
      result += `<p style="margin:6px 0 2px 0;"><a href="https://map.geo.admin.ch/?layers=${layerBodId}&lang=de" target="_blank" style="color:#1976D2; text-decoration: underline;">Auf Swisstopo ansehen</a></p>`;
    }

    return result;
  }

  private draw_path(path: LV95_Waypoint[]) {
    this.path_layer_source.clear();
    if (!path || path.length === 0) return;

    const coords = path.map((p) => [p.x, p.y]);
    const routeFeature = new Feature({
      geometry: new LineString(coords),
    });

    routeFeature.setStyle([
      new Style({
        stroke: new Stroke({
          color: '#fff',
          width: 9,
        }),
      }),
      new Style({
        stroke: new Stroke({
          color: '#efa038',
          width: 5,
        }),
      }),
    ]);

    this.path_layer_source.addFeature(routeFeature);
  }

  private create_line_segment_style(coords: number[][], color: string, width: number): Style {
    return new Style({
      geometry: new LineString(coords),
      stroke: new Stroke({ color, width }),
    });
  }

  private refreshAnchors() {
    this.anchor_points_layer_source.clear();
    const anchors = this.map_animator.anchor_points;
    anchors.forEach((pt: any) => {
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
    if (this.pointer != null && !this.map_animator?.export_mode && !this.hovered_anchor && !this.is_modifying) {
      if (this.is_hovering_interactive_feature) return;

      const feature = new Feature({ geometry: new Point(this.pointer) });
      feature.setStyle(new Style({
        image: new CircleStyle({
          radius: 8,
          fill: new Fill({ color: 'transparent' }),
          stroke: new Stroke({ color: '#efa038', width: 3 }),
        }),
      }));
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
