import { describe, expect, it } from "vitest";
import { getClientIp } from "../../src/middleware/helper.js";
import { parseTrustProxy } from "../../src/config.js";

describe("parseTrustProxy", () => {
  it("defaults to 1 hop when unset", () => {
    expect(parseTrustProxy(undefined)).toBe(1);
    expect(parseTrustProxy("")).toBe(1);
  });

  it("parses boolean and hop-count values", () => {
    expect(parseTrustProxy("true")).toBe(true);
    expect(parseTrustProxy("false")).toBe(false);
    expect(parseTrustProxy("0")).toBe(false);
    expect(parseTrustProxy("2")).toBe(2);
  });
});

describe("getClientIp", () => {
  it("returns request.ip when present", () => {
    expect(getClientIp({ ip: "203.0.113.10", socket: {} } as never)).toBe(
      "203.0.113.10",
    );
  });

  it("strips IPv4-mapped IPv6 prefixes for stable Redis keys", () => {
    expect(
      getClientIp({ ip: "::ffff:127.0.0.1", socket: {} } as never),
    ).toBe("127.0.0.1");
  });

  it("falls back to socket.remoteAddress", () => {
    expect(
      getClientIp({
        ip: undefined,
        socket: { remoteAddress: "198.51.100.7" },
      } as never),
    ).toBe("198.51.100.7");
  });
});
