import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map, forkJoin } from 'rxjs';

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
    geom_st_box2d: string; // e.g. "BOX(2704430 1241465,2711666 1247104)"
  };
}

export interface SwisstopoSearchResponse {
  results: SwisstopoSearchResult[];
}

@Injectable({
  providedIn: 'root',
})
export class SwisstopoSearchService {
  // Use 'ech' service like the official geoadmin web-mapviewer
  private apiUrl = 'https://api3.geo.admin.ch/rest/services/ech/SearchServer';

  // Bonus weight for origin type (higher = more important)
  private static readonly originBonus: Record<string, number> = {
    gg25: 7, // Gemeinde / Ort
    zipcode: 6, // Postleitzahl
    kantone: 5, // Kantone
    district: 4, // Bezirke
    haltestellen: 3, // ÖV-Haltestellen (Bus/Train)
    address: 2, // Adressen
    gazetteer: 1, // Flurnamen, SwissNames3D
    parcel: 0, // Parzellen
  };

  constructor(private http: HttpClient) {}

  searchLocations(query: string): Observable<SwisstopoSearchResult[]> {
    const defaultParams = {
      type: 'locations',
      searchText: query,
      sr: '2056',
    };

    // We do two separate queries because the SearchServer limits results to 50,
    // which pushes out haltestellen when many addresses match.
    const req1 = this.http.get<SwisstopoSearchResponse>(this.apiUrl, {
      params: {
        ...defaultParams,
        origins: 'gg25,zipcode,kantone,district,address,gazetteer',
      },
    });
    const req2 = this.http.get<SwisstopoSearchResponse>(this.apiUrl, {
      params: { ...defaultParams, origins: 'haltestellen' },
    });

    return forkJoin([req1, req2]).pipe(
      map(([res1, res2]) => {
        const combined = [...(res1.results || []), ...(res2.results || [])];
        return combined.sort((a, b) => {
          const bonusA =
            SwisstopoSearchService.originBonus[a.attrs.origin] ?? 0;
          const bonusB =
            SwisstopoSearchService.originBonus[b.attrs.origin] ?? 0;
          const scoreA = a.weight + bonusA;
          const scoreB = b.weight + bonusB;
          return scoreB - scoreA;
        });
      }),
    );
  }
}
