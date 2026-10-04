import { describe, expect, it } from "vitest";
import { getPropertyFromPointer } from "../json.ts";

describe("getPropertyFromPointer", () => {
  it("returns the input value for an empty pointer", () => {
    const value = { package: { name: "example" } };

    expect(getPropertyFromPointer(value, [])).toBe(value);
  });

  it("reads nested object properties", () => {
    const value = {
      package: {
        scripts: {
          build: "tsc",
        },
      },
    };

    expect(getPropertyFromPointer(value, ["package", "scripts", "build"])).toBe("tsc");
  });

  it("reads array elements using numeric or string segments", () => {
    const value = { packages: [{ name: "alpha" }, { name: "beta" }] };

    expect(getPropertyFromPointer(value, ["packages", 1, "name"])).toBe("beta");
    expect(getPropertyFromPointer(value, ["packages", "0", "name"])).toBe("alpha");
  });

  it("returns undefined when a property does not exist", () => {
    expect(getPropertyFromPointer({ package: {} }, ["package", "name"])).toBeUndefined();
  });

  it.each([
    [null, ["name"]],
    [undefined, ["name"]],
    ["example", ["length"]],
    [{ package: null }, ["package", "name"]],
    [{ package: false }, ["package", "name"]],
  ] as const)("returns undefined when traversal reaches a non-object", (value, pointer) => {
    expect(getPropertyFromPointer(value, [...pointer])).toBeUndefined();
  });

  it("does not traverse inherited properties", () => {
    const value = Object.create({ inherited: { enabled: true } }) as object;

    expect(getPropertyFromPointer(value, ["inherited", "enabled"])).toBeUndefined();
  });

  it("returns an own property whose value is undefined", () => {
    const value = { present: undefined };

    expect(Object.prototype.hasOwnProperty.call(value, "present")).toBe(true);
    expect(getPropertyFromPointer(value, ["present"])).toBeUndefined();
  });
});
