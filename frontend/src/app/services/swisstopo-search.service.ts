import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, catchError, forkJoin, map, of, throwError } from 'rxjs';

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
    // Named places (peaks, hamlets, field names) matter more than street
    // addresses when planning a hike
    gazetteer: 2, // Flurnamen, SwissNames3D
    address: 1, // Adressen
    parcel: 0, // Parzellen
  };

  // Extra bonus within the named places, by the <i>category</i> of the label
  private static readonly categoryBonus: [RegExp, number][] = [
    [/gipfel|huegel|^pass$|^grat$/i, 0.5], // Gipfel, Hauptgipfel, Haupthuegel, …
    [/^ort$|^weiler$|^alp/i, 0.3],
    [/^flurname/i, 0.1],
  ];

  static score(result: SwisstopoSearchResult): number {
    const originBonus =
      SwisstopoSearchService.originBonus[result.attrs.origin] ?? 0;
    let categoryBonus = 0;
    if (result.attrs.origin === 'gazetteer') {
      const category =
        result.attrs.label?.match(/^\s*<i>(.*?)<\/i>/i)?.[1] ?? '';
      categoryBonus =
        SwisstopoSearchService.categoryBonus.find(([re]) =>
          re.test(category),
        )?.[1] ?? 0;
    }
    return result.weight + originBonus + categoryBonus;
  }

  constructor(private http: HttpClient) {}

  searchLocations(query: string): Observable<SwisstopoSearchResult[]> {
    const defaultParams = {
      type: 'locations',
      searchText: query,
      sr: '2056',
      // otherwise the categories (<i>Zug</i>, <i>Gipfel</i>) follow the browser language
      lang: 'de',
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

    // One failing request should not hide the results of the other one
    const failed = null;
    const tolerant = (req: Observable<SwisstopoSearchResponse>) =>
      req.pipe(catchError(() => of(failed)));

    return forkJoin([tolerant(req1), tolerant(req2)]).pipe(
      map(([res1, res2]) => {
        if (res1 === failed && res2 === failed) {
          throw new Error('Swisstopo search is not available');
        }
        const combined = [...(res1?.results || []), ...(res2?.results || [])];
        return combined.sort(
          (a, b) =>
            SwisstopoSearchService.score(b) - SwisstopoSearchService.score(a),
        );
      }),
    );
  }
}
