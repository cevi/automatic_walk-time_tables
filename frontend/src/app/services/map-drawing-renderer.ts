import { Feature, MapBrowserEvent } from 'ol';
import Map from 'ol/Map';
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

export class MapDrawingRenderer {
  private map: Map;
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
  private hovered_anchor: LV95_Waypoint | undefined;
  private is_hovering_tooltip: boolean = false;
  private is_mouse_over_dom_tooltip: boolean = false;
  private dragged_anchor: LV95_Waypoint | null = null;
  private modifystart_coord: number[] | null = null;
  public onRouteModified = new EventEmitter<{
    new_coords: number[][];
    dragged_anchor: LV95_Waypoint | null;
    mousedown_coord: number[];
  }>();
  public onWaypointAdded = new EventEmitter<LV95_Coordinates>();
  public onWaypointDeleted = new EventEmitter<LV95_Waypoint>();
  public onUndoRequested = new EventEmitter<void>();

  private path_sub!: Subscription;
  private export_mode_sub!: Subscription;
  private anchor_points_sub!: Subscription;

  constructor(map: Map, animator: MapAnimatorService) {
    this.map = map;
    this.map_animator = animator;
    this.map.addLayer(this.path_layer);
    this.map.addLayer(this.anchor_points_layer);
    this.map.addLayer(this.pointer_layer);

    this.setupInteractions();
    this.setupSubscriptions();
  }

  private setupInteractions() {
    this.setupTooltipOverlay();
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

  private setupModifyInteraction() {
    this.modifyInteraction = new Modify({
      source: this.path_layer_source,
      pixelTolerance: 20,
    });

    this.modifyInteraction.on('modifystart', (evt: any) => {
      this.is_modifying = true;
      this.map_animator.is_modifying = true;

      // Synchronously verify anchor hits to prevent fast-drag ghosting
      let hit_anchor: LV95_Waypoint | null = null;
      const pixel = this.map?.getPixelFromCoordinate(evt.mapBrowserEvent.coordinate);
      if (pixel) {
        this.map?.forEachFeatureAtPixel(pixel, (feature, layer) => {
          if (layer === this.anchor_points_layer) {
            const center = (feature.getGeometry() as Point).getCoordinates();
            hit_anchor = { x: center[0], y: center[1] } as LV95_Waypoint;
          }
        }, { hitTolerance: 15 });
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
    });

    this.map.addInteraction(this.modifyInteraction);
  }

  private setupSnapInteraction() {
    this.snapInteraction = new Snap({
      source: this.anchor_points_layer_source,
      pixelTolerance: 20,
    });
    this.map.addInteraction(this.snapInteraction);
  }

  private setupHoverLogic() {
    this.map.on('pointermove', (evt) => {
      if (this.map_animator && !this.map_animator.export_mode) {
        let foundAnchor = false;
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
          { hitTolerance: 15 },
        );

        if (!foundAnchor && !this.is_mouse_over_dom_tooltip) {
          this.hovered_anchor = undefined;
        }

        if (
          !foundAnchor &&
          !this.is_hovering_tooltip &&
          !this.is_mouse_over_dom_tooltip
        ) {
          this.tooltipOverlay.setPosition(undefined);
        }

        if (this.is_modifying) {
          if (this.tooltipElement.innerHTML !== '') {
            this.tooltipElement.innerHTML = '';
          }
          this.tooltipOverlay.setPosition(undefined);
        } else if (foundAnchor) {
          const content =
            'Ziehen zum verschieben<br><span style="color:#ff5252; cursor:pointer" id="delete-anchor-btn">Klicken zum Löschen</span>';
          if (this.tooltipElement.innerHTML !== content) {
            this.tooltipElement.innerHTML = content;
            const deleteBtn =
              this.tooltipElement.querySelector('#delete-anchor-btn');
            if (deleteBtn) {
              deleteBtn.addEventListener('pointerdown', (e) => {
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

        // Update the drawing pointer location
        this.pointer = [evt.coordinate[0], evt.coordinate[1]];
        this.render_pointer();
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
      if (this.map_animator.export_mode) return;

      if (this.hovered_anchor) {
        // Explicitly hit an anchor without dragging -> delete it
        this.onWaypointDeleted.emit(this.hovered_anchor);
        this.tooltipOverlay.setPosition(undefined);
      } else if (!this.is_hovering_tooltip) {
        // Hit empty map -> append new anchor
        this.pointer_layer_source.clear();
        this.onWaypointAdded.emit({
          x: evt.coordinate[0], // MUST use locked event coordinate, not this.pointer
          y: evt.coordinate[1], // MUST use locked event coordinate, not this.pointer
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
        }
      },
    );

    this.path_sub = this.map_animator.path$.subscribe((path) => {
      this.draw_path(path);
    });

    this.anchor_points_sub = this.map_animator.anchor_points$.subscribe(() => {
      this.refreshAnchors();
    });
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
        if (Math.abs(coords[i][0] - path[i].x) > 0.1 || Math.abs(coords[i][1] - path[i].y) > 0.1) {
          return i;
        }
      }
      return coords.length - 1;
    } else {
      let max_dist = 0;
      for (let i = 0; i < Math.min(coords.length, path.length); i++) {
        const dist = Math.pow(coords[i][0] - path[i].x, 2) + Math.pow(coords[i][1] - path[i].y, 2);
        if (dist > max_dist) {
          max_dist = dist;
          dragged_idx = i;
        }
      }
      return dragged_idx;
    }
  }

  private get_preview_bounds(path: LV95_Waypoint[], coords: number[][], changed_idx: number) {
    let start_idx = -1;
    let found_start = false;
    let end_idx = -1;
    let found_end = false;

    let is_insert = coords.length > path.length;

    if (!is_insert && this.dragged_anchor) {
      // MOVES: Strict Topological Lookup for preview bounds
      let target_anchor_idx = -1;
      let anchor_count = 0;
      
      for(let i = 0; i < path.length; i++) {
         if(path[i].is_waypoint) {
            if(GeometryUtils.pointsMatch(path[i], this.dragged_anchor)) {
               target_anchor_idx = anchor_count;
            }
            anchor_count++;
         }
      }

      if(target_anchor_idx !== -1) {
         let current_anchor_count = 0;
         for (let i = 0; i < path.length; i++) {
           if (path[i].is_waypoint) {
             if (current_anchor_count === target_anchor_idx - 1) { start_idx = i; found_start = true; }
             if (current_anchor_count === target_anchor_idx + 1) { end_idx = i; found_end = true; }
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
    if (this.map_animator.export_mode) return;

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
      this.is_hovering_tooltip = false;
      const pixel = this.map?.getPixelFromCoordinate(this.pointer);
      if (pixel) {
        this.map?.forEachFeatureAtPixel(pixel, (feature, layer) => {
          if (layer === this.path_layer) this.is_hovering_tooltip = true;
        });
      }

      if (!this.is_hovering_tooltip && !this.hovered_anchor) {
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
            this.tooltipElement.style.display = 'block';
            this.tooltipOverlay.setPosition(this.pointer);
        } else {
            this.tooltipElement.style.display = 'none';
            this.tooltipOverlay.setPosition(undefined);
        }
      } else {
        if (this.tooltipElement.innerHTML !== '') {
            this.tooltipElement.style.display = 'block';
            this.tooltipOverlay.setPosition(this.pointer);
        } else {
            this.tooltipElement.style.display = 'none';
            this.tooltipOverlay.setPosition(undefined);
        }
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
      if (this.tooltipOverlay) this.map.removeOverlay(this.tooltipOverlay);
    }
  }
}
