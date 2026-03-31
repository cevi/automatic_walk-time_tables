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

    this.mapService.link_animator(this.mapAnimator);

    this.mapAnimator.path$.subscribe((path) => {
      this.has_valid_path = path.length > 0;
    });

    // sets horizontal to true if the window is wider than it is tall
    this.setHorizontal = window.innerWidth > window.innerHeight;

    // set action listener for window resize
    window.addEventListener('resize', () => {
      this.setHorizontal = window.innerWidth > window.innerHeight;
      this.mapService?.draw_map(
        this.currentLayer,
        this.showFountains,
        this.showHaltestellen,
      );
    });
  }

  public currentLayer: string = 'pixelkarte';
  public showFountains: boolean = false;
  public showHaltestellen: boolean = false;

  ngAfterViewInit() {
    this.mapService?.draw_map(
      this.currentLayer,
      this.showFountains,
      this.showHaltestellen,
    );
  }

  setMapLayer(layer: string) {
    this.currentLayer = layer;
    this.mapService?.draw_map(layer, this.showFountains, this.showHaltestellen);
  }

  toggleFountains(event: Event) {
    event.stopPropagation();
    this.showFountains = !this.showFountains;
    this.mapService?.draw_map(
      this.currentLayer,
      this.showFountains,
      this.showHaltestellen,
    );
  }

  toggleHaltestellen(event: Event) {
    event.stopPropagation();
    this.showHaltestellen = !this.showHaltestellen;
    this.mapService?.draw_map(
      this.currentLayer,
      this.showFountains,
      this.showHaltestellen,
    );
  }

  toggle_drawer_table() {
    if (this.router.url === '/guide') {
      this.router.navigate(['/']);
      this.mapAnimator.drawer_open = true;
    } else {
      this.mapAnimator.drawer_open = !this.mapAnimator.drawer_open;
    }
  }

  toggle_drawer_guide() {
    if (this.router.url !== '/guide') {
      this.router.navigate(['/guide']);
      this.mapAnimator.drawer_open = true;
    } else {
      this.mapAnimator.drawer_open = !this.mapAnimator.drawer_open;
    }
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
