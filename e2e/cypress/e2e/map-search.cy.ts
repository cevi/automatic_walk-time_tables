import { MAP_URL } from "./utils";

const SEARCH_API = "https://api3.geo.admin.ch/rest/services/ech/SearchServer*";
const SEARCH_INPUT = 'input[placeholder="Orte, Adressen, Flurnamen..."]';

/**
 * The search results of swisstopo are stubbed, as we only want to test our
 * handling of the results.
 */
function stub_search_api() {
  cy.intercept("GET", SEARCH_API, (req) => {
    const fixture =
      req.query["origins"] === "haltestellen"
        ? "stubs/search_haltestellen.json"
        : "stubs/search_locations.json";
    req.reply({ fixture });
  }).as("search");
}

function expect_search_markers(count: number) {
  cy.window().should((win: any) => {
    const markers = win.mapService
      .get_map()
      .getLayers()
      .getArray()
      .filter((layer: any) => layer.getZIndex() === 1000)
      .flatMap((layer: any) => layer.getSource().getFeatures());
    expect(markers).to.have.length(count);
  });
}

describe("Map search", () => {
  beforeEach(() => {
    cy.viewport(1800, 1200);
    stub_search_api();
    cy.visit(MAP_URL);
    cy.get("#map-canvas canvas").should("exist");
  });

  it("should query places, public transport stops and order the results by relevance", () => {
    cy.get(SEARCH_INPUT).type("Wald");

    cy.wait("@search").then(({ request }) => {
      expect(request.query["searchText"]).to.eq("Wald");
      expect(request.query["type"]).to.eq("locations");
      expect(request.query["sr"]).to.eq("2056");
    });
    cy.wait("@search");
    cy.get("@search.all").then((calls: any) => {
      const origins = calls.map((call: any) => call.request.query["origins"]);
      expect(origins).to.have.members([
        "gg25,zipcode,kantone,district,address,gazetteer",
        "haltestellen",
      ]);
    });

    // municipalities are listed before stops, stops before field names
    cy.get("mat-option .result-label").should("have.length", 3);
    cy.get("mat-option .result-label").eq(0).should("have.text", "Wald (ZH)");
    cy.get("mat-option .result-label")
      .eq(1)
      .should("have.text", "Wald (ZH), Bahnhof");
    cy.get("mat-option .result-label")
      .eq(2)
      .should("have.text", "Flurname Waldhof (ZH)");

    // only the search term gets highlighted
    cy.get("mat-option .result-label")
      .eq(2)
      .find("b")
      .should("have.length", 1)
      .and("have.text", "Wald");
  });

  it("should not search for less than two characters", () => {
    cy.get(SEARCH_INPUT).type("W");
    cy.wait(1000);
    cy.get("@search.all").should("have.length", 0);
    cy.get("mat-option").should("not.exist");
  });

  it("should jump to a selected stop and mark it on the map", () => {
    cy.get(SEARCH_INPUT).type("Wald");
    cy.contains("mat-option", "Wald (ZH), Bahnhof").click();

    cy.get(SEARCH_INPUT).should("have.value", "Wald (ZH), Bahnhof");
    cy.get("mat-option").should("not.exist");

    // the map is centered on the coordinates of the stop
    cy.window().should((win: any) => {
      const view = win.mapService.get_map().getView();
      expect(view.getCenter()[0]).to.be.closeTo(2712450, 1);
      expect(view.getCenter()[1]).to.be.closeTo(1236720, 1);
      expect(view.getZoom()).to.be.closeTo(10, 0.01);
    });
    expect_search_markers(1);

    cy.location("search").should("contain", "center=2712450.00%2C1236720.00");
  });

  it("should fit the map to the extent of a selected municipality", () => {
    cy.get(SEARCH_INPUT).type("Wald");
    cy.contains("mat-option", /^\s*Wald \(ZH\)\s*$/).click();

    cy.get(SEARCH_INPUT).should("have.value", "Wald (ZH)");

    // BOX(2708000 1233000,2717000 1240500)
    cy.window().should((win: any) => {
      const map = win.mapService.get_map();
      const center = map.getView().getCenter();
      expect(center[0]).to.be.closeTo(2712500, 1);
      expect(center[1]).to.be.closeTo(1236750, 1);

      const extent = map.getView().calculateExtent(map.getSize());
      expect(extent[0]).to.be.lte(2708000);
      expect(extent[1]).to.be.lte(1233000);
      expect(extent[2]).to.be.gte(2717000);
      expect(extent[3]).to.be.gte(1240500);
    });
    expect_search_markers(1);
  });

  it("should remove the marker when the search is cleared", () => {
    cy.get(SEARCH_INPUT).type("Wald");
    cy.contains("mat-option", "Wald (ZH), Bahnhof").click();
    expect_search_markers(1);

    cy.get('button[aria-label="Clear"]').click();

    cy.get(SEARCH_INPUT).should("have.value", "");
    cy.get('button[aria-label="Clear"]').should("not.exist");
    expect_search_markers(0);
  });

  it("should show no results if nothing was found", () => {
    cy.intercept("GET", SEARCH_API, { results: [] }).as("empty_search");
    cy.get(SEARCH_INPUT).type("Nirgendwo");

    cy.wait("@empty_search");
    cy.get("mat-option").should("not.exist");
  });
});
