describe("Initial Landing Page and GPX Input check", () => {
  it("should load the page, check input initially, switch to edit mode, and check input again", () => {
    // Navigate to /
    cy.visit("/");

    // Wait for the app-root to exist
    cy.get("app-root").should("exist");

    // 1. Verify that the GPX upload input does NOT exist initially (in view mode)
    cy.get("#gpx_upload_input").should("not.exist");

    // 2. Click the edit mode icon in the mode toggle toolbar to enter Zeichnen-Modus
    // The icon is inside .mode-toggle and contains the text 'edit'
    cy.get(".mode-toggle").contains("edit").click();

    // 3. Verify that the app mode is now edit mode, and the GPX upload input is present
    cy.get("#gpx_upload_input").should("exist");

    // Take a screenshot of the landing page in edit mode
    cy.screenshot("edit_mode_landing_page", { capture: "viewport" });

    // Read the document HTML and write it using cy.writeFile so we can inspect the DOM in edit mode
    cy.document().then((doc) => {
      const html = doc.documentElement.outerHTML;
      cy.writeFile("cypress/fixtures/page_dom_edit_mode.html", html);
    });
  });
});
