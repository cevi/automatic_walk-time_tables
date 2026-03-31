import { Injectable, OnDestroy } from '@angular/core';
import { LV95_Coordinates, LV95_Waypoint } from '../helpers/coordinates';
import { combineLatest, Subject } from 'rxjs';
import { take, filter, takeUntil } from 'rxjs/operators';
import { Router, NavigationEnd } from '@angular/router';
import { MapStateService } from './map-state.service';
import { RouteHistoryService } from './route-history.service';
import { RouteApiService } from './route-api.service';
import { GeometryUtils } from '../utils/geometry.utils';
import { decode } from '@googlemaps/polyline-codec';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root',
})
export class MapAnimatorService implements OnDestroy {
  private _error_handler: (err: string) => void = (err: string) =>
    console.error(err);
  public auto_waypoints_baked$ = new Subject<void>();
  private destroy$ = new Subject<void>();

  constructor(
    private router: Router,
    private state: MapStateService,
    private history: RouteHistoryService,
    private api: RouteApiService,
  ) {
    this.state.pois$.pipe(takeUntil(this.destroy$)).subscribe((wp) => {
      this._recalculate_route_stats(wp);
    });

    this.router.events
      .pipe(
        filter((e) => e instanceof NavigationEnd),
        takeUntil(this.destroy$)
      )
      .subscribe(() => {
        this.update_export_mode();
      });
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }


  // --- Facade Getters bounds to MapStateService ---
  public get path$() {
    return this.state.path$;
  }
  public get anchor_points$() {
    return this.state.anchor_points$;
  }
  public get pois$() {
    return this.state.pois$;
  }
  public get map_center$() {
    return this.state.map_center$;
  }
  public get export_mode$() {
    return this.state.export_mode$;
  }
  public get pointer$() {
    return this.state.pointer$;
  }
  public get route_stats$() {
    return this.state.route_stats$;
  }
  public get velocity$() {
    return this.state.velocity$;
  }

  // Synchronous Facade Getters
  public get export_mode(): boolean {
    return this.state.export_mode;
  }
  public get path(): LV95_Waypoint[] {
    return this.state.path;
  }
  public get anchor_points(): LV95_Coordinates[] {
    return this.state.anchor_points;
  }
  public get pois(): LV95_Waypoint[] {
    return this.state.pois;
  }

  public get has_route(): boolean {
    return this.state.has_route;
  }
  public get magnetic_paths(): boolean {
    return this.state.magnetic_paths;
  }
  public set magnetic_paths(val: boolean) {
    this.state.magnetic_paths = val;
  }
  public get is_modifying(): boolean {
    return this.state.is_modifying;
  }
  public set is_modifying(val: boolean) {
    this.state.is_modifying = val;
  }
  public get auto_waypoints() {
    return this.state.auto_waypoints;
  }
  public set auto_waypoints(val: boolean) {
    this.state.auto_waypoints = val;
  }
  public get drawer_open() {
    return this.state.drawer_open;
  }
  public set drawer_open(val: boolean) {
    this.state.drawer_open = val;
    this.update_export_mode();
  }

  public toggle_magnetic_paths() {
    this.state.toggleMagneticPaths();
  }
  public move_pointer(coords: LV95_Waypoint | null) {
    if (coords) {
      // Centralized POI snapping: if the coordinate is close to a POI by accumulated_distance,
      // snap to the POI so all consumers see the same result.
      const pois = this.state.pois;
      const path = this.state.path;
      if (pois.length > 0 && path.length > 0) {
        const totalDist = path[path.length - 1].accumulated_distance || 1;
        const snapThreshold = totalDist * 0.01; // 1% of total path length

        let nearest_poi: LV95_Waypoint | null = null;
        let min_dist = Infinity;
        for (const poi of pois) {
          const d = Math.abs((poi.accumulated_distance || 0) - (coords.accumulated_distance || 0));
          if (d < min_dist) { min_dist = d; nearest_poi = poi; }
        }

        if (nearest_poi && min_dist <= snapThreshold) {
          this.state.movePointer(nearest_poi);
          return;
        }
      }
    }
    this.state.movePointer(coords);
  }
  public set_error_handler(handler: (err: string) => void) {
    this._error_handler = handler;
  }

