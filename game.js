/* ============================================================
   مطعم المستقبل – AI Kitchen
   لعبة إدارة مطعم عربية مع أنظمة ذكاء اصطناعي محلية (بدون سيرفر)
   ============================================================ */
"use strict";

/* ---------- أدوات عامة ---------- */
const $ = (id) => document.getElementById(id);
const rand = (arr) => arr[Math.floor(Math.random() * arr.length)];
const rint = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

/* ---------- الصوت (WebAudio) ---------- */
let audioCtx = null;
function beep(freq, dur = 0.12, type = "sine", vol = 0.15) {
  if (!state.sound) return;
  try {
    audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    const o = audioCtx.createOscillator();
    const g = audioCtx.createGain();
    o.type = type; o.frequency.value = freq;
    g.gain.setValueAtTime(vol, audioCtx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + dur);
    o.connect(g).connect(audioCtx.destination);
    o.start(); o.stop(audioCtx.currentTime + dur);
  } catch (e) { /* لا صوت */ }
}
const sfx = {
  serve: () => { beep(660, .1); setTimeout(() => beep(880, .15), 90); },
  coin:  () => { beep(1200, .08, "square", .08); },
  cook:  () => beep(440, .08, "triangle"),
  ready: () => beep(750, .12, "triangle"),
  angry: () => { beep(200, .25, "sawtooth", .12); },
  wrong: () => beep(150, .2, "square", .1),
  chat:  () => beep(980, .1, "sine", .1),
  levelup: () => { beep(523, .1); setTimeout(() => beep(659, .1), 100); setTimeout(() => beep(784, .2), 200); },
};

/* ---------- الأطباق الأساسية ---------- */
const BASE_DISHES = [
  { id: "shawarma", emoji: "🌯", name: "شاورما",  price: 8,  cook: 3500 },
  { id: "fries",    emoji: "🍟", name: "بطاطس",   price: 5,  cook: 3000 },
  { id: "drink",    emoji: "🥤", name: "مشروب",   price: 3,  cook: 900  },
];
const UNLOCK_DISHES = {
  falafel: { id: "falafel", emoji: "🧆", name: "فلافل", price: 6,  cook: 2800 },
  burger:  { id: "burger",  emoji: "🍔", name: "برجر",  price: 10, cook: 4200 },
};

/* ---------- أنواع الزبائن ---------- */
const CUSTOMER_TYPES = {
  hasty:  { key: "hasty",  label: "⚡ مستعجل", patience: 14000, drain: 1.5, tip: 0.8, ratingW: 1 },
  calm:   { key: "calm",   label: "🙂 هادئ",   patience: 30000, drain: 1.0, tip: 1.0, ratingW: 1 },
  rich:   { key: "rich",   label: "💎 غني",    patience: 22000, drain: 1.0, tip: 2.2, ratingW: 1 },
  critic: { key: "critic", label: "🧐 ناقد",   patience: 20000, drain: 1.1, tip: 1.2, ratingW: 2 },
};
const FACES = ["😀","😄","🙂","😎","🤓","😊","🧔","👳","👴","👧","👦","👵","🧕","👨‍🦱","👩","🧑‍🦰"];
const NAMES = ["أبو فهد","أم سعد","خالد","نورة","سلطان","العنود","ماجد","حصة","بندر","لطيفة","تركي","الجوهرة","فيصل","دانة","ناصر","موضي"];

