import {Component, OnInit} from '@angular/core';
// @ts-ignore
import { version, copyrights } from '../../../../package.json';

@Component({
  selector: 'app-template-footer',
  templateUrl: './template-footer.component.html',
  styleUrls: ['./template-footer.component.sass']
})
export class TemplateFooterComponent implements OnInit {

  public version: string = version;
  public copyrights: string = copyrights;

  constructor() {
  }

  ngOnInit(): void {
  }

}
