import {BrowserModule} from '@angular/platform-browser';
import {NgModule} from '@angular/core';

import {AppComponent} from './app.component';
import {TemplateHeaderComponent} from './_template/template-header/template-header.component';
import {MainMenuComponent} from './_template/main-menu/main-menu.component';
import { RouterModule} from '@angular/router';
import {TemplateFooterComponent} from './_template/template-footer/template-footer.component';
import {MatIconModule} from '@angular/material/icon';
import {HeaderNavComponent} from './_template/header-nav/header-nav.component';
import {NoopAnimationsModule} from '@angular/platform-browser/animations';
import {MatSlideToggleModule} from '@angular/material/slide-toggle';
import {MatTooltipModule} from '@angular/material/tooltip';
import {AppRoutingModule} from './app-routing.module';
import { LandingPageComponent } from './pages/landing-page/landing-page.component';
import {HttpClientModule} from '@angular/common/http';
import {MarkdownModule} from 'ngx-markdown';
import { DesignWalkTableComponent } from './pages/design-walk-table/design-walk-table.component';
import { MapComponent } from './components/map/map.component';

@NgModule({
  declarations: [
    AppComponent,
    TemplateHeaderComponent,
    MainMenuComponent,
    TemplateFooterComponent,
    HeaderNavComponent,
    LandingPageComponent,
    DesignWalkTableComponent,
    MapComponent
  ],
  imports: [
    BrowserModule,
    RouterModule,
    MarkdownModule,
    HttpClientModule,
    MatIconModule,
    NoopAnimationsModule,
    MatSlideToggleModule,
    MatTooltipModule,
    RouterModule,
    AppRoutingModule
  ],
  providers: [RouterModule],
  bootstrap: [AppComponent]
})
export class AppModule {
}
