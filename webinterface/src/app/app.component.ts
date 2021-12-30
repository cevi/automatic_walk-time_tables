import {Component, OnInit} from '@angular/core';
import {environment} from "../environments/environment";
import {MapAnimatorService} from "./services/map-animator.service";
import {FormBuilder, FormControl, FormGroup} from "@angular/forms";


@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})
export class AppComponent implements OnInit {

  static baseURL = environment.API_URL;

  title = 'automatic-walk-time-tables';
  pending = false;
  uuid: string = '';
  status_message: string = '';
  status: string = '';
  options: FormGroup;

  constructor(private mapAnimator: MapAnimatorService, fb: FormBuilder) {

    this.options = fb.group({
      'velocity': new FormControl(4.5),
      'map-scaling': new FormControl(15_000),
      'departure-time': new FormControl((new Date()).toISOString().substring(0, 16)),
      'creator-name': new FormControl(''),
      'create-map-pdfs': new FormControl(true),
      'create-excel': new FormControl(true)
    });

  }

  ngOnInit(): void {
  }


  download_map() {

    this.status_message = '';
    this.status = '';

    this.pending = true;
    const uploaderElement = (document.getElementById('uploader') as HTMLInputElement);

    if (uploaderElement === null)
      return;

    // @ts-ignore
    let gpx_file: File = uploaderElement.files[0];

    // Start Animation
    this.mapAnimator.add_gpx_file(gpx_file);

    let formData = new FormData();

    formData.append("file", gpx_file);

    let url = AppComponent.baseURL + 'create?';

    for (const option in this.options.controls) {

      if (option === 'creator-name' && !this.options.controls['creator-name'].value.length )
        continue;

      url += '&--' + option + '=' +   this.options.controls[option].value
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
        console.log(this.uuid)

        this.get_status_updates()

      })
      .catch(console.log)

  }

  get_status_updates() {

    console.log('Request a status update.')

    const baseURL = AppComponent.baseURL + "status/"

    fetch(baseURL + this.uuid)
      .then(response => response.json())
      .then(res => {

        this.status = res.status;
        this.status_message = res.message;

        if (['error', 'finished'].includes(res.status)) {
          this.download_data()
          return;
        }

        setTimeout(() => this.get_status_updates(), 500)
      });

  }

  download_data() {

    this.pending = false;
    window.location.href = "http://localhost:5000/download/" + this.uuid;

  }


}
