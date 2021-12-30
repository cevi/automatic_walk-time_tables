export interface Coordinates {
  x: number;
  y: number;
}

export interface LV95_Coordinates extends Coordinates {
}

export interface Canvas_Coordinates extends Coordinates {
}

export interface Tile_Coodinates extends Coordinates {
}

export interface Canvas_Offset extends Canvas_Coordinates {
}

export interface LV95_Offset extends LV95_Coordinates {
}