  private update_export_mode() {
    const is_export =
      this.state.drawer_open && this.router.url.split('?')[0] === '/';
    if (
      is_export &&
      this.state.path.length > 0 &&
      this.state.path.some((p) => p.h === 0)
    ) {
      this.start_export_mode();
    } else {
      this.state.setExportMode(is_export);
      this.state.updatePOIs(this.state.pois); // force POIs refresh
    }
  }

  public start_export_mode() {
    this.state.setExportMode(true);
    const path = this.state.path.map(
      (p) => ({ x: p.x, y: p.y }) as LV95_Coordinates,
    );
    this.replace_route(path).catch(this._error_handler);
  }

  public is_anchor(point: LV95_Coordinates | LV95_Waypoint): boolean {
    return GeometryUtils.is_anchor(point, this.state.anchor_points);
  }

  public trigger_path_redraw() {
    this.state.updatePath(this.state.path);
  }

  public clear() {
    this.state.clearAll();
    this.history.clearHistories();
  }

  public async add_way_point(point: LV95_Coordinates) {
    if (this.export_mode) return;
    const current_path = this.state.path;
    const current_anchors = this.state.anchor_points;
    const start_anchor =
      current_anchors.length > 0
        ? current_anchors[current_anchors.length - 1]
        : null;

    // 1. Snapshot History before mutation
    this.history.commitState(current_path, this.state.pois, current_anchors);

    // 2. Build Query
    const queryLocations = GeometryUtils.buildRoutingQuery(
      start_anchor,
      point,
      null,
      'insert',
    );

    // 3. Update Anchor State
    const new_anchors = [...current_anchors, point];
    this.state.updateAnchorPoints(new_anchors);

    // 4. Fetch Valhalla Routing Segment or Straight Line
    let new_segment = queryLocations;
    if (this.magnetic_paths) {
      try {
        new_segment = await this.api.fetchValhallaRoute(queryLocations);
      } catch (err) {
        console.warn(
          'Valhalla routing failed, falling back to straight line:',
          err,
        );
      }
    }

    // 5. Splice Segments & Push State
    const mergedRoute = GeometryUtils.spliceRoute(
      current_path,
      new_segment,
      start_anchor ? current_path.length - 1 : -1, // Simple append logic
      -1,
      point as LV95_Waypoint,
      'insert',
      point as LV95_Waypoint,
    );

    this.state.updatePath(mergedRoute);

    const syncedAnchors = mergedRoute
      .filter((p) => p.is_waypoint)
      .map((p) => ({ x: p.x, y: p.y } as LV95_Coordinates));
    this.state.updateAnchorPoints(syncedAnchors);

    this.regenerateWalkTimeTable();
  }

