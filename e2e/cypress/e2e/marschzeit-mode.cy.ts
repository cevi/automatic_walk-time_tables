import "cypress-xpath";

describe("Marschzeittabellen Mode - Waypoint Management", () => {
  beforeEach(() => {
    cy.viewport(1800, 1200);
    cy.visit("/?center=2708224.25%2C1240069.50&z=8.989");
  });

  it("should draw a route, enter table mode, and allow adding/removing waypoints via map, chart and table actions", () => {
    // 1. Enter edit mode and draw a simple route
    cy.get(".mode-toggle").contains("edit").click();

    cy.xpath('//*[@id="map-canvas"]/div[1]/div[1]/div/canvas').then(
      ($canvas) => {
        const canvas = $canvas[$canvas.length - 1] as HTMLCanvasElement;
        const wrapper = cy.wrap(canvas);

        // Draw point 1
        wrapper.click(600, 500);
        cy.wait(1000);

        // Draw point 2
        wrapper.click(700, 500);
        cy.wait(2000);

        // Draw point 3
        wrapper.click(800, 500);
        cy.wait(2000);
      },
    );

    // 2. Switch to Marschzeittabellen-Modus
    cy.get(".mode-toggle").contains("table_chart").click();
    cy.wait(2000); // Wait for route generation and auto waypoints baking

    // Verify split-view control area and table are visible
    cy.get("#control-area").should("be.visible");
    cy.get(".marschzeit-table").should("exist");

    // Capture initial POI count from the badge
    let initialPoiCount = 0;
    cy.contains("Wegpunkte:")
      .find("strong")
      .then(($el) => {
        initialPoiCount = parseInt($el.text());
        expect(initialPoiCount).to.be.gt(0);
      });

    let targetPixel: number[] | null = null;
    let targetCoord: { x: number; y: number } | null = null;

    // 3. Find a coordinate on the route path that is far from existing waypoints, then click to ADD a new waypoint
    cy.window().then((win: any) => {
      const path = win.mapAnimator.path;
      const pois = win.mapAnimator.pois;
      const map = win.mapService.get_map();

      for (let i = 0; i < path.length; i++) {
        const pt = path[i];
        const ptPixel = map.getPixelFromCoordinate([pt.x, pt.y]);

        let minPoiDist = Infinity;
        for (const poi of pois) {
          const poiPixel = map.getPixelFromCoordinate([poi.x, poi.y]);
          const d = Math.sqrt(
            Math.pow(ptPixel[0] - poiPixel[0], 2) +
              Math.pow(ptPixel[1] - poiPixel[1], 2),
          );
          if (d < minPoiDist) {
            minPoiDist = d;
          }
        }

        // If this point is > 35 pixels away from all existing POIs, we can click it to add a new POI
        if (minPoiDist > 35) {
          targetPixel = ptPixel;
          targetCoord = { x: pt.x, y: pt.y };
          break;
        }
      }

      expect(targetPixel).to.not.be.null;

      // Click at the calculated screen pixel location
      cy.xpath('//*[@id="map-canvas"]/div[1]/div[1]/div/canvas').then(
        ($canvas) => {
          const canvas = $canvas[$canvas.length - 1] as HTMLCanvasElement;
          cy.wrap(canvas).click(targetPixel![0], targetPixel![1]);
          cy.wait(2000); // Wait for route and tables to reload
        },
      );
    });

    // Verify POI count increased by 1
    cy.contains("Wegpunkte:")
      .find("strong")
      .then(($el) => {
        const countAfterMapClick = parseInt($el.text());
        expect(countAfterMapClick).to.eq(initialPoiCount + 1);
      });

    // 4. Click at the EXACT SAME screen pixel location to DELETE that custom waypoint
    cy.window().then((win: any) => {
      const pois = win.mapAnimator.pois;
      const map = win.mapService.get_map();

      // Find the POI closest to targetCoord
      let addedPoi = null;
      let minD = Infinity;
      for (const p of pois) {
        const d = Math.sqrt(
          Math.pow(p.x - targetCoord!.x, 2) + Math.pow(p.y - targetCoord!.y, 2),
        );
        if (d < minD) {
          minD = d;
          addedPoi = p;
        }
      }
      expect(addedPoi).to.not.be.null;
      const poiPixel = map.getPixelFromCoordinate([addedPoi!.x, addedPoi!.y]);

      cy.xpath('//*[@id="map-canvas"]/div[1]/div[1]/div/canvas').then(
        ($canvas) => {
          const canvas = $canvas[$canvas.length - 1] as HTMLCanvasElement;
          cy.wrap(canvas).click(poiPixel[0], poiPixel[1]);
          cy.wait(2000);
        },
      );
    });

    // Verify POI count decreased back by 1
    cy.contains("Wegpunkte:")
      .find("strong")
      .then(($el) => {
        const countAfterMapDelete = parseInt($el.text());
        expect(countAfterMapDelete).to.eq(initialPoiCount);
      });

    // 5. Add a Waypoint via Elevation Profile Click
    // Hover first, then click on the chart canvas
    cy.get("#chart canvas")
      .trigger("mousemove", 200, 200, { force: true })
      .wait(500)
      .click(200, 200, { force: true });
    cy.wait(2000);

    // Verify POI count increased by 1
    cy.contains("Wegpunkte:")
      .find("strong")
      .then(($el) => {
        const countAfterChartClick = parseInt($el.text());
        expect(countAfterChartClick).to.eq(initialPoiCount + 1);
      });

    // 6. Remove that Waypoint via Elevation Profile Click
    // Hover the waypoint first (to set hover_snapped_poi), then click to delete
    cy.get("#chart canvas")
      .trigger("mousemove", 200, 200, { force: true })
      .wait(500)
      .click(200, 200, { force: true });
    cy.wait(2000);

    // Verify POI count decreased back by 1
    cy.contains("Wegpunkte:")
      .find("strong")
      .then(($el) => {
        const countAfterChartDelete = parseInt($el.text());
        expect(countAfterChartDelete).to.eq(initialPoiCount);
      });

    // 7. Add a Waypoint again to test Table Deletion
    cy.get("#chart canvas")
      .trigger("mousemove", 200, 200, { force: true })
      .wait(500)
      .click(200, 200, { force: true });
    cy.wait(2000);

    // Verify POI count increased by 1
    cy.contains("Wegpunkte:")
      .find("strong")
      .then(($el) => {
        const count = parseInt($el.text());
        expect(count).to.eq(initialPoiCount + 1);
      });

    // 8. Remove the Waypoint via Table Action (delete button)
    cy.get(".delete-icon").should("exist");
    cy.get(".delete-icon").first().click();
    cy.wait(2000);

    // Verify POI count decreased back by 1
    cy.contains("Wegpunkte:")
      .find("strong")
      .then(($el) => {
        const countAfterDelete = parseInt($el.text());
        expect(countAfterDelete).to.eq(initialPoiCount);
      });
  });
});
