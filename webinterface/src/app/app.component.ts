import {Component, OnInit} from '@angular/core';
import {environment} from "../environments/environment";
import {MapAnimatorService} from "./services/map-animator.service";
import {FormBuilder, FormControl, FormGroup} from "@angular/forms";
import {MatSnackBar} from "@angular/material/snack-bar";


@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})
export class AppComponent implements OnInit {

  static baseURL = environment.API_URL;

  pending = false;
  uuid: string = '';
  status_message: string = '';
  status: string = '';
  options: FormGroup;
  gpx_uploaded: boolean = false;
  private gpx_file: File | undefined = undefined;

  constructor(private mapAnimator: MapAnimatorService, fb: FormBuilder, private snackBar: MatSnackBar) {

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


    this.status_message = '';
    this.status = '';
    this.gpx_uploaded = false;

    this.pending = true;

    // Start Animation
    this.mapAnimator.add_gpx_file(this.gpx_file);

    let formData = new FormData();

    formData.append("file", this.gpx_file);

    let url = AppComponent.baseURL + 'create?';

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
        console.log(this.uuid)

        this.get_status_updates()

      })
      .catch(err => this.log_network_error(err));

  }

  get_status_updates() {

    console.log('Request a status update.')

    const baseURL = AppComponent.baseURL + "status/"

    fetch(baseURL + this.uuid)
      .then(response => response.json())
      .then(res => {

        this.status = res.status;
        this.status_message = res.message;

        if ('finished' == res.status) {
          this.download_data()
          return;
        }

        if('error' == res.status){
          return;
        }

        setTimeout(() => this.get_status_updates(), 500)
      })
      .catch(err => this.log_network_error(err))


  }

  private log_network_error(err: Error) {
    this.status = 'error';
    this.status_message = 'Ein Netzwerk-Fehler ist aufgetreten, bitte versuche es erneut.'
    console.error(err);
  }

  download_data() {

    this.pending = false;
    window.location.href = AppComponent.baseURL + 'download/' + this.uuid;
    this.snackBar.open('Dateien wurden erfolgreich erstellt und heruntergeladen.', '', {
      duration: 5000
    });


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
