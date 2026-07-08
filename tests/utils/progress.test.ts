import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { createProgressBar } from "../../src/utils/progress";
import { logger } from "../../src/utils/logger";

describe("createProgressBar", () => {
  let infoSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    infoSpy = vi.spyOn(logger, "info").mockImplementation(() => {});
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2025-01-01T00:00:00Z"));
  });

  afterEach(() => {
    infoSpy.mockRestore();
    vi.useRealTimers();
  });

  it("returns an object with tick and stop functions", () => {
    const bar = createProgressBar(10);
    expect(typeof bar.tick).toBe("function");
    expect(typeof bar.stop).toBe("function");
  });

  describe("tick", () => {
    it("increments progress and logs percentage", () => {
      const bar = createProgressBar(4);

      bar.tick();
      expect(infoSpy).toHaveBeenCalledTimes(1);
      expect(infoSpy.mock.calls[0][0]).toContain("[25%]");

      bar.tick();
      expect(infoSpy).toHaveBeenCalledTimes(2);
      expect(infoSpy.mock.calls[1][0]).toContain("[50%]");

      bar.tick();
      expect(infoSpy.mock.calls[2][0]).toContain("[75%]");

      bar.tick();
      expect(infoSpy.mock.calls[3][0]).toContain("[100%]");
    });

    it("includes elapsed time in log output", () => {
      const bar = createProgressBar(1);

      vi.setSystemTime(new Date("2025-01-01T00:00:02.500Z"));
      bar.tick();

      expect(infoSpy).toHaveBeenCalledTimes(1);
      expect(infoSpy.mock.calls[0][0]).toContain("[2.5s]");
    });

    it("includes message when provided", () => {
      const bar = createProgressBar(1);

      bar.tick("uploading file");

      expect(infoSpy).toHaveBeenCalledTimes(1);
      expect(infoSpy.mock.calls[0][0]).toContain("uploading file");
    });

    it("renders empty string when no message provided", () => {
      const bar = createProgressBar(1);

      bar.tick();

      const logOutput = infoSpy.mock.calls[0][0] as string;
      expect(logOutput).toMatch(/\[\d+%\] \[\d+\.\ds\] $/);
    });
  });

  describe("stop", () => {
    it("logs 'Done' message", () => {
      const bar = createProgressBar(5);

      bar.stop();

      expect(infoSpy).toHaveBeenCalledTimes(1);
      expect(infoSpy.mock.calls[0][0]).toContain("Done");
    });

    it("logs current progress percentage with Done", () => {
      const bar = createProgressBar(4);

      bar.tick();
      bar.tick();
      bar.stop();

      expect(infoSpy).toHaveBeenCalledTimes(3);
      const stopOutput = infoSpy.mock.calls[2][0] as string;
      expect(stopOutput).toContain("[50%]");
      expect(stopOutput).toContain("Done");
    });

    it("can be called without any prior ticks", () => {
      const bar = createProgressBar(10);

      bar.stop();

      expect(infoSpy).toHaveBeenCalledTimes(1);
      expect(infoSpy.mock.calls[0][0]).toContain("[0%]");
      expect(infoSpy.mock.calls[0][0]).toContain("Done");
    });
  });
});
