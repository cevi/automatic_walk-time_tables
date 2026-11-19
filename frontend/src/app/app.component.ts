import { Component, ChangeDetectionStrategy } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { filter } from 'rxjs';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss'],
  changeDetection: ChangeDetectionStrategy.Eager,
  standalone: false,
})
export class AppComponent {
  /**
   * The route panel ('/', also below the guide and statistics dialogs) shows the footer itself, above its
   * download bar, which stays at the bottom of the drawer.
   */
  public showFooter = true;

  constructor(router: Router) {
    router.events
      .pipe(filter((e) => e instanceof NavigationEnd))
      .subscribe((e) => {
        const path = (e as NavigationEnd).urlAfterRedirects.split(/[?#]/)[0];
        this.showFooter = !['/', '/guide', '/statistics'].includes(path);
      });
  }
}
