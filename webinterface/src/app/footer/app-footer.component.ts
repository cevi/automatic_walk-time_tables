import { Component, OnInit } from '@angular/core';
import packageInfo from '../../../package.json';

@Component({
  selector: 'app-footer',
  templateUrl: './app-footer.component.html',
  styleUrls: ['./app-footer.component.scss']
})
export class AppFooterComponent implements OnInit {

  public version: string;

  constructor() {

    this.version = packageInfo.version;

  }

  ngOnInit(): void {
  }

}
