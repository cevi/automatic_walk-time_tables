import { ChangeDetectionStrategy, Component, forwardRef } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';

export type RouteStyle = 'classic' | 'magenta' | 'highlighter';

interface RouteStyleOption {
  value: RouteStyle;
  label: string;
  hint: string;
  preview: string;
}

/**
 * Lets the user choose how the route is drawn on the exported map. The values
 * match ROUTE_STYLES in backend/automatic_walk_time_tables/map_downloader/create_map.py,
 * the previews are crops of real 1:25'000 exports.
 */
@Component({
  selector: 'app-route-style-picker',
  templateUrl: './route-style-picker.component.html',
  styleUrls: ['./route-style-picker.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: false,
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => RouteStylePickerComponent),
      multi: true,
    },
  ],
})
export class RouteStylePickerComponent implements ControlValueAccessor {
  readonly options: RouteStyleOption[] = [
    {
      value: 'classic',
      label: 'Orange (klassisch)',
      hint: 'Der bisherige Stil, die Karte ist leicht aufgehellt',
      preview: 'assets/route-styles/classic.webp',
    },
    {
      value: 'magenta',
      label: 'Magenta',
      hint: 'Stärkster Kontrast, auch in Städten und im Wald',
      preview: 'assets/route-styles/magenta.webp',
    },
    {
      value: 'highlighter',
      label: 'Textmarker',
      hint: 'Breit und durchscheinend, der Weg bleibt sichtbar',
      preview: 'assets/route-styles/highlighter.webp',
    },
  ];

  value: RouteStyle = 'classic';
  disabled = false;

  private onChange: (value: RouteStyle) => void = () => {};
  private onTouched: () => void = () => {};

  select(value: RouteStyle) {
    this.value = value;
    this.onChange(value);
    this.onTouched();
  }

  writeValue(value: RouteStyle | null): void {
    // values from an older local storage entry fall back to the default
    this.value =
      this.options.find((option) => option.value === value)?.value ?? 'classic';
  }

  registerOnChange(fn: (value: RouteStyle) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    this.disabled = isDisabled;
  }
}
