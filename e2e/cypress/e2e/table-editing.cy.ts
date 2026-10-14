import { draw_route, get_map_canvas, MAP_URL, open_table_mode } from "./utils";

const ROWS = ".marschzeit-table tbody tr";

/** Parses a duration (h:mm) or a time of day (HH:mm) into minutes. */
function to_minutes(text: string): number {
  const [hours, minutes] = text.trim().split(":").map(Number);
  return hours * 60 + minutes;
}

function get_arrival_times() {
  return cy
    .get(`${ROWS} .time-badge`)
    .then(($badges) => [...$badges].map((el) => to_minutes(el.innerText)));
}

function get_walk_times() {
  return cy
    .get(`${ROWS} td:nth-child(6)`)
    .then(($cells) =>
      [...$cells].slice(1).map((el) => to_minutes(el.innerText)),
    );
}

/**
 * Yields the index of a way point with a name, as not every location has one.
 */
function get_named_way_point() {
  return cy.get(`${ROWS} .col-name input`).then(($inputs) => {
    const index = [...$inputs].findIndex(
      (el) => (el as HTMLInputElement).value !== "",
    );
    expect(index, "index of a named way point").to.be.gte(0);
    return index;
  });
}

function minutes_between(start: number, end: number) {
  return (end - start + 24 * 60) % (24 * 60);
}

describe("Marschzeittabelle without a route", () => {
  it("should ask the user to draw or import a route", () => {
    cy.viewport(1800, 1200);
    cy.visit(MAP_URL);
    cy.get(".mode-toggle").contains("table_chart").click();

    cy.get("#control-area").should("be.visible");
    cy.get(".marschzeit-table .empty-state").should(
      "contain",
      "Noch keine Route vorhanden",
    );
    cy.get("#export-button").should("be.disabled");
    cy.get(".stats-overlay:not(.hidden)").should("not.exist");
  });
});

