import {NgModule} from '@angular/core';
import {BrowserModule} from '@angular/platform-browser';

import {AppRoutingModule} from './app-routing.module';
import {AppComponent} from './app.component';
import {MapBackgroundComponent} from './components/map-background/map-background.component';
import {AppFooterComponent} from './components/footer/app-footer.component';
import {BrowserAnimationsModule} from '@angular/platform-browser/animations';
import {MatStepperModule} from "@angular/material/stepper";
import {FormsModule, ReactiveFormsModule} from "@angular/forms";
import {ExportSettingsComponent} from './pages/export-settings/export-settings.component';
import {UserGuideComponent} from './pages/user-guide/user-guide.component';
import {DownloadPendingComponent} from './pages/download-pending/download-pending.component';
import {DownloadDataComponent} from './pages/download-data/download-data.component';
import {UploadAreaComponent} from './components/upload-area/upload-area.component';
import {MatIconModule} from "@angular/material/icon";
import {DownloadModule} from "./modules/download-module/download.module";
import {NgxEchartsModule} from 'ngx-echarts';
import {ElevationProfileComponent} from './components/elevation-profile/elevation-profile.component';
import {AngularSplitModule} from 'angular-split';
import {MatInputModule} from "@angular/material/input";
import {MatButtonModule} from "@angular/material/button";
import {MatProgressBarModule} from "@angular/material/progress-bar";
import {MatSlideToggleModule} from "@angular/material/slide-toggle";
import {MatSliderModule} from "@angular/material/slider";
import {MatSnackBarModule} from "@angular/material/snack-bar";
import {MatSelectModule} from "@angular/material/select";
import {MatOptionModule} from "@angular/material/core";
import {MatProgressSpinnerModule} from "@angular/material/progress-spinner";
import {MatFormFieldModule} from "@angular/material/form-field";

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
    MatFormFieldModule,
    MatOptionModule,
    NgxEchartsModule.forRoot({
      echarts: () => import('echarts')
    }),
    MatProgressSpinnerModule,
    FormsModule
  ],
  providers: [],
  bootstrap: [AppComponent]
})
export class AppModule {
}
