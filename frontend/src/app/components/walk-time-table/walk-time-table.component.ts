import {
  Component,
  Input,
  OnInit,
  OnDestroy,
  OnChanges,
  SimpleChanges,
  Output,
  EventEmitter,
  ChangeDetectorRef,
  ChangeDetectionStrategy,
} from '@angular/core';
import { UntypedFormGroup } from '@angular/forms';
import { MapAnimatorService } from '../../services/map-animator.service';
import { LV95_Waypoint } from '../../helpers/coordinates';
import { Subscription } from 'rxjs';
import { MapService } from '../../services/map.service';
import {
  leistungskilometer,
  MAX_WAY_POINTS,
} from '../../utils/walk-time.utils';

export interface TableRow {
  waypoint: LV95_Waypoint;
  delta_h: number;
  delta_dist: number;
  lkm: number;
  time_hours: number;
  planned_arrival: Date;
}

export interface WalkTimeTotals {
  distance: number;
  ascent: number;
  descent: number;
  lkm: number;
  /** walking time without the breaks */
  walk_hours: number;
  arrival: Date | null;
}

const EMPTY_TOTALS: WalkTimeTotals = {
  distance: 0,
  ascent: 0,
  descent: 0,
  lkm: 0,
  walk_hours: 0,
  arrival: null,
};

@Component({
  selector: 'app-walk-time-table',
  templateUrl: './walk-time-table.component.html',
  styleUrls: ['./walk-time-table.component.scss'],
  changeDetection: ChangeDetectionStrategy.Eager,
  standalone: false,
})
export class WalkTimeTableComponent implements OnInit, OnDestroy, OnChanges {
  @Input() formGroup!: UntypedFormGroup;

  @Output() userEdited = new EventEmitter<void>();

  /** Totals of the route, shown in the summary and in the download bar. */
  @Output() totalsChange = new EventEmitter<WalkTimeTotals>();

  get velocity(): number {
    return this.formGroup?.value?.velocity || 4.5;
  }

  get departureTime(): string {
    return this.formGroup?.value?.departure_time || '';
  }

  get autoWaypoints(): boolean {
    return this.formGroup?.value?.automatic_waypoint_selection || false;
  }

  rows: TableRow[] = [];
  readonly maxWayPoints = MAX_WAY_POINTS;
  totals: WalkTimeTotals = EMPTY_TOTALS;
  highlightedRowIndex: number = -1;
  private sub: Subscription | null = null;
  private pointerSub: Subscription | null = null;
  private currentWps: LV95_Waypoint[] = [];

  mapNumbers: string = '';

  constructor(
    public mapAnimator: MapAnimatorService,
    private mapService: MapService,
    private cdr: ChangeDetectorRef,
  ) {}

