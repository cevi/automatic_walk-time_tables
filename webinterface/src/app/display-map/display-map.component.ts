import {Component, OnInit} from '@angular/core';
import {LV03TransformerService} from "../lv03-transformer.service";
import * as gpxParser from "gpxparser";

interface Coordinates {
  x: number;
  y: number;
}

interface LV95_Coordinates extends Coordinates {
}

interface Canvas_Coordinates extends Coordinates {
}

interface Tile_Coodinates extends Coordinates {
}


interface Canvas_Offset extends Canvas_Coordinates {
}


interface LV95_Offset extends LV95_Coordinates {
}

class Tile {

  static TILE_RENDER_SIZE = 256;
  static TILE_SIZES = [64000, 25600, 12800, 5120, 2560, 1280, 640, 512, 384, 256, 128, 64]
  static ZOOM_LEVELS = [16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27]

  public tile_coordinates: Tile_Coodinates;
  public layer: string;
  public zoom_level: number;
  public canvas_position: Canvas_Coordinates;
  public image: HTMLImageElement | undefined;


  constructor(
    tile_coordinates: Tile_Coodinates,
    canvas_position: Canvas_Coordinates,
    layer: string,
    zoom_level: number) {

    this.tile_coordinates = tile_coordinates;
    this.canvas_position = canvas_position;
    this.layer = layer;
    this.image = undefined;

    if (zoom_level <= 0 || zoom_level > Tile.ZOOM_LEVELS.length - 1)
      throw new Error('Invalid Zoom Level');

    this.zoom_level = zoom_level;


  }


  private get_URL(): string {

    return 'https://wmts100.geo.admin.ch/1.0.0/' + this.layer +
      '/default/current/2056/' + (Tile.ZOOM_LEVELS)[this.zoom_level] + '/' +
      this.tile_coordinates.x + '/' + this.tile_coordinates.y + '.jpeg';

  }

  public async load_tile(): Promise<HTMLImageElement> {

    return new Promise((resolve, reject) => {
      const img = new Image();
      img.addEventListener('load', () => {
        this.image = img;
        resolve(img);
      });
      img.addEventListener('error', (err) => reject(err));
      img.src = this.get_URL();
    });

  }

  public get_tile_north() {

    const tile_coordinates = JSON.parse(JSON.stringify(this.tile_coordinates));
    tile_coordinates.y -= 1;

    const canvas_position = JSON.parse(JSON.stringify(this.canvas_position));
    canvas_position.y -= Tile.TILE_RENDER_SIZE;

    return new Tile(tile_coordinates, canvas_position, this.layer, this.zoom_level);

  }

  public get_tile_south() {

    const tile_coordinates = JSON.parse(JSON.stringify(this.tile_coordinates));
    tile_coordinates.y += 1;

    const canvas_position = JSON.parse(JSON.stringify(this.canvas_position));
    canvas_position.y += Tile.TILE_RENDER_SIZE;

    return new Tile(tile_coordinates, canvas_position, this.layer, this.zoom_level);

  }

  public get_tile_east() {

    const tile_coordinates = JSON.parse(JSON.stringify(this.tile_coordinates));
    tile_coordinates.x += 1;

    const canvas_position = JSON.parse(JSON.stringify(this.canvas_position));
    canvas_position.x += Tile.TILE_RENDER_SIZE;

    return new Tile(tile_coordinates, canvas_position, this.layer, this.zoom_level);

  }


  public get_tile_west() {

    const tile_coordinates = JSON.parse(JSON.stringify(this.tile_coordinates));
    tile_coordinates.x -= 1;

    const canvas_position = JSON.parse(JSON.stringify(this.canvas_position));
    canvas_position.x -= Tile.TILE_RENDER_SIZE;

    return new Tile(tile_coordinates, canvas_position, this.layer, this.zoom_level);

  }


}

class MapCreator {

  public readonly zoom_level: number;
  private readonly canvas_size: Canvas_Coordinates;
  private readonly LV95_center: LV95_Coordinates;
  public base_tile: Tile;

  private readonly LV95_origin: LV95_Coordinates;
  private readonly delta_x: number;
  private readonly delta_y: number;

