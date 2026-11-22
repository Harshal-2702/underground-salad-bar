import test from "node:test";
import assert from "node:assert/strict";
import { classifySla } from "./reports.service.js";

test("classifies kitchen timings against configured SLA boundaries", () => {
  assert.equal(classifySla(4 * 60, 5, 10), "WITHIN");
  assert.equal(classifySla(5 * 60, 5, 10), "AMBER");
  assert.equal(classifySla(10 * 60, 5, 10), "LATE");
});

test("does not invent an SLA result when thresholds are not configured", () => {
  assert.equal(classifySla(0, null, null), "UNCONFIGURED");
  assert.equal(classifySla(120, 5, null), "UNCONFIGURED");
});
