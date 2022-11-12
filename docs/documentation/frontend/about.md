# About the Frontend/Webinterface

The frontend of our application is build using Angular. It is a single page application that communicates with the
backend via REST API.

::: info
The frontend/webinterface is served on `localhost:80` if you run the application locally.
:::

## Map Viewer

The map viewer is the main component of the webinterface. The map is rendered using
the [OpenLayers](https://openlayers.org/) library. The map viewer is responsible for
rendering the map, displaying the map layers (paths and points) and the map controls.

The map viewer is also responsible for the map interactions. The user can interact with the map
by clicking on the map, selecting a point or a path, or by using the map controls.

### How to Render the Map

A map can be rendered by using the `MapService`. The `MapService` is a convenient wrapper around
the OpenLayers library, providing some high-level functions to render the map.

You can link a `MapAnimatorService` to the `MapService` to animate the map. The `MapAnimatorService`
is responsible for animating the map, by moving the map to a specific location and zoom level.


```javascript
export class MapComponent implements OnInit {
    
    constructor(mapAnimator: MapAnimatorService, mapService: MapService) {}

    ngOnInit(): void {
        mapService.draw_map('pixelkarte', 'map-canvas');
        mapService.link_animator(this.mapAnimator);
    }
    
}
```