  constructor(
    LV95_center: LV95_Coordinates,
    zoom_level: number,
    canvas_size: Canvas_Coordinates,
    layer: string) {

    this.zoom_level = zoom_level;
    this.canvas_size = canvas_size;
    this.LV95_center = LV95_center;

    if (zoom_level <= 0 || zoom_level > Tile.ZOOM_LEVELS.length - 1)
      throw new Error('Invalid Zoom Level');

    const tile_coordinates: Tile_Coodinates = {
      'x': Math.floor((LV95_center.x - 2_420_000) / Tile.TILE_SIZES[zoom_level]),
      'y': Math.floor((1_350_000 - LV95_center.y) / Tile.TILE_SIZES[zoom_level])
    };

    this.base_tile = new Tile(tile_coordinates, this.get_position_on_canvas(), layer, zoom_level);

    this.delta_x = Math.ceil(this.canvas_size.x / Tile.TILE_RENDER_SIZE / 2);
    this.delta_y = Math.ceil(this.canvas_size.y / Tile.TILE_RENDER_SIZE / 2);

    const offset = this.get_LV92_offset();

    const x = LV95_center.x - offset.x - this.delta_x * Tile.TILE_SIZES[zoom_level];
    const y = LV95_center.y + offset.y + this.delta_y * Tile.TILE_SIZES[zoom_level];


    this.LV95_origin = {'x': x, 'y': y}

  }

  public get_tiles(): Tile[] {

    const tiles = [this.base_tile];


    let tile_A = this.base_tile;
    let tile_B = this.base_tile;


    for (let j = 0; j < this.delta_x; j++) {

      tile_A = tile_A.get_tile_west()
      tile_B = tile_B.get_tile_east()

      tiles.push(tile_A)
      tiles.push(tile_B)

    }

    tile_A = this.base_tile;
    tile_B = this.base_tile;

    for (let i = 0; i < this.delta_y; i++) {


      tile_A = tile_A.get_tile_north()
      tile_B = tile_B.get_tile_south()

      tiles.push(tile_A)
      tiles.push(tile_B)

      let tile_A_A = tile_A;
      let tile_A_B = tile_A;

      let tile_B_A = tile_B;
      let tile_B_B = tile_B;


      for (let j = 0; j < this.delta_x; j++) {

        tile_A_A = tile_A_A.get_tile_west()
        tile_A_B = tile_A_B.get_tile_east()

        tiles.push(tile_A_A)
        tiles.push(tile_A_B)

        tile_B_A = tile_B_A.get_tile_west()
        tile_B_B = tile_B_B.get_tile_east()

        tiles.push(tile_B_A)
        tiles.push(tile_B_B)

      }

    }

    return tiles;

  }

  private get_LV92_offset(): LV95_Offset {

    let x_offset = (this.LV95_center.x - 2_420_000) % Tile.TILE_SIZES[this.zoom_level];
    let y_offset = (1_350_000 - this.LV95_center.y) % Tile.TILE_SIZES[this.zoom_level];

    return {'x': x_offset, 'y': y_offset};

  }

  private get_canvas_offset(): Canvas_Offset {

    const lv95_offset = this.get_LV92_offset();
    const x_offset = Tile.TILE_RENDER_SIZE * lv95_offset.x / Tile.TILE_SIZES[this.zoom_level];
    const y_offset = Tile.TILE_RENDER_SIZE * lv95_offset.y / Tile.TILE_SIZES[this.zoom_level];

    return {'x': x_offset, 'y': y_offset};

  }

  private get_position_on_canvas(): Canvas_Coordinates {

    const x_canvas_origin = Math.ceil(this.canvas_size.x / 2);
    const y_canvas_origin = Math.ceil(this.canvas_size.y / 2);

    const offset = this.get_canvas_offset();
    const x_tile_origin = x_canvas_origin - offset.x;
    const y_tile_origin = y_canvas_origin - offset.y;

    return {'x': x_tile_origin, 'y': y_tile_origin};

  }

  to_canvas_coordinates(coordinates: LV95_Coordinates) {

    let x = this.get_position_on_canvas().x - this.delta_x * Tile.TILE_RENDER_SIZE
    let y = this.get_position_on_canvas().y - this.delta_y * Tile.TILE_RENDER_SIZE

    x += Tile.TILE_RENDER_SIZE * (coordinates.x - this.LV95_origin.x) / Tile.TILE_SIZES[this.zoom_level]
    y += Tile.TILE_RENDER_SIZE * (this.LV95_origin.y - coordinates.y) / Tile.TILE_SIZES[this.zoom_level]

    return {'x': x, 'y': y};

  }


}

