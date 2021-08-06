import {NgModule} from '@angular/core';
import {RouterModule, Routes} from '@angular/router';
import {LandingPageComponent} from './pages/landing-page/landing-page.component';
import {MarkdownModule} from 'ngx-markdown';
import {HttpClient} from '@angular/common/http';
import {DesignWalkTableComponent} from './pages/design-walk-table/design-walk-table.component';

const routes: Routes = [

  {
    path: '',
    component: LandingPageComponent
  },
  {
    path: 'planen',
    component: DesignWalkTableComponent
  }
];

@NgModule({
  imports: [
    RouterModule.forRoot(routes),
    MarkdownModule.forRoot({loader: HttpClient}),
    MarkdownModule.forChild()
  ],
  exports: [RouterModule]
})
export class AppRoutingModule {
}