  public async delete_route_waypoint(point: LV95_Waypoint | LV95_Coordinates) {
    if (this.export_mode) return;
    const current_path = this.state.path;
    const current_anchors = this.state.anchor_points;

    const anchor_idx = current_anchors.findIndex(
      (a) => GeometryUtils.pointsMatch(a, point)
    );
    if (anchor_idx === -1) return;

    this.history.commitState(current_path, this.state.pois, current_anchors);

    const start_anchor =
      anchor_idx > 0 ? current_anchors[anchor_idx - 1] : null;
    const end_anchor =
      anchor_idx < current_anchors.length - 1
        ? current_anchors[anchor_idx + 1]
        : null;

    // Remove from anchors
    const new_anchors = [...current_anchors];
    new_anchors.splice(anchor_idx, 1);
    this.state.updateAnchorPoints(new_anchors);

    // If less than 2 anchors remain, clear path
    if (new_anchors.length < 2) {
      if (new_anchors.length === 1) {
        this.state.updatePath([
          {
            x: new_anchors[0].x,
            y: new_anchors[0].y,
            h: 0,
            accumulated_distance: 0,
            is_waypoint: true,
          },
        ]);
      } else {
        this.state.updatePath([]);
      }
      this.regenerateWalkTimeTable();
      return;
    }

    // Identify topological splice indices strictly via anchors
    let start_path_idx = -1;
    let end_path_idx = -1;

    let anchor_counter = 0;
    let path_node_idx = -1;
    for (let i = 0; i < current_path.length; i++) {
      if (current_path[i].is_waypoint) {
        if (anchor_counter === anchor_idx) {
          path_node_idx = i;
          break;
        }
        anchor_counter++;
      }
    }

    if (path_node_idx !== -1) {
        for (let i = path_node_idx - 1; i >= 0; i--) {
          if (current_path[i].is_waypoint) {
            start_path_idx = i;
            break;
          }
        }
        for (let i = path_node_idx + 1; i < current_path.length; i++) {
          if (current_path[i].is_waypoint) {
            end_path_idx = i;
            break;
          }
        }
    }

    const queryLocations = GeometryUtils.buildRoutingQuery(
      start_anchor,
      null,
      end_anchor,
      'delete',
    );
    let new_segment = queryLocations;
    if (this.magnetic_paths) {
      try {
        new_segment = await this.api.fetchValhallaRoute(queryLocations);
      } catch (err) {
        console.warn(
          'Valhalla routing failed, falling back to straight line:',
          err,
        );
      }
    }

    const mergedRoute = GeometryUtils.spliceRoute(
      current_path,
      new_segment,
      start_path_idx,
      end_path_idx,
      null,
      'delete',
      null,
    );

    this.state.updatePath(mergedRoute);

    const syncedAnchors = mergedRoute
      .filter((p) => p.is_waypoint)
      .map((p) => ({ x: p.x, y: p.y } as LV95_Coordinates));
    this.state.updateAnchorPoints(syncedAnchors);

    this.regenerateWalkTimeTable();
  }

