import { ChangeDetectionStrategy, Component, Inject } from '@angular/core';
import { UntypedFormGroup } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { MAP_LAYERS, MapLayerOption, previewTiles } from './map-layers';

export interface MapExportDialogData {
  options: UntypedFormGroup;
  /** 'export' is opened by the download button, 'edit' by the summary of the map settings */
  mode: 'export' | 'edit';
}

/** The dialog closes with 'download' to start the export, 'apply' to keep the settings, or nothing to discard them. */
export type MapExportDialogResult = 'download' | 'apply' | undefined;

type PointLabels = 'names' | 'numbers' | 'none';

const MAP_SETTINGS = [
  'map_layers',
  'auto_scale',
  'map_scaling',
  'name_points_in_export',
  'number_points_in_export',
  'legend_position',
  'route_style',
];

@Component({
  selector: 'app-map-export-dialog',
  templateUrl: './map-export-dialog.component.html',
  styleUrls: ['./map-export-dialog.component.scss'],
  changeDetection: ChangeDetectionStrategy.Eager,
  standalone: false,
})
export class MapExportDialogComponent {
  readonly layers = MAP_LAYERS;
  readonly legendPositions = [
    { value: 'upper left', label: 'Oben links' },
    { value: 'upper right', label: 'Oben rechts' },
    { value: 'lower left', label: 'Unten links' },
    { value: 'lower right', label: 'Unten rechts' },
  ];
  readonly previewTiles = previewTiles;
  readonly options: UntypedFormGroup;

  /** the settings when the dialog was opened, restored if it is closed without applying them */
  private readonly initial: Record<string, unknown> = {};

  constructor(
    @Inject(MAT_DIALOG_DATA) public data: MapExportDialogData,
    private dialogRef: MatDialogRef<
      MapExportDialogComponent,
      MapExportDialogResult
    >,
  ) {
    this.options = data.options;
    for (const name of MAP_SETTINGS) {
      this.initial[name] = this.options.get(name)?.value;
    }
    dialogRef.afterClosed().subscribe((result) => {
      if (!result) this.options.patchValue(this.initial);
    });
  }

  get pointLabels(): PointLabels {
    const value = this.options.value;
    if (value.name_points_in_export) return 'names';
    if (value.number_points_in_export) return 'numbers';
    return 'none';
  }

  setPointLabels(labels: PointLabels) {
    this.options.patchValue({
      name_points_in_export: labels === 'names',
      number_points_in_export: labels === 'numbers',
    });
  }

  selectLayer(option: MapLayerOption) {
    this.options.patchValue({ map_layers: option.value });
  }

  hideBrokenTile(event: Event) {
    (event.target as HTMLElement).style.visibility = 'hidden';
  }

  close(result: MapExportDialogResult) {
    this.dialogRef.close(result);
  }
}
