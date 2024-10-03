import {Component, OnInit} from '@angular/core';
import {environment} from "../../../environments/environment";
import {ActivatedRoute} from "@angular/router";
import {StatusManagerService} from "../../services/status-manager.service";
import { MapAnimatorService } from 'src/app/services/map-animator.service';
import {Router} from "@angular/router";

@Component({
    selector: 'app-retrieve-data',
    templateUrl: './retrieve-data.component.html',
    styleUrls: ['/retrieve-data.component.scss']
})
export class RetrieveDataComponent implements OnInit {
    static baseURL = environment.API_URL;
    private readonly uuid: string;
    public error_message: string = '';
    
    constructor(private mapAnimator: MapAnimatorService, activatedRoute: ActivatedRoute, public statusManager: StatusManagerService, private router: Router) {
        this.uuid = activatedRoute.snapshot.url[1].toString();
    }

    ngOnInit(): void {
        this.mapAnimator.retrieve_data(this.uuid).then(() =>
            this.router.navigate(['pending', this.uuid])
        ).catch((err) => this.error_message = err);
    }
}