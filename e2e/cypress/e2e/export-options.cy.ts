import {
  backend_url,
  export_route,
  open_table_mode,
  upload_route,
} from "./utils";

const DOWNLOAD_ZIP = "cypress/downloads/Download.zip";

function toggle(control: string) {
  return cy.get(`mat-slide-toggle[formControlName="${control}"] button`);
}

function select_option(control: string, option: string) {
  cy.get(`mat-select[formControlName="${control}"]`).click();
  cy.contains("mat-option", option).click();
  cy.get("mat-option").should("not.exist");
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
    toggle("name_points_in_export").should("have.attr", "aria-checked", "true");
    toggle("number_points_in_export").should(
      "have.attr",
      "aria-checked",
      "false",
    );

    toggle("number_points_in_export").click();
    toggle("number_points_in_export").should(
      "have.attr",
      "aria-checked",
      "true",
    );
    toggle("name_points_in_export").should(
      "have.attr",
      "aria-checked",
      "false",
    );

    toggle("name_points_in_export").click();
    toggle("name_points_in_export").should("have.attr", "aria-checked", "true");
    toggle("number_points_in_export").should(
      "have.attr",
      "aria-checked",
      "false",
    );

    // the points may be exported without any label
    toggle("name_points_in_export").click();
    toggle("name_points_in_export").should(
      "have.attr",
      "aria-checked",
      "false",
    );
    toggle("number_points_in_export").should(
      "have.attr",
      "aria-checked",
      "false",
    );
  });

  it("should hide the advanced settings by default", () => {
    cy.get('mat-select[formControlName="legend_position"]').should("not.exist");

    cy.contains("button", "Erweiterte Einstellungen").click();
    cy.get('mat-select[formControlName="legend_position"]')
      .should("be.visible")
      .and("contain", "Unten Rechts");

    cy.contains("button", "Erweiterte Einstellungen").click();
    cy.get('mat-select[formControlName="legend_position"]').should("not.exist");
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
      });
      expect(response?.body.status).to.eq("running");
      expect(response?.body.uuid).to.match(/^[0-9a-f]{32}$/);
    });

    get_exported_files().should("have.length", 4);
  });

  it("should export with customized settings", () => {
    cy.get('[formControlName="route_name"]').clear().type("Wanderung am See");
    cy.get('[formControlName="creator_name"]').clear().type("Cypress");
    cy.get('[formControlName="velocity"]').clear().type("3.5");
    cy.get('[formControlName="departure_time"]').type("2026-05-01T08:15");

    select_option("map_layers", "Basiskarte S/W");
    toggle("number_points_in_export").click();
    cy.get('input[formControlName="map_scaling"]')
      .invoke("val", 25_000)
      .trigger("input")
      .trigger("change");
    cy.contains("label", "Kartenmassstab: 1:25000").should("exist");

    cy.contains("button", "Erweiterte Einstellungen").click();
    select_option("legend_position", "Oben Links");

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
      });
    });

    get_exported_files().should("have.members", [
      "Wanderung-am-See.gpx",
      "Wanderung-am-See_maps.pdf",
      "Wanderung-am-See_Marschzeittabelle.xlsx",
      "Wanderung-am-See_elevation_profile.png",
    ]);

    // the name of the route is written to the GPX file
    cy.exec(`unzip -p ${DOWNLOAD_ZIP} Wanderung-am-See.gpx`)
      .its("stdout")
      .should("contain", "Wanderung am See");
  });

  it("should export an aerial map with an automatically chosen scale", () => {
    select_option("map_layers", "Luftbild");
    toggle("auto_scale").click();

    export_route();

    cy.wait("@create_map").then(({ request }) => {
      expect(request.body.settings).to.include({
        map_layers: "ch.swisstopo.swissimage-product",
        auto_scale: true,
      });
    });

    get_exported_files().should("have.length", 4);
  });

  it("should remember the settings of the last export", () => {
    cy.get('[formControlName="creator_name"]').clear().type("Cypress");
    select_option("map_layers", "Basiskarte S/W");

    export_route();

    cy.visit("/");
    cy.get(".mode-toggle").contains("table_chart").click();
    cy.get('[formControlName="creator_name"]').should("have.value", "Cypress");
    cy.get('mat-select[formControlName="map_layers"]').should(
      "contain",
      "Basiskarte S/W",
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
