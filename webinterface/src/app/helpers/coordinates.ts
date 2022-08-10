export interface Coordinates {
  x: number;
  y: number;
}

export interface LV95_Coordinates extends Coordinates {
}

export interface LV95_Waypoint extends Coordinates {

  h: number;
  accumulated_distance: number;

}
