import * as path from "path";
import "cypress-xpath";

export function test_and_save_download(file: string) {
  const downloadsFolder = Cypress.config("downloadsFolder");
  if (!downloadsFolder) {
    throw new Error("downloadsFolder is not configured in Cypress");
  }
  const downloadedFilename = path.join(downloadsFolder, "Download.zip");
  cy.readFile(downloadedFilename, "binary", { timeout: 15000 }).should(
    (buffer) => expect(buffer.length).to.be.gt(150000),
  );

  // unzip downloadedFilename
  const filename = file.split("/").pop();
  cy.exec(
    "unzip " +
      downloadedFilename +
      " -d " +
      downloadsFolder +
      "/" +
      filename +
      " && rm -f " +
      downloadedFilename,
  );
  cy.clearCookies();
}

export function test_without_interaction(file: string) {
  cy.visit("/");
  cy.get(".mode-toggle").contains("edit").click();
  cy.get("#gpx_upload_input", { force: true }).selectFile(
    "cypress/fixtures/" + file,
    { force: true },
  );

  cy.get("#export-button", {
    timeout: 10_000,
  }).should("be.enabled");
  cy.get("#export-button").click();

  cy.url({ timeout: 10_000 }).should("contain", "/pending");
  cy.url({ timeout: 180_000 }).should("contain", "/download");

  cy.get("h2").should("contain", "Deine Route wurde erfolgreich exportiert!");
}

// A map section around Wald ZH with a dense network of roads and hiking trails.
export const MAP_URL = "/?center=2708224.25%2C1240069.50&z=8.989";

export function get_map_canvas() {
  return cy
    .xpath('//*[@id="map-canvas"]/div[1]/div[1]/div/canvas')
    .then(($canvas) => cy.wrap($canvas[$canvas.length - 1]));
}

/**
 * Enters the drawing mode and draws a route by clicking on the given pixel
 * positions of the map canvas. Waits until Valhalla has routed every segment.
 */
export function draw_route(points: [number, number][]) {
  cy.get(".mode-toggle").contains("edit").click();

  points.forEach(([x, y], index) => {
    get_map_canvas().click(x, y);
    cy.window()
      .its("mapAnimator.anchor_points.length")
      .should("eq", index + 1);
    cy.wait(1500);
  });

  cy.window().its("mapAnimator.path.length").should("be.gt", points.length);
}

/**
 * Waits until the way points do not change anymore, i.e. until all pending
 * responses of the backend (way point selection, naming) have been applied.
 */
function wait_for_stable_way_points(previous = "", attempts = 20) {
  cy.wait(1000);
  cy.window().then((win: any) => {
    const current = JSON.stringify(
      win.mapAnimator.pois.map((poi: any) => [poi.x, poi.y, poi.name]),
    );
    const is_loading = current.includes("Lade...");

    if (current !== previous || is_loading) {
      expect(attempts, "way points should become stable").to.be.gt(0);
      wait_for_stable_way_points(current, attempts - 1);
    }
  });
}

/**
 * Switches to the Marschzeittabellen-Modus and waits until the way points
 * have been selected and named.
 */
export function open_table_mode() {
  cy.get(".mode-toggle").contains("table_chart").click();
  cy.get(".marschzeit-table tbody tr .col-name input", {
    timeout: 20_000,
  }).should("have.length.gte", 2);
  wait_for_stable_way_points();
}

/**
 * Exports the current route and waits for the download page.
 * Yields the uuid of the export.
 */
export function export_route() {
  cy.get("#export-button", { timeout: 10_000 }).should("be.enabled").click();

  cy.url({ timeout: 10_000 }).should("contain", "/pending");
  cy.url({ timeout: 180_000 }).should("contain", "/download");
  cy.get("h2").should("contain", "Deine Route wurde erfolgreich exportiert!");

  // format: <url>/download/<uuid>
  return cy.location("pathname").then((path) => path.split("/")[2]);
}

export function upload_route(file: string) {
  cy.get(".mode-toggle").contains("edit").click();
  cy.get("#gpx_upload_input", { force: true }).selectFile(
    "cypress/fixtures/" + file,
    { force: true },
  );
  cy.window().its("mapAnimator.path.length").should("be.gt", 2);
}

export function backend_url(path: string) {
  return `${Cypress.expose("BACKEND_DOMAIN")}/${path}`;
}
