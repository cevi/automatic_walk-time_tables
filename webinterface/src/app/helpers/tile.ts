import {Canvas_Coordinates, Tile_Coodinates} from "./coordinates";

export class Tile {

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

    const tile_coordinates = this.deep_copy(this.tile_coordinates);
    tile_coordinates.y -= 1;

    const canvas_position = this.deep_copy(this.canvas_position);
    canvas_position.y -= Tile.TILE_RENDER_SIZE;

    return new Tile(tile_coordinates, canvas_position, this.layer, this.zoom_level);

  }

  public get_tile_south() {

    const tile_coordinates = this.deep_copy(this.tile_coordinates);
    tile_coordinates.y += 1;

    const canvas_position = this.deep_copy(this.canvas_position);
    canvas_position.y += Tile.TILE_RENDER_SIZE;

    return new Tile(tile_coordinates, canvas_position, this.layer, this.zoom_level);

  }

  public get_tile_east() {

    const tile_coordinates = this.deep_copy(this.tile_coordinates);
    tile_coordinates.x += 1;

    const canvas_position = this.deep_copy(this.canvas_position);
    canvas_position.x += Tile.TILE_RENDER_SIZE;

    return new Tile(tile_coordinates, canvas_position, this.layer, this.zoom_level);

  }


  public get_tile_west() {

    const tile_coordinates = this.deep_copy(this.tile_coordinates);
    tile_coordinates.x -= 1;

    const canvas_position = this.deep_copy(this.canvas_position);
    canvas_position.x -= Tile.TILE_RENDER_SIZE;

    return new Tile(tile_coordinates, canvas_position, this.layer, this.zoom_level);

  }

  private deep_copy(obj: any) {
    return JSON.parse(JSON.stringify(obj));
  }

}