/* ---------- رسائل المحادثة الذكية ---------- */
const CHAT_EVENTS = {
  hasty: [
    { msg: "يلا يلا! عندي اجتماع بعد ٥ دقايق! ⏰", replies: [
      { t: "ثواني وطلبك طاير لك! 🚀", eff: 22 },
      { t: "كلنا مستعجلين يا طويل العمر 😑", eff: -15 },
      { t: "الاستعجال من الشيطان 😌", eff: -8 } ] },
    { msg: "وين طلبي؟؟ صار لي دهر واقف!", replies: [
      { t: "أعتذر منك، طلبك أولوية الحين! 🙏", eff: 20 },
      { t: "اصبر شوي، الزين ما يجي بسرعة", eff: -5 },
      { t: "في زباين قبلك يا غالي", eff: -12 } ] },
  ],
  calm: [
    { msg: "ما شاء الله المطعم مرتب اليوم 👌", replies: [
      { t: "تسلم! كله عشان عيونكم 🌟", eff: 15 },
      { t: "إيه نظفناه أخيراً 😅", eff: 5 },
      { t: "المهم الأكل مو الشكل", eff: -5 } ] },
    { msg: "شرايك أجرب شي جديد المرة الجاية؟", replies: [
      { t: "أبشر! عندنا أطباق يبتكرها الذكاء الاصطناعي 🤖", eff: 15 },
      { t: "خلك على اللي تعرفه أحسن", eff: -5 },
      { t: "جرب اللي تبي، أنا أطبخ الكل 💪", eff: 10 } ] },
  ],
  rich: [
    { msg: "أبي أفخم شي عندكم، والسعر ما يهم 💳", replies: [
      { t: "حاضرين! بنسوي لك تجربة VIP 👑", eff: 22 },
      { t: "كل أكلنا فاخر أصلاً", eff: 8 },
      { t: "السعر واحد للجميع عندنا", eff: -8 } ] },
    { msg: "إذا عجبني الأكل بعزم كل الشركة عندكم 😏", replies: [
      { t: "يا هلا بهم كلهم! العزيمة علينا 🎉", eff: 20 },
      { t: "بس ترى ما عندنا قاعة كبيرة", eff: -10 },
      { t: "أهم شي يعجبك أنت أول 🙌", eff: 12 } ] },
  ],
  critic: [
    { msg: "سمعت إن تقييمكم نزل… أثبتوا العكس 🧐", replies: [
      { t: "جرب بنفسك واحكم، الجودة تتكلم 👨‍🍳", eff: 20 },
      { t: "التقييمات كلها مزورة أصلاً", eff: -20 },
      { t: "نزل شوي بس رجعنا أقوى!", eff: 10 } ] },
    { msg: "الشاورما عندكم… فيها كم ملاحظة 📝", replies: [
      { t: "قول ملاحظاتك ونعدلها فوراً 📋", eff: 20 },
      { t: "شاورمتنا الأفضل بالحي وبدون نقاش", eff: -12 },
      { t: "الذوق يختلف من شخص لشخص", eff: -5 } ] },
  ],
};

/* ---------- مولّد الأطباق الذكي (LLM محلي مُحاكى) ---------- */
const AI_GEN = {
  prefix: ["شاورما","برجر","صحن","ساندويتش","بوكس","كباب","طبق","رول"],
  main: ["الدجاج المدخن","اللحم الواغيو","الروبيان الحار","الفلافل المقرمشة","الحلومي المشوي","الدجاج بالترفل","اللحم بالكرز","السلمون التركي"],
  style: ["على الفحم","بصوص المستقبل","بتتبيلة سرية","على الطريقة الفضائية","بلمسة زعفران","المقرمش ٢٠٧٧","بصوص النيون","بتوقيع الشيف الآلي"],
  ing: ["خبز صاج طازج","صوص الثوم الذهبي","مخلل نيون","بطاطس مقرمشة","جبنة ذائبة","خس مقرمش","صوص حار سري","بصل مكرمل","طماطم مجففة","زيتون مدخن","رقائق التورتيلا","صوص الرمان"],
  desc: [
    "طبق يجمع بين التراث والمستقبل — أول قضمة بتغير مزاجك!",
    "وصفة ولدت من تحليل ملايين الطلبات… والنتيجة أسطورية.",
    "الشيف الآلي يتوقع إنه بيصير الأكثر مبيعاً هذا الشهر.",
    "نكهة جريئة صُممت خصيصاً لذوق زباين مطعمك.",
    "خلطة سرية حسبتها الخوارزميات بدقة ٩٩.٩٪.",
  ],
  emoji: ["🌮","🥙","🍗","🍖","🥪","🍱","🥘","🍢","🫔","🍜"],
};
function aiGenerateDish() {
  const name = `${rand(AI_GEN.prefix)} ${rand(AI_GEN.main)} ${rand(AI_GEN.style)}`;
  const ings = [...AI_GEN.ing].sort(() => Math.random() - .5).slice(0, 4);
  return {
    id: "ai_" + Date.now(),
    emoji: rand(AI_GEN.emoji),
    name: name,
    shortName: name.split(" ").slice(0, 2).join(" "),
    desc: rand(AI_GEN.desc),
    ingredients: ings,
    price: rint(11, 18),
    cook: rint(3200, 5200),
    ai: true,
  };
}

/* ---------- التطويرات ---------- */
const UPGRADES = [
  { id: "grill", emoji: "🔥", name: "معدات أسرع", desc: "تسريع الطبخ 12% لكل مستوى", max: 5, cost: l => 60 + l * 70 },
  { id: "tray",  emoji: "🍽️", name: "صينية أكبر", desc: "+1 مكان في الصينية", max: 3, cost: l => 80 + l * 100 },
  { id: "decor", emoji: "🪴", name: "ديكور فخم", desc: "+12% صبر للزباين لكل مستوى", max: 5, cost: l => 70 + l * 80 },
  { id: "fame",  emoji: "📣", name: "حملة إعلانية", desc: "+10% بقشيش لكل مستوى", max: 5, cost: l => 90 + l * 90 },
  { id: "falafel", emoji: "🧆", name: "فتح: فلافل", desc: "صنف جديد بالقائمة (6 💵)", max: 1, cost: () => 120 },
  { id: "burger",  emoji: "🍔", name: "فتح: برجر", desc: "صنف جديد بالقائمة (10 💵)", max: 1, cost: () => 200 },
];

