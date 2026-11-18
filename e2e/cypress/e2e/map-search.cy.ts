import { MAP_URL } from "./utils";

const SEARCH_API = "https://api3.geo.admin.ch/rest/services/ech/SearchServer*";
const SEARCH_INPUT = "app-map-search input";

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
    cy.get(SEARCH_INPUT).type("Wald", { delay: 0 });

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
      .should("have.text", "Waldhof (ZH)");

    // the category of the API label is shown as the type of the result
    cy.get("mat-option .result-details").eq(0).should("have.text", "Gemeinde");
    cy.get("mat-option .result-details")
      .eq(1)
      .should("have.text", "Haltestelle · Zug");
    cy.get("mat-option .result-details").eq(2).should("have.text", "Flurname");
    cy.get("mat-option mat-icon").eq(1).should("have.text", "train");

    // only the search term gets highlighted
    cy.get("mat-option .result-label")
      .eq(2)
      .find("b")
      .should("have.length", 1)
      .and("have.text", "Wald");
  });

  it("should highlight every word of the search on its own", () => {
    cy.get(SEARCH_INPUT).type("Bahnhof Wald", { delay: 0 });
    cy.wait("@search").its("request.query.lang").should("eq", "de");

    cy.contains("mat-option", "Wald (ZH), Bahnhof")
      .find(".result-label b")
      .then((marks) => [...marks].map((b) => b.textContent))
      .should("deep.equal", ["Wald", "Bahnhof"]);
  });

  it("should not search for less than two characters", () => {
    cy.get(SEARCH_INPUT).type("W", { delay: 0 });
    cy.wait(1000);
    cy.get("@search.all").should("have.length", 0);
    cy.get("mat-option").should("not.exist");
  });

  it("should jump to a selected stop and mark it on the map", () => {
    cy.get(SEARCH_INPUT).type("Wald", { delay: 0 });
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
    cy.get(SEARCH_INPUT).type("Wald", { delay: 0 });
    cy.contains("mat-option .result-label", /^\s*Wald \(ZH\)\s*$/).click();

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
    cy.get(SEARCH_INPUT).type("Wald", { delay: 0 });
    cy.contains("mat-option", "Wald (ZH), Bahnhof").click();
    expect_search_markers(1);

    cy.get('button[aria-label="Clear"]').click();

    cy.get(SEARCH_INPUT).should("have.value", "");
    cy.get('button[aria-label="Clear"]').should("not.exist");
    expect_search_markers(0);
  });

  it("should tell when nothing was found", () => {
    cy.intercept("GET", SEARCH_API, { results: [] }).as("empty_search");
    cy.get(SEARCH_INPUT).type("Nirgendwo", { delay: 0 });

    cy.wait("@empty_search");
    cy.get("mat-option").should("have.length", 1);
    cy.get("mat-option.search-message")
      .should("contain", "Keine Ergebnisse für «Nirgendwo»")
      .and("have.attr", "aria-disabled", "true");
  });

  it("should show the places if the stops search fails and keep searching", () => {
    cy.intercept("GET", SEARCH_API, (req) => {
      if (req.query["origins"] === "haltestellen") {
        req.reply({ statusCode: 500 });
      } else {
        req.reply({ fixture: "stubs/search_locations.json" });
      }
    }).as("half_broken_search");
    cy.get(SEARCH_INPUT).type("Wald", { delay: 0 });

    cy.get("mat-option .result-label").should("have.length", 2);
    cy.get("mat-option").should("not.contain", "Bahnhof");

    // the search still reacts after a failed request
    cy.get(SEARCH_INPUT).type("h", { delay: 0 });
    cy.get("@half_broken_search.all").should((calls: any) => {
      const texts = calls.map((call: any) => call.request.query["searchText"]);
      expect(texts).to.include("Waldh");
    });
  });

  it("should tell when the search is not available", () => {
    cy.intercept("GET", SEARCH_API, { statusCode: 500 }).as("broken_search");
    cy.get(SEARCH_INPUT).type("Wald", { delay: 0 });

    cy.get("mat-option.search-message").should(
      "contain",
      "Die Suche ist gerade nicht verfügbar",
    );
  });

  describe("coordinates", () => {
    const cases = [
      ["LV95", "2'600'000 1'200'000", "2'600'000, 1'200'000", 2600000, 1200000],
      [
        "LV95 swapped",
        "1200000/2600000",
        "2'600'000, 1'200'000",
        2600000,
        1200000,
      ],
      ["LV03", "600000, 200000", "2'600'000, 1'200'000", 2600000, 1200000],
      ["WGS 84", "46.95 7.44", "46.95000° N, 7.44000° E", 2600104, 1199880],
      [
        "WGS 84 DMS",
        `46°57'3.6"N 7°26'24"E`,
        "46.95100° N, 7.44000° E",
        2600104,
        1199991,
      ],
    ] as const;

    for (const [name, query, label, east, north] of cases) {
      it(`should jump to ${name} coordinates without querying the API`, () => {
        cy.get(SEARCH_INPUT).type(query, { delay: 0 });

        cy.get("mat-option").should("have.length", 1);
        cy.get("mat-option .result-label").should("have.text", label);
        cy.get("mat-option .result-details").should("contain", "Koordinate");
        // a slow typist may trigger a name search for a prefix, but never for the coordinate
        cy.get("@search.all").should((calls: any) => {
          const texts = calls.map(
            (call: any) => call.request.query["searchText"],
          );
          expect(texts).not.to.include(query);
        });

        cy.get("mat-option").click();
        cy.window().should((win: any) => {
          const view = win.mapService.get_map().getView();
          expect(view.getCenter()[0]).to.be.closeTo(east, 2);
          expect(view.getCenter()[1]).to.be.closeTo(north, 2);
          expect(view.getResolution()).to.be.closeTo(2.5, 0.01);
        });
        expect_search_markers(1);
      });
    }

    it("should search names for numbers outside of Switzerland", () => {
      cy.get(SEARCH_INPUT).type("2023 2024", { delay: 0 });
      cy.wait("@search")
        .its("request.query.searchText")
        .should("eq", "2023 2024");
    });
  });
});
