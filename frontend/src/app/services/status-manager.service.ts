import {Injectable} from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class StatusManagerService {

  history: any[] = [];
  status_message: string = 'Der Export wurde gestartet, wir bitten um etwas Geduld.';
  status: string = 'unknown';
  last_change: string = '';

  constructor() {
  }
}
