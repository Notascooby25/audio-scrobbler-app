import { afterEach, describe, expect, it, vi } from "vitest";
import { dismissWrapped, fetchWrapped, fetchWrappedYear, markWrappedSeen } from "./wrapped";

afterEach(() => vi.unstubAllGlobals());

describe("wrapped api", () => {
  it("calls the year-reviews paths with the bearer token", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ years: [] }),
    });
    vi.stubGlobal("fetch", fetchMock);
    await fetchWrapped({ token: "tok" });
    await fetchWrappedYear({ token: "tok", year: 2026 });
    expect(fetchMock.mock.calls[0][0]).toBe("/year-reviews");
    expect(fetchMock.mock.calls[1][0]).toBe("/year-reviews/2026");
    expect(fetchMock.mock.calls[0][1].headers.Authorization).toBe("Bearer tok");
  });

  it("reads the empty body of a 204 so the browser doesn't report the request as aborted", async () => {
    const text = vi.fn().mockResolvedValue("");
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 204, text });
    vi.stubGlobal("fetch", fetchMock);
    expect(await markWrappedSeen({ token: "tok", year: 2026 })).toBeNull();
    expect(await dismissWrapped({ token: "tok", year: 2026 })).toBeNull();
    expect(text).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[0][1].method).toBe("POST");
  });

  it("throws an error carrying the status", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 404 }));
    await expect(fetchWrappedYear({ token: "tok", year: 2030 })).rejects.toMatchObject({
      status: 404,
    });
  });
});
