import {
  AfterViewInit,
  Component,
  OnInit,
  ChangeDetectionStrategy,
} from '@angular/core';
import { MapAnimatorService } from '../../services/map-animator.service';
import { MapService } from '../../services/map.service';
import { NavigationEnd, Router } from '@angular/router';
import { MatDialog, MatDialogRef } from '@angular/material/dialog';
import { filter } from 'rxjs';
import { UserGuideComponent } from '../../pages/user-guide/user-guide.component';
import { StatisticsPageComponent } from '../../pages/statistics-page/statistics-page.component';

type Overlay = 'guide' | 'statistics';

const OVERLAYS: Record<Overlay, any> = {
  guide: UserGuideComponent,
  statistics: StatisticsPageComponent,
};
import {
  SENTINEL_LAYER_PREFIX,
  SentinelLayersService,
  SentinelScene,
} from '../../services/sentinel-layers.service';

@Component({
  selector: 'app-map-background',
  templateUrl: './map-background.component.html',
  styleUrls: ['./map-background.component.scss'],
  providers: [{ provide: Window, useValue: window }],
  changeDetection: ChangeDetectionStrategy.Eager,
  standalone: false,
})
export class MapBackgroundComponent implements OnInit, AfterViewInit {
  public setHorizontal: boolean = true;
  // size of the drawer (control area) in pixels, along the split direction
  public drawerSize: number = 450;
  public has_valid_path: boolean = false;

  constructor(
    public mapAnimator: MapAnimatorService,
    private mapService: MapService,
    private router: Router,
    private sentinelLayers: SentinelLayersService,
    private dialog: MatDialog,
  ) {}

  /** the guide or the statistics, shown as a dialog over the map */
  private overlay: Overlay | null = null;
  private overlayRef: MatDialogRef<unknown> | null = null;

  /** newest first; selectable as `sentinel-<index>` */
  public sentinelScenes: SentinelScene[] = [];
  /** the Sentinel-2 background is still loading */
  public sentinelLoading = false;
  private viewInitialized = false;

  ngOnInit(): void {
    // the URL decides which dialog is open, so links and the back button work
    this.router.events
      .pipe(filter((e) => e instanceof NavigationEnd))
      .subscribe(() => this.syncOverlay());
    this.syncOverlay();

    const url = new URL(window.location.href);
    const bgLayerUrl = url.searchParams.get('bgLayer');
    if (bgLayerUrl) {
      this.currentLayer = bgLayerUrl;
    }

    const metaLayersUrl = url.searchParams.get('metaLayers');
    if (metaLayersUrl) {
      const layers = metaLayersUrl.split(',');
      if (layers.includes('fountains')) this.showFountains = true;
      if (layers.includes('haltestellen')) this.showHaltestellen = true;
      if (layers.includes('hangneigung')) this.showHangneigung = true;
      if (layers.includes('wanderwege')) this.showWanderwege = true;
      if (layers.includes('sperrungen')) this.showSperrungen = true;
      if (layers.includes('schutzgebiete')) this.showSchutzgebiete = true;
      if (layers.includes('schiessanzeigen')) this.showSchiessanzeigen = true;
      if (layers.includes('herdenschutzhunde'))
        this.showHerdenschutzhunde = true;
      if (layers.includes('notfall')) this.showNotfall = true;
      if (layers.includes('feuerstellen')) this.showFeuerstellen = true;
      if (layers.includes('shelter')) this.showShelter = true;
    }

    (window as any).mapService = this.mapService;
    this.mapService.link_animator(this.mapAnimator);

    this.mapAnimator.path$.subscribe((path) => {
      this.has_valid_path = path.length > 0;
    });

    this.mapService.sentinelLoading$.subscribe(
      (loading) => (this.sentinelLoading = loading),
    );

    this.sentinelLayers.catalog$.subscribe((catalog) => {
      this.sentinelScenes = catalog?.layers ?? [];
      // a shared link may select a satellite layer before the list has loaded
      if (
        this.viewInitialized &&
        this.currentLayer.startsWith(SENTINEL_LAYER_PREFIX)
      )
        this.redrawMap();
    });

    this.updateLayout();

    // set action listener for window resize
    window.addEventListener('resize', () => {
      const wasHorizontal = this.setHorizontal;
      this.updateLayout();
      // switching the split direction re-creates the map canvas
      if (wasHorizontal !== this.setHorizontal) this.redrawMap();
    });
  }

