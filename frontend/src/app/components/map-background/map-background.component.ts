import { AfterViewInit, Component, OnInit } from '@angular/core';
import { MapAnimatorService } from '../../services/map-animator.service';
import { MapService } from '../../services/map.service';
import { Router } from '@angular/router';

@Component({
  selector: 'app-map-background',
  templateUrl: './map-background.component.html',
  styleUrls: ['./map-background.component.scss'],
  providers: [{ provide: Window, useValue: window }],
  standalone: false,
})
export class MapBackgroundComponent implements OnInit, AfterViewInit {
  public setHorizontal: boolean = true;
  public has_valid_path: boolean = false;

  constructor(
    public mapAnimator: MapAnimatorService,
    private mapService: MapService,
    private router: Router,
  ) {}

  ngOnInit(): void {
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

    this.mapService.link_animator(this.mapAnimator);

    this.mapAnimator.path$.subscribe((path) => {
      this.has_valid_path = path.length > 0;
    });

    // sets horizontal to true if the window is wider than it is tall
    this.setHorizontal = window.innerWidth > window.innerHeight;

    // set action listener for window resize
    window.addEventListener('resize', () => {
      this.setHorizontal = window.innerWidth > window.innerHeight;
      this.redrawMap();
    });
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
    this.redrawMap();
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

  toggle_drawer_guide() {
    const isGuideUrl = this.router.url.split('?')[0] === '/guide';
    if (!isGuideUrl) {
      this.router.navigate(['/guide'], { queryParamsHandling: 'preserve' });
      this.mapAnimator.drawer_open = true;
    } else {
      this.mapAnimator.drawer_open = !this.mapAnimator.drawer_open;
      if (!this.mapAnimator.drawer_open) {
        this.router.navigate(['/'], { queryParamsHandling: 'preserve' });
      }
    }
  }

  toggle_drawer_statistics() {
    const isStatisticsUrl = this.router.url.split('?')[0] === '/statistics';
    if (!isStatisticsUrl) {
      this.router.navigate(['/statistics'], {
        queryParamsHandling: 'preserve',
      });
      this.mapAnimator.drawer_open = true;
    } else {
      this.mapAnimator.drawer_open = !this.mapAnimator.drawer_open;
      if (!this.mapAnimator.drawer_open) {
        this.router.navigate(['/'], { queryParamsHandling: 'preserve' });
      }
    }
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