/* ---------- حالة اللعبة ---------- */
const SAVE_KEY = "ai_kitchen_save_v1";
let state = null;

function freshState() {
  return {
    money: 0, gold: 5, day: 1, rating: 5.0, sound: true,
    upgrades: { grill: 0, tray: 0, decor: 0, fame: 0, falafel: 0, burger: 0 },
    aiDishes: [],           // أطباق ابتكرها الذكاء الاصطناعي
    totals: { served: 0, angry: 0, earned: 0 },
    history: [],            // ملخص الأيام السابقة (للتحليل الذكي)
  };
}
function save() { try { localStorage.setItem(SAVE_KEY, JSON.stringify(state)); } catch (e) {} }
function load() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (raw) { state = Object.assign(freshState(), JSON.parse(raw)); return; }
  } catch (e) {}
  state = freshState();
}

/* قائمة الأكل الفعالة حسب التطويرات */
function activeMenu() {
  const menu = [...BASE_DISHES];
  if (state.upgrades.falafel) menu.push(UNLOCK_DISHES.falafel);
  if (state.upgrades.burger) menu.push(UNLOCK_DISHES.burger);
  return menu.concat(state.aiDishes);
}
function cookTime(dish) { return dish.cook * Math.pow(0.88, state.upgrades.grill); }
function traySize() { return 4 + state.upgrades.tray; }
function patienceMult() { return 1 + state.upgrades.decor * 0.12; }
function tipMult() { return 1 + state.upgrades.fame * 0.10; }

/* ---------- حالة اليوم الجاري ---------- */
let day = null;
let loopTimer = null;
let lastTick = 0;

function freshDay() {
  return {
    running: false,
    timeLeft: Math.min(60000 + state.day * 12000, 150000),
    customers: [],           // الزبائن الحاليين (حد أقصى 4)
    tray: [],                // أصناف جاهزة { dish }
    cooking: [],             // { dish, elapsed, total, stationId }
    selectedTray: -1,
    spawnIn: 800,
    chatIn: rint(9000, 14000),
    chat: null,              // حدث المحادثة المفتوح
    // إحصائيات اليوم
    served: 0, angry: 0, earned: 0, goldEarned: 0, wrongServes: 0,
    perfect: 0, chatGood: 0, chatBad: 0,
    soldCount: {},           // dishId -> عدد
    angryTypes: {},          // type -> عدد
    patienceSum: 0,
  };
}

/* ============================================================
   الزبائن
   ============================================================ */
let customerSeq = 0;
function spawnCustomer() {
  if (day.customers.length >= 4) return;
  const typeKeys = Object.keys(CUSTOMER_TYPES);
  // الناقد والغني أندر
  const weighted = ["hasty","hasty","calm","calm","calm","rich","critic"];
  const type = CUSTOMER_TYPES[state.day < 2 ? rand(["calm","hasty"]) : rand(weighted)];
  const menu = activeMenu();
  const count = type.key === "rich" ? rint(2, Math.min(4, menu.length)) : rint(1, Math.min(3, menu.length));
  const order = [];
  for (let i = 0; i < count; i++) order.push(rand(menu));
  const maxP = type.patience * patienceMult();
  const c = {
    uid: ++customerSeq,
    name: rand(NAMES), face: rand(FACES), type,
    order: order.map(d => ({ dish: d, done: false })),
    patience: maxP, maxPatience: maxP,
    el: null, chatPending: false,
  };
  day.customers.push(c);
  renderCustomers();
}

function customerRemaining(c) { return c.order.filter(o => !o.done); }

function serveTrayItem(c) {
  if (day.selectedTray < 0 || !day.tray[day.selectedTray]) { toast("👆 اختر صنف من الصينية أولاً"); return; }
  const item = day.tray[day.selectedTray];
  const slot = c.order.find(o => !o.done && o.dish.id === item.dish.id);
  if (!slot) {
    // تسليم خاطئ
    const pen = c.type.key === "critic" ? 0.25 : 0.15;
    c.patience = Math.max(0, c.patience - c.maxPatience * pen);
    day.wrongServes++;
    sfx.wrong();
    toast(`❌ ${c.name} ما طلب ${item.dish.name}!`);
    return;
  }
  slot.done = true;
  day.tray.splice(day.selectedTray, 1);
  day.selectedTray = -1;
  sfx.serve();
  if (customerRemaining(c).length === 0) completeOrder(c);
  renderTray(); renderCustomers();
}

