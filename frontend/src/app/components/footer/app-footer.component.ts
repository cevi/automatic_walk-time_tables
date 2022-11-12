import {Component, OnInit} from '@angular/core';
import buildInfo from '../../../build';
import {environment} from "../../../environments/environment";

@Component({
  selector: 'app-footer',
  templateUrl: './app-footer.component.html',
  styleUrls: ['./app-footer.component.scss']
})
export class AppFooterComponent implements OnInit {

  public DOCS_URL = environment.DOCS_URL;

  public buildInfo = buildInfo;
  public buildDate;


  constructor() {

    this.buildDate = new Date(buildInfo.timestamp).toISOString().substr(0, 10) +
      ' ' + new Date(buildInfo.timestamp).toLocaleTimeString();

  }

  ngOnInit(): void {
  }

}
