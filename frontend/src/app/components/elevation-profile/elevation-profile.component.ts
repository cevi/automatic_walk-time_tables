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

  private echartsInstance: any = null;
  private is_echarts_hovering: boolean = false;

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

        // Compute Y-axis bounds with a minimum 100m span
        let yMin = Infinity, yMax = -Infinity;
        for (const p of path) {
          const h = Number(p.h || 0);
          if (h < yMin) yMin = h;
          if (h > yMax) yMax = h;
        }
        for (const p of pois) {
          const h = Number(p.h || 0);
          if (h < yMin) yMin = h;
          if (h > yMax) yMax = h;
        }
        if (!isFinite(yMin)) { yMin = 0; yMax = 100; }
        const span = yMax - yMin;
        if (span < 100) {
          const mid = (yMax + yMin) / 2;
          yMin = mid - 50;
          yMax = mid + 50;
        }
        yMin = Math.floor(yMin / 10) * 10;
        yMax = Math.ceil(yMax / 10) * 10;

        this.plot_options = {
          tooltip: {
            trigger: 'axis',
            axisPointer: {
              animation: false,
              lineStyle: { color: '#999', type: 'dashed' },
            },
          },
          xAxis: {
            type: 'value',
            axisLabel: { formatter: '{value} km' },
            max: 'dataMax',
          },
          yAxis: {
            type: 'value',
            axisLabel: { formatter: '{value}' },
            min: yMin, max: yMax,
            axisLine: {onZero: false}
          },
          series: [
            {
              name: 'Wanderweg',
              type: 'line',
              data: path.map(p => [Number(p.accumulated_distance || 0), Number(p.h || 0)]),
              showSymbol: false,
              itemStyle: { color: '#888' },
              lineStyle: { color: '#888', width: 2 },
              areaStyle: {
                color: new graphic.LinearGradient(0, 0, 0, 1, [
                  { offset: 0, color: 'rgba(160,160,160,0.5)' },
                  { offset: 1, color: 'rgba(160,160,160,0.1)' }
                ])
              },
              smooth: true,
              emphasis: {
                itemStyle: {
                  color: '#2196F3',
                  borderColor: '#fff',
                  borderWidth: 2,
                },
              },
            },
            {
              name: 'POI',
              type: 'line',
              itemStyle: { color: '#d32f2f' },
              lineStyle: { color: '#efa038', width: 3 },
              data: pois.map(p => [Number(p.accumulated_distance || 0), Number(p.h || 0)]),
              symbol: 'circle',
              symbolSize: 8,
              showSymbol: true,
            }
          ],
        };
      });
  }

  public onChartInit(ec: any) {
    this.echartsInstance = ec;
    ec.getZr().on('mousemove', async (params: any) => {
       this.is_echarts_hovering = true;
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
       this.is_echarts_hovering = false;
       this.mapAnimator.move_pointer(null);
    });

    this.mapAnimator.pointer$.subscribe((coord) => {
       if (!this.echartsInstance || this.is_echarts_hovering) return;
       
       if (!coord) {
          this.echartsInstance.dispatchAction({ type: 'hideTip' });
          this.echartsInstance.dispatchAction({ type: 'downplay', seriesIndex: 0 });
       } else {
          this.mapAnimator.path$.pipe(take(1)).subscribe((path) => {
             const dataIndex = path.findIndex(p => p.accumulated_distance === coord.accumulated_distance);
             if (dataIndex !== -1) {
                 this.echartsInstance.dispatchAction({
                     type: 'showTip',
                     seriesIndex: 0,
                     dataIndex: dataIndex
                 });
             }
          });
       }
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
