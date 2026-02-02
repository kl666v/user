const resultsEl = document.getElementById("results");
const historyEl = document.getElementById("history");
const blipsEl = document.getElementById("blips");
const toastEl = document.getElementById("toast");

const VOWELS = "aeiou";
const CONSONANTS = "bcdfghjklmnpqrstvwxyz";
const STORAGE_KEY = "username_radar_history_v1";

function toast(msg){
  toastEl.textContent = msg;
  toastEl.style.display = "block";
  clearTimeout(window.__t);
  window.__t = setTimeout(()=> toastEl.style.display="none", 1300);
}

function rand(min, max){ return Math.random()*(max-min)+min; }

function renderBlips(n=10){
  blipsEl.innerHTML = "";
  for(let i=0;i<n;i++){
    const b = document.createElement("div");
    b.className = "blip";
    b.style.left = `${rand(8, 92)}%`;
    b.style.top  = `${rand(10, 86)}%`;
    b.style.opacity = `${rand(0.45, 1)}`;
    blipsEl.appendChild(b);
  }
}

function isClean(name){
  return /^[a-z0-9._]+$/.test(name);
}

function pronounceable(n){
  const patterns = n === 3 ? ["CVC", "CVV"] : ["CVCV", "CVCC"];
  const pat = patterns[Math.floor(Math.random()*patterns.length)];
  let out = "";
  for(const ch of pat){
    out += (ch === "C")
      ? CONSONANTS[Math.floor(Math.random()*CONSONANTS.length)]
      : VOWELS[Math.floor(Math.random()*VOWELS.length)];
  }
  return out;
}

function randomLetters(n){
  const letters = "abcdefghijklmnopqrstuvwxyz";
  let out = "";
  for(let i=0;i<n;i++) out += letters[Math.floor(Math.random()*letters.length)];
  return out;
}

function scoreUsername(name){
  let score = 0;
  const reasons = [];
  const n = name.length;

  if(n === 3){ score += 80; reasons.push("3L rarity +80"); }
  else if(n === 4){ score += 50; reasons.push("4L rarity +50"); }
  else { score += 20; reasons.push("length base +20"); }

  if(/^[a-z]+$/.test(name)){ score += 30; reasons.push("letters-only +30"); }

  if(name.includes("_")){ score -= 15; reasons.push("underscore -15"); }
  if(/[0-9]/.test(name)){ score -= 10; reasons.push("digits -10"); }
  if(name.includes(".")){ score -= 4; reasons.push("dot -4"); }

  if([...VOWELS].some(v => name.includes(v))){ score += 10; reasons.push("has vowel +10"); }
  else { score -= 12; reasons.push("no vowel -12"); }

  let repeats = 0;
  for(let i=1;i<n;i++) if(name[i] === name[i-1]) repeats++;
  if(repeats){ score -= repeats*8; reasons.push(`repeats -${repeats*8}`); }

  if(/[._]{2,}/.test(name)){ score -= 12; reasons.push("double symbols -12"); }

  const c = CONSONANTS.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&');
  const v = VOWELS;
  const reCVCV = new RegExp(`^[${c}][${v}][${c}][${v}]$`);
  const reCVC = new RegExp(`^[${c}][${v}][${c}]$`);
  if(reCVCV.test(name)){ score += 12; reasons.push("CVCV pattern +12"); }
  if(reCVC.test(name)){ score += 10; reasons.push("CVC pattern +10"); }

  score = Math.max(score, 0);
  return {score, reason: reasons.join(" | ")};
}

function generateUsernames({mode, count, length, allowDot, allowDigits}){
  const results = new Set();

  while(results.size < count){
    let base = "";
    if(mode === "pronounceable") base = pronounceable(length);
    else if(mode === "random") base = randomLetters(length);
    else base = (Math.random() < 0.6) ? pronounceable(length) : randomLetters(length);

    let name = base.toLowerCase();

    if(allowDot && Math.random() < 0.20){
      const i = Math.floor(rand(1, Math.max(2, name.length-1)));
      name = name.slice(0,i) + "." + name.slice(i);
    }
    if(allowDigits && Math.random() < 0.15){
      name += String(Math.floor(Math.random()*10));
    }

    if(!isClean(name)) continue;
    results.add(name);
  }

  const scored = [...results].map(u => {
    const s = scoreUsername(u);
    return { username: u, score: s.score, reason: s.reason, length: u.length };
  });

  scored.sort((a,b) => b.score - a.score);
  return scored;
}

function getHistory(){
  try{
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
  }catch{
    return [];
  }
}

function setHistory(items){
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
}

function addToHistory(username, tag){
  const s = scoreUsername(username);
  const items = getHistory();
  const row = {
    id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random().toString(16).slice(2),
    username,
    length: username.length,
    tag,
    score: s.score,
    reason: s.reason,
    created_at: new Date().toISOString()
  };
  items.unshift(row);
  setHistory(items.slice(0, 1000));
}

function updateTag(id, tag){
  const items = getHistory();
  const idx = items.findIndex(x => x.id === id);
  if(idx >= 0){
    items[idx].tag = tag;
    setHistory(items);
  }
}

function clearHistory(){
  localStorage.removeItem(STORAGE_KEY);
}

