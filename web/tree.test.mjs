// Tests for the in-browser decision tree. Run: node --test web/
import { test } from "node:test";
import assert from "node:assert/strict";
import { trainTree, predict, splitRows, accuracy, describeRules } from "./tree.mjs";

const rows = [];
for (let b = 0; b <= 200; b += 5) for (const r of [0, 1]) {
  rows.push({ subject: b % 6, semester: (b % 8) + 1, past_borrow_count: b, course_relevance: r, label: b > 120 && r === 1 ? "High" : b > 40 ? "Medium" : "Low" });
}
const FEATURES = ["subject", "semester", "past_borrow_count", "course_relevance"];

test("learns the borrow-count and relevance rule exactly", () => {
  const tree = trainTree(rows, FEATURES, { maxDepth: 4, minLeaf: 2 });
  assert.equal(accuracy(tree, rows), 1);
  assert.equal(predict(tree, { subject: 0, semester: 3, past_borrow_count: 150, course_relevance: 1 }), "High");
  assert.equal(predict(tree, { subject: 0, semester: 3, past_borrow_count: 150, course_relevance: 0 }), "Medium");
  assert.equal(predict(tree, { subject: 0, semester: 3, past_borrow_count: 10, course_relevance: 1 }), "Low");
});

test("only splits on features that matter", () => {
  const tree = trainTree(rows, FEATURES, { maxDepth: 4, minLeaf: 2 });
  const used = new Set();
  (function walk(n) { if (n.leaf) return; used.add(n.feature); walk(n.left); walk(n.right); })(tree);
  assert.deepEqual([...used].sort(), ["course_relevance", "past_borrow_count"]);
});

test("splitRows is deterministic and keeps every row exactly once", () => {
  const a = splitRows(rows, 0.2, 42);
  const b = splitRows(rows, 0.2, 42);
  assert.deepEqual(a, b);
  assert.equal(a.train.length + a.test.length, rows.length);
  assert.equal(a.test.length, Math.round(rows.length * 0.2));
});

test("describeRules turns the tree into readable if/else lines", () => {
  const tree = trainTree(rows, FEATURES, { maxDepth: 4, minLeaf: 2 });
  const text = describeRules(tree).join("\n");
  assert.match(text, /past_borrow_count/);
  assert.match(text, /High/);
});
