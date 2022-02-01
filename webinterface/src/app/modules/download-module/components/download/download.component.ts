import {Component, Input, OnInit} from '@angular/core';

@Component({
  selector: 'app-download',
  templateUrl: './download.component.html',
  styleUrls: ['./download.component.sass']
})
export class DownloadComponent implements OnInit {

  @Input() public changeDate: number | undefined;
  @Input() public name: string | undefined;

  public docTypeClass = '';

  constructor() {
  }

  ngOnInit() {

    this.docTypeClass = 'gpxIcon';

  }

  numberToDateString(d: number): string {
    return new Date(d).toLocaleDateString()
  }


}
