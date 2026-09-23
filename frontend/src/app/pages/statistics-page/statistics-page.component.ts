import { Component, OnInit } from '@angular/core';
import {
  RouteApiService,
  RouteGenerationStatistics,
} from '../../services/route-api.service';

@Component({
  selector: 'app-statistics-page',
  templateUrl: './statistics-page.component.html',
  styleUrls: ['./statistics-page.component.scss'],
  standalone: false,
})
export class StatisticsPageComponent implements OnInit {
  public readonly defaultDays = 30;
  public statistics: RouteGenerationStatistics | null = null;
  public plotOptions: Record<string, unknown> = {};
  public isLoading = true;
  public errorMessage = '';
  public activeDays = 0;

  constructor(private routeApiService: RouteApiService) {}

  ngOnInit(): void {
    void this.loadStatistics();
  }

  public async refresh(): Promise<void> {
    await this.loadStatistics();
  }

  public get totalLengthKm(): string {
    return ((this.statistics?.totalLengthM ?? 0) / 1000).toFixed(1);
  }

  private async loadStatistics(): Promise<void> {
    this.isLoading = true;
    this.errorMessage = '';

    try {
      const statistics =
        await this.routeApiService.getRouteGenerationStatistics(
          this.defaultDays,
        );
      this.statistics = statistics;
      this.activeDays = statistics.dailyStats.filter(
        (entry) => entry.routesCount > 0,
      ).length;
      this.plotOptions = this.buildPlotOptions(statistics);
    } catch (error) {
      console.error(error);
      this.errorMessage = 'Die Statistiken konnten nicht geladen werden.';
      this.statistics = null;
      this.activeDays = 0;
      this.plotOptions = {};
    } finally {
      this.isLoading = false;
    }
  }

  private buildPlotOptions(
    statistics: RouteGenerationStatistics,
  ): Record<string, unknown> {
    const labels = statistics.dailyStats.map((entry) => entry.date.slice(5));
    const routeCounts = statistics.dailyStats.map((entry) => entry.routesCount);
    const totalLengthsKm = statistics.dailyStats.map((entry) =>
      Number((entry.totalLengthM / 1000).toFixed(1)),
    );
    const maxRoutes = Math.max(...routeCounts, 1);

    return {
      animationDuration: 250,
      color: ['#1d6f8c', '#e39b2d'],
      tooltip: {
        trigger: 'axis',
        axisPointer: {
          type: 'shadow',
        },
      },
      legend: {
        bottom: 0,
      },
      grid: {
        top: 24,
        left: 36,
        right: 24,
        bottom: 52,
      },
      xAxis: {
        type: 'category',
        data: labels,
        axisLabel: {
          rotate: labels.length > 14 ? 45 : 0,
        },
      },
      yAxis: [
        {
          type: 'value',
          name: 'Routen',
          minInterval: 1,
          max: Math.max(maxRoutes, 1),
        },
        {
          type: 'value',
          name: 'km',
          splitLine: {
            show: false,
          },
        },
      ],
      series: [
        {
          name: 'Routen pro Tag',
          type: 'bar',
          barMaxWidth: 26,
          data: routeCounts,
          itemStyle: {
            borderRadius: [6, 6, 0, 0],
          },
        },
        {
          name: 'Geplante Strecke pro Tag',
          type: 'line',
          yAxisIndex: 1,
          smooth: true,
          symbolSize: 7,
          data: totalLengthsKm,
        },
      ],
    };
  }
}
