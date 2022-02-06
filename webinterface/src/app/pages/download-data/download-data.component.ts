import {Component, OnInit} from '@angular/core';
import {environment} from "../../../environments/environment";
import {ActivatedRoute} from "@angular/router";

@Component({
  selector: 'app-download-data',
  templateUrl: './download-data.component.html',
  styleUrls: ['./download-data.component.scss']
})
export class DownloadDataComponent implements OnInit {

  static baseURL = environment.API_URL;
  private readonly uuid: string;

  constructor(activatedRoute: ActivatedRoute) {
    // Get UUID from the URL
    this.uuid = activatedRoute.snapshot.url[1].toString();
  }

  ngOnInit(): void {
    window.location.href = DownloadDataComponent.baseURL + 'download/' + this.uuid;
  }

}
