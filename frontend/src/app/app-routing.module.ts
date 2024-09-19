import {NgModule} from '@angular/core';
import {RouterModule, Routes} from '@angular/router';
import {ExportSettingsComponent} from "./pages/export-settings/export-settings.component";
import {UserGuideComponent} from "./pages/user-guide/user-guide.component";
import {DownloadPendingComponent} from "./pages/download-pending/download-pending.component";
import {DownloadDataComponent} from "./pages/download-data/download-data.component";
import {RetrieveDataComponent} from "./pages/retrieve-data/retrieve-data.component";

const routes: Routes = [
  {path: '', component: ExportSettingsComponent},
  {path: 'guide', component: UserGuideComponent},
  {path: 'pending/:uuid', component: DownloadPendingComponent},
  {path: 'download/:uuid', component: DownloadDataComponent},
  {path: 'retrieve/:uuid', component: RetrieveDataComponent},
  {path: '**', redirectTo: '/'}
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule]
})
export class AppRoutingModule {
}
