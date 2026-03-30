import {Component} from '@angular/core';
import {MapAnimatorService} from "../../services/map-animator.service";
import {LV95_Waypoint} from "../../helpers/coordinates";
import {graphic} from "echarts/core";
import {combineLatest} from "rxjs";
import {take} from "rxjs/operators";

@Component({
    selector: 'app-elevation-profile',
    templateUrl: './elevation-profile.component.html',
    styleUrls: ['./elevation-profile.component.scss'],
    standalone: false
})
export class ElevationProfileComponent {

  public plot_options: any = {};
  number_of_way_points: number = 0;
  number_of_pois: number = 0;

  constructor(private mapAnimator: MapAnimatorService) {

    this.set_listeners();

  }


  public async mouseClick() {
    try {
      const coordinates = await this.get_current_coordinates();
      if (coordinates == null) return;
      console.log("Mouse clicked at " + coordinates.accumulated_distance);
      this.mapAnimator.add_point_of_interest(coordinates);
    } catch(e) {
      // Ignore off-chart clicks or un-initialized zones
    }
  }

  public async mouseMove() {
    try {
      const coordinates = await this.get_current_coordinates();
      if (coordinates == null) return;
      this.mapAnimator.move_pointer(coordinates);
    } catch(e) {
      // Ignore
    }
  }

  private set_listeners() {

    combineLatest([
      this.mapAnimator.path$,
      this.mapAnimator.way_points$,
      this.mapAnimator.pois$,
    ])
      .subscribe(([path, way_points, pois]) => {

        console.log("Draw elevation profile, Path Len:", path.length, "First:", path[0]?.accumulated_distance, "Last:", path[path.length-1]?.accumulated_distance);

        this.number_of_way_points = way_points.length;
        this.number_of_pois = pois.length;

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
            min: 'dataMin',
            max: 'dataMax',
            axisLine: {onZero: false}
          },
          series: [
            {
              name: 'Wanderweg',
              type: 'line',
              data: path.map(p => [Number(p.accumulated_distance || 0), Number(p.h || 0)]),
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
              data: way_points.map(p => [Number(p.accumulated_distance || 0), Number(p.h || 0)]),
              symbolSize: 6,
              lineStyle: {
                width: 3
              },
              markPoint: {
                data: pois.map(p => {
                  return {name: '', coord: [Number(p.accumulated_distance || 0), Number(p.h || 0)]}
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