  public async handle_modify_event(event: {
    new_coords: number[][];
    dragged_anchor: LV95_Waypoint | null;
    mousedown_coord: number[];
  }) {
    if (this.export_mode) return;
    const { new_coords, dragged_anchor, mousedown_coord } = event;
    const current_path = this.state.path;
    const current_anchors = this.state.anchor_points;

    let start_path_idx = -1;
    let end_path_idx = -1;
    let dragged_idx = -1;
    let dragged_point: LV95_Waypoint;
    const isInsert = !dragged_anchor;

    if (!isInsert && dragged_anchor) {
      // MOVES: Strict Topological Lookup via known dragged_anchor
      let anchor_idx = current_anchors.findIndex(a => GeometryUtils.pointsMatch(a, dragged_anchor));
      
      if (anchor_idx !== -1) {
        let current_anchor_count = 0;
        for (let i = 0; i < current_path.length; i++) {
          if (current_path[i].is_waypoint) {
            if (current_anchor_count === anchor_idx - 1) start_path_idx = i;
            if (current_anchor_count === anchor_idx + 1) end_path_idx = i;
            if (current_anchor_count === anchor_idx) dragged_idx = i; // The exact node being replaced
            current_anchor_count++;
          }
        }
      }
      // Safety fallback if coordinate sync failed
      if (dragged_idx === -1) dragged_idx = find_spatial_index(new_coords, current_path);
      dragged_point = { x: new_coords[dragged_idx][0], y: new_coords[dragged_idx][1] } as LV95_Waypoint;
      
    } else {
      // INSERTS: Array divergence logic
      for (let i = 0; i < current_path.length; i++) {
        if (Math.abs(new_coords[i][0] - current_path[i].x) > 0.1 || Math.abs(new_coords[i][1] - current_path[i].y) > 0.1) {
          dragged_idx = i;
          break;
        }
      }
      if (dragged_idx === -1) dragged_idx = new_coords.length - 1;

      for (let i = dragged_idx - 1; i >= 0; i--) {
        if (current_path[i].is_waypoint) { start_path_idx = i; break; }
      }
      for (let i = dragged_idx; i < current_path.length; i++) {
        if (current_path[i].is_waypoint) { end_path_idx = i; break; }
      }
      dragged_point = { x: new_coords[dragged_idx][0], y: new_coords[dragged_idx][1] } as LV95_Waypoint;
    }

    this.history.commitState(current_path, this.state.pois, current_anchors);

    const start_anchor = start_path_idx !== -1 ? current_path[start_path_idx] : null;
    const end_anchor = end_path_idx !== -1 ? current_path[end_path_idx] : null;

    // Helper function scoped inside handle_modify_event to prevent duplication
    function find_spatial_index(nc: number[][], cp: LV95_Waypoint[]) {
      let max_d = 0, idx = 0;
      for (let i = 0; i < Math.min(nc.length, cp.length); i++) {
        const d = Math.pow(nc[i][0] - cp[i].x, 2) + Math.pow(nc[i][1] - cp[i].y, 2);
        if (d > max_d) { max_d = d; idx = i; }
      }
      return idx;
    }

    // Strict 1:1 anchor parity array insertions
    const new_anchors = [...current_anchors];
    if (isInsert) {
      let anchors_before = 0;
      for (let i = 0; i <= start_path_idx; i++) {
        if (current_path[i].is_waypoint) anchors_before++;
      }
      new_anchors.splice(anchors_before, 0, dragged_point);
    } else {
      if (dragged_anchor) {
        const mv_idx = new_anchors.findIndex(
          (a) =>
            Math.abs(a.x - dragged_anchor.x) < 0.1 &&
            Math.abs(a.y - dragged_anchor.y) < 0.1,
        );
        if (mv_idx !== -1) new_anchors[mv_idx] = dragged_point;
      }
    }
    this.state.updateAnchorPoints(new_anchors);

    const queryLocations = GeometryUtils.buildRoutingQuery(
      start_anchor,
      dragged_point,
      end_anchor,
      isInsert ? 'insert' : 'move',
    );

    let new_segment: LV95_Coordinates[] = [];
    if (
      queryLocations.length === 2 &&
      queryLocations[0].x === queryLocations[1].x &&
      queryLocations[0].y === queryLocations[1].y
    ) {
      new_segment = [queryLocations[0]];
    } else {
      new_segment = queryLocations;
      if (this.magnetic_paths) {
        try {
          new_segment = await this.api.fetchValhallaRoute(queryLocations);
        } catch (err) {
          console.warn(
            'Valhalla routing failed, falling back to straight line:',
            err,
          );
        }
      }
    }

    if (end_anchor && new_segment.length > 0) {
      const last = new_segment[new_segment.length - 1];
      if (
        Math.abs(last.x - end_anchor.x) > 2 ||
        Math.abs(last.y - end_anchor.y) > 2
      ) {
        new_segment.push(end_anchor);
      }
    }

    const mergedRoute = GeometryUtils.spliceRoute(
      current_path,
      new_segment,
      start_path_idx,
      end_path_idx,
      dragged_point,
      isInsert ? 'insert' : 'move',
      dragged_anchor,
    );

    this.state.updatePath(mergedRoute);

    const syncedAnchors = mergedRoute
      .filter((p) => p.is_waypoint)
      .map((p) => ({ x: p.x, y: p.y } as LV95_Coordinates));
    this.state.updateAnchorPoints(syncedAnchors);

    this.regenerateWalkTimeTable();
  }

  public add_point_of_interest(pkt: LV95_Waypoint) {
    this.state.updatePOIs([...this.state.pois, pkt]);
    this.regenerateWalkTimeTable();
  }

  public async retrieve_data(uuid: string): Promise<number> {
    return this.api.retrieveDataStatus(uuid);
  }

  async finish_drawing() {
    this.state.updatePOIs([]);
    const path = this.state.path.map(
      (p) => ({ x: p.x, y: p.y }) as LV95_Coordinates,
    );
    await this.replace_route(path);
  }

  public async download_map(settings: any): Promise<number> {
    console.log('settings', settings);
    localStorage['form_values'] = JSON.stringify(settings);

    if (this.state.path.some((p) => p.h === 0)) {
      await this.finish_drawing();
    }

    const tableJson = JSON.stringify(
      this.state.pois.map((p) => ({
        name: p.name || '',
        break_duration: p.break_duration ? p.break_duration.toString() : '',
      })),
    );

    const resp = await this.api.exportPdf(
      this.state.path,
      this.state.pois,
      settings,
      tableJson,
    );
    if (resp.status === 'running') return resp.uuid;
    throw resp;
  }

