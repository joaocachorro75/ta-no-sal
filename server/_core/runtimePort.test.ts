import { describe, expect, it } from "vitest";
import { getRuntimePort } from "./runtimePort";

describe("getRuntimePort", () => {
  it("uses the default application port when PORT is absent", () => {
    expect(getRuntimePort(undefined)).toBe(3000);
  });

  it("uses the exact port provided by the deployment environment", () => {
    expect(getRuntimePort("80")).toBe(80);
    expect(getRuntimePort("3000")).toBe(3000);
  });

  it("rejects invalid deployment port values instead of using a different port", () => {
    expect(() => getRuntimePort("0")).toThrow("PORT must be an integer");
    expect(() => getRuntimePort("not-a-port")).toThrow("PORT must be an integer");
  });
});
