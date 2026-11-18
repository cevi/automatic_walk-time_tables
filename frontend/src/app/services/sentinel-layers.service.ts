import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { environment } from '../../environments/environment';

/** One Sentinel-2 pass over Switzerland, as selected by the backend. */
export interface SentinelScene {
  id: string;
  datetime: string;
  /** true-colour Cloud-Optimized GeoTIFF (LV95, 10 m) hosted by swisstopo */
  url: string;
  /** share of the pass that is cloud-free (0..1) */
  clear_ratio: number;
  footprint_km2: number;
}

export interface SentinelCatalog {
  attribution: string;
  layers: SentinelScene[];
}

/** Prefix of the background layer labels, e.g. `sentinel-0` is the newest scene. */
export const SENTINEL_LAYER_PREFIX = 'sentinel-';

@Injectable({ providedIn: 'root' })
export class SentinelLayersService {
  public readonly catalog$ = new BehaviorSubject<SentinelCatalog | null>(null);

  constructor() {
    this.load();
  }

  /** Resolves a layer label like `sentinel-1` to its scene. */
  public sceneForLabel(label: string): SentinelScene | undefined {
    if (!label.startsWith(SENTINEL_LAYER_PREFIX)) return undefined;
    const index = Number(label.slice(SENTINEL_LAYER_PREFIX.length));
    return this.catalog$.value?.layers[index];
  }

  private load() {
    fetch(`${environment.API_URL}sentinel/layers`)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((catalog: SentinelCatalog) => this.catalog$.next(catalog))
      .catch((err) => {
        // the satellite images are optional, the rest of the map keeps working;
        // an empty list ends the loading indicator of a shared link to a satellite layer
        console.warn('Sentinel-2 layers unavailable:', err);
        this.catalog$.next({ attribution: '', layers: [] });
      });
  }
}
