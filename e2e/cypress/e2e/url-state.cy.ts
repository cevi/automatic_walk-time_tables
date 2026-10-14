import { draw_route, get_map_canvas } from "./utils";

describe("Map state in the URL", () => {
  beforeEach(() => {
    cy.viewport(1800, 1200);
  });

  it("should restore the map section from the URL", () => {
    cy.visit("/?center=2708224.25%2C1240069.50&z=8.989");

    cy.window().should((win: any) => {
      const view = win.mapService.get_map().getView();
      expect(view.getCenter()[0]).to.be.closeTo(2708224.25, 0.01);
      expect(view.getCenter()[1]).to.be.closeTo(1240069.5, 0.01);
      expect(view.getZoom()).to.be.closeTo(8.989, 0.001);
    });
  });

  it("should show the whole of Switzerland without a map section in the URL", () => {
    cy.visit("/");

    cy.window().should((win: any) => {
      const view = win.mapService.get_map().getView();
      expect(view.getCenter()[0]).to.be.closeTo(2660000, 1);
      expect(view.getCenter()[1]).to.be.closeTo(1190000, 1);
    });
  });

  it("should update the URL when the map is moved", () => {
    cy.visit("/?center=2708224.25%2C1240069.50&z=8.989");
    cy.get("#map-canvas canvas").should("exist");

    cy.window().then((win: any) => {
      win.mapService.get_map().getView().setCenter([2600000, 1200000]);
      win.mapService.get_map().getView().setZoom(6);
    });

    cy.location("search").should("contain", "center=2600000.00%2C1200000.00");
    cy.location("search").should("contain", "z=6.000");
    cy.location("search").should("contain", "bgLayer=pixelkarte");

    // the new map section survives a reload
    cy.reload();
    cy.window().should((win: any) => {
      const view = win.mapService.get_map().getView();
      expect(view.getCenter()[0]).to.be.closeTo(2600000, 0.01);
      expect(view.getCenter()[1]).to.be.closeTo(1200000, 0.01);
      expect(view.getZoom()).to.be.closeTo(6, 0.001);
    });
  });

  it("should update the URL when the map is dragged", () => {
    cy.visit("/?center=2708224.25%2C1240069.50&z=8.989");
    cy.get("#map-canvas canvas").should("exist");
    cy.wait(1000);

    const pointer = (x: number, y: number, buttons: number) => ({
      clientX: x,
      clientY: y,
      button: 0,
      buttons,
      pointerId: 1,
      isPrimary: true,
      force: true,
    });

    get_map_canvas().then(($canvas) => {
      const rect = $canvas[0].getBoundingClientRect();
      const [x, y] = [rect.left + 600, rect.top + 500];

      cy.wrap($canvas)
        .trigger("pointerdown", pointer(x, y, 1))
        .trigger("pointermove", pointer(x + 50, y, 1))
        .trigger("pointermove", pointer(x + 100, y, 1))
        .trigger("pointermove", pointer(x + 200, y, 1))
        .trigger("pointerup", pointer(x + 200, y, 0));
    });

    // dragging the map to the right moves the center to the west
    cy.location("search").should((search) => {
      const center = new URLSearchParams(search).get("center");
      expect(center).to.not.be.null;
      const [easting, northing] = center!.split(",").map(parseFloat);
      expect(easting).to.be.lt(2708224.25 - 100);
      expect(northing).to.be.closeTo(1240069.5, 50);
    });
  });

  it("should keep the map section while switching modes", () => {
    cy.visit("/?center=2708224.25%2C1240069.50&z=8.989");
    draw_route([
      [600, 500],
      [700, 500],
    ]);

    cy.get(".mode-toggle").contains("table_chart").click();
    cy.get("#control-area").should("be.visible");
    cy.get(".mode-toggle").contains("visibility").click();
    cy.get("#control-area").should("not.be.visible");

    cy.location("pathname").should("eq", "/");
    cy.location("search").should("contain", "center=");
    cy.location("search").should("contain", "z=");
  });
});

describe("Unknown URLs", () => {
  ["/does-not-exist", "/download", "/retrieve", "/some/nested/path"].forEach(
    (path) => {
      it(`should redirect ${path} to the landing page`, () => {
        cy.visit(path);
        cy.location("pathname").should("eq", "/");
        cy.get(".mode-toggle").should("exist");
      });
    },
  );
});