@Component({
  selector: 'app-display-map',
  templateUrl: './display-map.component.html',
  styleUrls: ['./display-map.component.scss'],
  providers: [
    {provide: Window, useValue: window}
  ]
})
export class DisplayMapComponent implements OnInit {

  path: LV95_Coordinates[];
  LV95_map_center: LV95_Coordinates
  zoom_level: number;

  constructor(private window: Window, private transformer: LV03TransformerService) {

    this.LV95_map_center = {'x': 2721902.0, 'y': 1217236.6}
    this.path = []
    this.zoom_level = 6;

  }

  ngOnInit(): void {

    this.draw_canvas().then();
    this.window.addEventListener('resize', () => this.draw_canvas())

    setTimeout(
      () => {
        const uploaderElement = (document.getElementById('uploader') as HTMLInputElement);
        uploaderElement.addEventListener('input', () => this.gpx_loaded())

      }, 100
    )

  }

  gpx_loaded() {

    const uploaderElement = (document.getElementById('uploader') as HTMLInputElement);

    if (uploaderElement === null)
      return;
    // @ts-ignore
    let gpx_file: File = uploaderElement.files[0];

    const fr = new FileReader();

    fr.readAsText(gpx_file);

    fr.onload = async () => {

      this.path = []

      // @ts-ignore
      const gpx = new gpxParser();
      gpx.parse(fr.result);

      console.log(gpx)

      gpx.tracks[0].points.forEach((sec: { lat: string; lon: string; }) => {

        const CH_coord = this.transformer.WGStoCH(sec.lat, sec.lon);
        this.path.push({'x': 2_000_000 + CH_coord[0], 'y': 1_000_000 + CH_coord[1]})

      })

      let x = 0;
      let y = 0;
      let count = 0;
      for (let i = 0; i < this.path.length; i += 100, count++) {

        x += this.path[i].x;
        y += this.path[i].y;

      }

      this.LV95_map_center = {'x': x / count, 'y': y / count}
      console.log(this.LV95_map_center)

      this.draw_canvas().then();

    };


  }

  private async draw_canvas() {


    const {canvas, ctx} = this.setup_canvas();
    const canvas_size: Canvas_Coordinates = {'x': canvas.width, 'y': canvas.height};


    // The base tile is the map tile which contains the LV95_map_center
    let map_creator = new MapCreator(
      this.LV95_map_center,
      this.zoom_level,
      canvas_size,
      'ch.swisstopo.pixelkarte-farbe');


    const tiles = map_creator.get_tiles();
    const promises = tiles.map(t => t.load_tile());

    await Promise.all(promises);

    ctx.globalAlpha = 0.2;
    tiles.forEach(t => {
      if (t.image)
        ctx.drawImage(t.image, t.canvas_position.x, t.canvas_position.y, Tile.TILE_RENDER_SIZE, Tile.TILE_RENDER_SIZE);
    });


    ctx.strokeStyle = "#AFA5FF"
    ctx.lineWidth = 3
    ctx.globalAlpha = 1;
    ctx.beginPath();

    let isFirst = 1;

    this.path.forEach(coord => {
      const point = map_creator.to_canvas_coordinates(coord);

      if (isFirst) {
        isFirst = 0;
        ctx.moveTo(point.x, point.y)
      } else {
        ctx.lineTo(point.x, point.y)
      }
    });
    ctx.stroke();


  }

  private setup_canvas() {
    const canvas = document.getElementById('map-canvas') as HTMLCanvasElement;
    const ctx = canvas.getContext('2d');

    if (!ctx)
      throw new Error('Canvas is Null!');

    const pageWidth = this.window.innerWidth;
    const pageHeight = this.window.innerHeight;

    const x_tiles_count = Math.ceil(pageWidth / Tile.TILE_RENDER_SIZE);
    const y_tiles_count = Math.ceil(pageHeight / Tile.TILE_RENDER_SIZE);
    canvas.width = x_tiles_count * Tile.TILE_RENDER_SIZE;
    canvas.height = y_tiles_count * Tile.TILE_RENDER_SIZE;
    return {canvas, ctx};
  }
}
