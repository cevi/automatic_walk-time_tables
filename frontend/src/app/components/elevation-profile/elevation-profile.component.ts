import { Component } from '@angular/core';
import { MapAnimatorService } from '../../services/map-animator.service';
import { LV95_Waypoint } from '../../helpers/coordinates';
import { graphic } from 'echarts/core';
import { combineLatest } from 'rxjs';
import { take } from 'rxjs/operators';

@Component({
  selector: 'app-elevation-profile',
  templateUrl: './elevation-profile.component.html',
  styleUrls: ['./elevation-profile.component.scss'],
  standalone: false,
})
export class ElevationProfileComponent {
  public plot_options: any = {};
  number_of_way_points: number = 0;
  number_of_pois: number = 0;

  private echartsInstance: any = null;
  private hover_snapped_poi: LV95_Waypoint | null = null;

  constructor(private mapAnimator: MapAnimatorService) {
    this.set_listeners();
  }

  public async mouseClick() {}
  public async mouseMove() {}

  private set_listeners() {
    combineLatest([this.mapAnimator.path$, this.mapAnimator.pois$]).subscribe(
      ([path, pois]) => {
        this.number_of_pois = pois.length;

        // Compute Y-axis bounds with a minimum 100m span
        let yMin = Infinity,
          yMax = -Infinity;
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
        if (!isFinite(yMin)) {
          yMin = 0;
          yMax = 100;
        }
        const span = yMax - yMin;
        if (span < 100) {
          const mid = (yMax + yMin) / 2;
          yMin = mid - 50;
          yMax = mid + 50;
        }
        yMin = Math.floor(yMin / 10) * 10;
        yMax = Math.ceil(yMax / 10) * 10;

        this.plot_options = {
          animation: false,
          tooltip: {
            trigger: 'axis',
            axisPointer: {
              animation: false,
              lineStyle: { color: '#999', type: 'dashed' },
            },
            formatter: (params: any) => {
              if (!params || params.length === 0) return '';
              const dist = Number(params[0].data[0]).toFixed(3);
              const elev = Math.round(Number(params[0].data[1]));
              let html = `<b>${dist} km</b><br/>Höhe: ${elev} m ü.M.`;
              // Check if a POI series point is present
              const poiParam = params.find((p: any) => p.seriesName === 'POI');
              if (poiParam) {
                const poiName = pois[poiParam.dataIndex]?.name;
                html += `<br/><span style="color:#d32f2f">● Wegpunkt${poiName ? ': ' + poiName : ''}</span>`;
              }
              return html;
            },
          },
          grid: {
            left: 45,
            right: 15,
            top: 15,
            bottom: 30,
          },
          xAxis: {
            type: 'value',
            axisLabel: { formatter: '{value} km' },
            max: 'dataMax',
          },
          yAxis: {
            type: 'value',
            axisLabel: { formatter: '{value}' },
            min: yMin,
            max: yMax,
            axisLine: { onZero: false },
          },
          series: [
            {
              name: 'Wanderweg',
              type: 'line',
              data: path.map((p) => [
                Number(p.accumulated_distance || 0),
                Number(p.h || 0),
              ]),
              showSymbol: false,
              itemStyle: { color: '#888' },
              lineStyle: { color: '#888', width: 2 },
              areaStyle: {
                color: new graphic.LinearGradient(0, 0, 0, 1, [
                  { offset: 0, color: 'rgba(160,160,160,0.5)' },
                  { offset: 1, color: 'rgba(160,160,160,0.1)' },
                ]),
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
              data: pois.map((p) => [
                Number(p.accumulated_distance || 0),
                Number(p.h || 0),
              ]),
              symbol: 'circle',
              symbolSize: 8,
              showSymbol: true,
            },
          ],
        };
      },
    );
  }

  public onChartInit(ec: any) {
    this.echartsInstance = ec;

    // Mousemove: just find nearest path point. Centralized move_pointer() handles POI snapping.
    ec.getZr().on('mousemove', async (params: any) => {
      const pointInPixel = [params.offsetX, params.offsetY];
      if (ec.containPixel('grid', pointInPixel)) {
        const distance = ec.convertFromPixel('grid', pointInPixel)[0];
        try {
          const coord = await this.get_coordinate_by_distance(distance);
          if (coord) this.mapAnimator.move_pointer(coord);
        } catch (e) {}
      }
    });

    // Click: use hover_snapped_poi from pointer$ to decide add vs delete
    ec.getZr().on('click', async (params: any) => {
      const pointInPixel = [params.offsetX, params.offsetY];
      if (ec.containPixel('grid', pointInPixel)) {
        if (this.hover_snapped_poi) {
          this.mapAnimator.delete_poi(this.hover_snapped_poi);
          this.hover_snapped_poi = null;
        } else {
          const distance = ec.convertFromPixel('grid', pointInPixel)[0];
          try {
            const coord = await this.get_coordinate_by_distance(distance);
            if (coord) this.mapAnimator.add_point_of_interest(coord);
          } catch (e) {}
        }
      }
    });

    ec.getZr().on('mouseout', () => {
      this.mapAnimator.move_pointer(null);
    });

    // pointer$ is the SINGLE source of truth for ECharts indicator positioning.
    // No is_echarts_hovering guard — centralized snap drives everything.
    this.mapAnimator.pointer$.subscribe((coord) => {
      if (!this.echartsInstance) return;

      if (!coord) {
        this.echartsInstance.dispatchAction({ type: 'hideTip' });
        this.echartsInstance.dispatchAction({
          type: 'downplay',
          seriesIndex: 0,
        });
        this.hover_snapped_poi = null;
      } else {
        // Track if we're snapped to a POI (for click-to-delete)
        const pois = this.mapAnimator.pois;
        this.hover_snapped_poi =
          pois.find(
            (p) =>
              p.x === coord.x &&
              p.y === coord.y &&
              p.accumulated_distance === coord.accumulated_distance,
          ) || null;

        this.mapAnimator.path$.pipe(take(1)).subscribe((path) => {
          const dataIndex = path.findIndex(
            (p) => p.accumulated_distance === coord.accumulated_distance,
          );
          if (dataIndex !== -1) {
            this.echartsInstance.dispatchAction({
              type: 'showTip',
              seriesIndex: 0,
              dataIndex: dataIndex,
            });
          }
        });
      }
    });
  }

  private async get_coordinate_by_distance(
    distance: number,
  ): Promise<LV95_Waypoint> {
    return new Promise<LV95_Waypoint>((resolve, reject) => {
      this.mapAnimator.path$.pipe(take(1)).subscribe((path) => {
        if (!path || distance == null || distance < 0) return reject();
        const way_point = path.find((p) => p.accumulated_distance >= distance);
        if (way_point) resolve(way_point);
        else reject();
      });
    });
  }
}
