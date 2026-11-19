// A small CART decision tree (Gini impurity, numeric thresholds), dependency-free so the
// same code trains offline in Node and predicts in the browser.

const counts = (rows) => rows.reduce((m, r) => ((m[r.label] = (m[r.label] ?? 0) + 1), m), {});
const majority = (rows) => Object.entries(counts(rows)).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0][0];
const gini = (rows) => {
  const n = rows.length;
  return n ? 1 - Object.values(counts(rows)).reduce((s, c) => s + (c / n) ** 2, 0) : 0;
};

function bestSplit(rows, features, minLeaf) {
  let best = null;
  const parent = gini(rows);
  for (const f of features) {
    const values = [...new Set(rows.map((r) => r[f]))].sort((a, b) => a - b);
    for (let i = 0; i < values.length - 1; i++) {
      const threshold = (values[i] + values[i + 1]) / 2;
      const left = rows.filter((r) => r[f] <= threshold);
      const right = rows.filter((r) => r[f] > threshold);
      if (left.length < minLeaf || right.length < minLeaf) continue;
      const gain = parent - (left.length * gini(left) + right.length * gini(right)) / rows.length;
      if (gain > 1e-9 && (!best || gain > best.gain)) best = { feature: f, threshold, gain, left, right };
    }
  }
  return best;
}

export function trainTree(rows, features, { maxDepth = 4, minLeaf = 5 } = {}, depth = 0) {
  const label = majority(rows);
  const node = { leaf: true, label, n: rows.length, counts: counts(rows) };
  if (depth >= maxDepth || gini(rows) === 0) return node;
  const split = bestSplit(rows, features, minLeaf);
  if (!split) return node;
  return {
    leaf: false,
    feature: split.feature,
    threshold: split.threshold,
    n: rows.length,
    left: trainTree(split.left, features, { maxDepth, minLeaf }, depth + 1),
    right: trainTree(split.right, features, { maxDepth, minLeaf }, depth + 1),
  };
}

export function predict(tree, x) {
  let n = tree;
  while (!n.leaf) n = x[n.feature] <= n.threshold ? n.left : n.right;
  return n.label;
}

export const accuracy = (tree, rows) => rows.filter((r) => predict(tree, r) === r.label).length / rows.length;

/** Deterministic shuffle (mulberry32) then split off a test fraction. */
export function splitRows(rows, testFraction, seed) {
  let s = seed >>> 0;
  const rand = () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const idx = rows.map((_, i) => i);
  for (let i = idx.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [idx[i], idx[j]] = [idx[j], idx[i]];
  }
  const nTest = Math.round(rows.length * testFraction);
  return { test: idx.slice(0, nTest).map((i) => rows[i]), train: idx.slice(nTest).map((i) => rows[i]) };
}

/** The tree as indented if/else lines, for people to read. */
export function describeRules(tree, indent = "") {
  if (tree.leaf) return [`${indent}→ ${tree.label}  (${tree.n} books)`];
  const t = Number.isInteger(tree.threshold) ? tree.threshold : Math.round(tree.threshold * 10) / 10;
  return [
    `${indent}if ${tree.feature} ≤ ${t}:`,
    ...describeRules(tree.left, indent + "    "),
    `${indent}else:`,
    ...describeRules(tree.right, indent + "    "),
  ];
}
