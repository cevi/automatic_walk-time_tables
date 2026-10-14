import { test_and_save_download } from './utils';

describe('Interactive Route Drawing, UI Settings Change and Export', () => {
    beforeEach(() => {
        cy.viewport(1800, 1200);
        // Visit the map area
        cy.visit('/?center=2708224.25%2C1240069.50&z=8.989');
    });

    before(() => {
        cy.exec('rm -rf cypress/downloads/*');
    });

    it('should draw a path interactively, modify UI settings, and export successfully', () => {
        // Enter edit/drawing mode
        cy.get('.mode-toggle').contains('edit').click();

        // Draw a route by clicking on the map canvas
        cy.xpath('//*[@id="map-canvas"]/div[1]/div[1]/div/canvas').then(($canvas) => {
            const canvas = $canvas[$canvas.length - 1] as HTMLCanvasElement;
            const wrapper = cy.wrap(canvas);

            // Draw point 1
            wrapper.click(600, 500);
            cy.wait(1000);

            // Draw point 2
            wrapper.click(700, 500);
            cy.wait(2000);
        });

        // Verify that the route is snapped to roads by Valhalla (not just a straight line)
        cy.window().then((win: any) => {
            expect(win.mapAnimator.path.length).to.be.gt(2);
        });

        // Switch to table/export settings mode to reveal the settings panel
        cy.get('.mode-toggle').contains('table_chart').click();

        // Verify the export settings panel has loaded and fields are editable
        cy.get('[formControlName="route_name"]').should('exist');

        // Interact with settings
        // 1. Change route name
        cy.get('[formControlName="route_name"]')
            .clear()
            .type('Drawn Route Test');

        // 2. Change velocity
        cy.get('[formControlName="velocity"]')
            .clear()
            .type('4.5');

        // 3. Toggle auto scale
        cy.get('[formControlName="auto_scale"]').click();

        // Verify that the export button is enabled
        cy.get('#export-button').should('be.enabled');

        // Click the export button
        cy.get('#export-button').click();

        // Verify redirection to /pending and /download
        cy.url({ timeout: 10_000 }).should('contain', '/pending');
        cy.url({ timeout: 120_000 }).should('contain', '/download');

        // Verify completion screen header
        cy.get('h2').should('contain', 'Deine Route wurde erfolgreich exportiert!');

        // Verify and extract download ZIP
        test_and_save_download('custom_drawn_route.gpx');
    });
});