describe("Editing the Marschzeittabelle", () => {
  beforeEach(() => {
    cy.viewport(1800, 1200);
    cy.visit(MAP_URL);
    draw_route([
      [600, 500],
      [700, 500],
      [800, 500],
    ]);
    open_table_mode();
  });

  it("should list the way points with their names, heights and times", () => {
    cy.get(ROWS).should("have.length.gte", 2);

    // the way points get named by the backend
    get_named_way_point();

    cy.get(".map-number-cell").should(($cell) => {
      expect($cell.text().trim()).to.not.be.empty;
      expect($cell.text()).to.not.contain("Lade...");
    });

    // the first row has no distance and time, the following rows do
    cy.get(ROWS)
      .first()
      .find("td")
      .eq(3)
      .invoke("text")
      .should("match", /^\s*$/);
    cy.get(ROWS)
      .last()
      .find("td")
      .eq(3)
      .invoke("text")
      .should("match", /\d+\.\d/);
    cy.get(ROWS)
      .last()
      .find("td")
      .eq(5)
      .invoke("text")
      .should("match", /\d:\d\d/);

    // the height of every way point is known
    cy.get(`${ROWS} td:nth-child(2)`).each(($cell) => {
      expect(parseInt($cell.text().replace(/\D/g, ""))).to.be.gt(300);
    });

    // the arrival times are increasing
    get_arrival_times().then((times) => {
      for (let i = 1; i < times.length; i++) {
        expect(minutes_between(times[0], times[i])).to.be.gte(
          minutes_between(times[0], times[i - 1]),
        );
      }
    });
  });

  it("should show the key figures of the route on the map", () => {
    cy.get(".stats-overlay").should("not.have.class", "hidden");
    cy.get(".stats-overlay .stat-item").should("have.length", 5);

    cy.get('.stat-item[matTooltip="Distanz"]')
      .invoke("text")
      .should("match", /\d+\.\d\s*km/);
    cy.get('.stat-item[matTooltip="Leistungskilometer"]')
      .invoke("text")
      .should("match", /\d+\.\d\s*Lkm/);
    cy.get('.stat-item[matTooltip="Aufstieg"]')
      .invoke("text")
      .should("match", /\d+\s*m/);
    cy.get('.stat-item[matTooltip="Abstieg"]')
      .invoke("text")
      .should("match", /\d+\s*m/);
    cy.get('.stat-item[matTooltip="Wanderzeit"]')
      .invoke("text")
      .should("match", /\d/);

    // the distance matches the sum of the distances in the table
    cy.get(`${ROWS} td:nth-child(4)`).then(($cells) => {
      const table_distance = [...$cells]
        .map((el) => parseFloat(el.innerText) || 0)
        .reduce((a, b) => a + b, 0);

      cy.get('.stat-item[matTooltip="Distanz"]')
        .invoke("text")
        .then((text) => {
          expect(parseFloat(text.replace(/[^\d.]/g, ""))).to.be.closeTo(
            table_distance,
            0.1 * $cells.length,
          );
        });
    });
  });

  it("should rename a way point and restore its automatic name", () => {
    get_named_way_point().then((index) => {
      const name_input = () => cy.get(`${ROWS} .col-name input`).eq(index);
      const auto_name_icon = () =>
        cy
          .get(ROWS)
          .eq(index)
          .find('mat-icon[matTooltip="Automatisch benennen"]');

      name_input()
        .invoke("val")
        .then((automatic_name) => {
          name_input().type("{selectall}Mein Wegpunkt");
          cy.window()
            .its(`mapAnimator.pois.${index}.name`)
            .should("eq", "Mein Wegpunkt");

          auto_name_icon().should("not.have.class", "disabled-icon").click();

          cy.get(`${ROWS} .col-name input`, { timeout: 20_000 })
            .eq(index)
            .should("have.value", automatic_name);
          auto_name_icon().should("have.class", "disabled-icon");
        });
    });
  });

  it("should keep a renamed way point when the mode is switched", () => {
    cy.get(`${ROWS} .col-name input`).last().clear().type("Mein Ziel");

    cy.get(".mode-toggle").contains("visibility").click();
    cy.get("#control-area").should("not.be.visible");
    cy.get(".mode-toggle").contains("table_chart").click();

    cy.get(`${ROWS} .col-name input`).last().should("have.value", "Mein Ziel");
  });

  it("should delay the following way points by a break", () => {
    get_arrival_times().then((before) => {
      // the column with the breaks is clipped by the drawer
      cy.get(`${ROWS} .col-break input`).first().type("30", { force: true });

      get_arrival_times().should((after) => {
        expect(minutes_between(before[0], after[0])).to.eq(30);
        expect(minutes_between(before[1], after[1])).to.eq(30);
      });

      // a second break only affects the way points after it
      cy.get(`${ROWS} .col-break input`).last().type("15", { force: true });

      get_arrival_times().should((after) => {
        const last = before.length - 1;
        expect(minutes_between(before[0], after[0])).to.eq(30);
        expect(minutes_between(before[last], after[last])).to.eq(45);
      });
    });

    cy.window().its("mapAnimator.pois.0.break_duration").should("eq", 30);
  });

  it("should recalculate the walk times for another velocity", () => {
    cy.get('[formControlName="velocity"]').clear().type("4");

    get_walk_times().then((walk_times) => {
      const total = walk_times.reduce((a, b) => a + b, 0);
      expect(total).to.be.gt(0);

      cy.get('[formControlName="velocity"]').clear().type("2");

      // half the velocity, twice the time (up to rounding to minutes)
      get_walk_times().should((slow_walk_times) => {
        const slow_total = slow_walk_times.reduce((a, b) => a + b, 0);
        expect(slow_total).to.be.closeTo(2 * total, walk_times.length);
      });
    });

    cy.window().then((win: any) => {
      expect(win.mapAnimator.velocity$.getValue()).to.eq(2);
    });
  });

  it("should start the table at the departure time", () => {
    cy.get('[formControlName="departure_time"]').type("2026-05-01T08:15");

    cy.get(`${ROWS} .time-badge`).first().should("have.text", "08:15");
    get_arrival_times().should((times) => {
      expect(times[0]).to.eq(8 * 60 + 15);
      expect(times[times.length - 1]).to.be.gt(8 * 60 + 15);
    });
  });
});

describe("Magnetic drawing", () => {
  beforeEach(() => {
    cy.viewport(1800, 1200);
    cy.visit(MAP_URL);
    cy.get(".mode-toggle").contains("edit").click();
  });

  it("should be enabled by default and can be toggled", () => {
    cy.get(".icon-magnet").should("have.class", "active");
    cy.window().its("mapAnimator.magnetic_paths").should("eq", true);

    cy.get(".icon-magnet").click();
    cy.get(".icon-magnet").should("not.have.class", "active");
    cy.window().its("mapAnimator.magnetic_paths").should("eq", false);

    cy.get(".icon-magnet").click();
    cy.get(".icon-magnet").should("have.class", "active");
  });

  it("should connect the points with straight lines if disabled", () => {
    cy.get(".icon-magnet").click();

    get_map_canvas().click(600, 500);
    cy.window().its("mapAnimator.anchor_points.length").should("eq", 1);
    get_map_canvas().click(700, 500);
    cy.window().its("mapAnimator.anchor_points.length").should("eq", 2);
    cy.wait(1500);

    // the path is not snapped to the roads
    cy.window().its("mapAnimator.path.length").should("eq", 2);
  });
});
