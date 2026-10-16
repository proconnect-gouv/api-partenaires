import { afterAll, afterEach, describe, expect, spyOn, test } from "bun:test";
import { log, set_log_level } from "./log";

describe("log", () => {
  const debug = spyOn(console, "debug").mockImplementation(() => {});
  const info = spyOn(console, "info").mockImplementation(() => {});

  afterEach(() => {
    set_log_level("debug");
    debug.mockClear();
    info.mockClear();
  });

  afterAll(() => {
    debug.mockRestore();
    info.mockRestore();
  });

  test("drops debug lines at the info level", () => {
    set_log_level("info");
    log("debug", { event: "auth.rejected" });
    log("info", { event: "http.request" });
    expect(debug).not.toHaveBeenCalled();
    expect(info).toHaveBeenCalledWith(
      '{"level":"info","event":"http.request"}',
    );
  });

  test("emits debug lines at the default debug level", () => {
    log("debug", { event: "auth.rejected", reason: "invalid_signature" });
    expect(debug).toHaveBeenCalledWith(
      '{"level":"debug","event":"auth.rejected","reason":"invalid_signature"}',
    );
  });

  test("drops info lines at the error level", () => {
    set_log_level("error");
    log("info", { event: "http.request" });
    expect(info).not.toHaveBeenCalled();
  });
});
