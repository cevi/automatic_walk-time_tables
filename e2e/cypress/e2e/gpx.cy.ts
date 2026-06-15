import { test_and_save_download, test_without_interaction } from "./utils";

before(() => {
  cy.exec("rm -rf cypress/downloads/*");
});

it("detects server", () => {
  cy.visit("/");
  cy.get('button[matTooltip="So funktioniert es!"]').should("exist");
});

describe("[Batch Test] of all GPX files", () => {
  const gpx_files = Cypress.expose("gpx_files") as string[];

  gpx_files.forEach((file) => {
    it("Testing file: " + file, () => {
      test_without_interaction(file);
      test_and_save_download(file);
    });
  });
});

it("test backend availability", () => {
  const backend_domain = Cypress.expose("BACKEND_DOMAIN");
  cy.visit(backend_domain as string, { failOnStatusCode: false });
});
