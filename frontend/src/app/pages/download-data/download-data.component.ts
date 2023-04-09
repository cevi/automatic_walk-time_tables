import {Component, OnInit} from '@angular/core';
import {environment} from "../../../environments/environment";
import {ActivatedRoute} from "@angular/router";
import {StatusManagerService} from "../../services/status-manager.service";

@Component({
  selector: 'app-download-data',
  templateUrl: './download-data.component.html',
  styleUrls: ['./download-data.component.scss']
})
export class DownloadDataComponent implements OnInit {

  static baseURL = environment.API_URL;
  private readonly uuid: string;
  public readonly download_link: string;

  public readonly available_until: string;

  constructor(activatedRoute: ActivatedRoute, public statusManager: StatusManagerService) {
    // Get UUID from the URL
    this.uuid = activatedRoute.snapshot.url[1].toString();
    this.download_link = DownloadDataComponent.baseURL + 'download/' + this.uuid;

    // the data is available for 10 minutes
    const available_until = new Date();
    available_until.setMinutes(available_until.getMinutes() + 5);
    this.available_until = available_until.toLocaleString();

  }

  ngOnInit(): void {
    window.open(this.download_link, '_blank');
  }

}
