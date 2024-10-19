import {Component, OnInit} from '@angular/core';
import {environment} from "../../../environments/environment";
import {ActivatedRoute} from "@angular/router";
import {StatusManagerService} from "../../services/status-manager.service";
import { Clipboard } from '@angular/cdk/clipboard';
import { MatSnackBar } from '@angular/material/snack-bar';

@Component({
  selector: 'app-download-data',
  templateUrl: './download-data.component.html',
  styleUrls: ['./download-data.component.scss']
})
export class DownloadDataComponent implements OnInit {

  static baseURL = environment.API_URL;
  private readonly uuid: string;
  public readonly download_link: string;
  public readonly retrieve_link: string;
  public readonly qr_link: string;

  public readonly available_until: string;

  constructor(activatedRoute: ActivatedRoute, public statusManager: StatusManagerService, private clipboard: Clipboard, private snackBar: MatSnackBar) {
    // Get UUID from the URL
    this.uuid = activatedRoute.snapshot.url[1].toString();
    this.download_link = DownloadDataComponent.baseURL + 'download/' + this.uuid;
    this.retrieve_link = window.location.origin + '/retrieve/' + this.uuid;
    this.qr_link = DownloadDataComponent.baseURL + 'qr/' + this.uuid;

    // the data is available for 10 minutes
    const available_until = new Date();
    available_until.setMinutes(available_until.getMinutes() + 10);
    this.available_until = available_until.toLocaleString();

  }

  ngOnInit(): void {
    window.open(this.download_link, '_blank');
  }

  copyLink(): void {
    this.clipboard.copy(this.retrieve_link);
    this.snackBar.open('Link in die Zwischenablage kopiert!', 'Schliessen', {
      duration: 2000,  // Notification lasts 2 seconds
    });
  }

}
