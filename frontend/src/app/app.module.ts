import {NgModule} from '@angular/core';
import {BrowserModule} from '@angular/platform-browser';

import {AppRoutingModule} from './app-routing.module';
import {AppComponent} from './app.component';
import {MapBackgroundComponent} from './components/map-background/map-background.component';
import {AppFooterComponent} from './components/footer/app-footer.component';
import {BrowserAnimationsModule} from '@angular/platform-browser/animations';
import {MatLegacyInputModule as MatInputModule} from "@angular/material/legacy-input";
import {MatLegacyButtonModule as MatButtonModule} from "@angular/material/legacy-button";
import {MatLegacyProgressBarModule as MatProgressBarModule} from "@angular/material/legacy-progress-bar";
import {MatLegacySlideToggleModule as MatSlideToggleModule} from "@angular/material/legacy-slide-toggle";
import {MatLegacySliderModule as MatSliderModule} from "@angular/material/legacy-slider";
import {MatStepperModule} from "@angular/material/stepper";
import {ReactiveFormsModule} from "@angular/forms";
import {MatLegacySnackBarModule as MatSnackBarModule} from "@angular/material/legacy-snack-bar";
import {ExportSettingsComponent} from './pages/export-settings/export-settings.component';
import {UserGuideComponent} from './pages/user-guide/user-guide.component';
import {DownloadPendingComponent} from './pages/download-pending/download-pending.component';
import {DownloadDataComponent} from './pages/download-data/download-data.component';
import {UploadAreaComponent} from './components/upload-area/upload-area.component';
import {MatIconModule} from "@angular/material/icon";
import {DownloadModule} from "./modules/download-module/download.module";
import {MatLegacySelectModule as MatSelectModule} from "@angular/material/legacy-select";
import {MatLegacyOptionModule as MatOptionModule} from "@angular/material/legacy-core";
import {NgxEchartsModule} from 'ngx-echarts';
import {ElevationProfileComponent} from './components/elevation-profile/elevation-profile.component';
import {MatLegacyProgressSpinnerModule as MatProgressSpinnerModule} from "@angular/material/legacy-progress-spinner";
import {AngularSplitModule} from 'angular-split';

@NgModule({
  declarations: [
    AppComponent,
    MapBackgroundComponent,
    AppFooterComponent,
    ExportSettingsComponent,
    UserGuideComponent,
    DownloadPendingComponent,
    DownloadDataComponent,
    UploadAreaComponent,
    ElevationProfileComponent
  ],
  imports: [
    BrowserModule,
    AppRoutingModule,
    AngularSplitModule,
    BrowserAnimationsModule,
    MatInputModule,
    MatButtonModule,
    MatProgressBarModule,
    MatSlideToggleModule,
    MatSliderModule,
    MatStepperModule,
    ReactiveFormsModule,
    MatSnackBarModule,
    MatIconModule,
    DownloadModule,
    MatSelectModule,
    MatOptionModule,
    NgxEchartsModule.forRoot({
      echarts: () => import('echarts')
    }),
    MatProgressSpinnerModule
  ],
  providers: [],
  bootstrap: [AppComponent]
})
export class AppModule {
}
