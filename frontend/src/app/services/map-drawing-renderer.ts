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
      this.dragged_anchor = this.hovered_anchor || null;
      this.modifystart_coord = evt.mapBrowserEvent.coordinate;
      this.tooltipOverlay.setPosition(undefined);
      this.anchor_points_layer_source.clear();
      this.pointer_layer_source.clear();
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
              deleteBtn.addEventListener(
                'click',
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
    this.map.on('click', async (evt) => {
      if (
        !this.hovered_anchor &&
        !this.is_hovering_tooltip &&
        !this.map_animator.export_mode
      ) {
        this.pointer_layer_source.clear();
        this.onWaypointAdded.emit({
          x: this.pointer![0],
          y: this.pointer![1],
        });
      }
    });
  }

  private setupSubscriptions() {
    this.export_mode_sub = this.map_animator.export_mode$.subscribe(
      (is_export) => {
        this.modifyInteraction.setActive(!is_export);
        this.snapInteraction.setActive(!is_export);
        this.path_layer.setVisible(!is_export);
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
    let max_dist = 0;
    let dragged_idx = -1;
    for (let i = 0; i < coords.length; i++) {
      let min_to_path = Infinity;
      for (let j = 0; j < path.length; j++) {
        const d =
          Math.abs(coords[i][0] - path[j].x) +
          Math.abs(coords[i][1] - path[j].y);
        if (d < min_to_path) min_to_path = d;
      }
      if (min_to_path > max_dist) {
        max_dist = min_to_path;
        dragged_idx = i;
      }
    }
    return dragged_idx;
  }

  private get_preview_bounds(path: LV95_Waypoint[]) {
    if (!this.modifystart_coord)
      return {
        start_anchor_idx: -1,
        found_start: false,
        end_anchor_idx: -1,
        found_end: false,
      };

    let min_d = Infinity;
    let grab_idx = 0;
    for (let i = 0; i < path.length; i++) {
      const d =
        Math.abs(path[i].x - this.modifystart_coord[0]) +
        Math.abs(path[i].y - this.modifystart_coord[1]);
      if (d < min_d) {
        min_d = d;
        grab_idx = i;
      }
    }

    let start_idx = -1;
    let found_start = false;
    for (let i = grab_idx; i >= 0; i--) {
      if (path[i].is_waypoint) {
        start_idx = i;
        found_start = true;
        break;
      }
    }

    let end_idx = -1;
    let found_end = false;
    for (let i = grab_idx; i < path.length; i++) {
      if (path[i].is_waypoint) {
        end_idx = i;
        found_end = true;
        break;
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
      this.get_preview_bounds(path);

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
    if (this.is_modifying || this.map_animator.export_mode) return;

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
        this.tooltipOverlay.setPosition(this.pointer);
      } else {
        this.tooltipOverlay.setPosition(this.pointer);
      }
    }
  }
}