function downloadCSV(filename, rows){
  const header = ["id","username","length","tag","score","reason","created_at"];
  const escape = (v) => {
    const s = String(v ?? "");
    if(/[,"\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
  };
  const csv = [header.join(",")].concat(
    rows.map(r => header.map(h => escape(r[h])).join(","))
  ).join("\n");

  const blob = new Blob([csv], {type:"text/csv;charset=utf-8"});
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function cardTemplate(item){
  const div = document.createElement("div");
  div.className = "card";
  div.innerHTML = `
    <div class="user">
      <div class="name" title="Click to copy">${item.username}</div>
      <div class="score">Score: ${item.score}</div>
    </div>
    <div class="reason">${item.reason}</div>
    <div class="actions">
      <button class="tagBtn good">Mark Available</button>
      <button class="tagBtn bad">Mark Taken</button>
      <button class="tagBtn neutral">Save</button>
    </div>
  `;

  div.querySelector(".name").addEventListener("click", async ()=>{
    await navigator.clipboard.writeText(item.username);
    toast(`Copied: ${item.username}`);
  });

  const [btnAvail, btnTaken, btnSave] = div.querySelectorAll(".tagBtn");
  btnSave.addEventListener("click", ()=> { addToHistory(item.username, "unverified"); toast(`Saved: ${item.username}`); loadHistory(activeTag()); });
  btnAvail.addEventListener("click", ()=> { addToHistory(item.username, "available"); toast(`Saved as AVAILABLE`); loadHistory(activeTag()); });
  btnTaken.addEventListener("click", ()=> { addToHistory(item.username, "taken"); toast(`Saved as TAKEN`); loadHistory(activeTag()); });

  return div;
}

function historyCardTemplate(row){
  const div = document.createElement("div");
  div.className = "card";
  const color = row.tag === "available" ? "var(--good)" : row.tag === "taken" ? "var(--bad)" : "var(--warn)";
  div.innerHTML = `
    <div class="user">
      <div class="name" title="Click to copy">${row.username}</div>
      <div class="score" style="border-color:${color}">${row.tag.toUpperCase()} • ${row.score}</div>
    </div>
    <div class="reason">${row.reason}</div>
    <div class="actions">
      <button class="tagBtn good">Available</button>
      <button class="tagBtn bad">Taken</button>
      <button class="tagBtn neutral">Unverified</button>
    </div>
  `;

  div.querySelector(".name").addEventListener("click", async ()=>{
    await navigator.clipboard.writeText(row.username);
    toast(`Copied: ${row.username}`);
  });

  const [a,t,u] = div.querySelectorAll(".tagBtn");
  a.addEventListener("click", ()=> { updateTag(row.id, "available"); toast("Updated: available"); loadHistory(activeTag()); });
  t.addEventListener("click", ()=> { updateTag(row.id, "taken"); toast("Updated: taken"); loadHistory(activeTag()); });
  u.addEventListener("click", ()=> { updateTag(row.id, "unverified"); toast("Updated: unverified"); loadHistory(activeTag()); });

  return div;
}

function renderResults(items){
  resultsEl.innerHTML = "";
  if(!items.length){
    resultsEl.innerHTML = `<div class="hint">No results. Try again.</div>`;
    return;
  }
  items.forEach(item => resultsEl.appendChild(cardTemplate(item)));
}

function activeTag(){
  return document.querySelector(".chip.active")?.dataset.tag || "all";
}

function loadHistory(tag="all"){
  const items = getHistory();
  const filtered = (tag === "all") ? items : items.filter(x => x.tag === tag);
  historyEl.innerHTML = "";
  if(!filtered.length){
    historyEl.innerHTML = `<div class="hint">No history yet.</div>`;
    return;
  }
  filtered.slice(0, 300).forEach(row => historyEl.appendChild(historyCardTemplate(row)));
}

function generate(){
  const mode = document.getElementById("mode").value;
  const length = parseInt(document.getElementById("length").value, 10) === 3 ? 3 : 4;
  const count = Math.max(1, Math.min(parseInt(document.getElementById("count").value, 10) || 30, 200));
  const allowDot = document.getElementById("allowDot").checked;
  const allowDigits = document.getElementById("allowDigits").checked;

  renderBlips(14);

  const items = generateUsernames({mode, count, length, allowDot, allowDigits});
  renderResults(items);
}

document.getElementById("scanBtn").addEventListener("click", generate);
document.getElementById("clearBtn").addEventListener("click", ()=> { resultsEl.innerHTML = ""; toast("Cleared results"); });
document.getElementById("clearHistoryBtn").addEventListener("click", ()=> {
  if(confirm("Clear all history?")){ clearHistory(); loadHistory(activeTag()); toast("History cleared"); }
});
document.getElementById("exportBtn").addEventListener("click", ()=> {
  const items = getHistory();
  if(!items.length) return toast("No history to export");
  downloadCSV("username_radar_history.csv", items);
});

document.querySelectorAll(".chip").forEach(chip=>{
  chip.addEventListener("click", ()=>{
    document.querySelectorAll(".chip").forEach(c=>c.classList.remove("active"));
    chip.classList.add("active");
    loadHistory(chip.dataset.tag);
  });
});

// initial
renderBlips(12);
loadHistory("all");
