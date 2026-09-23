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

              const surfaceNames = [
                'Naturbelag',
                'Teilw. befestigt',
                'Befestigt',
                'Unbekannt',
              ];
              let areaData: any = null;
              let surfaceLabel = 'Unbekannt';

              if (Array.isArray(params)) {
                for (const p of params) {
                  if (p.seriesName === 'Elevation Area' && p.data)
                    areaData = p.data;
                  if (
                    surfaceNames.includes(p.seriesName) &&
                    p.data &&
                    p.data[1] !== null
                  ) {
                    surfaceLabel = p.seriesName;
                  }
                }
              }
              const data = areaData || (params[0] && params[0].data);
              if (!data) return '';

              let html = `<b>${Number(data[0]).toFixed(3)} km</b><br/>Höhe: ${Math.round(Number(data[1]))} m ü.M.<br/>Belag: ${surfaceLabel}`;
              const roadName = areaData ? areaData[3] : null;
              if (roadName) html += `<br/>Detail: ${roadName}`;

              // Identify if a POI is natively hovered explicitly to render the red dot title
              const poiParam = Array.isArray(params)
                ? params.find((p: any) => p.seriesName === 'POI')
                : params.seriesName === 'POI'
                  ? params
                  : null;
              if (poiParam) {
                const poiName = pois[poiParam.dataIndex]?.name;
                html += `<br/><span style="color:#d32f2f">● Wegpunkt${poiName ? ': ' + poiName : ''}</span>`;
              }
              return html;
            },
          },
          grid: {
            top: 15,
            bottom: 60,
            left: 45,
            right: 15,
          },
          xAxis: {
            type: 'value',
            axisLabel: { formatter: '{value} km' },
            min: 0,
            max: 'dataMax',
            axisLine: { onZero: false },
          },
          yAxis: {
            type: 'value',
            axisLabel: { formatter: '{value}' },
            min: yMin,
            max: yMax,
            axisLine: { onZero: false },
          },
          legend: {
            show: true,
            bottom: 5,
            left: 'center',
            itemWidth: 14,
            itemHeight: 14,
            textStyle: { fontSize: 11, color: '#444' },
            data: [
              {
                name: 'Naturbelag',
                icon: 'rect',
                itemStyle: { color: '#9e6231' },
              },
              {
                name: 'Teilw. befestigt',
                icon: 'rect',
                itemStyle: { color: '#B38B6D' },
              },
              {
                name: 'Befestigt',
                icon: 'rect',
                itemStyle: { color: '#888888' },
              },
              {
                name: 'Unbekannt',
                icon: 'rect',
                itemStyle: { color: '#e0e0e0' },
              },
            ],
          },
          series: [
            {
              name: 'Elevation Area',
              type: 'line',
              data: path.map((p) => {
                const s = p.surface || '';
                let cat = 3;
                if (
                  [
                    'gravel',
                    'dirt',
                    'earth',
                    'path',
                    'grass',
                    'sand',
                    'wood',
                    'unpaved',
                    'impassable',
                  ].includes(s)
                ) {
                  cat = 0;
                } else if (
                  [
                    'compacted',
                    'fine_gravel',
                    'cobblestone',
                    'paving_stones',
                    'sett',
                  ].includes(s)
                ) {
                  cat = 1;
                } else if (
                  [
                    'paved_smooth',
                    'paved',
                    'paved_rough',
                    'asphalt',
                    'concrete',
                  ].includes(s)
                ) {
                  cat = 2;
                }
                return [
                  Number(p.accumulated_distance || 0),
                  Number(p.h || 0),
                  cat,
                  p.road_name || '',
                ];
              }),
              showSymbol: false,
              lineStyle: { width: 0, opacity: 0 },
              areaStyle: {
                opacity: 1,
                color: new graphic.LinearGradient(0, 0, 0, 1, [
                  { offset: 0, color: 'rgba(160,160,160,0.5)' },
                  { offset: 1, color: 'rgba(160,160,160,0.1)' },
                ]),
              },
              smooth: true,
              z: 1,
              silent: true,
            },
            // Generate one line series per surface category (split-series approach)
            // This is the only reliable way to color line segments in ECharts
            // when the color dimension is not an axis dimension.
            ...(() => {
              const surfaceConfig: {
                name: string;
                color: string;
                match: string[];
              }[] = [
                {
                  name: 'Naturbelag',
                  color: '#9e6231',
                  match: [
                    'gravel',
                    'dirt',
                    'earth',
                    'path',
                    'grass',
                    'sand',
                    'wood',
                    'unpaved',
                    'impassable',
                  ],
                },
                {
                  name: 'Teilw. befestigt',
                  color: '#B38B6D',
                  match: [
                    'compacted',
                    'fine_gravel',
                    'cobblestone',
                    'paving_stones',
                    'sett',
                  ],
                },
                {
                  name: 'Befestigt',
                  color: '#888888',
                  match: [
                    'paved_smooth',
                    'paved',
                    'paved_rough',
                    'asphalt',
                    'concrete',
                  ],
                },
                { name: 'Unbekannt', color: '#e0e0e0', match: [] },
              ];

              // Classify each path point
              const classified = path.map((p) => {
                const s = p.surface || '';
                for (let ci = 0; ci < surfaceConfig.length - 1; ci++) {
                  if (surfaceConfig[ci].match.includes(s)) return ci;
                }
                return 3; // Unbekannt
              });

              return surfaceConfig.map((cfg, catIdx) => ({
                name: cfg.name,
                type: 'line' as const,
                data: path.map((p, i) => {
                  // Include this point if it matches, or if the adjacent point matches
                  // (boundary overlap prevents gaps)
                  const isMine = classified[i] === catIdx;
                  const prevIsMine = i > 0 && classified[i - 1] === catIdx;
                  const nextIsMine =
                    i < classified.length - 1 && classified[i + 1] === catIdx;
                  if (isMine || prevIsMine || nextIsMine) {
                    return [
                      Number(p.accumulated_distance || 0),
                      Number(p.h || 0),
                    ];
                  }
                  return [Number(p.accumulated_distance || 0), null];
                }),
                showSymbol: false,
                lineStyle: { color: cfg.color, width: 3 },
                itemStyle: { color: cfg.color },
                smooth: true,
                z: 2,
                connectNulls: false,
                emphasis: {
                  itemStyle: {
                    color: '#2196F3',
                    borderColor: '#fff',
                    borderWidth: 2,
                  },
                },
              }));
            })(),
            {
              name: 'POI',
              type: 'line',
              z: 3,
              itemStyle: { color: '#d32f2f' },
              lineStyle: { color: '#efa038', width: 3 },
              data: pois.map((p) => [
                Number(p.accumulated_distance || 0),
                Number(p.h || 0),
              ]),
              symbol: 'circle',
              symbolSize: 8,
              showSymbol: true,
              emphasis: {
                itemStyle: {
                  color: '#2196F3',
                  borderColor: '#fff',
                  borderWidth: 2,
                },
                scale: true,
              },
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
          seriesIndex: 5,
        });
        this.hover_snapped_poi = null;
      } else {
        // Track if we're snapped to a POI (for click-to-delete)
        const pois = this.mapAnimator.pois;
        const snappedPoi =
          pois.find(
            (p) =>
              p.x === coord.x &&
              p.y === coord.y &&
              p.accumulated_distance === coord.accumulated_distance,
          ) || null;
        this.hover_snapped_poi = snappedPoi;

        // Highlight snapped POI in blue on the chart
        if (snappedPoi) {
          const poiIndex = pois.indexOf(snappedPoi);
          this.echartsInstance.dispatchAction({
            type: 'downplay',
            seriesIndex: 5,
          });
          this.echartsInstance.dispatchAction({
            type: 'highlight',
            seriesIndex: 5,
            dataIndex: poiIndex,
          });
        } else {
          this.echartsInstance.dispatchAction({
            type: 'downplay',
            seriesIndex: 5,
          });
        }

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
