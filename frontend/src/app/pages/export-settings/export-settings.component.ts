import {Component, signal} from '@angular/core';
import {FormControl, UntypedFormBuilder, UntypedFormControl, UntypedFormGroup} from "@angular/forms";
import {MapAnimatorService} from "../../services/map-animator.service";
import {Router} from "@angular/router";

@Component({
  selector: 'app-export-settings',
  templateUrl: './export-settings.component.html',
  styleUrls: ['./export-settings.component.scss']
})
export class ExportSettingsComponent {

  options: UntypedFormGroup;

  parse_error: boolean = false;

  public route_file: File | undefined;
  public route_uploaded: boolean = false;
  public loading = false;
  public error_message: string = '';
  protected readonly location = location;
  public has_valid_path: boolean = false;

  constructor(private mapAnimator: MapAnimatorService, fb: UntypedFormBuilder, private router: Router) {

    this.mapAnimator.set_error_handler((err) => {
      this.error_message = err;
    })

    this.options = fb.group({
      'velocity': new UntypedFormControl(4.5),
      'map_scaling': new UntypedFormControl(15_000),
      'departure_time': new UntypedFormControl((new Date()).toISOString().substring(0, 16)),
      'creator_name': new UntypedFormControl(''),
      'map_layers': new UntypedFormControl('ch.swisstopo.pixelkarte-farbe'),
      'auto_scale': new UntypedFormControl(false),
      'route_name': new UntypedFormControl(''),
      'name_points_in_export': new UntypedFormControl(true),
      'automatic_waypoint_selection': new FormControl<boolean>(true),
    });


    // we need this try-catch block to ensure the loaded data is compatible with the current form layout
    try {

      if (localStorage['form_values'] && this.isJsonString(localStorage['form_values'])) {
        this.options.patchValue(JSON.parse(localStorage['form_values']))
        console.log('Loaded form values from local storage')
      }

    } catch (_) {
      // safe to ignore
    }

    // listen to changes of automatic_waypoint_selection
    this.options.get('automatic_waypoint_selection')?.valueChanges.subscribe((val) => {
      this.mapAnimator.set_automatic_waypoint_selection(val);
    });


    console.log('Form values:', this.options.value);
    this.mapAnimator?.path$.subscribe((path) => {
      this.has_valid_path = path.length !== 0;
      this.route_uploaded = this.has_valid_path;
    });


  }


  public new_route_uploaded(route_file: File) {

    this.loading = true;

    this.route_file = route_file;
    this.mapAnimator.replace_route(route_file)
      .then((route_name) => {
        this.options.patchValue({'route_name': route_name})
        this.route_uploaded = true;
        this.loading = false;
      })
      .catch(() => {
        this.parse_error = true;
        this.loading = false;
      });

  }


  public delete_route_file() {

    this.route_uploaded = false;
    this.mapAnimator.clear();

  }

  public download_map() {

    console.log('Downloading map...')
    const settings = this.options.value;
    this.mapAnimator.download_map(settings).then(
      (uuid) => this.router.navigate(['pending', uuid])
    ).catch((err) => this.error_message = err);

  }

  private isJsonString(str: string): boolean {
    try {
      JSON.parse(str);
    } catch (e) {
      return false;
    }
    return true;
  }


  async finish_drawing() {

    this.route_uploaded = true;
    await this.mapAnimator.finish_drawing();

  }
}