function completeOrder(c) {
  const ratio = clamp(c.patience / c.maxPatience, 0, 1);
  const base = c.order.reduce((s, o) => s + o.dish.price, 0);
  const tip = Math.round(base * ratio * (c.type.tip - 0.4) * tipMult());
  const total = base + Math.max(0, tip);
  state.money += total;
  day.earned += total;
  day.served++;
  day.patienceSum += ratio;
  c.order.forEach(o => { day.soldCount[o.dish.id] = (day.soldCount[o.dish.id] || 0) + 1; });
  // ذهب للتسليم المثالي
  if (ratio > 0.75) {
    const g = c.type.key === "critic" ? 2 : 1;
    state.gold += g; day.goldEarned += g; day.perfect++;
    sfx.coin();
    floatScore(c.el, `+${total} 💵 +${g} 🪙`);
  } else {
    floatScore(c.el, `+${total} 💵`);
  }
  // التقييم
  const target = 3 + 2.2 * ratio;
  const w = 0.09 * c.type.ratingW;
  state.rating = clamp(state.rating + (target - state.rating) * w, 1, 5);
  removeCustomer(c, true);
  flashStat("stat-money");
}

function customerAngryLeave(c) {
  day.angry++;
  day.angryTypes[c.type.key] = (day.angryTypes[c.type.key] || 0) + 1;
  const w = 0.13 * c.type.ratingW;
  state.rating = clamp(state.rating + (1 - state.rating) * w, 1, 5);
  sfx.angry();
  floatScore(c.el, "💢 راح زعلان!", true);
  if (day.chat && day.chat.customer === c) closeChat();
  removeCustomer(c, false);
}

function removeCustomer(c, happy) {
  if (c.el) {
    c.el.classList.add("leaving");
    setTimeout(() => renderCustomers(), 450);
  }
  day.customers = day.customers.filter(x => x !== c);
  setTimeout(() => renderCustomers(), 460);
}

/* ============================================================
   الطبخ والصينية
   ============================================================ */
function startCooking(dish) {
  if (!day.running) return;
  const capacity = traySize() - day.tray.length - day.cooking.length;
  if (capacity <= 0) { toast("🍽️ الصينية ممتلئة! سلّم الطلبات أولاً"); sfx.wrong(); return; }
  day.cooking.push({ dish, elapsed: 0, total: cookTime(dish) });
  sfx.cook();
  renderCounter();
}

function tickCooking(dt) {
  for (let i = day.cooking.length - 1; i >= 0; i--) {
    const c = day.cooking[i];
    c.elapsed += dt;
    if (c.elapsed >= c.total) {
      day.cooking.splice(i, 1);
      day.tray.push({ dish: c.dish });
      sfx.ready();
      renderTray();
    }
  }
  renderCounterProgress();
}

/* ============================================================
   المحادثة الذكية
   ============================================================ */
function maybeStartChat() {
  if (day.chat || day.customers.length === 0) return;
  const c = rand(day.customers);
  const events = CHAT_EVENTS[c.type.key];
  if (!events) return;
  const ev = rand(events);
  day.chat = { customer: c, ev, timeLeft: 8000 };
  c.chatPending = true;
  sfx.chat();
  renderChat();
  renderCustomers();
}

function answerChat(reply) {
  const { customer: c } = day.chat;
  const delta = c.maxPatience * (reply.eff / 100);
  c.patience = clamp(c.patience + delta, 0, c.maxPatience);
  if (reply.eff >= 15) {
    day.chatGood++;
    toast("💬 عجبه ردك! ارتفعت معنوياته 🎉");
    if (c.type.key === "rich" && Math.random() < 0.5) { state.gold++; day.goldEarned++; sfx.coin(); toast("💎 الزبون الغني أعطاك 🪙 ذهب!"); }
  } else if (reply.eff < 0) {
    day.chatBad++;
    toast("💬 ما عجبه الرد… انخفض صبره 😬");
    sfx.wrong();
  } else {
    toast("💬 رد مقبول 🙂");
  }
  closeChat();
}

function closeChat() {
  if (day.chat) day.chat.customer.chatPending = false;
  day.chat = null;
  $("chat-panel").classList.add("hidden");
  renderCustomers();
}

function renderChat() {
  const panel = $("chat-panel");
  if (!day.chat) { panel.classList.add("hidden"); return; }
  const { customer: c, ev } = day.chat;
  $("chat-msg").textContent = `${c.face} ${c.name}: ${ev.msg}`;
  const box = $("chat-replies");
  box.innerHTML = "";
  ev.replies.forEach(r => {
    const b = document.createElement("button");
    b.className = "chat-reply";
    b.textContent = r.t;
    b.onclick = () => answerChat(r);
    box.appendChild(b);
  });
  panel.classList.remove("hidden");
}

