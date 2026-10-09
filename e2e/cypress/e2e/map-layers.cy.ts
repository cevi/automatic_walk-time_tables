import { MAP_URL } from "./utils";

const OVERLAY_TILES =
  /^https:\/\/wmts\d*\.geo\.admin\.ch\/1\.0\.0\/ch\.(swisstopo\.hangneigung|swisstopo\.swisstlm3d-wanderwege|astra|bafu|vbs)/;

/**
 * The overlays are served by swisstopo and OpenStreetMap. Their data is
 * stubbed, as we only want to test that the layers are added to our map.
 */
function stub_overlay_data() {
  cy.intercept("GET", OVERLAY_TILES, {
    fixture: "stubs/transparent_tile.png",
  }).as("overlay_tiles");
  cy.intercept(
    "GET",
    "https://api3.geo.admin.ch/rest/services/all/MapServer/identify*",
    {
      results: [],
    },
  ).as("identify");
  cy.intercept("GET", "https://overpass.osm.ch/api/interpreter*", {
    fixture: "stubs/overpass_fountains.json",
  }).as("overpass");
}

function open_layer_menu() {
  cy.get('button[matTooltip="Hintergrundkarte"]').click();
  cy.get(".premium-map-menu").should("be.visible");
}

function close_layer_menu() {
  cy.get("body").type("{esc}");
  cy.get(".premium-map-menu").should("not.exist");
}

function menu_item(label: string) {
  return cy.contains(".premium-map-menu button.custom-menu-item", label);
}

/**
 * Checks the layers of the map, i.e. the background map and the overlays.
 */
function expect_layers(expected: string[]) {
  cy.window().should((win: any) => {
    const names = win.mapService
      .get_map()
      .getLayers()
      .getArray()
      .map((layer: any) => layer.get("name"))
      // internal layer used to highlight features on the map
      .filter((name: string | undefined) => name && name !== "highlight_layer");
    expect(names).to.have.members(expected);
  });
}

function find_layer(win: any, name: string) {
  return win.mapService
    .get_map()
    .getLayers()
    .getArray()
    .find((layer: any) => layer.get("name") === name);
}

function get_layer(name: string) {
  return cy.window().then((win: any) => find_layer(win, name));
}

describe("Background maps", () => {
  beforeEach(() => {
    cy.viewport(1800, 1200);
    stub_overlay_data();
    cy.visit(MAP_URL);
    cy.get("#map-canvas canvas").should("exist");
  });

  it("should show the coloured base map by default", () => {
    expect_layers(["pixelkarte"]);

    open_layer_menu();
    menu_item("Basiskarte Farbig").find(".check-icon").should("exist");
    menu_item("Basiskarte S/W").find(".uncheck-icon").should("exist");
    menu_item("Luftbild").find(".uncheck-icon").should("exist");
    menu_item("Keine Hintergrundkarte").find(".uncheck-icon").should("exist");
  });

  const background_maps = [
    { label: "Basiskarte S/W", layer: "pixelkarte-grau" },
    { label: "Luftbild", layer: "luftbild" },
    { label: "Basiskarte Farbig", layer: "pixelkarte" },
  ];

  it("should switch between the background maps", () => {
    background_maps.forEach(({ label, layer }) => {
      open_layer_menu();
      menu_item(label).click();
      cy.get(".premium-map-menu").should("not.exist");

      expect_layers([layer]);
      cy.location("search").should("contain", `bgLayer=${layer}`);

      open_layer_menu();
      menu_item(label).find(".check-icon").should("exist");
      cy.get(".premium-map-menu .check-icon").should("have.length", 1);
      close_layer_menu();
    });
  });

  it("should hide the background map", () => {
    open_layer_menu();
    menu_item("Keine Hintergrundkarte").click();

    expect_layers([]);
    cy.location("search").should("contain", "bgLayer=keine");
  });

  it("should keep the map section when switching the background map", () => {
    open_layer_menu();
    menu_item("Luftbild").click();
    expect_layers(["luftbild"]);

    cy.window().should((win: any) => {
      const view = win.mapService.get_map().getView();
      expect(view.getCenter()[0]).to.be.closeTo(2708224.25, 0.01);
      expect(view.getCenter()[1]).to.be.closeTo(1240069.5, 0.01);
      expect(view.getZoom()).to.be.closeTo(8.989, 0.001);
    });
  });

  it("should restore the background map from the URL", () => {
    cy.visit(MAP_URL + "&bgLayer=pixelkarte-grau");

    expect_layers(["pixelkarte-grau"]);
    open_layer_menu();
    menu_item("Basiskarte S/W").find(".check-icon").should("exist");
  });

  it("should change the saturation of the background map", () => {
    get_layer("pixelkarte").invoke("get", "saturation").should("eq", 0.85);

    open_layer_menu();
    menu_item("Basiskarte Farbig").find(".settings-btn").click();
    cy.get(".layer-settings-panel .slider-label").should(
      "contain",
      "Sättigung: 85%",
    );

    cy.get(".layer-settings-panel input.opacity-slider")
      .invoke("val", 0.4)
      .trigger("input");

    cy.get(".layer-settings-panel .slider-label").should(
      "contain",
      "Sättigung: 40%",
    );
    get_layer("pixelkarte").invoke("get", "saturation").should("eq", 0.4);

    // the settings panel can be collapsed again
    menu_item("Basiskarte Farbig").find(".settings-btn").click();
    cy.get(".layer-settings-panel").should("not.exist");
  });
});

