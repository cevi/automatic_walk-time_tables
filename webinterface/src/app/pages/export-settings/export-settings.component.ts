import {Component, OnInit} from '@angular/core';
import {environment} from "../../../environments/environment";
import {FormBuilder, FormControl, FormGroup} from "@angular/forms";
import {MapAnimatorService} from "../../services/map-animator.service";
import {Router} from "@angular/router";
import {decode, encode, LatLngTuple} from "@googlemaps/polyline-codec";
import {graphic} from "echarts/core";

@Component({
  selector: 'app-export-settings',
  templateUrl: './export-settings.component.html',
  styleUrls: ['./export-settings.component.scss']
})
export class ExportSettingsComponent implements OnInit {

  static baseURL = environment.API_URL;
  uuid: string = '';

  options: FormGroup;
  route_uploaded: boolean = false;
  public route_file: File | undefined = undefined;

  public plot_options: any = {};
  private elevation_data: string | undefined;
  private path_elevation: number[][] | undefined;
  private path: LatLngTuple[] | undefined;
  private pois: string = '';


  constructor(private mapAnimator: MapAnimatorService, fb: FormBuilder, private router: Router) {

    this.options = fb.group({
      'velocity': new FormControl(4.5),
      'map-scaling': new FormControl(25_000),
      'departure-time': new FormControl((new Date()).toISOString().substring(0, 16)),
      'creator-name': new FormControl(''),
      'create-map-pdfs': new FormControl(true),
      'create-excel': new FormControl(true),
      'legend-position': new FormControl('lower right'),
      'map-layers': new FormControl('ch.swisstopo.pixelkarte-farbe'),
      'auto-scale': new FormControl(false),
    });


    // we need this try-catch block to ensure the loaded data is compatible with the current form layout
    try {

      if (localStorage['form_values'] && this.isJsonString(localStorage['form_values'])) {
        this.options.setValue(JSON.parse(localStorage['form_values']))
        console.log('Loaded form values from local storage')
      }

    } catch (_) {
      // safe to ignore
    }


  }

  isJsonString(str: string): boolean {
    try {
      JSON.parse(str);
    } catch (e) {
      return false;
    }
    return true;
  }

  ngOnInit(): void {
  }


  async download_map() {

    localStorage['form_values'] = JSON.stringify(this.options.value);

    if (!this.route_uploaded || !this.route_file)
      return

    // minify XML data
    let xml_string = (await this.route_file.text()).toString()
    xml_string = xml_string.replace(/>\s*/g, '>');  // Remove space after >
    xml_string = xml_string.replace(/\s*</g, '<');  // Remove space before <

    let formData = new FormData();
    formData.append("options", JSON.stringify({
      'file_type': this.route_file.name.split('.').pop()
    }));
    formData.append("file_content", xml_string);

    let url = ExportSettingsComponent.baseURL + 'create?';
    url += '--list-of-pois=' + this.pois + 'create-elevation-profile';
    for (const option in this.options.controls) {

      if (['creator-name'].includes(option) && !this.options.controls[option].value.length)
        continue;

      if (option === 'map-scaling' && this.options.controls['auto-scale'].value)
        continue;

      if (option === 'auto-scale')
        continue;

      console.log(this.options.controls[option].value)
      url += '&--' + option + '=' + this.options.controls[option].value.toString().replaceAll('\n', ';')

    }


    fetch(url, {
      method: "POST",
      headers: {
        ContentType: 'multipart/form-data',
        Accept: 'application/json',
      },
      body: formData
    })
      .then(response => response.text())
      .then((resp: any) => {
        const response = JSON.parse(resp)
        this.uuid = response['uuid'];
      })
      .finally(() => this.router.navigate(['pending', this.uuid]));

  }


  new_route_uploaded(route_file: File) {

    this.route_uploaded = true;
    this.route_file = route_file

    this.fetch_route().then();

  }


  delete_route_file() {

    this.route_uploaded = false;

  }

  async fetch_route() {

    if (!this.route_uploaded || !this.route_file)
      return

    // minify XML data
    let xml_string = (await this.route_file.text()).toString()
    xml_string = xml_string.replace(/>\s*/g, '>');  // Remove space after >
    xml_string = xml_string.replace(/\s*</g, '<');  // Remove space before <

    let formData = new FormData();
    formData.append("options", JSON.stringify({
      'encoding': 'polyline',
      'file_type': this.route_file.name.split('.').pop()
    }));
    formData.append("file_content", xml_string);

    let url = ExportSettingsComponent.baseURL + 'parse_route';

    fetch(url, {
      method: "POST",
      headers: {
        ContentType: 'multipart/form-data',
        Accept: 'application/json',
      },
      body: formData
    })
      .then(response => response.json())
      .then((resp: any) => {
        console.log(resp)
        const path = decode(resp?.route, 0);
        this.mapAnimator.add_route(path).then();

        this.elevation_data = resp?.elevation_data;
        console.log(this.elevation_data)
      });

  }

