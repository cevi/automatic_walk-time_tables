import { Injectable } from '@angular/core';
import { MapStateService } from './map-state.service';
import { LV95_Coordinates, LV95_Waypoint } from '../helpers/coordinates';

@Injectable({
  providedIn: 'root',
})
export class RouteHistoryService {
  private _pathHistory: LV95_Waypoint[][] = [];
  private _pathRedoHistory: LV95_Waypoint[][] = [];
  
  private _poisHistory: LV95_Waypoint[][] = [];
  private _poisRedoHistory: LV95_Waypoint[][] = [];
  
  private _anchorPointsHistory: LV95_Coordinates[][] = [];
  private _anchorPointsRedoHistory: LV95_Coordinates[][] = [];

  constructor(private mapState: MapStateService) {}

  public get canUndo(): boolean {
    return this._pathHistory.length > 0;
  }

  public get canRedo(): boolean {
    return this._pathRedoHistory.length > 0;
  }

  public commitState(
    path: LV95_Waypoint[],
    pois: LV95_Waypoint[],
    anchors: LV95_Coordinates[]
  ): void {
    // Preserve copies securely
    this._pathHistory.push(JSON.parse(JSON.stringify(path)));
    this._poisHistory.push(JSON.parse(JSON.stringify(pois)));
    this._anchorPointsHistory.push(JSON.parse(JSON.stringify(anchors)));

    // Erase redo sequences post-modification
    this._pathRedoHistory = [];
    this._poisRedoHistory = [];
    this._anchorPointsRedoHistory = [];
  }

  public undo(): void {
    if (!this.canUndo) return;

    // Push Current State to Redo
    this._pathRedoHistory.push(JSON.parse(JSON.stringify(this.mapState.path)));
    const previous_path = this._pathHistory.pop()!;
    this.mapState.updatePath(previous_path);

    if (this._poisHistory.length > 0) {
      this._poisRedoHistory.push(JSON.parse(JSON.stringify(this.mapState.pois)));
      const previous_pois = this._poisHistory.pop()!;
      this.mapState.updatePOIs(previous_pois);
    }

    if (this._anchorPointsHistory.length > 0) {
      this._anchorPointsRedoHistory.push(JSON.parse(JSON.stringify(this.mapState.anchor_points)));
      const previous_anchors = this._anchorPointsHistory.pop()!;
      this.mapState.updateAnchorPoints(previous_anchors);
    }
  }

  public redo(): void {
    if (!this.canRedo) return;

    // Push Current State to Undo
    this._pathHistory.push(JSON.parse(JSON.stringify(this.mapState.path)));
    const next_path = this._pathRedoHistory.pop()!;
    this.mapState.updatePath(next_path);

    if (this._poisRedoHistory.length > 0) {
      this._poisHistory.push(JSON.parse(JSON.stringify(this.mapState.pois)));
      const next_pois = this._poisRedoHistory.pop()!;
      this.mapState.updatePOIs(next_pois);
    }

    if (this._anchorPointsRedoHistory.length > 0) {
      this._anchorPointsHistory.push(JSON.parse(JSON.stringify(this.mapState.anchor_points)));
      const next_anchors = this._anchorPointsRedoHistory.pop()!;
      this.mapState.updateAnchorPoints(next_anchors);
    }
  }

  public invertRoute(): void {
    const current_path = this.mapState.path;
    if (current_path.length === 0) return;

    const current_pois = this.mapState.pois;
    const current_anchors = this.mapState.anchor_points;

    // Snapshot current state
    this.commitState(current_path, current_pois, current_anchors);

    const total_dist = current_path[current_path.length - 1].accumulated_distance;

    const reversed_path = [...current_path].reverse().map((p) => ({
      ...p,
      accumulated_distance: Math.max(0, total_dist - p.accumulated_distance),
    }));
    this.mapState.updatePath(reversed_path);

    const reversed_pois = [...current_pois].reverse().map((p) => ({
      ...p,
      accumulated_distance: Math.max(0, total_dist - p.accumulated_distance),
    }));
    this.mapState.updatePOIs(reversed_pois);

    const reversed_anchors = [...current_anchors].reverse();
    this.mapState.updateAnchorPoints(reversed_anchors);
  }

  public clearHistories(): void {
    this._pathHistory = [];
    this._pathRedoHistory = [];
    this._poisHistory = [];
    this._poisRedoHistory = [];
    this._anchorPointsHistory = [];
    this._anchorPointsRedoHistory = [];
  }
}
