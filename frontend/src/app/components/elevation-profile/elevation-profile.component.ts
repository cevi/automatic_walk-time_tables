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


  public async mouseClick() {}
  public async mouseMove() {}

  private set_listeners() {

    combineLatest([
      this.mapAnimator.path$,
      this.mapAnimator.pois$,
    ])
      .subscribe(([path, pois]) => {

        this.number_of_pois = pois.length;

        this.plot_options = {
          tooltip: {
            trigger: 'axis',
            axisPointer: { animation: false },
          },
          xAxis: {
            type: 'value',
            axisLabel: { formatter: '{value} km' }
          },
          yAxis: {
            type: 'value',
            axisLabel: { formatter: '{value}' },
            min: 'dataMin', max: 'dataMax',
            axisLine: {onZero: false}
          },
          series: [
            {
              name: 'Wanderweg',
              type: 'line',
              data: path.map(p => [Number(p.accumulated_distance || 0), Number(p.h || 0)]),
              showSymbol: false,
              itemStyle: { color: 'rgb(223,80,16)' },
              areaStyle: {
                color: new graphic.LinearGradient(0, 0, 0, 1, [
                  { offset: 0, color: 'rgb(223,80,16)' },
                  { offset: 1, color: 'rgba(223,80,16,0.2)' }
                ])
              }, smooth: true,
            },
            {
              name: 'POI',
              type: 'line',
              itemStyle: { color: 'rgba(16,102,223,0.36)' },
              data: pois.map(p => [Number(p.accumulated_distance || 0), Number(p.h || 0)]),
              symbolSize: 6,
              lineStyle: { width: 3 },
              markPoint: {
                data: pois.map(p => {
                  return {name: '', coord: [Number(p.accumulated_distance || 0), Number(p.h || 0)]}
                }),
                symbolSize: 25,
              },
            }
          ],
        };
      });
  }

  public onChartInit(ec: any) {
    ec.getZr().on('mousemove', async (params: any) => {
       const pointInPixel = [params.offsetX, params.offsetY];
       if (ec.containPixel('grid', pointInPixel)) {
          let distance = ec.convertFromPixel('grid', pointInPixel)[0];
          try {
             const coord = await this.get_coordinate_by_distance(distance);
             if (coord) this.mapAnimator.move_pointer(coord);
          } catch(e) {}
       }
    });

    ec.getZr().on('click', async (params: any) => {
       const pointInPixel = [params.offsetX, params.offsetY];
       if (ec.containPixel('grid', pointInPixel)) {
          let distance = ec.convertFromPixel('grid', pointInPixel)[0];
          try {
             const coord = await this.get_coordinate_by_distance(distance);
             if (coord) this.mapAnimator.add_point_of_interest(coord);
          } catch(e) {}
       }
    });

    ec.getZr().on('mouseout', () => {
       this.mapAnimator.move_pointer(null);
    });
  }

  private async get_coordinate_by_distance(distance: number): Promise<LV95_Waypoint> {
    return new Promise<LV95_Waypoint>((resolve, reject) => {
      this.mapAnimator.path$.pipe(take(1)).subscribe(path => {
        if (!path || distance == null || distance < 0) return reject();
        const way_point = path.find(p => p.accumulated_distance >= distance);
        if (way_point) resolve(way_point);
        else reject();
      });
    });
  }
}
