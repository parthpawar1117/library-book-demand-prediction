// Trains the web demo's decision tree on library_data.csv and writes web/model.json.
// Run from the repo root: node web/train.mjs
import { readFileSync, writeFileSync } from "node:fs";
import { trainTree, splitRows, accuracy, describeRules, predict } from "./tree.mjs";

const SUBJECTS = ["Biology", "Computer Science", "Economics", "Management", "Mathematics", "Physics"]; // alphabetical, like sklearn's LabelEncoder
const FEATURES = ["subject", "semester", "past_borrow_count", "course_relevance"];

const [header, ...lines] = readFileSync("library_data.csv", "utf8").trim().split(/\r?\n/);
const cols = header.split(",");
const raw = lines.map((l) => Object.fromEntries(l.split(",").map((v, i) => [cols[i], v])));
const rows = raw.map((r) => ({
  subject: SUBJECTS.indexOf(r.subject),
  semester: Number(r.semester),
  past_borrow_count: Number(r.past_borrow_count),
  course_relevance: Number(r.course_relevance),
  label: r.demand_level,
}));

const { train, test } = splitRows(rows, 0.2, 42);
const tree = trainTree(train, FEATURES, { maxDepth: 4, minLeaf: 5 });
const labels = ["High", "Low", "Medium"];
const confusion = labels.map((a) => labels.map((p) => test.filter((r) => r.label === a && predict(tree, r) === p).length));

const by = (key) => raw.reduce((m, r) => ((m[r[key]] = (m[r[key]] ?? 0) + 1), m), {});
const bySubjectDemand = Object.fromEntries(
  [...new Set(raw.map((r) => r.subject))].sort().map((s) => [s, Object.fromEntries(labels.map((l) => [l, raw.filter((r) => r.subject === s && r.demand_level === l).length]))]),
);

const model = {
  subjects: SUBJECTS,
  features: FEATURES,
  tree,
  rules: describeRules(tree),
  split: { train: train.length, test: test.length, seed: 42 },
  testAccuracy: accuracy(tree, test),
  confusion: { labels, matrix: confusion },
  dataset: { rows: raw.length, demand: by("demand_level"), subjects: by("subject"), bySubjectDemand, sample: raw.slice(0, 12) },
  python: JSON.parse(readFileSync("model_metrics.json", "utf8")),
};
writeFileSync("web/model.json", JSON.stringify(model, null, 1) + "\n");
console.log(`test accuracy ${(model.testAccuracy * 100).toFixed(1)}% on ${test.length} rows`);
console.log(model.rules.join("\n"));