  /**
   *
   * @param route_file_or_array
   * @returns {Promise<string>} the name of the route
   *
   */
  public async replace_route(
    route_file_or_array: File | LV95_Coordinates[] | undefined,
  ): Promise<string> {
    if (!route_file_or_array) {
      this.clear();
      throw new Error('No route file selected');
    }

    let xml_string: string;
    let file_type: string;
    if (route_file_or_array instanceof File) {
      this.state.clearAll();
      xml_string = (await route_file_or_array.text()).toString();
      xml_string = xml_string.replace(/>\s*/g, '>');
      xml_string = xml_string.replace(/\s*</g, '<');
      file_type = route_file_or_array.name.split('.').pop() || 'tmp';
    } else {
      xml_string = route_file_or_array.map((p) => `${p.x},${p.y}`).join(';');
      file_type = 'array';
    }

    const resp = await this.api.parseRouteFile(xml_string, file_type);
    await this.set_route(resp);
    return resp.route_name;
  }

  public set_map_center(coordinates: LV95_Coordinates) {
    this.state.updateMapCenter(coordinates);
  }

  private update_map_center(points: LV95_Coordinates[]) {
    let x_min = points[0].x,
      y_min = points[0].y;
    let x_max = points[0].x,
      y_max = points[0].y;

    points.forEach((point) => {
      if (point.x < x_min) x_min = point.x;
      if (point.y < y_min) y_min = point.y;
      if (point.x > x_max) x_max = point.x;
      if (point.y > y_max) y_max = point.y;
    });

    this.state.updateMapCenter({
      x: (x_max + x_min) / 2,
      y: (y_max + y_min) / 2,
    });
  }
  public regenerateWalkTimeTable() {
    if (this.state.anchor_points.length < 2) {
      this.state.route_stats$.next(null);
      this.state.updatePOIs([]);
      return;
    }

    this.api
      .createWalkTimeTable(
        this.state.path,
        this.state.pois,
        this.state.auto_waypoints,
      )
      .then((resp) => {
        if (!resp) return;
        this.applyWalkTimeTableResponse(resp);
      })
      .catch(this._error_handler);
  }

  private applyWalkTimeTableResponse(resp: any) {
    if (resp?.status === 'error') throw new Error(resp.message);
    if (!resp?.pois || !resp?.pois_elevation) {
      throw new Error('Unvollständige Antwort vom Server.');
    }

    const pois_coords = decode(resp.pois, 0);
    const pois_elev = decode(resp.pois_elevation, 0);

    const pois: LV95_Waypoint[] = pois_coords.map((p, i) => {
      const x = p[0];
      const y = p[1];
      let name = '';
      let break_duration = '';
      let is_waypoint = true;

      const old_wp = this.state.pois.find((w) =>
        GeometryUtils.pointsMatch(w, { x, y }),
      );
      if (old_wp) {
        name = old_wp.name || '';
        break_duration = old_wp.break_duration || '';
        is_waypoint = old_wp.is_waypoint;
      }

      return {
        x,
        y,
        h: pois_elev[i][1],
        accumulated_distance: pois_elev[i][0] / 1000,
        is_waypoint,
        name,
        break_duration,
      };
    });

    this.state.updatePOIs(pois);
    this._recalculate_route_stats(pois);
  }

  public can_undo(): boolean {
    return this.history.canUndo;
  }
  public can_redo(): boolean {
    return this.history.canRedo;
  }

  public undo() {
    this.history.undo();
    this.regenerateWalkTimeTable();
  }

  public redo() {
    this.history.redo();
    this.regenerateWalkTimeTable();
  }

  public invert_route() {
    this.history.invertRoute();
    this.regenerateWalkTimeTable();
  }

