import {NgModule} from '@angular/core';
import {BrowserModule} from '@angular/platform-browser';

import {AppRoutingModule} from './app-routing.module';
import {AppComponent} from './app.component';
import {MapBackgroundComponent} from './components/map-background/map-background.component';
import {AppFooterComponent} from './components/footer/app-footer.component';
import {BrowserAnimationsModule} from '@angular/platform-browser/animations';
import {MatInputModule} from "@angular/material/input";
import {MatButtonModule} from "@angular/material/button";
import {MatProgressBarModule} from "@angular/material/progress-bar";
import {MatSlideToggleModule} from "@angular/material/slide-toggle";
import {MatSliderModule} from "@angular/material/slider";
import {MatStepperModule} from "@angular/material/stepper";
import {ReactiveFormsModule} from "@angular/forms";
import {MatSnackBarModule} from "@angular/material/snack-bar";
import {ExportSettingsComponent} from './pages/export-settings/export-settings.component';
import {UserGuideComponent} from './pages/user-guide/user-guide.component';
import {DownloadPendingComponent} from './pages/download-pending/download-pending.component';
import {DownloadDataComponent} from './pages/download-data/download-data.component';
import {UploadAreaComponent} from './components/upload-area/upload-area.component';
import {MatIconModule} from "@angular/material/icon";
import {DownloadModule} from "./modules/download-module/download.module";
import {MatSelectModule} from "@angular/material/select";
import {MatOptionModule} from "@angular/material/core";
import {NgxEchartsModule} from 'ngx-echarts';

@NgModule({
  declarations: [
    AppComponent,
    MapBackgroundComponent,
    AppFooterComponent,
    ExportSettingsComponent,
    UserGuideComponent,
    DownloadPendingComponent,
    DownloadDataComponent,
    UploadAreaComponent
  ],
  imports: [
    BrowserModule,
    AppRoutingModule,
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
    })
  ],
  providers: [],
  bootstrap: [AppComponent]
})
export class AppModule {
}
