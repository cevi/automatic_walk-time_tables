import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { map } from 'rxjs/operators';
import { LV95_Coordinates, LV95_Waypoint } from '../helpers/coordinates';

export interface RouteStats {
  dist: number;
  up: number;
  down: number;
  duration: number;
}

export type AppMode = 'edit' | 'view' | 'table';

@Injectable({
  providedIn: 'root',
})
export class MapStateService {
  private static readonly DEFAULT_MAP_CENTER: LV95_Coordinates = {
    x: 2719675,
    y: 1216320,
  };

  private readonly _path$ = new BehaviorSubject<LV95_Waypoint[]>([]);
  private readonly _anchor_points$ = new BehaviorSubject<LV95_Coordinates[]>(
    [],
  );
  private readonly _pois$ = new BehaviorSubject<LV95_Waypoint[]>([]);
  private readonly _map_center$ = new BehaviorSubject<LV95_Coordinates>(
    MapStateService.DEFAULT_MAP_CENTER,
  );
  private readonly _app_mode$ = new BehaviorSubject<AppMode>('view');
  private readonly _pointer$ = new BehaviorSubject<LV95_Waypoint | null>(null);

  public readonly route_stats$ = new BehaviorSubject<RouteStats | null>(null);
  public readonly velocity$ = new BehaviorSubject<number>(4.5);

  public readonly path$ = this._path$.asObservable();
  public readonly anchor_points$ = this._anchor_points$.asObservable();
  public readonly pois$ = this._pois$.asObservable();
  public readonly map_center$ = this._map_center$.asObservable();
  public readonly app_mode$ = this._app_mode$.asObservable();
  public readonly export_mode$ = this._app_mode$.pipe(
    map((mode) => mode !== 'edit'),
  );
  public readonly pointer$ = this._pointer$.asObservable();

  // Settings
  public auto_waypoints: boolean = true;
  public magnetic_paths: boolean = true;
  public is_modifying: boolean = false;
  private _drawer_open: boolean = false;

  public get drawer_open(): boolean {
    return this._drawer_open;
  }
  public set drawer_open(val: boolean) {
    this._drawer_open = val;
  }

  // Synchronous Accessors (Use judiciously)
  public get path(): LV95_Waypoint[] {
    return this._path$.value;
  }
  public get anchor_points(): LV95_Coordinates[] {
    return this._anchor_points$.value;
  }
  public get pois(): LV95_Waypoint[] {
    return this._pois$.value;
  }
  public get app_mode(): AppMode {
    return this._app_mode$.value;
  }
  public get export_mode(): boolean {
    return this._app_mode$.value !== 'edit';
  }
  public get has_route(): boolean {
    return this._path$.value.length > 0;
  }

  // Mutators
  public updatePath(path: LV95_Waypoint[]): void {
    this._path$.next([...path]);
  }

  public updateAnchorPoints(anchors: LV95_Coordinates[]): void {
    this._anchor_points$.next([...anchors]);
  }

  public updatePOIs(pois: LV95_Waypoint[]): void {
    this._pois$.next([...pois]);
  }

  public setAppMode(mode: AppMode): void {
    this._app_mode$.next(mode);
  }

  public setExportMode(isExport: boolean): void {
    this._app_mode$.next(isExport ? 'table' : 'edit');
  }

  public updateMapCenter(center: LV95_Coordinates): void {
    this._map_center$.next(center);
  }

  public movePointer(coordinates: LV95_Waypoint | null): void {
    this._pointer$.next(coordinates);
  }

  public toggleMagneticPaths(): void {
    this.magnetic_paths = !this.magnetic_paths;
  }

  public clearAll(): void {
    this._path$.next([]);
    this._anchor_points$.next([]);
    this._pois$.next([]);
  }
}
