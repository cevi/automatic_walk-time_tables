import {AfterViewInit, Component, OnInit} from '@angular/core';
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
export class MapBackgroundComponent implements OnInit, AfterViewInit {

  public setHorizontal: boolean = true;


  constructor(
    private mapAnimator: MapAnimatorService,
    private mapService: MapService) {
  }

  ngOnInit(): void {
    this.mapService.link_animator(this.mapAnimator);

    // sets horizontal to true if the window is wider than it is tall
    this.setHorizontal = window.innerWidth > window.innerHeight;

    // set action listener for window resize
    window.addEventListener('resize', () => {
      this.setHorizontal = window.innerWidth > window.innerHeight;
      this.mapService?.draw_map();
    });

  }

  ngAfterViewInit() {
    this.mapService?.draw_map();
  }


}
