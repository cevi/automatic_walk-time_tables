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

@Component({
  selector: 'app-map-search',
  templateUrl: './map-search.component.html',
  styleUrls: ['./map-search.component.scss'],
  standalone: false
})
export class MapSearchComponent implements OnInit {
  searchControl = new FormControl('');
  results$: Observable<SwisstopoSearchResult[]> = of([]);
  isLoading = false;

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
        if (!value || typeof value !== 'string' || value.length < 2) {
          this.isLoading = false;
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

  onResultSelected(event: any) {
    const result: SwisstopoSearchResult = event.option.value;
    if (result && result.attrs.x && result.attrs.y) {
      // Swisstopo API returns y as Easting and x as Northing in LV95
      const easting = result.attrs.y;
      const northing = result.attrs.x;

      const map = this.mapService.get_map();
      if (map) {
        map.getView().animate({
          center: [easting, northing],
          zoom: 13,
          duration: 1000,
        });
      }
    }
  }
}
