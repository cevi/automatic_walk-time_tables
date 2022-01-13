import {Component, OnInit} from '@angular/core';
import {environment} from "../../../environments/environment";
import {FormBuilder, FormControl, FormGroup} from "@angular/forms";
import {MapAnimatorService} from "../../services/map-animator.service";
import {Router} from "@angular/router";

@Component({
  selector: 'app-export-settings',
  templateUrl: './export-settings.component.html',
  styleUrls: ['./export-settings.component.scss']
})
export class ExportSettingsComponent implements OnInit {

  static baseURL = environment.API_URL;
  uuid: string = '';

  options: FormGroup;
  gpx_uploaded: boolean = false;
  private gpx_file: File | undefined = undefined;

  constructor(private mapAnimator: MapAnimatorService, fb: FormBuilder, private router: Router) {

    this.options = fb.group({
      'velocity': new FormControl(4.5),
      'map-scaling': new FormControl(25_000),
      'departure-time': new FormControl((new Date()).toISOString().substring(0, 16)),
      'creator-name': new FormControl(''),
      'create-map-pdfs': new FormControl(true),
      'create-excel': new FormControl(true)
    });

  }

  ngOnInit(): void {
  }


  download_map() {

    if (!this.gpx_uploaded || !this.gpx_file)
      return

    // Start Animation
    this.mapAnimator.add_gpx_file(this.gpx_file);

    let formData = new FormData();

    formData.append("file", this.gpx_file);

    let url = ExportSettingsComponent.baseURL + 'create?';

    for (const option in this.options.controls) {

      if (option === 'creator-name' && !this.options.controls['creator-name'].value.length)
        continue;

      url += '&--' + option + '=' + this.options.controls[option].value
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
      .finally(() => this.router.navigate(['pending', this.uuid]))

  }


  new_gpx_uploaded() {
    this.gpx_uploaded = true;

    const uploaderElement = (document.getElementById('uploader') as HTMLInputElement);

    if (uploaderElement === null)
      return;

    // @ts-ignore
    this.gpx_file = uploaderElement.files[0];

  }

}
