import { describe, expect, it, beforeEach } from "vitest";
import { logger, setVerbose } from "../../src/utils/logger";

describe("setVerbose", () => {
  beforeEach(() => {
    logger.level = 3;
  });

  it("sets logger level to 5 (debug) when enabled is true", () => {
    setVerbose(true);
    expect(logger.level).toBe(5);
  });

  it("sets logger level to 3 (info) when enabled is false", () => {
    setVerbose(false);
    expect(logger.level).toBe(3);
  });

  it("toggles logger level between verbose and normal", () => {
    setVerbose(true);
    expect(logger.level).toBe(5);

    setVerbose(false);
    expect(logger.level).toBe(3);

    setVerbose(true);
    expect(logger.level).toBe(5);
  });
});

describe("logger", () => {
  it("is a consola instance", () => {
    expect(logger).toBeDefined();
    expect(typeof logger.info).toBe("function");
    expect(typeof logger.debug).toBe("function");
    expect(typeof logger.warn).toBe("function");
    expect(typeof logger.error).toBe("function");
  });

  it("has a numeric level property", () => {
    expect(typeof logger.level).toBe("number");
  });
});
