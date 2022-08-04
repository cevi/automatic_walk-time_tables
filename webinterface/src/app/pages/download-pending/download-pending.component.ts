import {Component, OnInit} from '@angular/core';
import {environment} from "../../../environments/environment";
import {ActivatedRoute, Router} from "@angular/router";
import {StatusManagerService} from 'src/app/services/status-manager.service';
import {MapAnimatorService} from "../../services/map-animator.service";
import {decode} from "@googlemaps/polyline-codec";

@Component({
  selector: 'app-download-pending',
  templateUrl: './download-pending.component.html',
  styleUrls: ['./download-pending.component.scss']
})
export class DownloadPendingComponent implements OnInit {

  static baseURL = environment.API_URL;
  private readonly uuid: string = '';

  constructor(private mapAnimator: MapAnimatorService, activatedRoute: ActivatedRoute, private router: Router, public statusManager: StatusManagerService) {
    // Get UUID from the URL
    this.uuid = activatedRoute.snapshot.url[1].toString();
  }

  ngOnInit(): void {
    this.get_status_updates();
  }

  get_status_updates() {

    const baseURL = DownloadPendingComponent.baseURL + "status/"
    let route_fetched = false;

    fetch(baseURL + this.uuid)
      .then(response => response.json())
      .then(res => {

        this.statusManager.status = res.status
        this.statusManager.status_message = res.message
        this.statusManager.last_change = res.last_change
        this.statusManager.history = res.history


        if (res?.route && !route_fetched) {

          try {

            const path = decode(res?.route, 0);
            console.log(path)

            route_fetched = true;
            this.mapAnimator.add_route(path);

          } catch (_) {
            // do nothing
          }

        }

        if ('success' == res.status) {
          this.router.navigate(['download', this.uuid]).then();
          return;
        }

        if ('error' == res.status) {
          return;
        }

        setTimeout(() => this.get_status_updates(), route_fetched ? 75 : 500);
      })
      .catch(err => this.log_network_error(err))


  }

  private log_network_error(err: Error) {
    this.statusManager.status = 'error';
    this.statusManager.status_message = 'Ein Netzwerk-Fehler ist aufgetreten, bitte versuche es erneut.'
    console.error(err);
  }


}
