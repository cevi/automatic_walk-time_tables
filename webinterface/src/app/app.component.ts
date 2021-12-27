import {Component} from '@angular/core';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})
export class AppComponent {
  title = 'automatic-walk-time-tables';
  pending = false;
  showDownloadLink = false;
  download_id: string = '';

  download_map() {

    this.showDownloadLink = false;
    this.pending = true;
    const uploaderElement = (document.getElementById('uploader') as HTMLInputElement);

    if (uploaderElement === null)
      return;

    // @ts-ignore
    let gpx_file: File = uploaderElement.files[0];
    let formData = new FormData();

    formData.append("file", gpx_file);

    const url = "http://localhost:5000/create?--velocity=5"
    fetch(url, {
      method: "POST",
      headers: {
        Accept: 'text/plain',
      },
      body: formData
    })
      .then(response => response.text())
      .then((resp: any) => {
        console.log(resp)
        const response = JSON.parse(resp)
        console.log(response['download_id'])
        this.download_id = response['download_id'];
        this.download_data()

      })
      .catch(console.log)

  }

  download_data() {

    this.pending = false;
    this.showDownloadLink = true;

  }

}