  private async set_route(resp: any) {
    if (resp?.status == 'error') throw new Error(resp.message);

    if (resp?.route == undefined)
      throw new Error('Die Datei konnte nicht gelesen werden!');

    if (resp?.elevation_data == undefined)
      throw new Error('Keine Höhendaten gefunden!');

    const path = decode(resp?.route, 0);
    const elevation = decode(resp?.elevation_data, 0);

    // If route is empty, we cleat all data
    if (path.length == 0) {
      this.clear();
      return;
    }

    if (path.length != elevation.length)
      throw new Error(
        'Die Route und die Höhendaten haben unterschiedliche Länge!',
      );

    const old_path = this.path || [];
    let old_start_name = '';
    let old_start_break = '';
    let old_end_name = '';
    let old_end_break = '';
    if (old_path.length > 0) {
      old_start_name = old_path[0].name || '';
      old_start_break = old_path[0].break_duration || '';
      old_end_name = old_path[old_path.length - 1].name || '';
      old_end_break = old_path[old_path.length - 1].break_duration || '';
    }

    const way_points = GeometryUtils.create_way_points(path, elevation);

    if (way_points.length > 0 && old_path.length > 0) {
      way_points[0].name = old_start_name;
      way_points[0].break_duration = old_start_break;
      way_points[way_points.length - 1].name = old_end_name;
      way_points[way_points.length - 1].break_duration = old_end_break;
    }

    this.update_map_center(way_points);
    this.state.updatePath(way_points);

    return new Promise<void>((resolve, reject) =>
      combineLatest([this.path$, this.pois$])
        .pipe(take(1))
        .subscribe((data: any) => {
          const path_val = data[0];
          const pois_val = data[1];
          this.api
            .createWalkTimeTable(path_val, pois_val, this.auto_waypoints)
            .then((resp) => {
              this.applyWalkTimeTableResponse(resp);
              resolve();
            })
            .catch((err: any) => reject(err));
        }),
    );
  }

  public delete_poi(point: LV95_Waypoint) {
    const pois = this.state.pois;
    const idx = pois.findIndex((p) => GeometryUtils.pointsMatch(p, point));
    if (idx !== -1) {
      const new_pois = [...pois];
      new_pois.splice(idx, 1);
      this.state.updatePOIs(new_pois);
      this.regenerateWalkTimeTable();
    }
  }

  public update_poi_names(pois: LV95_Waypoint[]) {
    this.state.updatePOIs(pois);
  }

  set_automatic_waypoint_selection(val: boolean) {
    this.state.auto_waypoints = val;
    this.regenerateWalkTimeTable();
  }

  /**
   * Deletes all path points after the second last waypoint
   */
  delete_last_waypoint() {
    const old_path = this.state.path;
    const old_anchors = this.state.anchor_points;
    if (old_anchors.length > 0) {
      this.delete_route_waypoint(old_anchors[old_anchors.length - 1]);
    }
  }

  public set_velocity(v: number) {
    this.state.velocity$.next(v);
    this._recalculate_route_stats(this.state.pois);
  }

  public async get_name_from_coords(lat: number, lon: number): Promise<string> {
    try {
      const resp = await fetch(environment.API_URL + 'get_name', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lat, lon }),
      });
      const data = await resp.json();
      return data.name || '';
    } catch {
      return '';
    }
  }

  private _recalculate_route_stats(wp: LV95_Waypoint[]) {
    if (!wp || wp.length === 0) {
      this.state.route_stats$.next(null);
      return;
    }
    let dist = wp[wp.length - 1].accumulated_distance;
    let up = 0;
    let down = 0;
    let duration = 0;
    const speed = this.state.velocity$.getValue() || 4.5;

    for (let i = 1; i < wp.length; i++) {
      const dH = Math.round(wp[i].h - wp[i - 1].h);
      const dDist = Math.abs(
        wp[i].accumulated_distance - wp[i - 1].accumulated_distance,
      );
      if (dH > 0) up += dH;
      else down += Math.abs(dH);

      duration += (dDist + (dH > 0 ? dH / 100 : 0)) / speed;
    }
    this.state.route_stats$.next({ dist, up, down, duration });
  }

  public formatDuration(hours: number): string {
    const h = Math.floor(hours);
    const m = Math.round((hours - h) * 60);
    if (m === 60) {
      return `${h + 1}h 00min`;
    }
    return `${h}h ${m.toString().padStart(2, '0')}min`;
  }
}
