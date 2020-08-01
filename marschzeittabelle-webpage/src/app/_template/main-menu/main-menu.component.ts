import {Component} from '@angular/core';
import {TemplateHeaderComponent} from '../template-header/template-header.component';
import {Router} from '@angular/router';
import {Location} from '@angular/common';

@Component({
  selector: 'app-main-menu',
  templateUrl: './main-menu.component.html',
  styleUrls: ['./main-menu.component.sass']
})
export class MainMenuComponent {


  constructor(private router: Router, private location: Location) {
  }

  public closeMenu(): void {
    TemplateHeaderComponent.showMenu();
  }


}
