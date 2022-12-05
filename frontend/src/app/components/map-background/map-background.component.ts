import {Component, OnInit} from '@angular/core';
import {MapAnimatorService} from "../../services/map-animator.service";
import {MapService} from "../../services/map.service";

@Component({
  selector: 'app-map-background',
  templateUrl: './map-background.component.html',
  styleUrls: ['./map-background.component.scss'],
  providers: [
    {provide: Window, useValue: window}
  ]
})
export class MapBackgroundComponent implements OnInit {


  constructor(
    private mapAnimator: MapAnimatorService,
    private mapService: MapService) {
  }

  ngOnInit(): void {

    this.mapService.draw_map()
    this.mapService.link_animator(this.mapAnimator);

  }


}