/* ============================================================
   حلقة اللعبة
   ============================================================ */
function startDay() {
  day = freshDay();
  day.running = true;
  showScreen("screen-game");
  renderCounter(); renderTray(); renderCustomers(); renderTopbar();
  lastTick = performance.now();
  loopTimer = requestAnimationFrame(gameLoop);
}

function gameLoop(now) {
  if (!day || !day.running) return;
  const dt = Math.min(now - lastTick, 100);
  lastTick = now;

  day.timeLeft -= dt;
  day.spawnIn -= dt;
  day.chatIn -= dt;

  // نزول صبر الزبائن
  for (const c of [...day.customers]) {
    c.patience -= dt * c.type.drain;
    if (c.patience <= 0) customerAngryLeave(c);
  }
  updatePatienceBars();

  // زبون جديد
  if (day.spawnIn <= 0 && day.timeLeft > 8000) {
    spawnCustomer();
    const base = Math.max(6500 - state.day * 300, 3200);
    day.spawnIn = rint(base * 0.8, base * 1.3);
  }

  // محادثة ذكية
  if (day.chatIn <= 0) {
    maybeStartChat();
    day.chatIn = rint(11000, 17000);
  }
  if (day.chat) {
    day.chat.timeLeft -= dt;
    if (day.chat.timeLeft <= 0) closeChat();
  }

  tickCooking(dt);
  renderTopbar();

  // نهاية اليوم: انتهى الوقت وما بقي زبائن
  if (day.timeLeft <= 0 && day.customers.length === 0) { endDay(); return; }
  loopTimer = requestAnimationFrame(gameLoop);
}

function endDay() {
  day.running = false;
  cancelAnimationFrame(loopTimer);
  closeChat();
  state.totals.served += day.served;
  state.totals.angry += day.angry;
  state.totals.earned += day.earned;
  state.history.push({
    day: state.day, served: day.served, angry: day.angry, earned: day.earned,
    avgPatience: day.served ? day.patienceSum / day.served : 0,
  });
  if (state.history.length > 14) state.history.shift();
  showReport();
  state.day++;
  save();
}

/* ============================================================
   التقرير + التحليل الذكي
   ============================================================ */
function showReport() {
  const menu = activeMenu();
  let best = null, bestN = 0;
  for (const [id, n] of Object.entries(day.soldCount)) {
    if (n > bestN) { bestN = n; best = menu.find(d => d.id === id); }
  }
  const avgP = day.served ? Math.round((day.patienceSum / day.served) * 100) : 0;
  $("report-stats").innerHTML = `
    📅 اليوم <b>${state.day}</b> انتهى!<br>
    ✅ زباين راضين: <b>${day.served}</b> &nbsp;|&nbsp; 💢 زباين زعلانين: <b>${day.angry}</b><br>
    💵 أرباح اليوم: <b>${day.earned}</b> &nbsp;|&nbsp; 🪙 ذهب: <b>+${day.goldEarned}</b><br>
    🌟 متوسط رضا التسليم: <b>${avgP}%</b> &nbsp;|&nbsp; 🏆 تسليم مثالي: <b>${day.perfect}</b><br>
    ${best ? `🥇 الأكثر مبيعاً: <b>${best.emoji} ${best.shortName || best.name}</b> (${bestN})` : "🥇 ما انباع شي اليوم 😅"}
  `;
  $("ai-analysis").innerHTML = aiAnalyze().map(t => `<div class="tip">${t}</div>`).join("");
  showScreen("screen-report");
}

