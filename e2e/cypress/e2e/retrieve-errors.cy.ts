import { backend_url } from "./utils";

// has the format of a valid uuid (uuid4().hex), but was never exported
const UNKNOWN_UUID = "0123456789abcdef0123456789abcdef";

const INVALID_UUIDS = [
  "not-a-valid-uuid",
  "0123456789abcdef", // too short
  UNKNOWN_UUID + "0", // too long
  UNKNOWN_UUID.toUpperCase(),
  "0123456789abcdef0123456789abcdeg", // non-hex character
  "..",
  "..%2F..%2Fapp",
  "%2E%2E%2Foutput",
];

describe("Retrieving a route that does not exist", () => {
  it("should show an error for an unknown uuid", () => {
    cy.intercept("GET", backend_url("retrieve/*")).as("retrieve");
    cy.visit(`/retrieve/${UNKNOWN_UUID}`);

    cy.wait("@retrieve").its("response.statusCode").should("eq", 404);
    cy.get("p.error_message").should(
      "contain",
      "Die Route wurde nicht gefunden.",
    );
    cy.location("pathname").should("eq", `/retrieve/${UNKNOWN_UUID}`);
    cy.contains("button", "Neuer Versuch starten").should("exist");
  });

  it("should show an error for a malformed uuid", () => {
    cy.intercept("GET", backend_url("retrieve/*")).as("retrieve");
    cy.visit("/retrieve/not-a-valid-uuid");

    cy.wait("@retrieve").its("response.statusCode").should("eq", 404);
    cy.get("p.error_message").should(
      "contain",
      "Die Route wurde nicht gefunden.",
    );
    cy.contains("button", "Neuer Versuch starten").should("exist");
  });
});

describe("Backend routes taking an export uuid", () => {
  const routes = [
    (uuid: string) => `retrieve/${uuid}`,
    (uuid: string) => `status/${uuid}`,
    (uuid: string) => `download/${uuid}`,
    (uuid: string) => `qr/${uuid}`,
    (uuid: string) => `gpx/${uuid}.gpx`,
  ];

  INVALID_UUIDS.forEach((uuid) => {
    it(`should reject the malformed uuid "${uuid}"`, () => {
      routes.forEach((route) => {
        cy.request({
          url: backend_url(route(uuid)),
          headers: { Accept: "application/json" },
          failOnStatusCode: false,
        }).then((response) => {
          expect(response.status, route(uuid)).to.eq(404);
        });
      });
    });
  });

  it("should respond with a message for a well-formed, but unknown uuid", () => {
    const expected_messages: Record<string, string> = {
      [`retrieve/${UNKNOWN_UUID}`]:
        "Die angeforderte Route ist nicht verfügbar.",
      [`download/${UNKNOWN_UUID}`]:
        "Die angeforderten Daten sind nicht verfügbar.",
      [`gpx/${UNKNOWN_UUID}.gpx`]:
        "Die angeforderte GPX Datei ist nicht verfügbar.",
    };

    Object.entries(expected_messages).forEach(([path, message]) => {
      cy.request({
        url: backend_url(path),
        headers: { Accept: "application/json" },
        failOnStatusCode: false,
      }).then((response) => {
        expect(response.status, path).to.eq(404);
        expect(response.body.status, path).to.eq("error");
        expect(response.body.message, path).to.eq(message);
      });
    });
  });
});
