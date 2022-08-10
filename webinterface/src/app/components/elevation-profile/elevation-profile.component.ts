import {Component} from '@angular/core';
import {MapAnimatorService} from "../../services/map-animator.service";
import {LV95_Waypoint} from "../../helpers/coordinates";
import {graphic} from "echarts/core";
import {combineLatest} from "rxjs";
import {take} from "rxjs/operators";

@Component({
  selector: 'app-elevation-profile',
  templateUrl: './elevation-profile.component.html',
  styleUrls: ['./elevation-profile.component.scss']
})
export class ElevationProfileComponent {

  public plot_options: any = {};

  constructor(private mapAnimator: MapAnimatorService) {

    this.set_listeners();

  }


  public async mouseClick() {

    const coordinates = await this.get_current_coordinates();
    if (coordinates == null) return;

    console.log("Mouse clicked at " + coordinates.accumulated_distance);
    this.mapAnimator.add_point_of_interest(coordinates);

  }


  public async mouseMove() {

    const coordinates = await this.get_current_coordinates();
    if (coordinates == null) return;
    this.mapAnimator.move_pointer(coordinates);

  }

  private set_listeners() {

    combineLatest([
      this.mapAnimator.path$,
      this.mapAnimator.way_points$,
      this.mapAnimator.pois$,
    ])
      .subscribe(([path, way_points, pois]) => {

        console.log("Draw elevation profile");

        this.plot_options = {
          tooltip: {
            trigger: 'axis',
            axisPointer: {
              animation: false
            },
          },
          xAxis: {
            type: 'value',
            axisLabel: {
              formatter: '{value} km'
            },
          },
          yAxis: {
            type: 'value',
            axisLabel: {
              formatter: '{value}'
            },
            min: Math.floor(Math.min(...path.map(p => p.h))),
            max: Math.floor(Math.max(...path.map(p => p.h))),
            axisLine: {onZero: false}
          },
          series: [
            {
              name: 'Wanderweg',
              type: 'line',
              data: path.map(p => [p.accumulated_distance, p.h]),
              showSymbol: false,
              itemStyle: {
                color: 'rgb(223,80,16)'
              },
              areaStyle: {
                color: new graphic.LinearGradient(0, 0, 0, 1, [
                  {
                    offset: 0,
                    color: 'rgb(223,80,16)'
                  },
                  {
                    offset: 1,
                    color: 'rgba(223,80,16,0.2)'
                  }
                ])
              }, smooth: true,
            },

            {
              name: 'Wegpunkte',
              type: 'line',
              itemStyle: {
                color: 'rgba(16,102,223,0.36)'
              },
              data: way_points.map(p => [p.accumulated_distance, p.h]),
              symbolSize: 6,
              lineStyle: {
                width: 3
              },
              markPoint: {
                data: pois.map(p => {
                  return {name: '', coord: [p.accumulated_distance, p.h]}
                }),
                symbolSize: 25,
              },
            },


          ],
        };


      });


  }

  private async get_current_coordinates(): Promise<LV95_Waypoint> {

    // get element
    const chart = document.querySelector("#chart > div:nth-child(2) > div > div:nth-child(1) > div:nth-child(1)");
    let distance = parseFloat(chart?.innerHTML ? chart?.innerHTML : '0');

    return new Promise<LV95_Waypoint>((resolve, reject) => {
      this.mapAnimator.path$.pipe(take(1)).subscribe(path => {

        if (path == undefined || distance == 0)
          reject();

        // get index in this.path_elevation
        const way_point: LV95_Waypoint | undefined = path.find(p => p.accumulated_distance >= distance);

        if (way_point != undefined) resolve(way_point);
        reject();

      });
    });

  }

  mouseOut() {
    this.mapAnimator.move_pointer(null);
  }
}
