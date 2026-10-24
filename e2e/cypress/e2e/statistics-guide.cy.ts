import { backend_url, export_route, upload_route } from "./utils";

const STATISTICS_API = "**/statistics?days=30";

function open_statistics() {
  cy.visit("/");
  cy.get('button[matTooltip="Statistiken"]').click();
  cy.location("pathname").should("eq", "/statistics");
  cy.get("#control-area").should("be.visible");
}

describe("Statistics page", () => {
  beforeEach(() => {
    cy.viewport(1800, 1200);
  });

  it("should show the summary cards and the chart", () => {
    cy.intercept("GET", STATISTICS_API).as("statistics");
    open_statistics();

    cy.wait("@statistics").its("response.statusCode").should("eq", 200);

    cy.get("h1").should("contain", "Routenstatistik der letzten 30 Tage");
    cy.get(".summary-card").should("have.length", 3);
    cy.contains(".summary-card", "Geplante Gesamtdistanz")
      .find(".value")
      .invoke("text")
      .should("match", /^\d+\.\d km$/);
    cy.contains(".summary-card", "Generierte Routen")
      .find(".value")
      .invoke("text")
      .should("match", /^\d+$/);
    cy.contains(".summary-card", "Aktive Tage")
      .find(".value")
      .invoke("text")
      .should("match", /^\d+$/);

    cy.get(".statistics-chart canvas").should("be.visible");
  });

  it("should render the numbers returned by the backend", () => {
    cy.intercept("GET", STATISTICS_API, {
      days: 30,
      rangeStart: "2026-01-01",
      rangeEnd: "2026-01-30",
      dailyStats: [
        { date: "2026-01-01", routesCount: 2, totalLengthM: 10_000 },
        { date: "2026-01-02", routesCount: 0, totalLengthM: 0 },
        { date: "2026-01-03", routesCount: 5, totalLengthM: 32_340 },
      ],
      totalRoutes: 7,
      totalLengthM: 42_340,
    });
    open_statistics();

    cy.contains(".summary-card", "Geplante Gesamtdistanz")
      .find(".value")
      .should("have.text", "42.3 km");
    cy.contains(".summary-card", "Geplante Gesamtdistanz")
      .find(".hint")
      .should("contain", "von 2026-01-01 bis 2026-01-30");
    cy.contains(".summary-card", "Generierte Routen")
      .find(".value")
      .should("have.text", "7");
    cy.contains(".summary-card", "Aktive Tage")
      .find(".value")
      .should("have.text", "2");
  });

  it("should show an error if the statistics are unavailable and recover on refresh", () => {
    cy.intercept("GET", STATISTICS_API, { statusCode: 502, body: {} });
    open_statistics();

    cy.get(".error-state").should(
      "contain",
      "Die Statistiken konnten nicht geladen werden.",
    );
    cy.get(".summary-card").should("not.exist");

    // the backend is reachable again
    cy.intercept("GET", STATISTICS_API, (req) => req.continue());
    cy.contains("button", "Aktualisieren").click();

    cy.get(".error-state").should("not.exist");
    cy.get(".summary-card").should("have.length", 3);
  });

  it("should count a newly exported route", () => {
    const today = new Date().toISOString().substring(0, 10);

    cy.request(backend_url("statistics?days=30")).then((before) => {
      expect(before.body.days).to.eq(30);
      expect(before.body.dailyStats).to.have.length(30);
      expect(before.body.rangeEnd).to.eq(today);

      cy.visit("/");
      upload_route("test_small.gpx");
      export_route();

      cy.request(backend_url("statistics?days=30")).then((after) => {
        expect(after.body.totalRoutes).to.eq(before.body.totalRoutes + 1);
        expect(after.body.totalLengthM).to.be.gt(before.body.totalLengthM);

        open_statistics();
        cy.contains(".summary-card", "Generierte Routen")
          .find(".value")
          .should("have.text", `${after.body.totalRoutes}`);
        cy.contains(".summary-card", "Aktive Tage")
          .find(".value")
          .should(($el) => expect(parseInt($el.text())).to.be.gte(1));
      });
    });
  });

  it("should reject an invalid time range", () => {
    cy.request({
      url: backend_url("statistics?days=0"),
      failOnStatusCode: false,
    })
      .its("status")
      .should("eq", 400);
  });
});

describe("Statistics and guide drawer", () => {
  const query = "center=2708224.25%2C1240069.50&z=8.989";

  beforeEach(() => {
    cy.viewport(1800, 1200);
    cy.visit("/?" + query);
  });

  it("should open and close the statistics", () => {
    cy.get("#control-area").should("not.be.visible");

    cy.get('button[matTooltip="Statistiken"]').click();
    cy.location("pathname").should("eq", "/statistics");
    cy.location("search").should("contain", "z=8.989");
    cy.get("#control-area").should("be.visible");
    cy.get("h1").should("contain", "Routenstatistik");

    cy.get('button[matTooltip="Statistiken"]').click();
    cy.location("pathname").should("eq", "/");
    cy.location("search").should("contain", "z=8.989");
    cy.get("#control-area").should("not.be.visible");
  });

  it("should open and close the user guide", () => {
    cy.get('button[matTooltip="So funktioniert es!"]').click();
    cy.location("pathname").should("eq", "/guide");
    cy.location("search").should("contain", "z=8.989");
    cy.get("#control-area").should("be.visible");
    cy.get("h1").should(
      "contain",
      "J+S-Marschzeittabellen automatisiert generieren",
    );
    cy.contains("h2", "Woher erhalte ich eine GPX-Datei?").should("exist");
    cy.contains("h2", "Woher erhalte ich eine KML-Datei?").should("exist");

    cy.get('button[matTooltip="So funktioniert es!"]').click();
    cy.location("pathname").should("eq", "/");
    cy.get("#control-area").should("not.be.visible");
  });

  it("should switch between the guide and the statistics", () => {
    cy.get('button[matTooltip="So funktioniert es!"]').click();
    cy.location("pathname").should("eq", "/guide");

    cy.get('button[matTooltip="Statistiken"]').click();
    cy.location("pathname").should("eq", "/statistics");
    cy.get("#control-area").should("be.visible");
    cy.get("h1").should("contain", "Routenstatistik");
  });
});
