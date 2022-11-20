import {Component} from '@angular/core';
import {FormBuilder, FormControl, FormGroup} from "@angular/forms";
import {MapAnimatorService} from "../../services/map-animator.service";
import {Router} from "@angular/router";

@Component({
  selector: 'app-export-settings',
  templateUrl: './export-settings.component.html',
  styleUrls: ['./export-settings.component.scss']
})
export class ExportSettingsComponent {

  options: FormGroup;
  route_uploaded: boolean = false;

  public route_file: File | undefined;

  constructor(private mapAnimator: MapAnimatorService, fb: FormBuilder, private router: Router) {

    this.options = fb.group({
      'velocity': new FormControl(4.5),
      'map-scaling': new FormControl(25_000),
      'departure-time': new FormControl((new Date()).toISOString().substring(0, 16)),
      'creator-name': new FormControl(''),
      'create-map-pdfs': new FormControl(true),
      'create-excel': new FormControl(true),
      'legend-position': new FormControl('lower right'),
      'map-layers': new FormControl('ch.swisstopo.pixelkarte-farbe'),
      'auto-scale': new FormControl(false),
      'route-name': new FormControl(''),
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

    this.route_file = route_file;
    this.route_uploaded = true;
    this.mapAnimator.replace_route(route_file).then(route_name =>
      this.options.patchValue({'route-name': route_name})
    );

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
