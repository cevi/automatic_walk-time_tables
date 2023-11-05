import {Component} from '@angular/core';
import {UntypedFormBuilder, UntypedFormControl, UntypedFormGroup} from "@angular/forms";
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

  constructor(private mapAnimator: MapAnimatorService, fb: UntypedFormBuilder, private router: Router) {

    this.options = fb.group({
      'velocity': new UntypedFormControl(4.5),
      'map_scaling': new UntypedFormControl(25_000),
      'departure_time': new UntypedFormControl((new Date()).toISOString().substring(0, 16)),
      'creator_name': new UntypedFormControl(''),
      'create_map_pdfs': new UntypedFormControl(true),
      'create_excel': new UntypedFormControl(true),
      'legend_position': new UntypedFormControl('lower right'),
      'map_layers': new UntypedFormControl('ch.swisstopo.pixelkarte-farbe'),
      'auto_scale': new UntypedFormControl(false),
      'route_name': new UntypedFormControl(''),
      'name_points_in_export': new UntypedFormControl(true),
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
    );


  }

  private isJsonString(str: string): boolean {
    try {
      JSON.parse(str);
    } catch (e) {
      return false;
    }
    return true;
  }


}
