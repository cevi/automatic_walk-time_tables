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

    if (this.name?.includes('.gpx')) {
      this.docTypeClass = 'gpxIcon';
    } else if (this.name?.includes('.kml')) {
      this.docTypeClass = 'kmlIcon';
    }

  }

  numberToDateString(d: number): string {
    return new Date(d).toLocaleDateString()
  }


}
