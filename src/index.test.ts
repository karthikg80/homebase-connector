import { describe, it, expect, vi } from "vitest";
import { createConnector } from "./index";

describe("createConnector", () => {
  it("returns connected: false when any env var is missing", () => {
    expect(createConnector({}).connected).toBe(false);
    expect(createConnector({ url: "https://h" }).connected).toBe(false);
    expect(createConnector({ url: "https://h", appKey: "k" }).connected).toBe(false);
    expect(createConnector({ url: "https://h", appKey: "k", circleId: "c" }).connected).toBe(false);
  });

  it("returns connected: true when all four required fields are present", () => {
    const c = createConnector({
      url: "https://h",
      appKey: "k",
      circleId: "c",
      token: "t"
    });
    expect(c.connected).toBe(true);
  });
});
