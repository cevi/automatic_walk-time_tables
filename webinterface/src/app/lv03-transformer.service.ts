import {Injectable} from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class LV03TransformerService {

  constructor() {
  }


  WGStoCH(lat: string, lng: string) {
    return [
      this.WGStoCHy(lat, lng),
      this.WGStoCHx(lat, lng)
    ]
  }


// Convert WGS lat/lng (° dec) to CH x
  WGStoCHx(lat: string, lng: string) {

    // Convert decimal degrees to sexagesimal seconds
    let lat_number = this.DECtoSEX(lat);
    let lng_number = this.DECtoSEX(lng);

    // Auxiliary values (% Bern)
    let lat_aux = (lat_number - 169028.66) / 10000;
    let lng_aux = (lng_number - 26782.5) / 10000;

    // Process X
    let x = 200147.07 +
      308807.95 * lat_aux +
      3745.25 * Math.pow(lng_aux, 2) +
      76.63 * Math.pow(lat_aux, 2) -
      194.56 * Math.pow(lng_aux, 2) * lat_aux +
      119.79 * Math.pow(lat_aux, 3);

    return x;
  }


// Convert WGS lat/lng (° dec) to CH y
  WGStoCHy(lat: string, lng: string) {
    // Convert decimal degrees to sexagesimal seconds
    let lat_number =  this.DECtoSEX(lat);
    let lng_number = this.DECtoSEX(lng);

    // Auxiliary values (% Bern)
    var lat_aux = (lat_number - 169028.66) / 10000;
    var lng_aux = (lng_number - 26782.5) / 10000;

    // Process Y
    let y = 600072.37 +
      211455.93 * lng_aux -
      10938.51 * lng_aux * lat_aux -
      0.36 * lng_aux * Math.pow(lat_aux, 2) -
      44.54 * Math.pow(lng_aux, 3);

    return y;
  }


// Convert angle in decimal degrees to sexagesimal seconds
  DECtoSEX(angle: string) {

    // Extract DMS
    var deg = parseInt(angle);
    let ange = parseFloat(angle);
    var min = ((ange - deg) * 60);
    var sec = (((ange - deg) * 60) - min) * 60;

    // Result sexagesimal seconds
    return sec + min * 60.0 + deg * 3600.0;

  }
}
