import {Component, OnInit} from '@angular/core';
import {environment} from "../../../environments/environment";
import {FormBuilder, FormControl, FormGroup} from "@angular/forms";
import {MapAnimatorService} from "../../services/map-animator.service";
import {Router} from "@angular/router";
import {decode} from "@googlemaps/polyline-codec";

@Component({
  selector: 'app-export-settings',
  templateUrl: './export-settings.component.html',
  styleUrls: ['./export-settings.component.scss']
})
export class ExportSettingsComponent implements OnInit {

  static baseURL = environment.API_URL;
  uuid: string = '';

  options: FormGroup;
  route_uploaded: boolean = false;
  public route_file: File | undefined = undefined;

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
      'list-of-pois': new FormControl(''),
      'auto-scale': new FormControl(false),
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

  isJsonString(str: string): boolean {
    try {
      JSON.parse(str);
    } catch (e) {
      return false;
    }
    return true;
  }

  ngOnInit(): void {
  }


  download_map() {

    localStorage['form_values'] = JSON.stringify(this.options.value);

    if (!this.route_uploaded || !this.route_file)
      return

    let formData = new FormData();

    formData.append("file", this.route_file);

    let url = ExportSettingsComponent.baseURL + 'create?';

    for (const option in this.options.controls) {

      if (['creator-name', 'list-of-pois'].includes(option) && !this.options.controls[option].value.length)
        continue;

      if (option === 'map-scaling' && this.options.controls['auto-scale'].value)
        continue;

      if (option === 'auto-scale')
        continue;

      console.log(this.options.controls[option].value)
      url += '&--' + option + '=' + this.options.controls[option].value.toString().replaceAll('\n', ';')

    }


    fetch(url, {
      method: "POST",
      headers: {
        Accept: 'text/plain',
      },
      body: formData
    })
      .then(response => response.text())
      .then((resp: any) => {
        const response = JSON.parse(resp)
        this.uuid = response['uuid'];
      })
      .finally(() => this.router.navigate(['pending', this.uuid]));

  }


  new_route_uploaded(route_file: File) {

    this.route_uploaded = true;
    this.route_file = route_file

  }


  delete_route_file() {

    this.route_uploaded = false;

  }

  async fetch_route() {

    if (!this.route_uploaded || !this.route_file)
      return

    // minify XML data
    let xml_string = (await this.route_file.text()).toString()
    xml_string = xml_string.replace(/>\s*/g, '>');  // Remove space after >
    xml_string = xml_string.replace(/\s*</g, '<');  // Remove space before <

    let formData = new FormData();
    formData.append("options", JSON.stringify({
      'encoding': 'polyline',
      'file_type': this.route_file.name.split('.').pop()
    }));
    formData.append("file_content", xml_string);

    let url = ExportSettingsComponent.baseURL + 'parse_route';

    fetch(url, {
      method: "POST",
      headers: {
        ContentType: 'multipart/form-data',
        Accept: 'application/json',
      },
      body: formData
    })
      .then(response => response.json())
      .then((resp: any) => {
        console.log(resp)
        const path = decode(resp?.route, 0);
        this.mapAnimator.add_route(path).then();
      });

  }

}
