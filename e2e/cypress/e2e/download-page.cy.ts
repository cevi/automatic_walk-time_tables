import { backend_url, export_route, upload_route } from "./utils";

describe("Download page", () => {
  let uuid: string;

  beforeEach(() => {
    cy.viewport(1800, 1200);
    cy.visit("/");
    upload_route("test_small.gpx");
    export_route().then((export_uuid) => (uuid = export_uuid));
  });

  it("should show the export log and how long the data is available", () => {
    expect(uuid).to.match(/^[0-9a-f]{32}$/);

    cy.get(".log-container .log-line").should("have.length.gte", 2);
    cy.get(".log-container .log-line").last().should("have.class", "success");
    cy.get(".log-container .log-line.error").should("not.exist");

    // de-CH: 1.5.2026, 08:15:00
    cy.get(".action-card strong")
      .invoke("text")
      .should("match", /\d{1,2}\.\d{1,2}\.\d{4}, \d{2}:\d{2}:\d{2}/);

    cy.request(backend_url(`status/${uuid}`))
      .its("body.status")
      .should("eq", "success");
  });

  it("should link to the exported files", () => {
    cy.get("a.download-btn")
      .should("contain", "Daten herunterladen")
      .and("have.attr", "href", backend_url(`download/${uuid}`));

    cy.request({
      url: backend_url(`download/${uuid}`),
      encoding: "binary",
    }).then((response) => {
      expect(response.status).to.eq(200);
      expect(response.headers["content-type"]).to.contain("application/zip");
      expect(response.headers["content-disposition"]).to.contain(
        "Download.zip",
      );
      // every zip file starts with the magic number "PK"
      expect(response.body.substring(0, 2)).to.eq("PK");
    });
  });

  it("should offer a link to share the route", () => {
    cy.location("origin").then((origin) => {
      cy.get("input.link-field").should(
        "have.value",
        `${origin}/retrieve/${uuid}`,
      );
    });

    cy.get("input.link-field").click();
    cy.get("mat-snack-bar-container").should(
      "contain",
      "Link in die Zwischenablage kopiert!",
    );

    cy.contains("mat-snack-bar-container button", "Schliessen").click();
    cy.get("mat-snack-bar-container").should("not.exist");

    // the copy icon behaves the same as the input field
    cy.get(".share-section mat-icon").contains("content_copy").click();
    cy.get("mat-snack-bar-container").should(
      "contain",
      "Link in die Zwischenablage kopiert!",
    );
  });

  it("should show a QR code to import the route into the swisstopo app", () => {
    cy.get("img.qr-img").should("have.attr", "src", backend_url(`qr/${uuid}`));

    // the image itself is rendered by an external service
    cy.request(backend_url(`qr/${uuid}`)).then((response) => {
      expect(response.status).to.eq(200);
      expect(response.headers["content-type"]).to.contain("image/jpg");
    });

    // the QR code points to the GPX file of the route
    cy.request(backend_url(`gpx/${uuid}.gpx`)).then((response) => {
      expect(response.status).to.eq(200);
      expect(response.headers["content-type"]).to.contain(
        "application/gpx+xml",
      );
      expect(response.body).to.contain("<gpx");
      expect(response.body).to.contain("<trkpt");
    });
  });

  it("should allow to export another route", () => {
    cy.contains("button", "Weitere Route Exportieren").click();

    cy.location("pathname").should("eq", "/");
    cy.get("h2").should("contain", "Marschzeittabellen erstellen");
  });
});
