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
