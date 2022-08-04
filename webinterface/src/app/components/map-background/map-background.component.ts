import {Component, OnDestroy, OnInit} from '@angular/core';
import {MapAnimatorService} from "../../services/map-animator.service";
import {Subscription} from "rxjs";
import Map from 'ol/Map';
import {MapService} from "../../services/map.service";
import {Feature} from "ol";
import {Circle, LineString} from "ol/geom";
import {Stroke, Style} from "ol/style";

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

    this.map = this.mapService.getMap('pixelkarte');

    // adjust the map center to the route
    this.mapAnimator.map_center$.subscribe(center =>
      this.map?.getView().setCenter([center.x, center.y])
    );

    this.mapAnimator.path$.subscribe(path => {

      const feature = new Feature({
        geometry: new LineString(path.map(p => [p.x, p.y]))
      });

      feature.setStyle(new Style({
        stroke: new Stroke({color: '#ec9929', width: 5})
      }));

      this.mapService.getVectorSource().addFeature(feature);

    });

    this.mapAnimator.way_points$.subscribe(way_points => {

      way_points.forEach(way_point => {

        const feature = new Feature({
          geometry: new Circle([way_point.x, way_point.y], 25)
        });

        feature.setStyle(new Style({
          stroke: new Stroke({color: '#df5010', width: 5})
        }));

        this.mapService.getVectorSource().addFeature(feature);

      });


    });

  }


  ngOnDestroy(): void {
    this.path_subscription?.unsubscribe();
    this.map_subscription?.unsubscribe();
  }

}