/* نظام تحليل الأداء — قواعد ذكية محلية */
function aiAnalyze() {
  const tips = [];
  const total = day.served + day.angry;

  if (total === 0) { tips.push("🤖 ما استقبلت أي زبون اليوم! جرب يوم أطول وركّز 😄"); return tips; }

  const angryRate = day.angry / total;
  if (angryRate === 0) tips.push("🏆 يوم مثالي: ولا زبون راح زعلان! استمر على نفس الأسلوب.");
  else if (angryRate > 0.35) tips.push("🚨 أكثر من ثلث الزباين مشوا زعلانين — جهّز الأصناف السريعة (🥤) مسبقاً وخلّ الصينية فيها احتياط.");
  else if (angryRate > 0.15) tips.push("⚠️ في كم زبون مشى زعلان. راقب أشرطة الصبر وقدّم للأحمر أولاً.");

  const worstType = Object.entries(day.angryTypes).sort((a, b) => b[1] - a[1])[0];
  if (worstType && worstType[1] >= 2) {
    const names = { hasty: "⚡ المستعجلين", calm: "🙂 الهادئين", rich: "💎 الأغنياء", critic: "🧐 النقاد" };
    tips.push(`📊 لاحظت أن أكثر من يزعل عندك: ${names[worstType[0]]}. أعطهم أولوية أعلى في التسليم.`);
  }

  if (day.wrongServes >= 3) tips.push(`🎯 سلّمت ${day.wrongServes} أصناف خاطئة — تأكد من فقاعة الطلب قبل التسليم، الناقد يعاقبك عليها أكثر.`);
  if (day.perfect >= 3) tips.push(`🪙 ممتاز! ${day.perfect} تسليمات مثالية جابت لك ذهب. الذهب يفتح لك أطباق الذكاء الاصطناعي.`);
  if (day.chatBad > day.chatGood) tips.push("💬 ردودك على الزباين تحتاج لباقة أكثر — الرد الحلو يرفع صبرهم مجاناً!");
  else if (day.chatGood >= 2) tips.push("💬 ردودك على الزباين ممتازة، كسبت ولاءهم!");

  if (state.upgrades.grill === 0 && state.money >= 60) tips.push("🔥 عندك فلوس كافية لتطوير المعدات — الطبخ الأسرع = زباين أكثر رضا.");
  if (state.aiDishes.length === 0 && state.gold >= 15) tips.push("🤖 عندك ذهب كافي! جرب مطبخ الذكاء الاصطناعي — الأطباق المبتكرة أسعارها أعلى.");

  // مقارنة مع اليوم السابق
  const prev = state.history[state.history.length - 2];
  if (prev) {
    if (day.earned > prev.earned * 1.2) tips.push(`📈 أرباحك ارتفعت ${Math.round((day.earned / Math.max(prev.earned, 1) - 1) * 100)}% عن أمس — نمو ممتاز!`);
    else if (day.earned < prev.earned * 0.8 && prev.earned > 0) tips.push("📉 أرباح اليوم أقل من أمس — يمكن تحتاج أصناف أغلى أو تطوير الإعلانات 📣.");
  }

  if (state.rating >= 4.5) tips.push(`⭐ تقييمك ${state.rating.toFixed(1)} — مطعمك من الأفضل بالمدينة!`);
  else if (state.rating < 3) tips.push(`⭐ تقييمك ${state.rating.toFixed(1)} منخفض — النقاد 🧐 هم أسرع طريق لرفعه إذا أرضيتهم.`);

  if (tips.length === 0) tips.push("👍 يوم متوازن! جرب ترفع صعوبتك بفتح أصناف جديدة.");
  return tips;
}

/* ============================================================
   المتجر
   ============================================================ */
let pendingDish = null;

function renderShop() {
  $("shop-money").textContent = `💵 ${state.money}`;
  $("shop-gold").textContent = `🪙 ${state.gold}`;

  const list = $("upgrades-list");
  list.innerHTML = "";
  for (const u of UPGRADES) {
    const lvl = state.upgrades[u.id];
    const row = document.createElement("div");
    row.className = "upgrade-row";
    const maxed = lvl >= u.max;
    const cost = maxed ? 0 : u.cost(lvl);
    row.innerHTML = `
      <span class="u-emoji">${u.emoji}</span>
      <span class="u-info"><span class="u-name">${u.name} ${u.max > 1 ? `(${lvl}/${u.max})` : lvl ? "✅" : ""}</span><br><span class="u-desc">${u.desc}</span></span>
    `;
    const btn = document.createElement("button");
    btn.className = "u-buy";
    btn.textContent = maxed ? "✅ مكتمل" : `💵 ${cost}`;
    btn.disabled = maxed || state.money < cost;
    btn.onclick = () => {
      if (state.money < cost) return;
      state.money -= cost;
      state.upgrades[u.id]++;
      sfx.levelup();
      toast(`✅ تم شراء: ${u.name}`);
      save();
      renderShop();
    };
    row.appendChild(btn);
    list.appendChild(row);
  }

  // القائمة الحالية
  const ml = $("menu-list");
  ml.innerHTML = "";
  for (const d of activeMenu()) {
    const row = document.createElement("div");
    row.className = "menu-row";
    row.innerHTML = `
      <span class="m-emoji">${d.emoji}</span>
      <span class="m-info"><span class="m-name">${d.name} ${d.ai ? "🤖" : ""}</span><br>
      <span class="m-desc">💵 ${d.price} — ⏱️ ${(d.cook / 1000).toFixed(1)} ث${d.desc ? "<br>" + d.desc : ""}</span></span>
    `;
    ml.appendChild(row);
  }

  $("btn-ai-dish").disabled = state.gold < 15;
  $("ai-dish-result").classList.add("hidden");
  pendingDish = null;
}

