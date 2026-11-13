import assert from "node:assert/strict";
import test from "node:test";
import { greet } from "./index.ts";

test("greet", () => {
  assert.equal(greet("world"), "hello world");
});
