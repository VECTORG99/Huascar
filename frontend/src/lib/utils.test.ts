import { describe, expect, it } from "vitest";
import { slugify } from "./utils";

describe("slugify", () => {
  it("converts basic string to slug", () => {
    expect(slugify("Hello World")).toBe("hello-world");
  });

  it("handles accented characters", () => {
    expect(slugify("Producción Rápida")).toBe("produccion-rapida");
  });

  it("strips leading/trailing hyphens", () => {
    expect(slugify("---test---")).toBe("test");
  });

  it("collapses multiple non-alphanumeric characters", () => {
    expect(slugify("a///b___c")).toBe("a-b-c");
  });

  it("returns empty string for empty input", () => {
    expect(slugify("")).toBe("");
  });
});