  ngOnInit() {
    this.mapAnimator.mapNumbers$.subscribe((num) => {
      this.mapNumbers = num;
      this.cdr.detectChanges();
    });

    if (this.formGroup) {
      this.formGroup.valueChanges.subscribe(() => {
        this.recalculate(this.currentWps);
      });
    }

    this.sub = this.mapAnimator.pois$.subscribe((wps: LV95_Waypoint[]) => {
      this.currentWps = wps;
      this.recalculate(this.currentWps);
    });

    // Reverse highlight: when map/elevation hover snaps to a POI, highlight that table row
    this.pointerSub = this.mapAnimator.pointer$.subscribe((coord) => {
      if (!coord) {
        this.highlightedRowIndex = -1;
        return;
      }
      const idx = this.currentWps.findIndex(
        (wp) =>
          wp.accumulated_distance === coord.accumulated_distance &&
          wp.x === coord.x &&
          wp.y === coord.y,
      );
      this.highlightedRowIndex = idx;
    });
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes['formGroup'] && this.formGroup) {
      this.recalculate(this.currentWps);
    }
  }

  ngOnDestroy() {
    if (this.sub) this.sub.unsubscribe();
    if (this.pointerSub) this.pointerSub.unsubscribe();
  }

  onRowHover(row: TableRow) {
    this.mapAnimator.move_pointer(row.waypoint);
  }

  onRowLeave() {
    this.mapAnimator.move_pointer(null);
  }

  onFieldChange(row?: TableRow) {
    this.userEdited.emit();
    this.mapAnimator.update_poi_names(this.currentWps);
    this.recalculate(this.currentWps);
    if (row && row.waypoint) {
      this.mapAnimator.move_pointer(row.waypoint);
    }
  }

  isAutoNamed(row: TableRow): boolean {
    if (!row.waypoint) return false;
    if (row.waypoint.name === 'Lade...') return true;
    return (
      !!row.waypoint.auto_name && row.waypoint.name === row.waypoint.auto_name
    );
  }

  deletePoi(waypoint: any) {
    // Deletion is purely local — service handles state update directly
    this.mapAnimator.delete_poi(waypoint);
  }

  async autoName(row: TableRow) {
    if (!row.waypoint) return;
    if (this.isAutoNamed(row)) return;

    // the name the selection gave the way point (e.g. after the station or hut at the point)
    if (row.waypoint.auto_name) {
      row.waypoint.name = row.waypoint.auto_name;
      this.onFieldChange();
      return;
    }

    const oldName = row.waypoint.name || '';
    row.waypoint.name = 'Lade...';
    try {
      const resp = await this.mapAnimator.get_name_from_coords(
        row.waypoint.x,
        row.waypoint.y,
      );
      row.waypoint.name = resp || '';
      row.waypoint.auto_name = resp || '';
      this.onFieldChange();
    } catch {
      row.waypoint.name = oldName;
    }
  }

  trackByFn(index: number, item: TableRow) {
    return index;
  }

  parseBreakDuration(durationStr: string | number | undefined): number {
    if (!durationStr && durationStr !== 0) return 0;
    const str = String(durationStr);
    // format "hh:mm" or just "minutes"
    if (str.includes(':')) {
      const parts = str.split(':');
      const val = parseInt(parts[0]) + parseInt(parts[1] || '0') / 60.0;
      return isNaN(val) ? 0 : val;
    }
    const val = parseFloat(str);
    return isNaN(val) ? 0 : val / 60.0; // Fallback assumes minutes if just a flat number is typed
  }

  formatDuration(hours: number): string {
    if (isNaN(hours) || !isFinite(hours)) return '0:00';
    const h = Math.floor(hours);
    const m = Math.round((hours - h) * 60);
    const mPadded = m < 10 ? '0' + m : m.toString();
    return `${h}:${mPadded}`;
  }

  recalculate(wps: LV95_Waypoint[]) {
    this.rows = [];
    if (!wps || wps.length === 0) {
      this.setTotals(EMPTY_TOTALS);
      return;
    }

    let sum_dist = 0;
    let sum_lkm = 0;
    let accumulated_time_hours = 0;

    let departureDate = this.departureTime
      ? new Date(this.departureTime)
      : new Date();
    let oldPoint: LV95_Waypoint | null = null;

    for (let i = 0; i < wps.length; i++) {
      const pt = wps[i];

      let delta_h = 0;
      let delta_dist = 0;
      let lkm = 0;
      let time_hours = 0;
      let gradient = 0;

      if (oldPoint) {
        delta_h = pt.h - oldPoint.h;
        delta_dist = Math.abs(
          pt.accumulated_distance - oldPoint.accumulated_distance,
        );

        lkm = leistungskilometer(delta_dist, delta_h);
        time_hours = lkm / (this.velocity || 4.5);
      }

      accumulated_time_hours += time_hours;

      let total_hours_from_start = accumulated_time_hours;
      let total_break_hours = 0;
      for (let j = 0; j <= i; j++) {
        total_break_hours += this.parseBreakDuration(wps[j].break_duration);
      }

      let planned_arrival = new Date(
        departureDate.getTime() +
          (total_hours_from_start + total_break_hours) * 3600 * 1000,
      );

      this.rows.push({
        waypoint: pt,
        delta_h,
        delta_dist,
        lkm,
        time_hours,
        planned_arrival,
      });

      oldPoint = pt;
    }

    this.setTotals({
      distance: this.rows.reduce((sum, r) => sum + r.delta_dist, 0),
      ascent: this.rows.reduce((sum, r) => sum + Math.max(r.delta_h, 0), 0),
      descent: this.rows.reduce((sum, r) => sum - Math.min(r.delta_h, 0), 0),
      lkm: this.rows.reduce((sum, r) => sum + r.lkm, 0),
      walk_hours: accumulated_time_hours,
      arrival: this.rows[this.rows.length - 1].planned_arrival,
    });
  }

  private setTotals(totals: WalkTimeTotals) {
    this.totals = totals;
    this.totalsChange.emit(totals);
  }
}
