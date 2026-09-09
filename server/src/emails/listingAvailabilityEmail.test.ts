import { describe, expect, it } from "vitest";
import { buildListingAvailabilityEmail } from "./listingAvailabilityEmail.js";

describe("listingAvailabilityEmail", () => {
  it("links the title to the listing and offers both still-free and rented actions", () => {
    const mail = buildListingAvailabilityEmail({
      title: "Casa con balcón en Versalles",
      city: "Guadalajara",
      neighborhood: "Chapalita",
      publisherName: "Enrique Batani",
      listingUrl: "https://dev.bestie.mx/anuncio/A12345678",
      confirmUrl: "https://dev.bestie.mx/c/9ap5fw",
      rentedUrl: "https://dev.bestie.mx/p/k7m2pq",
    });

    expect(mail.subject).toContain("Casa con balcón en Versalles");
    expect(mail.html).toContain('href="https://dev.bestie.mx/anuncio/A12345678"');
    expect(mail.html).toContain("Casa con balcón en Versalles");
    expect(mail.html).toContain("Chapalita · Guadalajara");
    expect(mail.html).toContain("Sigue libre");
    expect(mail.html).toContain('href="https://dev.bestie.mx/c/9ap5fw?e=1"');
    expect(mail.html).toContain("Ya se rentó");
    expect(mail.html).toContain('href="https://dev.bestie.mx/p/k7m2pq?e=1"');
    expect(mail.html).not.toContain("En la misma página puedes marcar que ya se rentó");
    expect(mail.text).toContain("Ver anuncio: https://dev.bestie.mx/anuncio/A12345678");
    expect(mail.text).toContain("Sigue libre: https://dev.bestie.mx/c/9ap5fw?e=1");
    expect(mail.text).toContain("Ya se rentó: https://dev.bestie.mx/p/k7m2pq?e=1");
  });
});