describe("Map overlays", () => {
  beforeEach(() => {
    cy.viewport(1800, 1200);
    stub_overlay_data();
    cy.visit(MAP_URL);
    cy.get("#map-canvas canvas").should("exist");
  });

  const overlays = [
    { label: "ÖV-Haltestellen", key: "haltestellen", layers: ["haltestellen"] },
    {
      label: "Hangneigung über 30°",
      key: "hangneigung",
      layers: ["hangneigung"],
    },
    { label: "Wanderwege", key: "wanderwege", layers: ["wanderwege"] },
    {
      label: "Sperrungen Wanderwege",
      key: "sperrungen",
      layers: ["sperrungen"],
    },
    {
      label: "Schutzgebiete",
      key: "schutzgebiete",
      layers: [
        "schutzgebiete_nationalpark",
        "schutzgebiete_jagdbanngebiete",
        "schutzgebiete_wildruhezonen",
        "schutzgebiete_naturschutzgebiete",
      ],
    },
    {
      label: "Schiessanzeigen (VBS)",
      key: "schiessanzeigen",
      layers: ["schiessanzeigen"],
    },
    {
      label: "Herdenschutzhunde",
      key: "herdenschutzhunde",
      layers: ["herdenschutzhunde"],
    },
    { label: "Brunnen", key: "fountains", layers: ["fountains"] },
    { label: "Notfall / Medizin", key: "notfall", layers: ["notfall"] },
    { label: "Feuerstellen", key: "feuerstellen", layers: ["feuerstellen"] },
    { label: "Unterstände und Hütten", key: "shelter", layers: ["shelter"] },
  ];

  overlays.forEach(({ label, key, layers }) => {
    it(`should toggle the overlay "${label}"`, () => {
      open_layer_menu();
      menu_item(label).find(".uncheck-icon").should("exist");

      // the menu stays open, such that several overlays can be toggled
      menu_item(label).click();
      cy.get(".premium-map-menu").should("be.visible");
      menu_item(label).find(".check-icon").should("exist");

      expect_layers(["pixelkarte", ...layers]);
      cy.location("search").should("contain", `metaLayers=${key}`);

      menu_item(label).click();
      menu_item(label).find(".uncheck-icon").should("exist");

      expect_layers(["pixelkarte"]);
      cy.location("search").should("not.contain", "metaLayers");
    });
  });

  it("should combine several overlays", () => {
    open_layer_menu();
    menu_item("Wanderwege").click();
    menu_item("Hangneigung über 30°").click();
    menu_item("Brunnen").click();

    expect_layers(["pixelkarte", "wanderwege", "hangneigung", "fountains"]);
    cy.location("search").should((search) => {
      const meta_layers = new URLSearchParams(search).get("metaLayers");
      expect(meta_layers?.split(",")).to.have.members([
        "wanderwege",
        "hangneigung",
        "fountains",
      ]);
    });

    // the overlays are kept when the background map gets changed
    menu_item("Luftbild").click();
    expect_layers(["luftbild", "wanderwege", "hangneigung", "fountains"]);
  });

  it("should restore the overlays from the URL", () => {
    cy.visit(MAP_URL + "&bgLayer=luftbild&metaLayers=wanderwege,shelter");

    expect_layers(["luftbild", "wanderwege", "shelter"]);

    open_layer_menu();
    menu_item("Luftbild").find(".check-icon").should("exist");
    menu_item("Wanderwege").find(".check-icon").should("exist");
    menu_item("Unterstände und Hütten").find(".check-icon").should("exist");
    menu_item("Brunnen").find(".uncheck-icon").should("exist");
  });

  it("should load the tiles of a swisstopo overlay", () => {
    open_layer_menu();
    menu_item("Wanderwege").click();

    cy.wait("@overlay_tiles")
      .its("request.url")
      .should("contain", "/ch.swisstopo.swisstlm3d-wanderwege/");
  });

  it("should display the features of an OpenStreetMap overlay", () => {
    open_layer_menu();
    menu_item("Brunnen").click();

    cy.wait("@overpass").then(({ request }) => {
      expect(request.query["data"]).to.contain("drinking_water");
    });

    // elements without coordinates are skipped; the features are added once
    // the response is parsed, thus the assertion must be retried
    cy.window({ timeout: 10_000 }).should((win: any) => {
      const features = find_layer(win, "fountains").getSource().getFeatures();
      expect(features).to.have.length(2);
    });
  });

  it("should change the opacity of an overlay", () => {
    open_layer_menu();
    menu_item("Hangneigung über 30°").click();
    get_layer("hangneigung").invoke("getOpacity").should("eq", 0.35);

    menu_item("Hangneigung über 30°").find(".settings-btn").click();
    cy.get(".layer-settings-panel input.opacity-slider")
      .invoke("val", 0.8)
      .trigger("input");

    get_layer("hangneigung").invoke("getOpacity").should("eq", 0.8);

    // the opacity is kept when the map gets redrawn
    menu_item("Wanderwege").click();
    get_layer("hangneigung").invoke("getOpacity").should("eq", 0.8);
  });

  it("should only open the settings of an active overlay", () => {
    open_layer_menu();

    menu_item("Wanderwege")
      .find(".settings-btn")
      .should("have.class", "disabled");
    menu_item("Wanderwege").click();
    menu_item("Wanderwege")
      .find(".settings-btn")
      .should("not.have.class", "disabled");
  });
});
