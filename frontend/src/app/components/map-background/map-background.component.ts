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

    const viewElement = document.querySelector('#view-element');

    const sizeAdjuster = document.querySelector('.size-adjuster');
    const VIEW_MODES = ['compressed-view', 'one-third-view', 'expanded-view'];
    let currentViewMode = 'compressed-view';

    if (sizeAdjuster === null || viewElement === null) return;

    sizeAdjuster.addEventListener('click', () => {

      const nextViewMode = VIEW_MODES[(VIEW_MODES.indexOf(currentViewMode) + 1) % VIEW_MODES.length];
      viewElement.classList.remove(currentViewMode);
      viewElement.classList.add(nextViewMode);
      currentViewMode = nextViewMode;

    });

    sizeAdjuster.addEventListener('mousedown', (event) => {

      console.log('mousedown');

      const startingY = (event as MouseEvent).clientY;
      console.log('startingY', startingY);

      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('touchmove', handleMouseMove);


      document.addEventListener('mouseup', () => {
        console.log('mouseup');
        document.removeEventListener('mousemove', handleMouseMove);
      });

      function handleMouseMove(event: MouseEvent | TouchEvent) {

        console.log('handleMouseMove');

        let deltaY;
        if ("clientY" in event) {
          deltaY = startingY - event.clientY;
        }
        else {
          deltaY = startingY - (event as TouchEvent).touches[0].clientY;
        }

        const currentViewModeIndex = VIEW_MODES.indexOf(currentViewMode);
        let nextViewModeIndex = currentViewModeIndex;

        if (deltaY > 20) {
          nextViewModeIndex = Math.min(currentViewModeIndex + 1, VIEW_MODES.length - 1);
        } else if (deltaY < -20) {
          nextViewModeIndex = Math.max(currentViewModeIndex - 1, 0);
        } else {
          console.log('deltaY is too small');
          return;
        }

        const nextViewMode = VIEW_MODES[nextViewModeIndex];
        viewElement?.classList.remove(currentViewMode);
        viewElement?.classList.add(nextViewMode);
        currentViewMode = nextViewMode;

        document.removeEventListener('mousemove', handleMouseMove);
      }


    });


  }


}
