import {
  backend_url,
  export_route,
  open_table_mode,
  upload_route,
} from "./utils";

const DOWNLOAD_ZIP = "cypress/downloads/Download.zip";

function open_map_settings() {
  cy.get("#map-settings-button").click();
  cy.get(".info-dialog").should("be.visible");
}

function select_layer(label: string) {
  cy.contains(".info-dialog .layer-tile", label).click();
}

function choose(label: string) {
  cy.contains(".info-dialog mat-button-toggle", label).click();
}

function apply_map_settings() {
  cy.contains(".info-dialog button", "Übernehmen").click();
  cy.get(".info-dialog").should("not.exist");
}

function map_settings_summary() {
  return cy.get(".map-settings-summary");
}

/** Yields the names of the files in the downloaded zip file. */
function get_exported_files() {
  cy.readFile(DOWNLOAD_ZIP, "binary", { timeout: 15_000 }).should((buffer) =>
    expect(buffer.length).to.be.gt(150_000),
  );
  return cy
    .exec(`unzip -Z1 ${DOWNLOAD_ZIP}`)
    .then((result) => result.stdout.split("\n").filter((name) => name !== ""));
}

describe("Export options", () => {
  beforeEach(() => {
    cy.viewport(1800, 1200);
    cy.exec("rm -rf cypress/downloads/*");
    cy.intercept("POST", backend_url("create_map")).as("create_map");

    cy.visit("/");
    upload_route("test_small.gpx");
    // a route name is suggested once the way points are named, it would be
    // inserted into a route name field that is cleared at that moment
    open_table_mode();
    cy.get("#control-area").should("be.visible");
    cy.get("#export-button").should("be.enabled");
  });

  it("should either name or number the points", () => {
    map_settings_summary().should("contain", "Punkte mit Namen beschriftet");

    open_map_settings();
    choose("Nummern");
    apply_map_settings();
    map_settings_summary().should("contain", "Punkte nummeriert");

    // the points may be exported without any label
    open_map_settings();
    choose("Keine");
    apply_map_settings();
    map_settings_summary().should("contain", "Punkte ohne Beschriftung");
  });

  it("should discard changed map settings when the dialog is cancelled", () => {
    open_map_settings();
    select_layer("Luftbild");
    choose("Nummern");
    cy.contains(".info-dialog button", "Abbrechen").click();

    map_settings_summary()
      .should("contain", "Basiskarte Farbig")
      .and("contain", "Punkte mit Namen beschriftet");
  });

  it("should choose the legend position in the map settings", () => {
    open_map_settings();
    cy.contains(".info-dialog mat-button-toggle", "Unten rechts").should(
      "have.class",
      "mat-button-toggle-checked",
    );
    choose("Oben links");
    apply_map_settings();
  });

  it("should export with the default settings", () => {
    export_route();

    cy.wait("@create_map").then(({ request, response }) => {
      expect(request.body.encoding).to.eq("polyline");
      expect(request.body.settings).to.include({
        map_layers: "ch.swisstopo.pixelkarte-farbe",
        legend_position: "lower right",
        map_scaling: 15_000,
        auto_scale: false,
        name_points_in_export: true,
        number_points_in_export: false,
        route_style: "classic",
      });
      expect(response?.body.status).to.eq("running");
      expect(response?.body.uuid).to.match(/^[0-9a-f]{32}$/);
    });

    get_exported_files().should("have.length", 5);
  });

  it("should export with customized settings", () => {
    cy.get('[formControlName="route_name"]').clear().type("Wanderung am See");
    cy.get('[formControlName="creator_name"]').clear().type("Cypress");
    cy.get('[formControlName="velocity"]').clear().type("3.5");
    cy.get('[formControlName="departure_time"]').type("2026-05-01T08:15");

    open_map_settings();
    select_layer("Basiskarte S/W");
    choose("Nummern");
    cy.get('input[formControlName="map_scaling"]')
      .invoke("val", 25_000)
      .trigger("input")
      .trigger("change");
    cy.contains("label", "Kartenmassstab: 1:25000").should("exist");
    cy.get('[data-route-style="magenta"]').click();
    choose("Oben links");
    apply_map_settings();

    export_route();

    cy.wait("@create_map").then(({ request }) => {
      expect(request.body.settings).to.include({
        route_name: "Wanderung am See",
        creator_name: "Cypress",
        velocity: 3.5,
        departure_time: "2026-05-01T08:15",
        map_layers: "ch.swisstopo.pixelkarte-grau",
        legend_position: "upper left",
        map_scaling: 25_000,
        auto_scale: false,
        name_points_in_export: false,
        number_points_in_export: true,
        route_style: "magenta",
      });
    });

    get_exported_files().should("have.members", [
      "Wanderung-am-See.gpx",
      "Wanderung-am-See_maps.pdf",
      "Wanderung-am-See_Marschzeittabelle.xlsx",
      "Wanderung-am-See_Marschzeittabelle.pdf",
      "Wanderung-am-See_elevation_profile.png",
    ]);

    // the name of the route is written to the GPX file
    cy.exec(`unzip -p ${DOWNLOAD_ZIP} Wanderung-am-See.gpx`)
      .its("stdout")
      .should("contain", "Wanderung am See");
  });

  it("should export an aerial map with an automatically chosen scale", () => {
    open_map_settings();
    select_layer("Luftbild");
    choose("Automatisch");
    apply_map_settings();

    export_route();

    cy.wait("@create_map").then(({ request }) => {
      expect(request.body.settings).to.include({
        map_layers: "ch.swisstopo.swissimage-product",
        auto_scale: true,
      });
    });

    get_exported_files().should("have.length", 5);
  });

  it("should remember the settings of the last export", () => {
    cy.get('[formControlName="creator_name"]').clear().type("Cypress");
    open_map_settings();
    select_layer("Basiskarte S/W");
    cy.get('[data-route-style="highlighter"]').click();
    apply_map_settings();

    export_route();

    cy.visit("/");
    cy.get(".mode-toggle").contains("table_chart").click();
    cy.get('[formControlName="creator_name"]').should("have.value", "Cypress");
    map_settings_summary().should("contain", "Basiskarte S/W");
    // the route style is part of the map settings dialog
    cy.get("#map-settings-button").click();
    cy.get('input[name="route_style"]:checked').should(
      "have.value",
      "highlighter",
    );
  });

  // a route name is used as file name, thus it must not contain any path
  const unsafe_route_names = [
    { route_name: "../../../etc/passwd", file_name: "etc-passwd" },
    {
      route_name: "Tour: Uetliberg & Albis (2026)",
      file_name: "Tour-Uetliberg-Albis-2026",
    },
    { route_name: "..\\..\\tour.exe", file_name: "tour-exe" },
    { route_name: "../..", file_name: "Route" },
  ];

  unsafe_route_names.forEach(({ route_name, file_name }) => {
    it(`should sanitize the route name "${route_name}"`, () => {
      cy.get('[formControlName="route_name"]').clear().type(route_name);

      export_route().then((uuid) => {
        cy.request(backend_url(`status/${uuid}`))
          .its("body.status")
          .should("eq", "success");
      });

      get_exported_files().should("have.members", [
        `${file_name}.gpx`,
        `${file_name}_maps.pdf`,
        `${file_name}_Marschzeittabelle.xlsx`,
        `${file_name}_Marschzeittabelle.pdf`,
        `${file_name}_elevation_profile.png`,
      ]);
    });
  });

  it("should fall back to a default file name without a route name", () => {
    cy.get('[formControlName="route_name"]').clear();

    export_route();

    get_exported_files().should("include", "Route.gpx");
  });
});
