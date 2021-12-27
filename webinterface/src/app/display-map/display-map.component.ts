import {Component, OnInit} from '@angular/core';

@Component({
  selector: 'app-display-map',
  templateUrl: './display-map.component.html',
  styleUrls: ['./display-map.component.scss'],
  providers: [
    {provide: Window, useValue: window}
  ]
})
export class DisplayMapComponent implements OnInit {

  TILE_SIZES = [64000, 25600, 12800, 5120, 2560, 1280, 640, 512, 384, 256, 128, 64, 25.6]
  ZOOM_LEVELS = [16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28]


  constructor(private window: Window) {
  }

  ngOnInit(): void {
    this.load_map();

    this.window.addEventListener('resize', () => this.load_map())

  }

  private load_map() {

    const zoom_level = 6;

    const base_url = 'https://wmts100.geo.admin.ch/1.0.0/ch.swisstopo.pixelkarte-farbe/default/current/2056/' +
      (this.ZOOM_LEVELS)[zoom_level] + '/';

    let x_tile = 466;
    const y_tile = 210;

    const canvas = document.getElementById('map-canvas') as HTMLCanvasElement;
    const ctx = canvas.getContext('2d');

    const pageWidth = this.window.innerWidth;
    const pageHeight = this.window.innerHeight;

    const maxY = Math.ceil(pageHeight / 256);
    const maxX = Math.ceil(pageWidth / 256);

    canvas.width = maxX * 256;
    canvas.height = maxY * 256;

    x_tile -= Math.floor(maxX / 2) - 2;

    for (let i = 0; i < maxX; i++) {
      for (let j = 0; j < maxY; j++) {

        const url = base_url + (x_tile + i) + '/' + (y_tile - j) + '.jpeg'
        let image = new Image(256, 256);
        image.onload = function () {

          ctx?.drawImage(image, i * 256, (maxY - 1 - j) * 256, 256, 256);
        }
        image.src = url;

      }
    }



  }
}