  private updateLayout() {
    // place the drawer to the right if the window is wider than it is tall,
    // otherwise below the map (e.g. phones in portrait mode)
    this.setHorizontal = window.innerWidth > window.innerHeight;
    this.drawerSize = this.setHorizontal
      ? Math.min(450, Math.round(window.innerWidth / 2))
      : Math.round(window.innerHeight * 0.55);
  }

  public currentLayer: string = 'pixelkarte';
  public showFountains: boolean = false;
  public showHaltestellen: boolean = false;
  public showHangneigung: boolean = false;
  public showWanderwege: boolean = false;
  public showSperrungen: boolean = false;
  public showSchutzgebiete: boolean = false;
  public showSchiessanzeigen: boolean = false;
  public showHerdenschutzhunde: boolean = false;
  public showNotfall: boolean = false;
  public showFeuerstellen: boolean = false;
  public showShelter: boolean = false;

  public mapOpacities: Record<string, number> = {
    hangneigung: 0.35,
  };
  public mapSaturations: Record<string, number> = {
    pixelkarte: 0.85,
  };
  public expandedSettings: string | null = null;

  private saveStateToUrl() {
    const url = new URL(window.location.href);
    url.searchParams.set('bgLayer', this.currentLayer);

    const metaLayers = [];
    if (this.showFountains) metaLayers.push('fountains');
    if (this.showHaltestellen) metaLayers.push('haltestellen');
    if (this.showHangneigung) metaLayers.push('hangneigung');
    if (this.showWanderwege) metaLayers.push('wanderwege');
    if (this.showSperrungen) metaLayers.push('sperrungen');
    if (this.showSchutzgebiete) metaLayers.push('schutzgebiete');
    if (this.showSchiessanzeigen) metaLayers.push('schiessanzeigen');
    if (this.showHerdenschutzhunde) metaLayers.push('herdenschutzhunde');
    if (this.showNotfall) metaLayers.push('notfall');
    if (this.showFeuerstellen) metaLayers.push('feuerstellen');
    if (this.showShelter) metaLayers.push('shelter');

    if (metaLayers.length > 0) {
      url.searchParams.set('metaLayers', metaLayers.join(','));
    } else {
      url.searchParams.delete('metaLayers');
    }

    window.history.replaceState({}, '', url.toString());
  }

  private redrawMap() {
    this.saveStateToUrl();

    this.mapService?.draw_map(
      this.currentLayer,
      {
        fountains: this.showFountains,
        haltestellen: this.showHaltestellen,
        hangneigung: this.showHangneigung,
        wanderwege: this.showWanderwege,
        sperrungen: this.showSperrungen,
        schutzgebiete: this.showSchutzgebiete,
        schiessanzeigen: this.showSchiessanzeigen,
        herdenschutzhunde: this.showHerdenschutzhunde,
        notfall: this.showNotfall,
        feuerstellen: this.showFeuerstellen,
        shelter: this.showShelter,
      },
      'map-canvas',
      this.mapOpacities,
      this.mapSaturations,
    );
  }

  ngAfterViewInit() {
    this.viewInitialized = true;
    this.redrawMap();
  }

  isSentinelLayer(): boolean {
    return this.currentLayer.startsWith(SENTINEL_LAYER_PREFIX);
  }

  selectedSentinelScene(): SentinelScene | undefined {
    return this.sentinelLayers.sceneForLabel(this.currentLayer);
  }

  setMapLayer(layer: string) {
    this.currentLayer = layer;
    this.redrawMap();
  }

  toggleFountains(event: Event) {
    event.stopPropagation();
    this.showFountains = !this.showFountains;
    this.redrawMap();
  }

  toggleHaltestellen(event: Event) {
    event.stopPropagation();
    this.showHaltestellen = !this.showHaltestellen;
    this.redrawMap();
  }

  toggleHangneigung(event: Event) {
    event.stopPropagation();
    this.showHangneigung = !this.showHangneigung;
    this.redrawMap();
  }

  toggleWanderwege(event: Event) {
    event.stopPropagation();
    this.showWanderwege = !this.showWanderwege;
    this.redrawMap();
  }

  toggleSperrungen(event: Event) {
    event.stopPropagation();
    this.showSperrungen = !this.showSperrungen;
    this.redrawMap();
  }

  toggleSchutzgebiete(event: Event) {
    event.stopPropagation();
    this.showSchutzgebiete = !this.showSchutzgebiete;
    this.redrawMap();
  }

