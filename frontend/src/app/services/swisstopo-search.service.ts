import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';

export interface SwisstopoSearchResult {
  id: number;
  weight: number;
  attrs: {
    detail: string;
    featureId: string;
    label: string; // contains html <b> tags
    lat: number;
    lon: number;
    x: number; // Northing in LV95
    y: number; // Easting in LV95
    origin: string;
    zoomlevel: number;
  };
}

export interface SwisstopoSearchResponse {
  results: SwisstopoSearchResult[];
}

@Injectable({
  providedIn: 'root',
})
export class SwisstopoSearchService {
  private apiUrl = 'https://api3.geo.admin.ch/rest/services/api/SearchServer';

  constructor(private http: HttpClient) {}

  searchLocations(query: string): Observable<SwisstopoSearchResult[]> {
    const params = {
      type: 'locations',
      searchText: query,
      sr: '2056',
    };

    return this.http
      .get<SwisstopoSearchResponse>(this.apiUrl, { params })
      .pipe(map((response) => response.results || []));
  }
}
