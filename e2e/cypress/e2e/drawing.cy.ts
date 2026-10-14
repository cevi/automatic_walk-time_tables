import "cypress-xpath";

describe("Interactive Route Drawing and Toolbar Controls", () => {
  beforeEach(() => {
    cy.viewport(1800, 1200);
    cy.visit("/?center=2708224.25%2C1240069.50&z=8.989");
  });

  it("should allow entering edit mode, drawing a path, drag-and-drop modifying, performing undo/redo, reversing, and clearing", () => {
    // 1. Verify that we start in view mode (drawer is closed, no drawing tools visible)
    cy.get('button[matTooltip="Tour umkehren"]').should("not.exist");

    // 2. Click the edit mode button to enter Zeichnen-Modus
    cy.get(".mode-toggle").contains("edit").click();

    // Verify that the drawing toolbar buttons are now rendered
    cy.get('button[matTooltip="Tour umkehren"]').should("exist");
    cy.get('button[matTooltip="Rückgängig machen"]').should("exist");
    cy.get('button[matTooltip="Wiederherstellen"]').should("exist");
    cy.get('button[matTooltip="Route verwerfen"]').should("exist");

    // Verify that undo, redo, reverse, and discard buttons are initially disabled (since no route is drawn yet)
    cy.get('button[matTooltip="Tour umkehren"]').should("be.disabled");
    cy.get('button[matTooltip="Rückgängig machen"]').should("be.disabled");
    cy.get('button[matTooltip="Wiederherstellen"]').should("be.disabled");
    cy.get('button[matTooltip="Route verwerfen"]').should("be.disabled");

    // 3. Click on the map canvas to draw multiple points (waypoints)
    cy.xpath('//*[@id="map-canvas"]/div[1]/div[1]/div/canvas').then(
      ($canvas) => {
        const canvas = $canvas[$canvas.length - 1] as HTMLCanvasElement;
        const wrapper = cy.wrap(canvas);

        // Draw point 1
        wrapper.click(600, 500);
        cy.wait(1000);

        // Draw point 2 (creating a line segment)
        wrapper.click(700, 500);
        cy.wait(2000);

        // Draw point 3 (multiple waypoints)
        wrapper.click(800, 500);
        cy.wait(2000);

        // Draw point 4 (to test click-to-delete)
        wrapper.click(900, 500);
        cy.wait(2000);
      },
    );

    // 3b. Verify we have 4 anchor points initially
    cy.window().then((win: any) => {
      expect(win.mapAnimator.anchor_points.length).to.eq(4);
    });

    // Click on the existing point 4 to remove it
    // In edit/drawing mode, a click on an existing anchor point deletes it.
    // We hover over point 4 at (900, 500) to set hovered_anchor, then click it.
    cy.xpath('//*[@id="map-canvas"]/div[1]/div[1]/div/canvas').then(
      ($canvas) => {
        const canvas = $canvas[$canvas.length - 1] as HTMLCanvasElement;
        const rect = canvas.getBoundingClientRect();
        const clientX = rect.left + 900;
        const clientY = rect.top + 500;

        const wrapper = cy.wrap(canvas);

        // Hover (trigger pointermove/mousemove)
        wrapper.trigger("pointermove", {
          clientX,
          clientY,
          button: 0,
          buttons: 0,
          pointerId: 1,
          isPrimary: true,
          force: true,
        });
        wrapper.trigger("mousemove", {
          clientX,
          clientY,
          button: 0,
          buttons: 0,
          force: true,
        });
        cy.wait(500);

        // Click to delete
        wrapper.click(900, 500);
        cy.wait(2000); // Wait for route to recalculate
      },
    );

    // Verify that the anchor point 4 was removed (count goes back to 3)
    cy.window().then((win: any) => {
      expect(win.mapAnimator.anchor_points.length).to.eq(3);
    });

    // Verify that the route is not a straight line (it should be snapped to roads by Valhalla)
    cy.window().then((win: any) => {
      expect(win.mapAnimator.path.length).to.be.gt(3);
    });

    // 4. Verify that buttons are now enabled since there is a valid path
    cy.get('button[matTooltip="Tour umkehren"]').should("not.be.disabled");
    cy.get('button[matTooltip="Rückgängig machen"]').should("not.be.disabled");
    cy.get('button[matTooltip="Route verwerfen"]').should("not.be.disabled");

    // Capture original path length before modifying
    let originalPathLength = 0;
    cy.window().then((win: any) => {
      originalPathLength = win.mapAnimator.path.length;
    });

    // 5. Test Drag and Drop (modify existing route in the middle)
    // Drag point at (700, 500) to (700, 400)
    cy.xpath('//*[@id="map-canvas"]/div[1]/div[1]/div/canvas').then(
      ($canvas) => {
        const canvas = $canvas[$canvas.length - 1] as HTMLCanvasElement;
        const rect = canvas.getBoundingClientRect();

        // Coordinate relative to canvas is (700, 500)
        const clientX = rect.left + 700;
        const clientY = rect.top + 500;

        // Drag destination coordinate is (700, 400)
        const targetX = rect.left + 700;
        const targetY = rect.top + 400;

        const wrapper = cy.wrap(canvas);

        // Trigger pointerdown/mousedown on the middle waypoint
        wrapper.trigger("pointerdown", {
          clientX,
          clientY,
          button: 0,
          buttons: 1,
          pointerId: 1,
          isPrimary: true,
          force: true,
        });
        wrapper.trigger("mousedown", {
          clientX,
          clientY,
          button: 0,
          buttons: 1,
          force: true,
        });
        cy.wait(500);

        // Drag to intermediate point
        wrapper.trigger("pointermove", {
          clientX: targetX,
          clientY: (clientY + targetY) / 2,
          button: 0,
          buttons: 1,
          pointerId: 1,
          isPrimary: true,
          force: true,
        });
        wrapper.trigger("mousemove", {
          clientX: targetX,
          clientY: (clientY + targetY) / 2,
          button: 0,
          buttons: 1,
          force: true,
        });
        cy.wait(200);

        // Drag to destination
        wrapper.trigger("pointermove", {
          clientX: targetX,
          clientY: targetY,
          button: 0,
          buttons: 1,
          pointerId: 1,
          isPrimary: true,
          force: true,
        });
        wrapper.trigger("mousemove", {
          clientX: targetX,
          clientY: targetY,
          button: 0,
          buttons: 1,
          force: true,
        });
        cy.wait(500);

        // Release pointerup/mouseup
        wrapper.trigger("pointerup", {
          clientX: targetX,
          clientY: targetY,
          button: 0,
          buttons: 0,
          pointerId: 1,
          isPrimary: true,
          force: true,
        });
        wrapper.trigger("mouseup", {
          clientX: targetX,
          clientY: targetY,
          button: 0,
          buttons: 0,
          force: true,
        });
        cy.wait(2500); // Wait for the route to recalculate
      },
    );

    // Verify path length has changed due to modification routing
    cy.window().then((win: any) => {
      expect(win.mapAnimator.path.length).to.not.equal(originalPathLength);
    });

    // 6. Test Undo/Redo for the drag action
    cy.get('button[matTooltip="Wiederherstellen"]').should("be.disabled");

    // Undo the drag modification
    cy.get('button[matTooltip="Rückgängig machen"]').click();
    cy.wait(1500);
    cy.get('button[matTooltip="Wiederherstellen"]').should("not.be.disabled");

    // Redo the drag modification
    cy.get('button[matTooltip="Wiederherstellen"]').click();
    cy.wait(1500);
    cy.get('button[matTooltip="Wiederherstellen"]').should("be.disabled");

    // 7. Test Tour umkehren (Reverse Route)
    cy.get('button[matTooltip="Tour umkehren"]').click();
    cy.wait(1500);

    // 8. Test Route verwerfen (Clear Route)
    cy.get('button[matTooltip="Route verwerfen"]').click();
    cy.wait(1000);

    // Verify that buttons are disabled again
    cy.get('button[matTooltip="Tour umkehren"]').should("be.disabled");
    cy.get('button[matTooltip="Rückgängig machen"]').should("be.disabled");
    cy.get('button[matTooltip="Route verwerfen"]').should("be.disabled");
  });
});