function aiDishFlow(regenerate) {
  if (!regenerate) {
    if (state.gold < 15) { toast("🪙 تحتاج 15 ذهب — اكسبها من التسليم المثالي!"); return; }
    state.gold -= 15;
  }
  pendingDish = aiGenerateDish();
  $("ai-dish-card").innerHTML = `
    <div class="d-name">${pendingDish.emoji} ${pendingDish.name}</div>
    <div>${pendingDish.desc}</div>
    <div>🧂 المكونات: ${pendingDish.ingredients.join("، ")}</div>
    <div>💵 السعر: <b>${pendingDish.price}</b> — ⏱️ وقت الطبخ: ${(pendingDish.cook / 1000).toFixed(1)} ث</div>
  `;
  $("ai-dish-result").classList.remove("hidden");
  $("shop-gold").textContent = `🪙 ${state.gold}`;
  sfx.levelup();
}

/* ============================================================
   الواجهة (Rendering)
   ============================================================ */
let currentScreen = "screen-menu";
function showScreen(id) {
  document.querySelectorAll(".screen").forEach(s => s.classList.remove("active"));
  $(id).classList.add("active");
  currentScreen = id;
}

function renderTopbar() {
  $("stat-money").textContent = `💵 ${state.money}`;
  $("stat-gold").textContent = `🪙 ${state.gold}`;
  $("stat-rating").textContent = `⭐ ${state.rating.toFixed(1)}`;
  $("stat-time").textContent = `⏰ ${Math.max(0, Math.ceil(day ? day.timeLeft / 1000 : 0))}`;
  $("stat-day").textContent = `📅 ${state.day}`;
}
function flashStat(id) {
  const el = $(id);
  el.classList.remove("flash");
  void el.offsetWidth;
  el.classList.add("flash");
}

function renderCustomers() {
  const area = $("customers-area");
  area.innerHTML = "";
  for (const c of day.customers) {
    const div = document.createElement("div");
    div.className = "customer";
    const selected = day.selectedTray >= 0 && day.tray[day.selectedTray];
    if (selected && c.order.some(o => !o.done && o.dish.id === day.tray[day.selectedTray].dish.id)) {
      div.classList.add("servable");
    }
    div.innerHTML = `
      ${c.chatPending ? '<span class="chat-hint">💬</span>' : ""}
      <span class="face">${moodFace(c)}</span>
      <span class="cname">${c.name}</span>
      <span class="ctype">${c.type.label}</span>
      <div class="order-bubble">${c.order.map(o => `<span class="oitem ${o.done ? "done" : ""}">${o.dish.emoji}</span>`).join("")}</div>
      <div class="patience-bar"><div class="patience-fill" style="width:${(c.patience / c.maxPatience) * 100}%"></div></div>
    `;
    div.onclick = () => serveTrayItem(c);
    c.el = div;
    area.appendChild(div);
  }
}

function moodFace(c) {
  const r = c.patience / c.maxPatience;
  if (r > 0.6) return c.face;
  if (r > 0.3) return "😕";
  return "😡";
}

function updatePatienceBars() {
  for (const c of day.customers) {
    if (!c.el) continue;
    const fill = c.el.querySelector(".patience-fill");
    const face = c.el.querySelector(".face");
    if (fill) {
      const r = clamp(c.patience / c.maxPatience, 0, 1);
      fill.style.width = (r * 100) + "%";
      fill.style.background = r > 0.5 ? "var(--green)" : r > 0.25 ? "var(--accent)" : "var(--red)";
    }
    if (face) face.textContent = moodFace(c);
  }
}

function renderTray() {
  const box = $("tray-slots");
  box.innerHTML = "";
  const size = traySize();
  for (let i = 0; i < size; i++) {
    const slot = document.createElement("div");
    slot.className = "tray-slot";
    const item = day.tray[i];
    if (item) {
      slot.classList.add("filled");
      if (i === day.selectedTray) slot.classList.add("selected");
      slot.textContent = item.dish.emoji;
      slot.onclick = () => {
        day.selectedTray = day.selectedTray === i ? -1 : i;
        renderTray(); renderCustomers();
      };
    }
    box.appendChild(slot);
  }
}

function renderCounter() {
  const area = $("counter-area");
  area.innerHTML = "";
  for (const d of activeMenu()) {
    const b = document.createElement("button");
    b.className = "station";
    b.id = "station-" + d.id;
    b.innerHTML = `
      <span class="s-emoji">${d.emoji}</span>
      <span class="s-name">${d.shortName || d.name}</span>
      <span class="s-price">💵 ${d.price}</span>
      <div class="cook-fill"></div>
    `;
    b.onclick = () => startCooking(d);
    area.appendChild(b);
  }
}