  async create_walk_time_table() {

    console.log('Creating walk time table')

    let path = this.mapAnimator.path;

    if (path == undefined) {
      console.error('No path found')
      return;
    }

    let data: any = {
      'encoding': 'polyline',
      'route': encode(path.map(pkt => [pkt.x, pkt.y]), 0),
      'pois': this.pois,
    };

    if (this.elevation_data) {
      data.elevation_data = this.elevation_data;
    }

    let formData = new FormData();
    formData.append("options", JSON.stringify(data));

    fetch(ExportSettingsComponent.baseURL + 'create-walk-time-table', {
      method: "POST",
      headers: {
        ContentType: 'application/json',
        Accept: 'application/json',
      },
      body: formData
    })
      .then(response => response.json())
      .then((resp: any) => {
        console.log(resp)

        const selected_way_points = decode(resp?.selected_way_points, 0);
        this.mapAnimator.add_way_points(selected_way_points);

        let selected_way_points_elevation: number[][] = decode(resp?.selected_way_points_elevation, 0);
        this.elevation_data = resp?.path_elevation;
        this.path_elevation = decode(resp?.path_elevation, 0);
        let pois_elevation: number[][] = decode(resp?.pois_elevation, 0);

        this.path = decode(resp?.path, 0);
        this.mapAnimator.add_route(this.path)

        selected_way_points_elevation = selected_way_points_elevation.map((pkt: number[]) => [pkt[0] / 1_000, pkt[1]])
        this.path_elevation = this.path_elevation.map((pkt: number[]) => [pkt[0] / 1_000, pkt[1]])
        pois_elevation = pois_elevation.map((pkt: number[]) => [pkt[0] / 1_000, pkt[1]])


        let markPointsData: { name: string; coord: number[]; }[] = [];

        pois_elevation.forEach(poi => {
          markPointsData.push({
            name: 'Point of Interest',
            coord: [poi[0], poi[1]]
          });
        });

        this.plot_options = {
          tooltip: {
            trigger: 'axis',
            axisPointer: {
              animation: false
            },
          },
          xAxis: {
            type: 'value',
            axisLabel: {
              formatter: '{value} km'
            },
          },
          yAxis: {
            type: 'value',
            axisLabel: {
              formatter: '{value}'
            },
            min: Math.floor(Math.min(...this.path_elevation.map(pkt => pkt[1]))),
            max: Math.floor(Math.max(...this.path_elevation.map(pkt => pkt[1]))),
            axisLine: {onZero: false}
          },
          series: [
            {
              name: 'Wanderweg',
              type: 'line',
              data: this.path_elevation,
              showSymbol: false,
              itemStyle: {
                color: 'rgb(223,80,16)'
              },
              areaStyle: {
                color: new graphic.LinearGradient(0, 0, 0, 1, [
                  {
                    offset: 0,
                    color: 'rgb(223,80,16)'
                  },
                  {
                    offset: 1,
                    color: 'rgba(223,80,16,0.2)'
                  }
                ])
              }, smooth: true,
            },
            {
              name: 'Wegpunkte',
              type: 'line',
              itemStyle: {
                color: 'rgba(16,102,223,0.36)'
              },
              data: selected_way_points_elevation,
              symbolSize: 6,
              lineStyle: {
                width: 3
              },
              markPoint: {
                data: markPointsData,
                symbolSize: 25,
              },
            },

          ],
        };

      });
  }

  mouseClick() {

    // get element
    const chart = document.querySelector("#chart > div:nth-child(2) > div > div:nth-child(1) > div:nth-child(1)");
    let distance = parseFloat(chart?.innerHTML ? chart?.innerHTML : '0');

    if (this.path_elevation == undefined || this.path == undefined || distance == 0)
      return;

    // get index in this.path_elevation
    let index = this.path_elevation.findIndex((pkt: number[]) => pkt[0] >= distance);

    const coord = this.path[index];
    this.mapAnimator.set_location({x: coord[0], y: coord[1]});

    this.pois += coord[0] + ',' + coord[1] + ';';
    this.create_walk_time_table().then();


  }
}
