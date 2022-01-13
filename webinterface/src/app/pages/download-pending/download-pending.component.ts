import {Component, OnInit} from '@angular/core';
import {environment} from "../../../environments/environment";
import {ActivatedRoute, Router} from "@angular/router";

@Component({
  selector: 'app-download-pending',
  templateUrl: './download-pending.component.html',
  styleUrls: ['./download-pending.component.scss']
})
export class DownloadPendingComponent implements OnInit {

  static baseURL = environment.API_URL;

  status_message: string = 'Der Export wurde gestartet, wir bitten um etwas Geduld.';
  status: string = 'unknown';
  private readonly uuid: string = '';

  constructor( activatedRoute: ActivatedRoute, private router: Router) {
    // Get UUID from the URL
    this.uuid  = activatedRoute.snapshot.url[1].toString();
  }

  ngOnInit(): void {
    this.get_status_updates();
  }

  get_status_updates() {

    const baseURL = DownloadPendingComponent.baseURL + "status/"

    fetch(baseURL + this.uuid)
      .then(response => response.json())
      .then(res => {

        this.status = res.status;
        this.status_message = res.message;

        if ('finished' == res.status) {
          this.router.navigate(['download', this.uuid]).then();
          return;
        }

        if ('error' == res.status) {
          return;
        }

        setTimeout(() => this.get_status_updates(), 500)
      })
      .catch(err => this.log_network_error(err))


  }

  private log_network_error(err: Error) {
    this.status = 'error';
    this.status_message = 'Ein Netzwerk-Fehler ist aufgetreten, bitte versuche es erneut.'
    console.error(err);
  }


}
