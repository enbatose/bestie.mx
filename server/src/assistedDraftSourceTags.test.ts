import { describe, expect, it } from "vitest";
import { mergeExtractionWithHints } from "./assistedDraftMerge.js";
import {
  applySourceTextTagSignals,
  inferBinaryTagsFromSourceText,
} from "./assistedDraftSourceTags.js";

const PET_POSITIVE_POST = `Busco roomie profesionista y tranquilo, para compartir casa,  en un coto privado con seguridad las 24 h, cuenta con casa club para eventos y alberca Disponible
📍 Ubicación  con muchas rutas de trasporte y a 10 mn de macro periférico
• Zona tranquila y súper bien conectada
🏡 sería casa con dos rumies
• Solo seríamos 2 personas
• Hay dos perritos una grande y una chiquita pero no hacen desastres
• Ambiente relajado, limpio y de buena convivencia
El cuarto
• Sin amueblar
• Cuenta con clóset
• 2 baños compartidos, uno completo con ducha y el otro baño pequeño
💰 Costo
• $3,500 de renta
• Servicios aprox. $365
• Para iniciar se pide 2,500 de depósito + los 3,500 de la renta
✨ Ideal para ti si:
• Eres profesionista o estudiante
• Te gusta un ambiente tranquilo
• Eres pet friendly
• Buscas un lugar con buena vibra y paz mental
Si te interesa o quieres más info, mándame mensajito  al 3325892453`;

describe("inferBinaryTagsFromSourceText", () => {
  it("treats existing pets and pet friendly as mascotas, not a denial", () => {
    const signals = inferBinaryTagsFromSourceText(PET_POSITIVE_POST);
    expect(signals.affirmed).toContain("mascotas");
    expect(signals.denied).not.toContain("mascotas");
    expect(signals.affirmed).toEqual(
      expect.arrayContaining([
        "mascotas",
        "closet",
        "cerca-transporte",
        "seguridad-acceso",
        "vigilancia",
        "profesionistas",
        "estudiantes",
      ]),
    );
    expect(signals.denied).toEqual(expect.arrayContaining(["muebles", "baño-privado"]));
    expect(signals.affirmed).not.toContain("muebles");
    expect(signals.affirmed).not.toContain("baño-privado");
    expect(signals.affirmed).not.toContain("fiestas");
    expect(signals.affirmed).not.toContain("servicios-incluidos");
  });

  it("treats smoke-and-pets-free and optional AC as not a yes", () => {
    const noPets = inferBinaryTagsFromSourceText("Espacio ideal, libre de humo y mascotas.");
    expect(noPets.denied).toContain("mascotas");
    expect(noPets.affirmed).not.toContain("mascotas");

    const optionalAc = inferBinaryTagsFromSourceText("Cuenta con opción a aire acondicionado.");
    expect(optionalAc.affirmed).not.toContain("aire-acondicionado");

    const privateOrShared = inferBinaryTagsFromSourceText("Opciones de baño privado o compartido.");
    expect(privateOrShared.affirmed).not.toContain("baño-privado");
  });

  it("does not treat quiet pets as a no-pets rule", () => {
    const signals = inferBinaryTagsFromSourceText(
      "Hay dos perritos pero no hacen desastres. Eres pet friendly.",
    );
    expect(signals.affirmed).toContain("mascotas");
    expect(signals.denied).not.toContain("mascotas");
  });

  it("keeps an explicit no-pets rule as a denial", () => {
    const signals = inferBinaryTagsFromSourceText("Cuarto amplio. No se aceptan mascotas ni perros.");
    expect(signals.denied).toContain("mascotas");
    expect(signals.affirmed).not.toContain("mascotas");
  });

  it("does not let a nearby no cancel an explicit pet welcome", () => {
    const { extraction } = mergeExtractionWithHints(
      { tags: [], deniedTags: ["mascotas"] },
      {},
      PET_POSITIVE_POST,
    );
    expect(extraction.tags).toContain("mascotas");
    expect(extraction.deniedTags ?? []).not.toContain("mascotas");
    expect(extraction.tags).toContain("closet");
    expect(extraction.tags).not.toContain("muebles");
  });
});

describe("applySourceTextTagSignals", () => {
  it("fills a tag the model omitted and drops a false denial", () => {
    const next = applySourceTextTagSignals(
      { tags: ["wifi"], deniedTags: ["mascotas"] },
      "Tenemos una perrita. El cuarto es pet friendly.",
    );
    expect(next.tags).toEqual(expect.arrayContaining(["wifi", "mascotas"]));
    expect(next.deniedTags ?? []).not.toContain("mascotas");
  });
});
