import {Component, OnInit} from '@angular/core';
import {Tile} from "../helpers/tile";
import {Canvas_Coordinates, LV95_Coordinates} from "../helpers/coordinates";
import {MapCreator} from "../helpers/map-creator";
import {MapAnimatorService} from "../services/map-animator.service";
import {combineLatest, Subscription} from "rxjs";


@Component({
  selector: 'app-display-map',
  templateUrl: './display-map.component.html',
  styleUrls: ['./display-map.component.scss'],
  providers: [
    {provide: Window, useValue: window}
  ]
})
export class DisplayMapComponent implements OnInit {

  LV95_map_center: LV95_Coordinates
  zoom_level: number;
  path_subscription: Subscription | undefined;

  constructor(private window: Window, private mapAnimator: MapAnimatorService) {

    this.LV95_map_center = {'x': 2721902.0, 'y': 1217236.6}
    this.zoom_level = 6;

  }

  ngOnInit(): void {

    this.draw_map(this.LV95_map_center).then();

    // Redraw Canvas on Changes to Path

    combineLatest([this.mapAnimator.map_center, this.mapAnimator.bbox])
      .subscribe(([map_center, bbox]) => this.draw_map(map_center, bbox));

  }


  private async draw_map(map_center: LV95_Coordinates, bbox?: [LV95_Coordinates, LV95_Coordinates]) {

    this.path_subscription?.unsubscribe();
    this.LV95_map_center = map_center;

    const {canvas, ctx} = this.setup_canvas();
    const canvas_size: Canvas_Coordinates = {'x': canvas.width, 'y': canvas.height};

    if (bbox) this.calc_zoom_level(canvas_size, bbox);

    // The base tile is the map tile which contains the LV95_map_center
    let map_creator = new MapCreator(
      this.LV95_map_center,
      this.zoom_level,
      canvas_size,
      'ch.swisstopo.pixelkarte-farbe');

    await this.draw_background_map(map_creator, ctx);

    this.path_subscription = this.mapAnimator.path.subscribe(path => this.draw_route(ctx, path, map_creator));

  }

  private async draw_background_map(map_creator: MapCreator, ctx: CanvasRenderingContext2D) {

    // Download all Tiles
    const tiles = map_creator.get_all_tiles();
    const promises = tiles.map(t => t.load_tile());
    await Promise.all(promises);

    ctx.globalAlpha = 1;
    ctx.fillStyle = "#ffffff"
    ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);

    ctx.globalAlpha = 0.2;
    tiles.forEach(t => {
      if (t.image)
        ctx.drawImage(t.image, t.canvas_position.x, t.canvas_position.y, Tile.TILE_RENDER_SIZE, Tile.TILE_RENDER_SIZE);
    });

  }

  private draw_route(ctx: CanvasRenderingContext2D, path: LV95_Coordinates[], map_creator: MapCreator) {

    ctx.strokeStyle = "#AFA5FF"
    ctx.lineWidth = 3
    ctx.globalAlpha = 1;
    ctx.beginPath();

    let isFirst = 1;

    path.forEach(coord => {
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

  private calc_zoom_level(
    canvas_size: Canvas_Coordinates,
    [min_values, max_values]: [LV95_Coordinates, LV95_Coordinates]) {

    const delta_x = max_values.x - min_values.x;
    const delta_y = max_values.y - min_values.y;

    const tiles_x = Math.floor(canvas_size.x / Tile.TILE_RENDER_SIZE);
    const tiles_y = Math.floor(canvas_size.y / Tile.TILE_RENDER_SIZE);

    this.zoom_level = 8;

    while (this.zoom_level > 0) {
      if (delta_x <= tiles_x * Tile.TILE_SIZES[this.zoom_level] &&
        delta_y <= tiles_y * Tile.TILE_SIZES[this.zoom_level]) break;
      this.zoom_level--;
    }

    console.log(this.zoom_level)


  }
}
