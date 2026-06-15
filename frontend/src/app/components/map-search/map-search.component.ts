import { Component, OnInit } from '@angular/core';
import { FormControl } from '@angular/forms';
import {
  debounceTime,
  distinctUntilChanged,
  switchMap,
  tap,
} from 'rxjs/operators';
import {
  SwisstopoSearchService,
  SwisstopoSearchResult,
} from '../../services/swisstopo-search.service';
import { MapService } from '../../services/map.service';
import { Observable, of } from 'rxjs';
import Feature from 'ol/Feature';
import Point from 'ol/geom/Point';
import VectorSource from 'ol/source/Vector';
import VectorLayer from 'ol/layer/Vector';
import { Style, Icon } from 'ol/style';

@Component({
  selector: 'app-map-search',
  templateUrl: './map-search.component.html',
  styleUrls: ['./map-search.component.scss'],
  standalone: false,
})
export class MapSearchComponent implements OnInit {
  searchControl = new FormControl('');
  results$: Observable<SwisstopoSearchResult[]> = of([]);
  isLoading = false;
  private searchMarkerLayer: VectorLayer<any> | null = null;

  constructor(
    private searchService: SwisstopoSearchService,
    private mapService: MapService,
  ) {}

  ngOnInit() {
    this.results$ = this.searchControl.valueChanges.pipe(
      debounceTime(300),
      distinctUntilChanged(),
      tap(() => (this.isLoading = true)),
      switchMap((value) => {
        if (typeof value === 'object' && value !== null) {
          this.isLoading = false;
          return of([]);
        }

        if (!value || typeof value !== 'string' || value.length < 2) {
          this.isLoading = false;
          if (this.searchMarkerLayer) {
            const source = this.searchMarkerLayer.getSource();
            if (source) {
              source.clear();
            }
          }
          return of([]);
        }
        return this.searchService
          .searchLocations(value)
          .pipe(tap(() => (this.isLoading = false)));
      }),
    );
  }

  displayFn(result: SwisstopoSearchResult): string {
    if (!result) return '';
    // Strip HTML from label since API returns <b> tags
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = result.attrs.label;
    return tempDiv.textContent || result.attrs.label || '';
  }

  jumpToResult(result: SwisstopoSearchResult, animate: boolean = true) {
    if (!result?.attrs) return;

    const map = this.mapService.get_map();
    if (!map) return;

    // Parse bounding box from geom_st_box2d (like geoadmin web-mapviewer does)
    let extent: [number, number, number, number] | null = null;
    if (result.attrs.geom_st_box2d) {
      const match = result.attrs.geom_st_box2d.match(
        /BOX\(([0-9.]+) ([0-9.]+),([0-9.]+) ([0-9.]+)\)/,
      );
      if (match) {
        const minX = parseFloat(match[1]);
        const minY = parseFloat(match[2]);
        const maxX = parseFloat(match[3]);
        const maxY = parseFloat(match[4]);
        // Only use extent if it's a real polygon (not a point)
        if (minX !== maxX && minY !== maxY) {
          extent = [minX, minY, maxX, maxY];
        }
      }
    }

    let markerCoord: [number, number];

    if (extent) {
      // For polygon results (e.g. municipalities): zoom to fit extent
      map.getView().fit(extent, {
        duration: animate ? 1000 : 0,
        padding: [50, 50, 50, 50],
      });
      // Place marker at center of extent
      markerCoord = [(extent[0] + extent[2]) / 2, (extent[1] + extent[3]) / 2];
    } else {
      // For point results: use coordinates directly
      const easting = result.attrs.y;
      const northing = result.attrs.x;
      markerCoord = [easting, northing];

      map.getView().animate({
        center: markerCoord,
        zoom: result.attrs.zoomlevel < 100 ? result.attrs.zoomlevel : 13,
        duration: animate ? 1000 : 0,
      });
    }

    if (!this.searchMarkerLayer) {
      this.searchMarkerLayer = new VectorLayer({
        source: new VectorSource(),
        style: new Style({
          image: new Icon({
            src: `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="36" height="36"><path fill="%23D32F2F" stroke="white" stroke-width="1.5" stroke-linejoin="round" d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/></svg>`,
            anchor: [0.5, 1],
          }),
        }),
        zIndex: 1000,
      });
      map.addLayer(this.searchMarkerLayer);
    }

    const source = this.searchMarkerLayer.getSource();
    if (source) {
      source.clear();
      source.addFeature(
        new Feature({
          geometry: new Point(markerCoord),
        }),
      );
    }
  }

  onResultSelected(event: any) {
    const result: SwisstopoSearchResult = event.option.value;
    this.jumpToResult(result, true);
  }

  onOptionActivated(event: any) {
    if (event && event.option && event.option.value) {
      const result: SwisstopoSearchResult = event.option.value;
      this.jumpToResult(result, false);
    }
  }

  highlightLabel(label: string, query: string | null): string {
    if (!label) return '';

    // Strip original HTML (Swisstopo's arbitrary <b> and <i> tags)
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = label;
    let cleanText = tempDiv.textContent || label || '';

    if (!query || query.length < 2) return cleanText;

    // Highlight the actual search term input by the user
    // Escape special regex characters in the query
    const escapedQuery = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`(${escapedQuery})`, 'gi');
    return cleanText.replace(regex, '<b>$1</b>');
  }
}
