import { afterEach, describe, expect, it, vi } from "vitest";
import { clearAppCaches, fetchLatestBuildId } from "./updateCheck";

afterEach(() => {
  vi.unstubAllGlobals();
});

function stubFetch(impl) {
  const fetchMock = vi.fn(impl);
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

describe("fetchLatestBuildId", () => {
  it("returns the build string from version.json", async () => {
    const fetchMock = stubFetch(async () => ({ ok: true, json: async () => ({ build: "123" }) }));
    await expect(fetchLatestBuildId()).resolves.toBe("123");
    expect(fetchMock).toHaveBeenCalledWith("/version.json", { cache: "no-store" });
  });

  it("returns null when the response is not ok", async () => {
    stubFetch(async () => ({ ok: false, json: async () => ({ build: "123" }) }));
    await expect(fetchLatestBuildId()).resolves.toBeNull();
  });

  it("returns null when the body is not JSON", async () => {
    stubFetch(async () => ({
      ok: true,
      json: async () => {
        throw new SyntaxError("Unexpected token <");
      },
    }));
    await expect(fetchLatestBuildId()).resolves.toBeNull();
  });

  it("returns null when fetch rejects", async () => {
    stubFetch(async () => {
      throw new TypeError("network down");
    });
    await expect(fetchLatestBuildId()).resolves.toBeNull();
  });

  it("returns null when build is missing or not a non-empty string", async () => {
    for (const body of [{}, { build: 5 }, { build: "" }, null]) {
      stubFetch(async () => ({ ok: true, json: async () => body }));
      await expect(fetchLatestBuildId()).resolves.toBeNull();
    }
  });
});

describe("clearAppCaches", () => {
  it("deletes every cache key", async () => {
    const del = vi.fn().mockResolvedValue(true);
    vi.stubGlobal("caches", { keys: vi.fn().mockResolvedValue(["a", "b"]), delete: del });
    await clearAppCaches();
    expect(del).toHaveBeenCalledWith("a");
    expect(del).toHaveBeenCalledWith("b");
  });

  it("does nothing when caches is unavailable", async () => {
    vi.stubGlobal("caches", undefined);
    await expect(clearAppCaches()).resolves.toBeUndefined();
  });

  it("swallows errors", async () => {
    vi.stubGlobal("caches", {
      keys: vi.fn().mockRejectedValue(new Error("denied")),
      delete: vi.fn(),
    });
    await expect(clearAppCaches()).resolves.toBeUndefined();
  });
});
