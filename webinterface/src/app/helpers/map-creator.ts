import {Canvas_Coordinates, Canvas_Offset, LV95_Coordinates, LV95_Offset, Tile_Coodinates} from "./coordinates";
import {Tile} from "./tile";

export class MapCreator {

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

  public get_all_tiles(): Tile[] {

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

    const x_offset = (this.LV95_center.x - 2_420_000) % Tile.TILE_SIZES[this.zoom_level];
    const y_offset = (1_350_000 - this.LV95_center.y) % Tile.TILE_SIZES[this.zoom_level];

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

  /**
   * Converts LV95_Coordinates to local canvas coordinates.
   *
   * @param coordinates
   */
  public to_canvas_coordinates(coordinates: LV95_Coordinates) {

    let x = this.base_tile.canvas_position.x - this.delta_x * Tile.TILE_RENDER_SIZE
    let y = this.base_tile.canvas_position.y - this.delta_y * Tile.TILE_RENDER_SIZE

    x += Tile.TILE_RENDER_SIZE * (coordinates.x - this.LV95_origin.x) / Tile.TILE_SIZES[this.zoom_level]
    y += Tile.TILE_RENDER_SIZE * (this.LV95_origin.y - coordinates.y) / Tile.TILE_SIZES[this.zoom_level]

    return {'x': x, 'y': y};

  }

}
