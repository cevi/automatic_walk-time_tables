import {Component, OnInit} from '@angular/core';
import {environment} from "../../../environments/environment";
import {FormBuilder, FormControl, FormGroup} from "@angular/forms";
import {MapAnimatorService} from "../../services/map-animator.service";
import {Router} from "@angular/router";
import {decode, encode} from "@googlemaps/polyline-codec";

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
      'list-of-pois': new FormControl(''),
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


  download_map() {

    localStorage['form_values'] = JSON.stringify(this.options.value);

    if (!this.route_uploaded || !this.route_file)
      return

    let formData = new FormData();

    formData.append("file", this.route_file);

    let url = ExportSettingsComponent.baseURL + 'create?';

    for (const option in this.options.controls) {

      if (['creator-name', 'list-of-pois'].includes(option) && !this.options.controls[option].value.length)
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
        Accept: 'text/plain',
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

    let path = this.mapAnimator.path;

    if (path == undefined) {
      console.error('No path found')
      return;
    }

    let data: any = {
      'encoding': 'polyline',
      'route': encode(path.map(pkt => [pkt.x, pkt.y]), 0),
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

        let selected_way_points_elevation = decode(resp?.selected_way_points_elevation, 0);
        let path_elevation = decode(resp?.path_elevation, 0);

        selected_way_points_elevation = selected_way_points_elevation.map(pkt => [pkt[0] / 1_000, pkt[1]])
        path_elevation = path_elevation.map(pkt => [pkt[0] / 1_000, pkt[1]])

        this.plot_options = {
          legend: {
            data: ['Wanderweg', 'Wegpunkte'],
            align: 'left',
          },
          tooltip: {
            trigger: 'axis',
            axisPointer: {
              animation: false
            }

          },
          xAxis: {
            type: 'value',
          },
          yAxis: {
            type: 'value',
            splitLine: {
              show: false
            },
            min: Math.min.apply(path_elevation.map(pkt => pkt[1])),
            max: Math.max.apply(path_elevation.map(pkt => pkt[1])),
          },
          series: [
            {
              name: 'Wanderweg',
              type: 'line',
              data: path_elevation,
              showSymbol: false,
            },
            {
              name: 'Wegpunkte',
              type: 'line',
              data: selected_way_points_elevation,
            },
          ],
        };


      });
  }


  private add_value(path: number[][], meters: number): number | undefined {

    return path.find((pkt: number[]) => pkt[0] >= meters && pkt[0] < meters + 1)?.[1] ?? 0;

  }

}
