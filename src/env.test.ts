import { describe, it, expect, afterEach } from "vitest";
import { requireEnv, assertEnv } from "./env";

describe("requireEnv", () => {
  afterEach(() => {
    delete process.env.__TEST_VAR__;
  });

  it("returns the value when set", () => {
    process.env.__TEST_VAR__ = "value";
    expect(requireEnv("__TEST_VAR__")).toBe("value");
  });

  it("throws when missing", () => {
    expect(() => requireEnv("__TEST_VAR__")).toThrow(/Missing required environment variable: __TEST_VAR__/);
  });

  it("throws when empty string", () => {
    process.env.__TEST_VAR__ = "";
    expect(() => requireEnv("__TEST_VAR__")).toThrow();
  });
});

describe("assertEnv", () => {
  afterEach(() => {
    delete process.env.__A__;
    delete process.env.__B__;
    delete process.env.__C__;
  });

  it("passes when all are set", () => {
    process.env.__A__ = "a";
    process.env.__B__ = "b";
    expect(() => assertEnv("__A__", "__B__")).not.toThrow();
  });

  it("throws with all missing names listed", () => {
    process.env.__A__ = "a";
    expect(() => assertEnv("__A__", "__B__", "__C__")).toThrow(/__B__, __C__/);
  });
});
