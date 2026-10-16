import { afterAll, afterEach, describe, expect, spyOn, test } from "bun:test";
import { log, set_log_level } from "./log";

describe("log", () => {
  const debug = spyOn(console, "debug").mockImplementation(() => {});
  const info = spyOn(console, "info").mockImplementation(() => {});

  afterEach(() => {
    set_log_level("info");
    debug.mockClear();
    info.mockClear();
  });

  afterAll(() => {
    debug.mockRestore();
    info.mockRestore();
  });

  test("drops debug lines at the default info level", () => {
    log("debug", { event: "auth.rejected" });
    log("info", { event: "http.request" });
    expect(debug).not.toHaveBeenCalled();
    expect(info).toHaveBeenCalledWith(
      '{"level":"info","event":"http.request"}',
    );
  });

  test("emits debug lines once LOG_LEVEL is debug", () => {
    set_log_level("debug");
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
