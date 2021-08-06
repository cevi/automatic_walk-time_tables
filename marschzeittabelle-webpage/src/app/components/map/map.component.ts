import {Component, Input, OnChanges, OnInit} from '@angular/core';

@Component({
  selector: 'app-map',
  templateUrl: './map.component.html',
  styleUrls: ['./map.component.sass']
})
export class MapComponent implements OnInit, OnChanges {

  @Input() public bounds;
  @Input() public showMap;

  constructor() {

    console.log('Init map');

  }

  ngOnInit(): void {
  }

  ngOnChanges(): void {

    console.log(this.showMap);

  }


}
