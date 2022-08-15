import {Component, OnDestroy, OnInit} from '@angular/core';
import {MapAnimatorService} from "../../services/map-animator.service";
import {Subscription} from "rxjs";
import Map from 'ol/Map';
import {MapService} from "../../services/map.service";
import {Feature} from "ol";
import {Geometry, LineString, Point} from "ol/geom";
import {Stroke, Style} from "ol/style";
import {Draw} from "ol/interaction";
import {transform} from "ol/proj";
import {VectorSourceEvent} from 'ol/source/Vector';
import {decode} from "@googlemaps/polyline-codec";

@Component({
  selector: 'app-map-background',
  templateUrl: './map-background.component.html',
  styleUrls: ['./map-background.component.scss'],
  providers: [
    {provide: Window, useValue: window}
  ]
})
export class MapBackgroundComponent implements OnInit, OnDestroy {

  path_subscription: Subscription | undefined;
  map_subscription: Subscription | undefined;


  private map: Map | undefined;

  constructor(
    private mapAnimator: MapAnimatorService,
    private mapService: MapService) {
  }

  ngOnInit(): void {

    this.mapService.draw_map()
    this.mapService.link_animator(this.mapAnimator);

    const draw = new Draw({
      source: this.mapService.path_layer_source,
      type: 'Point',
    });
    this.mapService?.addInteraction(draw);

    let coordinates: number[][] = [];
    this.mapService.path_layer_source?.on('addfeature', (event) => this.drawingHandler(coordinates, event));

  }

  private async drawingHandler(coordinates: number[][], event: VectorSourceEvent<Geometry>) {

    const point = event.feature?.getGeometry() as Point
    const coord = transform(point.getCoordinates(), 'EPSG:2056', 'EPSG:4326');
    coordinates.push([coord[1], coord[0]])

    if (coordinates.length >= 2) {

      // fetch path from valhalla/valhalla at localhost:8002 with json in url
      const url = 'http://localhost:8002/route?json=' + encodeURIComponent(JSON.stringify({
        locations: [
          {lat: coordinates[0][0], lon: coordinates[0][1]},
          {lat: coordinates[1][0], lon: coordinates[1][1]}
        ],
        costing: 'pedestrian',
        radius: 25
      }));

      // remove last two points from stack
      coordinates.shift();

      // fetch path from valhalla/valhalla at localhost:8002
      const data = await fetch(url, {method: 'POST'}).then(response => response.json());
      const shape: string = data.trip.legs[0].shape;

      const decoded_path = decode(shape, 6).map(p =>
        transform([p[1], p[0]], 'EPSG:4326', 'EPSG:2056'));

      const feature = new Feature({
        geometry: new LineString(decoded_path)
      });

      feature.setStyle(new Style({
        stroke: new Stroke({color: '#e127ae', width: 5})
      }));

      this.mapService.path_layer_source?.addFeature(feature);


    }

  }


  ngOnDestroy(): void {
    this.path_subscription?.unsubscribe();
    this.map_subscription?.unsubscribe();
  }

}
