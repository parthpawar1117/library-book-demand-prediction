import { predict } from "./tree.mjs";

const $ = (id) => document.getElementById(id);
const model = await (await fetch("model.json")).json();
const COLORS = { High: "#27ae60", Medium: "#f39c12", Low: "#e74c3c" };

// ---- form ----
const subjectNames = model.subjects;
$("subject").innerHTML = subjectNames.map((s, i) => `<option value="${i}"${s === "Computer Science" ? " selected" : ""}>${s}</option>`).join("");

/** Walk the tree and record each decision, so we can explain the prediction. */
function explain(x) {
  const steps = [];
  let n = model.tree;
  const names = { past_borrow_count: "borrowed", course_relevance: "course relevance", semester: "semester", subject: "subject" };
  while (!n.leaf) {
    const v = x[n.feature];
    const goLeft = v <= n.threshold;
    const t = Math.round(n.threshold * 10) / 10;
    const what = n.feature === "course_relevance" ? (v ? "required for a course" : "not required for a course") : `${names[n.feature]} ${v} times ${goLeft ? "≤" : ">"} ${t}`;
    steps.push(what);
    n = goLeft ? n.left : n.right;
  }
  return { label: n.label, steps, n: n.n };
}

function render() {
  const x = {
    subject: Number($("subject").value),
    semester: Number($("semester").value),
    past_borrow_count: Number($("borrow").value),
    course_relevance: Number(document.querySelector('input[name="rel"]:checked').value),
  };
  $("semester-out").textContent = x.semester;
  $("borrow-out").textContent = x.past_borrow_count;
  const { label, steps, n } = explain(x);
  if (predict(model.tree, x) !== label) throw new Error("explanation out of sync with model");
  const advice = { High: "Stock extra copies and keep it on the short-loan shelf.", Medium: "Keep normal stock.", Low: "A single copy, or move it to the stacks." }[label];
  $("result").innerHTML = `
    <div class="verdict" style="--c:${COLORS[label]}"><span>Predicted demand</span><strong>${label}</strong></div>
    <p class="why"><b>Why:</b> ${steps.join(" → ")}. ${n} books in the training data followed this path.</p>
    <p class="muted small">${advice}</p>`;
}
$("form").addEventListener("input", render);
render();

// ---- rules ----
$("rules").textContent = model.rules.join("\n");
$("acc").textContent = `Test accuracy: ${(model.testAccuracy * 100).toFixed(0)}% on ${model.split.test} unseen books (trained on ${model.split.train}).`;

// ---- dataset ----
const d = model.dataset;
$("data-note").textContent = `${d.rows} books across ${Object.keys(d.subjects).length} subjects. Sample row: ${JSON.stringify(d.sample[0])}`;
const max = Math.max(...Object.values(d.demand));
$("demand-bars").innerHTML = ["High", "Medium", "Low"].map((l) => `
  <div class="bar-row"><span>${l}</span><div class="bar"><i style="width:${(100 * d.demand[l]) / max}%;background:${COLORS[l]}"></i></div><b>${d.demand[l]}</b></div>`).join("");
$("subject-bars").innerHTML = Object.entries(d.bySubjectDemand).map(([s, c]) => {
  const total = c.High + c.Medium + c.Low;
  return `<div class="bar-row"><span>${s}</span><div class="bar stack">${["High", "Medium", "Low"].map((l) => `<i style="width:${(100 * c[l]) / total}%;background:${COLORS[l]}" title="${l}: ${c[l]}"></i>`).join("")}</div><b>${total}</b></div>`;
}).join("");

// ---- models ----
const best = Math.max(...Object.values(model.python).map((m) => m["F1-score"]));
$("models").innerHTML = Object.entries(model.python).map(([name, m]) => `
  <div class="model${m["F1-score"] === best ? " best" : ""}">
    <h3>${name}</h3>
    <p class="score">${(m.Accuracy * 100).toFixed(0)}% <span class="muted small">accuracy · F1 ${m["F1-score"].toFixed(2)}</span></p>
    <table class="cm" aria-label="Confusion matrix for ${name}">
      ${m["Confusion Matrix"].map((row, i) => `<tr>${row.map((v, j) => `<td class="${i === j ? "diag" : v ? "miss" : ""}">${v}</td>`).join("")}</tr>`).join("")}
    </table>
  </div>`).join("");
