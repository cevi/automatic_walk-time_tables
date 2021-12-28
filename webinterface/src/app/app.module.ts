import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';

import { AppRoutingModule } from './app-routing.module';
import { AppComponent } from './app.component';
import { DisplayMapComponent } from './display-map/display-map.component';
import { AppFooterComponent } from './footer/app-footer.component';

@NgModule({
  declarations: [
    AppComponent,
    DisplayMapComponent,
    AppFooterComponent
  ],
  imports: [
    BrowserModule,
    AppRoutingModule
  ],
  providers: [],
  bootstrap: [AppComponent]
})
export class AppModule { }
