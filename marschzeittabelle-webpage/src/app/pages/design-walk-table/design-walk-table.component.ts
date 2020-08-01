import {Component, OnInit} from '@angular/core';

@Component({
  selector: 'app-design-walk-table',
  templateUrl: './design-walk-table.component.html',
  styleUrls: ['./design-walk-table.component.sass']
})
export class DesignWalkTableComponent implements OnInit {

  public bounds: {
    maxlat: number;
    minlat: number;
    maxlon: number;
    minlon: number;
  } = null;
  public showMap = false;

  constructor() {
  }

  static getFileContentAsText(file) {

    return new Promise<string>(res => {
      DesignWalkTableComponent.readFileContent(file)
        .then((content: string) => res(content))
        .catch(error => console.log(error));
    });

  }

  static readFileContent(file) {
    const reader = new FileReader();
    return new Promise((resolve, reject) => {
      reader.onload = event => resolve(event.target.result);
      reader.onerror = error => reject(error);
      reader.readAsText(file);
    });
  }

  ngOnInit(): void {

    document.getElementById('input-file')
      .addEventListener('change', this.onFileUpload);

  }

  /**
   * This function executes every time, when a file gets uploaded.
   *
   * @param event a file was uploaded
   */
  async onFileUpload(event) {

    const input = event.target;

    if ('files' in input && input.files.length > 0) {

      // load file
      const fileContent = await DesignWalkTableComponent.getFileContentAsText(input.files[0]);
      const parser = new DOMParser();
      const xmlDoc = parser.parseFromString(fileContent, 'text/xml');

      // read map bounds
      const bounds = xmlDoc.querySelector('gpx > metadata > bounds');
      this.bounds = {
        maxlat: parseFloat(bounds.getAttribute('maxlat')),
        minlat: parseFloat(bounds.getAttribute('minlat')),
        minlon: parseFloat(bounds.getAttribute('minlon')),
        maxlon: parseFloat(bounds.getAttribute('maxlon')),
      };
      this.showMap = true;
      console.log(this.bounds);

    }

  }

}