  toggleSchiessanzeigen(event: Event) {
    event.stopPropagation();
    this.showSchiessanzeigen = !this.showSchiessanzeigen;
    this.redrawMap();
  }

  toggleHerdenschutzhunde(event: Event) {
    event.stopPropagation();
    this.showHerdenschutzhunde = !this.showHerdenschutzhunde;
    this.redrawMap();
  }

  toggleNotfall(event: Event) {
    event.stopPropagation();
    this.showNotfall = !this.showNotfall;
    this.redrawMap();
  }

  toggleFeuerstellen(event: Event) {
    event.stopPropagation();
    this.showFeuerstellen = !this.showFeuerstellen;
    this.redrawMap();
  }

  toggleShelter(event: Event) {
    event.stopPropagation();
    this.showShelter = !this.showShelter;
    this.redrawMap();
  }

  toggle_drawer_table() {
    if (this.mapAnimator.app_mode === 'table') {
      this.setAppMode('edit');
    } else {
      this.setAppMode('table');
    }
  }

  setAppMode(mode: 'view' | 'edit' | 'table') {
    this.mapAnimator.setAppMode(mode);
  }

  private currentOverlay(): Overlay | null {
    const path = this.router.url.split(/[?#]/)[0];
    if (path === '/guide') return 'guide';
    if (path === '/statistics') return 'statistics';
    return null;
  }

  private syncOverlay() {
    const wanted = this.currentOverlay();
    if (wanted === this.overlay) return;

    this.overlay = wanted;
    this.overlayRef?.close();
    this.overlayRef = null;
    if (!wanted) return;

    const ref = this.dialog.open(OVERLAYS[wanted], {
      panelClass: 'info-dialog',
      width: '760px',
      maxWidth: '100vw',
      autoFocus: 'dialog',
      ariaLabelledBy: 'info-dialog-title',
    });
    this.overlayRef = ref;
    ref.afterClosed().subscribe(() => {
      // closed with the button, Esc or a click outside: leave the URL
      if (this.overlayRef === ref) {
        this.overlayRef = null;
        this.overlay = null;
        this.router.navigate(['/'], { queryParamsHandling: 'preserve' });
      }
    });
  }

  private toggleOverlay(overlay: Overlay) {
    const target = this.currentOverlay() === overlay ? '/' : '/' + overlay;
    this.router.navigate([target], { queryParamsHandling: 'preserve' });
  }

  toggle_drawer_guide() {
    this.toggleOverlay('guide');
  }

  toggle_drawer_statistics() {
    this.toggleOverlay('statistics');
  }

  handleToggle(event: Event, layerMethodName: string) {
    const fnName = ('toggle' + layerMethodName) as keyof MapBackgroundComponent;
    const fn = this[fnName];
    if (typeof fn === 'function') {
      (fn as Function).call(this, event);
    }
  }

  handleSettingsClick(layerKey: string, event: Event) {
    event.stopPropagation();
    event.preventDefault();
    if (this.expandedSettings === layerKey) {
      this.expandedSettings = null;
    } else {
      this.expandedSettings = layerKey;
    }
  }

  getOpacity(layerKey: string): number {
    return this.mapOpacities[layerKey] ?? 1.0;
  }

  setOpacity(layerKey: string, value: string | number) {
    const numericValue = typeof value === 'string' ? parseFloat(value) : value;
    this.mapOpacities[layerKey] = numericValue;
    this.mapService?.updateLayerOpacity(layerKey, numericValue);
  }

  getSaturation(layerKey: string): number {
    return this.mapSaturations[layerKey] ?? 1.0;
  }

  setSaturation(layerKey: string, value: string | number) {
    const numericValue = typeof value === 'string' ? parseFloat(value) : value;
    this.mapSaturations[layerKey] = numericValue;
    this.mapService?.updateLayerSaturation(layerKey, numericValue);
  }

  triggerUpload() {
    document.getElementById('gpx_upload_input')?.click();
  }

  onFileSelected(event: any) {
    const file: File = event.target.files[0];
    if (file) {
      this.mapAnimator
        .replace_route(file)
        .then(() => {
          this.mapAnimator.drawer_open = true;
        })
        .catch((err) => {
          console.error('Failed to parse route:', err);
          alert('Fehler beim Verarbeiten der GPX/KML-Datei.');
        });
    }
    event.target.value = '';
  }
}
