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
  route_uploaded: boolean = false;

  private pois: string = '';
  public route_file: File | undefined;

  constructor(private mapAnimator: MapAnimatorService, fb: UntypedFormBuilder, private router: Router) {

    this.options = fb.group({
      'velocity': new UntypedFormControl(4.5),
      'map-scaling': new UntypedFormControl(25_000),
      'departure-time': new UntypedFormControl((new Date()).toISOString().substring(0, 16)),
      'creator-name': new UntypedFormControl(''),
      'create-map-pdfs': new UntypedFormControl(true),
      'create-excel': new UntypedFormControl(true),
      'legend-position': new UntypedFormControl('lower right'),
      'map-layers': new UntypedFormControl('ch.swisstopo.pixelkarte-farbe'),
      'auto-scale': new UntypedFormControl(false),
    });


    // we need this try-catch block to ensure the loaded data is compatible with the current form layout
    try {

      if (localStorage['form_values'] && this.isJsonString(localStorage['form_values'])) {
        this.options.setValue(JSON.parse(localStorage['form_values']))
        console.log('Loaded form values from local storage')
      }

    } catch (_) {
      // safe to ignore
    }


  }


  public new_route_uploaded(route_file: File) {

    this.route_file = route_file;
    this.route_uploaded = true;
    this.mapAnimator.replace_route(route_file).then();

  }


  public delete_route_file() {

    this.route_uploaded = false;
    this.mapAnimator.clear();

  }

  public download_map() {

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