function renderCounterProgress() {
  // أول عملية طبخ لكل صنف تظهر على محطته
  const perDish = {};
  for (const c of day.cooking) {
    if (!perDish[c.dish.id]) perDish[c.dish.id] = c;
  }
  for (const d of activeMenu()) {
    const st = $("station-" + d.id);
    if (!st) continue;
    const c = perDish[d.id];
    const fill = st.querySelector(".cook-fill");
    if (c) {
      st.classList.add("cooking");
      fill.style.width = ((c.elapsed / c.total) * 100) + "%";
    } else {
      st.classList.remove("cooking");
      fill.style.width = "0%";
    }
  }
}

/* ---------- توست ونقاط متطايرة ---------- */
let toastTimer = null;
function toast(msg) {
  const t = $("toast");
  t.textContent = msg;
  t.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove("show"), 1800);
}

function floatScore(el, text, bad) {
  const f = document.createElement("div");
  f.className = "float-score" + (bad ? " bad" : "");
  f.textContent = text;
  const r = el ? el.getBoundingClientRect() : { left: innerWidth / 2, top: innerHeight / 2, width: 0 };
  f.style.left = (r.left + r.width / 2 - 40) + "px";
  f.style.top = (r.top + 10) + "px";
  document.body.appendChild(f);
  setTimeout(() => f.remove(), 1000);
}

/* ============================================================
   شاشة البداية والإعدادات
   ============================================================ */
function renderMenuScreen() {
  $("menu-stats").innerHTML = `
    📅 اليوم: ${state.day} &nbsp; | &nbsp; ⭐ ${state.rating.toFixed(1)} &nbsp; | &nbsp; 💵 ${state.money} &nbsp; | &nbsp; 🪙 ${state.gold}<br>
    ✅ إجمالي الزباين الراضين: ${state.totals.served} &nbsp; | &nbsp; 🤖 أطباق مبتكرة: ${state.aiDishes.length}
  `;
}

function bindEvents() {
  $("btn-start").onclick = () => { sfx.cook(); startDay(); };
  $("btn-shop-menu").onclick = () => { renderShop(); showScreen("screen-shop"); };
  $("btn-howto").onclick = () => showScreen("screen-howto");
  $("btn-howto-back").onclick = () => { renderMenuScreen(); showScreen("screen-menu"); };

  $("btn-report-shop").onclick = () => { renderShop(); showScreen("screen-shop"); };
  $("btn-next-day").onclick = () => startDay();
  $("btn-shop-back").onclick = () => {
    if (state.history.length && currentScreen === "screen-shop" && day && !day.running && day.served + day.angry > 0) {
      showScreen("screen-report");
    } else {
      renderMenuScreen(); showScreen("screen-menu");
    }
  };

  $("btn-ai-dish").onclick = () => aiDishFlow(false);
  $("btn-reject-dish").onclick = () => aiDishFlow(true);
  $("btn-accept-dish").onclick = () => {
    if (!pendingDish) return;
    pendingDish.shortName = pendingDish.name.split(" ").slice(0, 2).join(" ");
    state.aiDishes.push(pendingDish);
    if (state.aiDishes.length > 4) state.aiDishes.shift(); // حد أقصى 4 أطباق ذكية
    toast(`🎉 انضاف للقائمة: ${pendingDish.emoji} ${pendingDish.shortName}`);
    sfx.levelup();
    save();
    renderShop();
  };

  $("btn-settings").onclick = () => $("settings-modal").classList.remove("hidden");
  $("btn-close-settings").onclick = () => $("settings-modal").classList.add("hidden");
  $("btn-sound").onclick = () => {
    state.sound = !state.sound;
    $("btn-sound").textContent = state.sound ? "🔊 الصوت: يعمل" : "🔇 الصوت: مغلق";
    save();
  };
  $("btn-quit-day").onclick = () => {
    $("settings-modal").classList.add("hidden");
    if (day && day.running) { day.customers = []; day.timeLeft = 0; }
  };
  $("btn-reset").onclick = () => {
    if (confirm("متأكد؟ سيتم مسح كل تقدمك نهائياً!")) {
      localStorage.removeItem(SAVE_KEY);
      state = freshState();
      $("settings-modal").classList.add("hidden");
      renderMenuScreen();
      showScreen("screen-menu");
    }
  };
}

/* ---------- تشغيل ---------- */
load();
day = freshDay(); // حالة فارغة حتى لا تنكسر الواجهة قبل بدء اليوم
bindEvents();
$("btn-sound").textContent = state.sound ? "🔊 الصوت: يعمل" : "🔇 الصوت: مغلق";
renderMenuScreen();
showScreen("screen-menu");
