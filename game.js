/* ============================================================
   مطعم المستقبل – AI Kitchen
   لعبة إدارة مطعم عربية مع أنظمة ذكاء اصطناعي محلية (بدون سيرفر)
   ============================================================ */
"use strict";

/* ---------- أدوات عامة ---------- */
const $ = (id) => document.getElementById(id);
// احتياط: إذا ما تحمّل المشهد ثلاثي الأبعاد (ولا مكتبة Three) نلعب بالوضع 2D
if (typeof window.S3D === "undefined") window.S3D = { active: false, init: () => false };
const rand = (arr) => arr[Math.floor(Math.random() * arr.length)];
const rint = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
// أيقونة الذهب: بعض الأجهزة تعرض إيموجي 🪙 بلون أسود بدون تلوين — نرسمها بـCSS بدل الاعتماد على خط الجهاز
const GOLD_ICON = '<span class="gcoin"></span>';
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
/* لكل صنف تكلفة مواد خام (خبز، مايونيز، كاتشب…) تُخصم عند بدء الطبخ */
const BASE_DISHES = [
  { id: "shawarma", emoji: "🌯", name: "شاورما",  price: 8,  cook: 3500, cost: 3, mats: "خبز صاج + دجاج + ثومية" },
  { id: "fries",    emoji: "🍟", name: "بطاطس",   price: 5,  cook: 3000, cost: 2, mats: "بطاطس + زيت + كاتشب" },
  { id: "drink",    emoji: "🥤", name: "مشروب",   price: 3,  cook: 900,  cost: 1, mats: "عبوة + ثلج" },
];
const UNLOCK_DISHES = {
  falafel: { id: "falafel", emoji: "🧆", name: "فلافل", price: 6,  cook: 2800, cost: 2, mats: "حمص + بقدونس + زيت" },
  burger:  { id: "burger",  emoji: "🍔", name: "برجر",  price: 10, cook: 4200, cost: 4, mats: "خبز + لحم + جبن + مايونيز" },
};

/* ---------- أنواع الزبائن ---------- */
const CUSTOMER_TYPES = {
  hasty:  { key: "hasty",  label: "⚡ مستعجل", patience: 14000, drain: 1.5, tip: 0.8, ratingW: 1 },
  calm:   { key: "calm",   label: "🙂 هادئ",   patience: 30000, drain: 1.0, tip: 1.0, ratingW: 1 },
  rich:   { key: "rich",   label: "💎 غني",    patience: 22000, drain: 1.0, tip: 2.2, ratingW: 1 },
  critic: { key: "critic", label: "🧐 ناقد",   patience: 20000, drain: 1.1, tip: 1.2, ratingW: 2 },
};
const FACES_M = ["😀","😄","🙂","😎","🤓","😊","🧔","👳","👴","👦","👨‍🦱"];
const MALE_NAMES = ["أبو فهد","خالد","سلطان","ماجد","بندر","تركي","فيصل","ناصر"];
const FEMALE_NAMES = ["أم سعد","نورة","العنود","حصة","لطيفة","الجوهرة","دانة","موضي"];

/* ---------- الشخصيات المميزة (VIP) — رسوم كرتونية ---------- */
const VIP_SVG = {
  yousef: `<svg viewBox="0 0 64 64"><path d="M10 30 Q10 6 32 6 Q54 6 54 30 L54 42 Q54 48 48 48 L16 48 Q10 48 10 42 Z" fill="#f5f5f5" stroke="#444" stroke-width="2"/><rect x="14" y="12" width="36" height="7" rx="3.5" fill="#222"/><ellipse cx="32" cy="31" rx="12" ry="12" fill="#eeb98c"/><path d="M21 36 Q19 60 32 61 Q45 60 43 36 Q38 42 32 42 Q26 42 21 36" fill="#fafafa" stroke="#ccc" stroke-width="1.5"/><path d="M25 28 q2.5 3 5 0 M34 28 q2.5 3 5 0" stroke="#333" stroke-width="2" fill="none"/><ellipse cx="32" cy="34" rx="2" ry="2.5" fill="#d99a7a"/></svg>`,
  khalil: `<svg viewBox="0 0 64 64"><circle cx="32" cy="26" r="16" fill="#f2c49b" stroke="#444" stroke-width="2"/><circle cx="26" cy="25" r="4" fill="#fff" stroke="#333"/><circle cx="38" cy="25" r="4" fill="#fff" stroke="#333"/><circle cx="26" cy="26" r="1.8" fill="#222"/><circle cx="38" cy="26" r="1.8" fill="#222"/><path d="M25 34 Q32 41 39 34" fill="#fff" stroke="#333" stroke-width="2"/><circle cx="32" cy="30" r="1.5" fill="#e8967a"/><path d="M18 44 Q32 38 46 44 L46 58 L18 58 Z" fill="#6d4c2f"/></svg>`,
  fahad: `<svg viewBox="0 0 64 64"><path d="M10 32 Q10 6 32 6 Q54 6 54 32 L54 46 Q54 52 48 52 L16 52 Q10 52 10 46 Z" fill="#c0392b" stroke="#7b241c" stroke-width="2"/><path d="M14 14 L50 30 M14 22 L50 38 M50 14 L14 30 M50 22 L14 38" stroke="#fff" stroke-width="1" opacity=".5"/><rect x="14" y="10" width="36" height="7" rx="3.5" fill="#1a1a1a"/><ellipse cx="32" cy="33" rx="11.5" ry="12" fill="#dba876"/><path d="M23 29 l7 2 M41 29 l-7 2" stroke="#222" stroke-width="2.5"/><ellipse cx="27" cy="33" rx="1.7" ry="2" fill="#222"/><ellipse cx="37" cy="33" rx="1.7" ry="2" fill="#222"/><path d="M22 41 Q27 36 32 40 Q37 36 42 41 Q37 46 32 43 Q27 46 22 41" fill="#1a1a1a"/></svg>`,
  salim: `<svg viewBox="0 0 64 64"><ellipse cx="32" cy="28" rx="12" ry="18" fill="#e6c9a3" stroke="#555" stroke-width="2"/><circle cx="26" cy="28" r="5" fill="none" stroke="#555" stroke-width="2"/><circle cx="38" cy="28" r="5" fill="none" stroke="#555" stroke-width="2"/><path d="M31 28 h2" stroke="#555" stroke-width="2"/><circle cx="26" cy="28" r="1.5" fill="#222"/><circle cx="38" cy="28" r="1.5" fill="#222"/><path d="M28 42 Q32 52 36 42 Q34 44 32 44 Q30 44 28 42" fill="#9a9a9a"/><path d="M24 14 Q22 12 20 14 M40 14 Q42 12 44 14" stroke="#aaa" stroke-width="2" fill="none"/><path d="M16 52 Q32 44 48 52 L48 60 L16 60 Z" fill="#8d7350"/></svg>`,
  samir: `<svg viewBox="0 0 64 64"><path d="M20 16 L44 16 L42 4 L22 4 Z" fill="#b71c1c" stroke="#7f1010" stroke-width="2"/><circle cx="45" cy="6" r="2.5" fill="#5d4037"/><path d="M44 8 L43 15" stroke="#5d4037" stroke-width="1.5"/><ellipse cx="32" cy="30" rx="14" ry="14" fill="#e8b48b" stroke="#555" stroke-width="2"/><path d="M23 27 q3 -2 5 0 M36 27 q3 -2 5 0" stroke="#333" stroke-width="2" fill="none"/><ellipse cx="26" cy="29" rx="1.6" ry="2" fill="#222"/><ellipse cx="38" cy="29" rx="1.6" ry="2" fill="#222"/><path d="M20 37 Q26 32 32 36 Q38 32 44 37 Q38 43 32 39 Q26 43 20 37" fill="#9e9e9e"/><path d="M16 50 Q32 42 48 50 L48 60 L16 60 Z" fill="#fff"/><path d="M20 48 L26 60 M44 48 L38 60" stroke="#8e1c1c" stroke-width="5"/></svg>`,
  fanni: `<svg viewBox="0 0 64 64"><path d="M14 22 Q14 8 32 8 Q50 8 50 22 Z" fill="#1565c0"/><path d="M20 12 Q32 4 44 12 L44 18 L20 18 Z" fill="#cfd8dc"/><rect x="12" y="20" width="40" height="5" rx="2.5" fill="#0d47a1"/><ellipse cx="32" cy="34" rx="12" ry="12" fill="#eeb98c" stroke="#555" stroke-width="2"/><ellipse cx="27" cy="33" rx="1.7" ry="2" fill="#3a2411"/><ellipse cx="37" cy="33" rx="1.7" ry="2" fill="#3a2411"/><path d="M26 40 Q32 45 38 40" stroke="#7a3b2e" stroke-width="2" fill="none"/><rect x="44" y="22" width="5" height="26" rx="2" fill="#c62828" transform="rotate(28 46 35)"/><rect x="49" y="14" width="9" height="11" rx="2" fill="#9e9e9e" transform="rotate(28 53 19)"/><path d="M16 52 Q32 44 48 52 L48 62 L16 62 Z" fill="#1976d2"/></svg>`,
  edward: `<svg viewBox="0 0 64 64"><ellipse cx="32" cy="28" rx="13" ry="13" fill="#f2cba6" stroke="#666" stroke-width="2"/><path d="M18 24 Q18 15 27 15 M46 24 Q46 15 37 15" stroke="#eceff1" stroke-width="6" fill="none"/><path d="M22 20 q4 -2 8 0 M34 20 q4 -2 8 0" stroke="#eceff1" stroke-width="3" fill="none"/><ellipse cx="27" cy="27" rx="1.8" ry="2.2" fill="#4e342e"/><ellipse cx="38" cy="27" rx="1.8" ry="2.2" fill="#4e342e"/><path d="M20 35 Q26 30 32 34 Q38 30 44 35 Q38 41 32 37 Q26 41 20 35" fill="#fafafa"/><path d="M27 40 Q32 48 37 40 Q34 42 32 42 Q30 42 27 40" fill="#fafafa"/><path d="M14 52 Q32 44 50 52 L50 62 L14 62 Z" fill="#8d6e63"/><path d="M26 50 L32 62 L38 50" fill="#546e7a"/><rect x="30" y="48" width="4" height="10" fill="#5d1a12"/></svg>`,
};

const VIPS = [
  { id: "yousef", name: "شيخ يوسف", label: "📿 حكيم", patience: 38000, drain: 0.8, tip: 1.3, ratingW: 3, orders: [1, 2],
    intro: "📿 شيخ يوسف شرّف المطعم! رضاه بركة على تقييمك",
    chat: [{ msg: "يا ولدي، البركة في البكور… والأكل الزين 😌", replies: [
      { t: "حياك الله يا شيخ، طلبك على عيني 🙏", eff: 20 },
      { t: "البركة في السرعة يا شيخ 😅", eff: 5 },
      { t: "المهم الحساب قبل الدعاء 😬", eff: -15 } ] }] },
  { id: "khalil", name: "خليل", label: "🧒 طفل", patience: 20000, drain: 1.1, tip: 0.6, ratingW: 1, orders: [1, 1],
    intro: "🧒 خليل جاء! إذا رضي بسرعة بيجيب ربعه معه",
    chat: [{ msg: "عمو! تخليني أشوف كيف تسوون الشاورما؟ 🤩", replies: [
      { t: "تعال شوف يا بطل، بس من ورا الكاونتر 😄", eff: 20 },
      { t: "المطبخ مو مكان أطفال", eff: -12 },
      { t: "إذا خلصت أكلك أوريك 😉", eff: 12 } ] }] },
  { id: "fahad", name: "أحمد الفهد", label: "🕵️ مفتش", patience: 22000, drain: 1.2, tip: 1.4, ratingW: 3, orders: [2, 3],
    intro: "🕵️ أحمد الفهد مفتش الجودة وصل… لا تعطيه أي غلط!",
    chat: [{ msg: "أنا أقيّم المطاعم رسمياً… وعيني ما تفوّت شي 🧐", replies: [
      { t: "أهلاً بالخبير! جودتنا بتتكلم عنا 👨‍🍳", eff: 20 },
      { t: "التقييمات ما تهمنا صراحة", eff: -18 },
      { t: "خذ راحتك، بس البقشيش يفرق 😅", eff: -8 } ] }] },
  { id: "salim", name: "العم سالم", label: "👓 نسّاي", patience: 34000, drain: 0.9, tip: 1.0, ratingW: 1, orders: [1, 2],
    intro: "👓 العم سالم وصل… ترى ينسى ويغيّر طلبه!",
    chat: [{ msg: "أممم… وش كنت طالب؟ ذكرني الله يذكرك بالخير 😅", replies: [
      { t: "ولا يهمك يا عم، طلبك محفوظ عندي 📝", eff: 20 },
      { t: "هذي ثالث مرة تسأل! 😑", eff: -15 },
      { t: "اطلب من جديد ولا عليك", eff: 8 } ] }] },
  { id: "fanni", name: "أبو شاكر الفني", label: "🔧 فني", patience: 26000, drain: 1.0, tip: 1.1, ratingW: 1, orders: [1, 2],
    intro: "🔧 أبو شاكر الفني وصل — إذا رضي يصلّح معداتك ببلاش!",
    chat: [{ msg: "أشوف مطبخك يحتاج صيانة… أسويها لك مجاناً إذا الأكل عجبني 😉", replies: [
      { t: "أبشر! أكلنا يستاهل أفضل معدات 💪", eff: 20 },
      { t: "معداتنا جديدة ما تحتاج أحد", eff: -8 },
      { t: "وكم بتاخذ لو ما عجبك؟ 😅", eff: 5 } ] }] },
  { id: "edward", name: "الخواجة إدوارد", label: "🧐 سائح", patience: 19000, drain: 1.1, tip: 2.5, ratingW: 2, orders: [1, 2],
    intro: "🧐 سائح أجنبي وصل — يدفع بسخاء ويكتب مراجعات مشهورة!",
    chat: [{ msg: "Excuse me… هذي أول شاورما لي بحياتي! 🤩", replies: [
      { t: "Welcome! بتدمن عليها من أول قضمة 😄", eff: 20 },
      { t: "أول مرة؟! وين عايش أنت؟ 😅", eff: -10 },
      { t: "خذ معها بطاطس، هدية مني 🎁", eff: 15 } ] }] },
  { id: "samir", name: "أبو سمير", label: "🎩 تاجر", patience: 24000, drain: 1.0, tip: 2.0, ratingW: 2, orders: [3, 4],
    intro: "🎩 أبو سمير التاجر هنا — يدفع ضعف السعر!",
    chat: [{ msg: "عندي صفقة: أكل ممتاز اليوم، وأنا زبونك الدائم 🤝", replies: [
      { t: "اتفقنا! وأول وجبة VIP عليّ أنا 🎉", eff: 22 },
      { t: "كل الزباين عندي سواء", eff: -5 },
      { t: "الدائم يحتاج خصم دائم؟ نتفاهم 😏", eff: 10 } ] }] },
];

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
    cost: rint(4, 7),
    mats: "مكونات فاخرة مستوردة",
    ai: true,
  };
}

/* ---------- التطويرات: مستويات متصاعدة — البداية ~300 والسعر يقفز مع كل مستوى ---------- */
const UPGRADES = [
  { id: "decor", emoji: "🪴", name: "ديكور فخم", desc: "+12% صبر للزباين لكل مستوى", max: 5, cost: l => Math.round(300 * Math.pow(1.5, l)) },
  { id: "grill", emoji: "🔥", name: "معدات أسرع", desc: "تسريع الطبخ 12% لكل مستوى", max: 5, cost: l => Math.round(320 * Math.pow(1.6, l)) },
  { id: "fame",  emoji: "📣", name: "حملة إعلانية", desc: "+10% بقشيش لكل مستوى", max: 5, cost: l => Math.round(340 * Math.pow(1.7, l)) },
  { id: "tray",  emoji: "🍽️", name: "صينية أكبر", desc: "+1 مكان بالصينية لكل مستوى", max: 3, cost: l => Math.round(380 * Math.pow(1.8, l)) },
  { id: "falafel", emoji: "🧆", name: "فتح صنف: فلافل", desc: "إضافة صنف جديد للمطعم استثمار مكلف (يبيع بـ6 💵)", max: 1, cost: () => 400 },
  { id: "burger",  emoji: "🍔", name: "فتح صنف: برجر", desc: "الصنف الأغلى بالقائمة (يبيع بـ10 💵)", max: 1, cost: () => 700 },
  { id: "robot",   emoji: "🤖", name: "مساعد آلي", desc: "م1: يطبخ كل 12ث — م2: كل 8ث — م3: كل 4ث", max: 3, cost: l => Math.round(600 * Math.pow(2, l)), req: { day: 6 } },
  /* عناصر فاخرة — غالية ومقفلة بشروط صعبة */
  { id: "soda", emoji: "🥤", name: "نافورة المشروبات الذاتية", desc: "المشروبات تجهز فورياً بدون انتظار!", max: 1, cost: () => 2200, req: { level: 5 } },
  { id: "doubleOven", emoji: "♨️", name: "الفرن المزدوج الاحترافي", desc: "25% فرصة يطلع صنفان من كل طبخة — الثاني ببلاش!", max: 1, cost: () => 3500, req: { day: 10 } },
  { id: "goldenSign", emoji: "🏅", name: "اللوحة الذهبية المرموقة", desc: "سمعة محصّنة: تقييمك لا ينزل أبداً تحت 3.0", max: 1, cost: () => 4200, req: { level: 8 } },
];
function reqMet(u) {
  if (!u.req) return true;
  if (u.req.level && playerLevel() < u.req.level) return false;
  if (u.req.day && state.day < u.req.day) return false;
  return true;
}
function reqLabel(u) {
  if (u.req.level) return `🔒 يتطلب مستوى ${u.req.level} (أنت ${playerLevel()})`;
  return `🔒 يتطلب الوصول لليوم ${u.req.day} (أنت باليوم ${state.day})`;
}

/* ---------- الأحداث اليومية ---------- */
const DAY_EVENTS = [
  { id: "rain", name: "🌧️ يوم ممطر", desc: "زباين أقل لكن البقشيش +30%", spawnMult: 1.45, tipMult: 1.3 },
  { id: "match", name: "⚽ مباراة اليوم", desc: "زحمة كبيرة وصبر أقل!", spawnMult: 0.6, patMult: 0.85 },
  { id: "press", name: "📰 يوم الصحافة", desc: "النقاد أكثر اليوم — فرصة تقييم ذهبية", criticBoost: true },
  { id: "holiday", name: "🎉 يوم إجازة", desc: "عوائل: صنف إضافي بكل طلب", extraItem: true },
  { id: "health", name: "🥗 حملة صحية", desc: "الطازج ✨ يعطي ضعف المكافأة", freshX2: true },
];

/* ---------- المهمات الجانبية اليومية ---------- */
const QUESTS = [
  { id: "fresh5", name: "سلّم 5 أصناف طازجة ✨", check: d => d.freshServes >= 5, reward: { gold: 2 } },
  { id: "perfect3", name: "3 تسليمات مثالية 🏆", check: d => d.perfect >= 3, reward: { gold: 2 } },
  { id: "combo4", name: "وصل كومبو ×4 🔥", check: d => d.maxCombo >= 4, reward: { money: 80 } },
  { id: "noangry", name: "يوم بلا زعل (3+ زباين) 😇", check: d => d.angry === 0 && d.served >= 3, reward: { gold: 3 } },
  { id: "chat2", name: "ردّان موفقان بالمحادثة 💬", check: d => d.chatGood >= 2, reward: { money: 60 } },
];

/* ---------- المستويات والألقاب ---------- */
const TITLES = ["طباخ مبتدئ", "مساعد شيف", "شيف", "شيف محترف", "ماستر الشاورما", "نجم الحي", "أسطورة المطبخ", "إمبراطور AI Kitchen"];
function xpForLevel(l) { return l * l * 40; }
function playerLevel() { let l = 1; while (xpForLevel(l + 1) <= state.xp) l++; return Math.min(l, 40); }
function playerTitle() { return TITLES[Math.min(TITLES.length - 1, Math.floor((playerLevel() - 1) / 2))]; }

/* ---------- الإنجازات ---------- */
const ACHIEVEMENTS = [
  { id: "first", emoji: "🍽️", name: "البداية", desc: "أول زبون راضي", check: s => s.totals.served >= 1 },
  { id: "s50", emoji: "👨‍🍳", name: "معلم الحارة", desc: "50 زبون راضي", check: s => s.totals.served >= 50 },
  { id: "s200", emoji: "⭐", name: "مشهور", desc: "200 زبون راضي", check: s => s.totals.served >= 200 },
  { id: "rich", emoji: "💰", name: "تاجر شاطر", desc: "اجمع 1000 ربح إجمالي", check: s => s.totals.earned >= 1000 },
  { id: "combo8", emoji: "🔥", name: "على النار", desc: "كومبو ×8", check: s => s.records.maxCombo >= 8 },
  { id: "lvl5", emoji: "📈", name: "محترف معتمد", desc: "الوصول لمستوى 5", check: () => playerLevel() >= 5 },
  { id: "ai3", emoji: "🤖", name: "شيف المستقبل", desc: "3 أطباق مبتكرة بالقائمة", check: s => s.aiDishes.length >= 3 },
  { id: "day7", emoji: "📅", name: "أسبوع كامل", desc: "الوصول لليوم 7", check: s => s.day >= 7 },
  { id: "star48", emoji: "🌟", name: "مطعم 5 نجوم", desc: "تقييم 4.8 أو أعلى", check: s => s.rating >= 4.8 },
  { id: "vips", emoji: "👑", name: "صديق الجميع", desc: "أرضِ الشخصيات المميزة الخمس", check: s => (s.vipsPleased || []).length >= 5 },
];
function checkAchievements() {
  for (const a of ACHIEVEMENTS) {
    if (!state.ach[a.id] && a.check(state)) {
      state.ach[a.id] = true;
      toast(`🏅 إنجاز جديد: ${a.emoji} ${a.name}!`);
      sfx.levelup();
    }
  }
}

/* ---------- المزايا الذهبية: مستويات بالذهب النادر ---------- */
const PERKS = [
  { id: "freshPlus", emoji: "🧊", name: "صينية التبريد VIP", max: 2, cost: l => 15 + l * 15,
    desc: l => `الطازج ✨ يدوم ${(5 + (l + 1) * 3.5).toFixed(1)} ثانية (حالياً: ${(5 + l * 3.5).toFixed(1)})` },
  { id: "coffeePro", emoji: "🫖", name: "دلة الضيافة الكبيرة", max: 2, cost: l => 12 + l * 12,
    desc: l => `القهوة كل ${(25 - (l + 1) * 6.5).toFixed(1)} ثانية (حالياً: ${(25 - l * 6.5).toFixed(1)})` },
  { id: "vipMagnet", emoji: "👑", name: "السمعة الذهبية", max: 2, cost: l => 15 + l * 15,
    desc: () => "الشخصيات المميزة تزورك أكثر ولمرات أكثر باليوم" },
  { id: "insurance", emoji: "🛡️", name: "تأمين تجاري", max: 2, cost: l => 10 + l * 10,
    desc: l => `غرامات الوزارة −${(l + 1) * 30}% (حالياً: −${l * 30}%)` },
  { id: "extraTime", emoji: "⏳", name: "ساعات عمل أطول", max: 3, cost: l => 15 + l * 15,
    desc: l => `+${(l + 1) * 10} ثانية لكل يوم (حالياً: +${l * 10})` },
];
const perkLv = (id) => (state.perks && state.perks[id]) || 0;
const FRESH_MS = () => 5000 + perkLv("freshPlus") * 3500;

/* ---------- ثيمات الديكور ---------- */
const THEME_DEFS = [
  { id: "classic", name: "🏠 كلاسيكي دافئ", cost: 0 },
  { id: "neon", name: "🌌 نيون ليلي", cost: 450 },
  { id: "desert", name: "🏜️ صحراوي تراثي", cost: 450 },
  { id: "royal", name: "👑 القصر الملكي", cost: 0, vipOnly: true },
];

/* ============================================================
   البريميوم: شراء بفلوس حقيقية (IAP) + إعلانات مكافئة
   ملاحظة تقنية: في نسخة المتاجر تُستبدل simulateIAP/simulateAd
   بمكتبات الدفع الحقيقية (StoreKit / Google Play Billing / AdMob)
   ============================================================ */
const IAP_PRODUCTS = [
  { id: "vip", emoji: "👑", name: "عضوية VIP الذهبية", price: "49.99 ر.س", once: true,
    desc: "للأبد: خبرة ×2، بقشيش +10%، إعفاء من أول مخالفة كل يوم، وثيم القصر الملكي الحصري" },
  { id: "money1", emoji: "💵", name: "حزمة فلوس", price: "9.99 ر.س",
    desc: "+1200 فلوس فوراً", grant: () => { state.money += 1200; } },
  { id: "money2", emoji: "💰", name: "خزنة الفلوس الكبيرة", price: "39.99 ر.س",
    desc: "+6500 فلوس فوراً (أفضل قيمة)", grant: () => { state.money += 6500; } },
  { id: "gold1", emoji: GOLD_ICON, name: "كيس ذهب", price: "14.99 ر.س",
    desc: "+25 ذهب فوراً", grant: () => { state.gold += 25; } },
  { id: "gold2", emoji: "🏆", name: "صندوق الذهب الملكي", price: "49.99 ر.س",
    desc: "+110 ذهب فوراً (أفضل قيمة)", grant: () => { state.gold += 110; } },
];

const AD_COOLDOWN = 180000; // 3 دقائق بين الإعلانات
function adReady() { return Date.now() >= (state.adCdUntil || 0); }

/* إعلان تجريبي — 5 ثوانٍ عد تنازلي (يُستبدل بـAdMob في نسخة المتاجر) */
function simulateAd(onDone) {
  const modal = $("ad-modal");
  const cnt = $("ad-count");
  modal.classList.remove("hidden");
  let left = 5;
  cnt.textContent = left;
  const iv = setInterval(() => {
    left--;
    cnt.textContent = left;
    if (left <= 0) {
      clearInterval(iv);
      modal.classList.add("hidden");
      onDone();
    }
  }, 1000);
}

function watchShopAd() {
  if (!adReady()) {
    toast(`🎬 الإعلان التالي بعد ${Math.ceil(((state.adCdUntil || 0) - Date.now()) / 1000)} ثانية`);
    return;
  }
  simulateAd(() => {
    state.adCdUntil = Date.now() + AD_COOLDOWN;
    state.adToggle = !state.adToggle;
    if (state.adToggle) { state.money += 60; toast("🎬 مكافأة الإعلان: +60 💵!"); }
    else { state.gold += 1; toast(`🎬 مكافأة الإعلان: +1 ${GOLD_ICON}!`); }
    sfx.coin();
    save();
    renderShop();
  });
}

/* شراء IAP (وضع تجريبي على الويب) */
let pendingIAP = null;
function buyIAP(p) {
  pendingIAP = p;
  $("iap-name").innerHTML = `${p.emoji} ${p.name} — ${p.price}`;
  $("iap-modal").classList.remove("hidden");
}
function confirmIAP() {
  const p = pendingIAP;
  if (!p) return;
  $("iap-modal").classList.add("hidden");
  // في نسخة المتاجر: هنا يُستدعى الدفع الحقيقي وننتظر الإيصال
  if (p.once) state.iap[p.id] = true;
  if (p.grant) p.grant();
  if (p.id === "vip" && !state.themesOwned.includes("royal")) state.themesOwned.push("royal");
  sfx.levelup();
  toast(`👑 تم الشراء (تجريبي): ${p.name}!`);
  save();
  renderShop();
  pendingIAP = null;
}
const isVIP = () => !!(state.iap && state.iap.vip);

/* ---------- حالة اللعبة ---------- */
const SAVE_KEY = "ai_kitchen_save_v1";
let state = null;

function freshState() {
  return {
    money: 60, gold: 2, day: 1, rating: 5.0, sound: true, music: true, // رأس مال بسيط للمواد الخام
    xp: 0, ach: {}, vipsPleased: [], freeDish: 0,
    complaints: 0, violations: 0, perks: {},
    iap: {}, adCdUntil: 0, adToggle: false,
    records: { bestDayEarn: 0, maxCombo: 0, endlessBest: 0 },
    theme: "classic", themesOwned: ["classic"],
    upgrades: { grill: 0, tray: 0, decor: 0, fame: 0, falafel: 0, burger: 0, robot: 0 },
    aiDishes: [],           // أطباق ابتكرها الذكاء الاصطناعي
    totals: { served: 0, angry: 0, earned: 0 },
    history: [],            // ملخص الأيام السابقة (للتحليل الذكي)
  };
}
function save() { try { localStorage.setItem(SAVE_KEY, JSON.stringify(state)); } catch (e) {} }
function load() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (raw) {
      state = Object.assign(freshState(), JSON.parse(raw));
      // ترحيل: المزايا القديمة كانت true/false وصارت مستويات
      for (const k of Object.keys(state.perks || {})) {
        if (state.perks[k] === true) state.perks[k] = 1;
      }
      return;
    }
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
function cookTime(dish) {
  if (dish.id === "drink" && state.upgrades.soda) return 200; // نافورة ذاتية 🥤
  let t = dish.cook * Math.pow(0.88, state.upgrades.grill || 0);
  if (day && day.combo >= 5) t *= 0.8; // وضع النار 🔥
  if (day && day.fanniBoost) t *= 0.8; // صيانة أبو شاكر 🔧
  return t;
}
function traySize() { return 4 + (state.upgrades.tray || 0); }
function patienceMult() { return 1 + (state.upgrades.decor || 0) * 0.12; }
function tipMult() {
  return (1 + (state.upgrades.fame || 0) * 0.10)
       * (1 + Math.min(playerLevel() - 1, 10) * 0.02)
       * (isVIP() ? 1.1 : 1); // 👑 عضوية VIP
}

/* ---------- حالة اليوم الجاري ---------- */
let day = null;
let loopTimer = null;
let lastTick = 0;

function freshDay() {
  return {
    running: false,
    timeLeft: Math.min(60000 + state.day * 12000, 150000) + perkLv("extraTime") * 10000,
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
    // أنظمة جديدة
    combo: 0, maxCombo: 0,                 // سلسلة التسليم المتتالي
    goal: 40 + state.day * 25,             // الهدف اليومي
    goalMet: false,
    rushAt: -1, rushLeft: 0, rushDone: false, // ساعة الذروة
    vipCount: 0, vipsSeen: [], vipServed: 0, vipAngry: 0,
    freshServes: 0,          // أصناف سُلّمت وهي طازجة
    // أنظمة تحديث 5
    totalTime: Math.min(60000 + state.day * 12000, 150000) + perkLv("extraTime") * 10000,
    event: null, quest: null, questDone: false,
    coffeeCd: 0, robotIn: 12000,
    endless: false, goalBonus: 0,
    inspectionAt: -1, inspectionDone: false, fined: 0,
    expenses: 0,             // مصاريف المواد الخام
    fanniBoost: false,       // صيانة أبو شاكر الفني
    vipWaiverUsed: false,    // إعفاء مخالفة VIP اليومي
    adDoubled: false,        // مضاعفة أرباح اليوم بإعلان
  };
}

/* ============================================================
   الزبائن
   ============================================================ */
let customerSeq = 0;
function spawnCustomer() {
  if (day.customers.length >= 4) return;
  // فرصة ظهور شخصية مميزة (السمعة الذهبية 👑 ترفع الفرصة والحد)
  const vipMax = 2 + (perkLv("vipMagnet") > 1 ? 1 : 0);
  const vipChance = 0.22 + perkLv("vipMagnet") * 0.06;
  if (state.day >= 2 && day.vipCount < vipMax && !day.customers.some(c => c.isVip) && Math.random() < vipChance) {
    const pool = VIPS.filter(v => !day.vipsSeen.includes(v.id));
    if (pool.length) { spawnVip(rand(pool)); return; }
  }
  // الناقد والغني أندر (يوم الصحافة يكثر النقاد)
  const weighted = (day.event && day.event.criticBoost)
    ? ["hasty","calm","calm","rich","critic","critic","critic"]
    : ["hasty","hasty","calm","calm","calm","rich","critic"];
  const type = CUSTOMER_TYPES[state.day < 2 ? rand(["calm","hasty"]) : rand(weighted)];
  const menu = activeMenu();
  let count = type.key === "rich" ? rint(2, Math.min(4, menu.length)) : rint(1, Math.min(3, menu.length));
  if (day.event && day.event.extraItem) count = Math.min(count + 1, 4);
  const order = [];
  for (let i = 0; i < count; i++) order.push(rand(menu));
  const maxP = type.patience * patienceMult() * ((day.event && day.event.patMult) || 1);
  const female = Math.random() < 0.4;
  const c = {
    uid: ++customerSeq,
    gender: female ? "f" : "m",
    scaleVar: 0.94 + Math.random() * 0.12,
    name: female ? rand(FEMALE_NAMES) : rand(MALE_NAMES),
    face: female ? "🧕" : rand(FACES_M), type,
    order: order.map(d => ({ dish: d, done: false })),
    patience: maxP, maxPatience: maxP,
    el: null, chatPending: false,
  };
  day.customers.push(c);
  renderCustomers();
}

function spawnVip(v) {
  const menu = activeMenu();
  let count = clamp(rint(v.orders[0], v.orders[1]), 1, Math.max(2, menu.length));
  let mega = false;
  if (v.id === "samir" && Math.random() < 0.35) { count = 5; mega = true; } // الطلب الضخم
  const order = [];
  for (let i = 0; i < count; i++) order.push(rand(menu));
  const maxP = v.patience * patienceMult();
  const c = {
    uid: ++customerSeq,
    name: v.name, face: "", svg: VIP_SVG[v.id],
    type: { key: "vip_" + v.id, label: v.label, patience: v.patience, drain: v.drain, tip: v.tip, ratingW: v.ratingW },
    isVip: true, vip: v.id, vipChat: v.chat,
    order: order.map(d => ({ dish: d, done: false })),
    patience: maxP, maxPatience: maxP,
    el: null, chatPending: false, swapped: false, mega,
  };
  day.customers.push(c);
  day.vipCount++;
  day.vipsSeen.push(v.id);
  toast(mega ? "🎩💰 طلب ضخم من أبو سمير — أجرة مضاعفة ×3!" : v.intro);
  sfx.chat();
  renderCustomers();
}

function customerRemaining(c) { return c.order.filter(o => !o.done); }

/* ---------- تفتيش وزارة التجارة ---------- */
function runInspection() {
  sfx.angry();
  toast("🚨 زيارة مفاجئة من وزارة التجارة!");
  const insp = {
    uid: ++customerSeq,
    name: "مفتش الوزارة", face: "🕵️", gender: "m",
    vip: "inspector", isInspector: true, isVip: false,
    type: { key: "inspector", label: "🏛️ وزارة التجارة", drain: 0, tip: 0, ratingW: 0, patience: 1 },
    order: [], patience: 1, maxPatience: 1,
    el: null, chatPending: false,
  };
  day.customers.push(insp);
  renderCustomers();
  setTimeout(() => {
    if (!day.running || !day.customers.includes(insp)) return;
    const hasComplaints = state.complaints > 0;
    let valid = hasComplaints && Math.random() < 0.7;
    // 👑 عضوية VIP تسقط أول مخالفة كل يوم
    if (valid && isVIP() && !day.vipWaiverUsed) {
      day.vipWaiverUsed = true;
      valid = false;
      toast("👑 عضوية VIP الذهبية أسقطت المخالفة — محاميك تكفّل بالموضوع!");
    }
    if (valid) {
      let fine = 40 + state.day * 10;
      if (perkLv("insurance")) fine = Math.round(fine * (1 - perkLv("insurance") * 0.3));
      fine = Math.min(fine, state.money);
      state.money -= fine;
      state.violations++;
      state.rating = clamp(state.rating - 0.3, 1, 5);
      day.fined += fine;
      toast(`❌ ثبتت شكوى العميل! غرامة ${fine} 💵 + مخالفة رقم ${state.violations}${perkLv("insurance") ? " (🛡️ التأمين خفّض الغرامة)" : ""}`);
      sfx.wrong();
    } else {
      state.rating = clamp(state.rating + 0.15, 1, 5);
      toast(hasComplaints ? "✅ الشكوى ما ثبتت — سجلّك سليم والتقييم ارتفع!" : "✅ تفتيش روتيني: المطعم ممتاز! التقييم ارتفع");
      sfx.levelup();
    }
    state.complaints = 0;
    removeCustomer(insp, !valid);
    renderTopbar();
    save();
  }, 6000);
}

function serveTrayItem(c) {
  if (c.isInspector) { toast("🏛️ هذا مفتش الوزارة، مو زبون! خله يفتش براحته 😅"); return; }
  let idx = day.selectedTray;
  // تسليم بلمسة واحدة: بدون تحديد، نختار تلقائياً أول صنف بالصينية يناسب طلبه
  if (idx < 0 || !day.tray[idx]) {
    idx = day.tray.findIndex(t => c.order.some(o => !o.done && o.dish.id === t.dish.id));
    if (idx < 0) { toast(day.tray.length ? "🤔 ما في صنف بالصينية يناسب طلبه" : "👨‍🍳 اطبخ من الكاونتر أولاً"); return; }
  }
  const item = day.tray[idx];
  const slot = c.order.find(o => !o.done && o.dish.id === item.dish.id);
  if (!slot) {
    // تسليم خاطئ (حدد صنفاً غلط بنفسه) — يكسر الكومبو
    const pen = c.type.ratingW >= 2 ? 0.25 : 0.15;
    c.patience = Math.max(0, c.patience - c.maxPatience * pen);
    day.wrongServes++;
    day.combo = 0;
    sfx.wrong();
    toast(`❌ ${c.name} ما طلب ${item.dish.name}! (انكسر الكومبو)`);
    return;
  }
  slot.done = true;
  day.tray.splice(idx, 1);
  day.selectedTray = -1;
  sfx.serve();
  // مكافأة الصنف الطازج: يرفع صبر الزبون (تتضاعف بالحملة الصحية)
  if (item.readyAt && performance.now() - item.readyAt < FRESH_MS()) {
    const boost = 0.06 * ((day.event && day.event.freshX2) ? 2 : 1);
    c.patience = Math.min(c.maxPatience, c.patience + c.maxPatience * boost);
    day.freshServes++;
    floatScore(c.el, "✨ طازج!");
  }
  if (S3D.active && S3D.flyDish) S3D.flyDish(item.dish, c.uid);
  if (customerRemaining(c).length === 0) completeOrder(c);
  renderTray(); renderCustomers();
}

function completeOrder(c) {
  const ratio = clamp(c.patience / c.maxPatience, 0, 1);
  let base = c.order.reduce((s, o) => s + o.dish.price, 0);
  if (c.vip === "samir") base *= 2; // التاجر يدفع الضعف
  if (c.mega) base = Math.round(base * 1.5); // الطلب الضخم ×3 إجمالاً
  const tip = Math.round(base * ratio * (c.type.tip - 0.4) * tipMult() * ((day.event && day.event.tipMult) || 1));
  let total = base + Math.max(0, tip);
  if (day.rushLeft > 0) total = Math.round(total * 1.5); // ساعة الذروة

  // الكومبو: تسليم متتالي بنصف صبر أو أكثر يرفع المضاعف
  if (ratio >= 0.5) day.combo++; else day.combo = 1;
  day.maxCombo = Math.max(day.maxCombo, day.combo);
  const comboMult = 1 + Math.min(day.combo - 1, 10) * 0.08;
  total = Math.round(total * comboMult);

  state.money += total;
  day.earned += total;
  day.served++;
  if (c.isVip) day.vipServed++;
  day.patienceSum += ratio;
  c.order.forEach(o => { day.soldCount[o.dish.id] = (o.dish.id in day.soldCount ? day.soldCount[o.dish.id] : 0) + 1; });

  // الذهب نادر: يحتاج تسليماً شبه فوري (صبر 85%+)، والزبون العادي ما يضمن العطاء
  const comboTxt = day.combo >= 2 ? ` 🔥x${day.combo}` : "";
  if (ratio > 0.85) {
    day.perfect++;
    const generous = c.type.ratingW >= 2 || Math.random() < 0.4; // الناقد/المفتش الجودة يقدرون، والعادي 40% بس
    const g = generous ? (c.vip === "fahad" ? 2 : 1) : 0;
    if (g > 0) {
      state.gold += g; day.goldEarned += g;
      sfx.coin();
      floatScore(c.el, `+${total} 💵 +${g} ${GOLD_ICON}${comboTxt}`);
    } else {
      floatScore(c.el, `+${total} 💵 🌟${comboTxt}`);
    }
  } else {
    floatScore(c.el, `+${total} 💵${comboTxt}`);
  }

  // قدرات الشخصيات المميزة
  if (c.vip === "yousef" && ratio > 0.4) {
    state.rating = clamp(state.rating + (5 - state.rating) * 0.3, 1, 5);
    toast("📿 شيخ يوسف دعا لمطعمك — التقييم ارتفع!");
  }
  if (c.vip === "khalil" && ratio > 0.6) {
    day.spawnIn = 500;
    toast("🧒 خليل راح يجيب ربعه — زباين جايين!");
  }
  if (c.vip === "fanni" && ratio > 0.5 && !day.fanniBoost) {
    day.fanniBoost = true;
    toast("🔧 أبو شاكر صلّح معداتك مجاناً — طبخ أسرع 20% لبقية اليوم!");
    sfx.levelup();
  }
  if (c.vip === "edward" && ratio > 0.5) {
    state.rating = clamp(state.rating + (5 - state.rating) * 0.2, 1, 5);
    toast("🧐 الخواجة إدوارد نشر مراجعة 5 نجوم عن مطعمك!");
  }

  // التقييم
  const target = 3 + 2.2 * ratio;
  const w = 0.09 * c.type.ratingW;
  state.rating = clamp(state.rating + (target - state.rating) * w, 1, 5);

  // خبرة ومستويات (VIP يضاعفها 👑)
  const lvlBefore = playerLevel();
  state.xp += (10 + day.combo * 2 + (c.isVip ? 10 : 0)) * (isVIP() ? 2 : 1);
  if (playerLevel() > lvlBefore) {
    toast(`⬆️ مستوى ${playerLevel()}: أنت الآن "${playerTitle()}"! (+2% بقشيش)`);
    sfx.levelup();
  }
  // عملات تطير + سجلات + إنجازات
  if (S3D.active && S3D.flyCoins) S3D.flyCoins(c.uid, Math.min(6, Math.ceil(total / 15)));
  if (c.isVip && !state.vipsPleased.includes(c.vip)) state.vipsPleased.push(c.vip);
  state.records.maxCombo = Math.max(state.records.maxCombo, day.combo);
  checkAchievements();

  removeCustomer(c, true);
  flashStat("stat-money");
}

function customerAngryLeave(c) {
  if (c.isInspector) return;
  day.angry++;
  day.combo = 0;
  // شكوى لوزارة التجارة (الناقد شبه مؤكد يشتكي)
  const complainChance = c.type.key === "critic" ? 0.9 : 0.35;
  if (Math.random() < complainChance) {
    state.complaints++;
    setTimeout(() => toast(`😠 ${c.name} رفع شكوى لوزارة التجارة!`), 900);
  }
  // التحدي اللانهائي: الخسارة عند 5
  if (day.endless && day.angry >= 5 && day.running) {
    toast("💀 انتهى التحدي — 5 زباين زعلوا!");
    setTimeout(() => { if (day.running) { day.customers = []; day.timeLeft = 0; } }, 100);
  }
  if (c.isVip) { day.vipAngry++; toast(`💔 خسرت ${c.name} — الشخصيات المميزة تأثيرها كبير!`); }
  day.angryTypes[c.type.key] = (day.angryTypes[c.type.key] || 0) + 1;
  const w = 0.13 * c.type.ratingW;
  state.rating = clamp(state.rating + (1 - state.rating) * w, 1, 5);
  sfx.angry();
  floatScore(c.el, "💢 راح زعلان!", true);
  if (day.chat && day.chat.customer === c) closeChat();
  removeCustomer(c, false);
}

function removeCustomer(c, happy) {
  if (S3D.active) S3D.leave(c, happy);
  else if (c.el) c.el.classList.add("leaving");
  day.customers = day.customers.filter(x => x !== c);
  setTimeout(() => renderCustomers(), 460);
}

/* ============================================================
   الطبخ والصينية
   ============================================================ */
/* خصم المواد الخام (خبز، مايونيز، كاتشب…) — تُستهلك لحظة بدء الطبخ */
function payMaterials(dish) {
  const matCost = dish.cost || 2;
  if (state.money < matCost) {
    toast(`🧾 ما عندك فلوس للمواد الخام! (${dish.name} يحتاج ${matCost} 💵)`);
    sfx.wrong();
    return false;
  }
  state.money -= matCost;
  day.expenses += matCost;
  return true;
}

function startCooking(dish) {
  if (!day.running) return;
  const capacity = traySize() - day.tray.length - day.cooking.length;
  if (capacity <= 0) { toast("🍽️ الصينية ممتلئة! سلّم الطلبات أولاً"); sfx.wrong(); return; }
  if (!payMaterials(dish)) return;
  day.cooking.push({ dish, elapsed: 0, total: cookTime(dish) });
  sfx.cook();
  renderCounter();
  renderTopbar();
}

function tickCooking(dt) {
  for (let i = day.cooking.length - 1; i >= 0; i--) {
    const c = day.cooking[i];
    c.elapsed += dt;
    if (c.elapsed >= c.total) {
      day.cooking.splice(i, 1);
      day.tray.push({ dish: c.dish, readyAt: performance.now() });
      // الفرن المزدوج: 25% صنف إضافي مجاني (بدون مواد)
      if (state.upgrades.doubleOven && Math.random() < 0.25 &&
          day.tray.length + day.cooking.length < traySize()) {
        day.tray.push({ dish: c.dish, readyAt: performance.now() });
        toast("♨️ الفرن المزدوج أخرج صنفاً إضافياً ببلاش!");
      }
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
  const pool = day.customers.filter(c => !c.isInspector);
  if (day.chat || pool.length === 0) return;
  const c = rand(pool);
  const events = c.vipChat || CHAT_EVENTS[c.type.key];
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
    if (c.type.key === "rich" && Math.random() < 0.25) { state.gold++; day.goldEarned++; sfx.coin(); toast(`💎 الزبون الغني أعطاك ${GOLD_ICON} ذهب!`); }
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
  $("chat-msg").textContent = `${c.isVip ? c.type.label.split(" ")[0] : c.face} ${c.name}: ${ev.msg}`;
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
function startDay(endless = false) {
  day = freshDay();
  day.endless = !!endless;
  if (endless) { day.timeLeft = 999999999; day.goal = 999999; }
  day.rushAt = day.timeLeft * (0.4 + Math.random() * 0.25); // نقطة انطلاق ساعة الذروة
  // حدث اليوم + المهمة الجانبية
  if (!endless && state.day >= 2 && Math.random() < 0.6) day.event = rand(DAY_EVENTS);
  day.quest = rand(QUESTS);
  day.running = true;
  // قرض طوارئ: بدون فلوس ما تقدر تشتري مواد خام أصلاً
  if (state.money < 10) {
    state.money += 50;
    setTimeout(() => toast("🏦 البنك أعطاك قرض طوارئ +50 💵 — لا تفلّس مرة ثانية!"), 1200);
  }
  document.body.classList.remove("rush", "fire");
  if (S3D.active) {
    if (S3D.clear) S3D.clear();
    if (S3D.setRobot) S3D.setRobot(!!state.upgrades.robot);
    if (S3D.setTheme) S3D.setTheme(state.theme);
  }
  if (window.GameAudio) { GameAudio.setEnabled(state.music); GameAudio.start(); }
  if (day.event) setTimeout(() => toast(`${day.event.name} — ${day.event.desc}`), 700);
  // زيارة مفاجئة من وزارة التجارة: شبه مؤكدة إذا فيه شكاوى، ونادرة بدونها
  if (!endless && (state.complaints > 0 ? Math.random() < 0.75 : Math.random() < 0.08)) {
    day.inspectionAt = day.timeLeft * (0.3 + Math.random() * 0.4);
  }
  if (endless) setTimeout(() => toast("♾️ التحدي اللانهائي: اصمد! تخسر عند 5 زباين زعلانين"), 700);
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

  // زيارة مفتش وزارة التجارة
  if (day.inspectionAt > 0 && !day.inspectionDone && day.timeLeft <= day.inspectionAt) {
    if (day.customers.length >= 4) day.inspectionAt -= 4000; // أجّل حتى يفضى مكان
    else { day.inspectionDone = true; runInspection(); }
  }

  // نزول صبر الزبائن
  for (const c of [...day.customers]) {
    if (c.isInspector) continue;
    c.patience -= dt * c.type.drain;
    // العم سالم ينسى ويغيّر طلبه مرة واحدة
    if (c.vip === "salim" && !c.swapped && c.patience < c.maxPatience * 0.55) {
      c.swapped = true;
      const undone = c.order.filter(o => !o.done);
      const others = activeMenu().filter(d => undone.length && d.id !== undone[0].dish.id);
      if (undone.length && others.length) {
        rand(undone).dish = rand(others);
        toast("👓 العم سالم نسي وغيّر طلبه!");
        sfx.chat();
        renderCustomers();
      }
    }
    if (c.patience <= 0) customerAngryLeave(c);
  }
  updatePatienceBars();

  // ساعة الذروة (من اليوم الثالث، مرة باليوم)
  if (state.day >= 3 && !day.rushDone && day.rushAt > 0 && day.timeLeft <= day.rushAt) {
    day.rushDone = true;
    day.rushLeft = 15000;
    document.body.classList.add("rush");
    toast("🔥 ساعة الذروة! زباين أكثر وأرباح ×1.5 لمدة 15 ثانية!");
    sfx.levelup();
  }
  if (day.rushLeft > 0) {
    day.rushLeft -= dt;
    if (day.rushLeft <= 0) {
      document.body.classList.remove("rush");
      toast("✅ ساعة الذروة انتهت — أحسنت الصمود!");
    }
  }

  // زبون جديد
  if (day.spawnIn <= 0 && day.timeLeft > 8000) {
    spawnCustomer();
    let base = Math.max(6500 - state.day * 300, 3200);
    if (day.rushLeft > 0) base *= 0.45;
    if (day.event && day.event.spawnMult) base *= day.event.spawnMult;
    day.spawnIn = rint(base * 0.8, base * 1.3);
  }

  // القهوة العربية: عدّاد التبريد
  if (day.coffeeCd > 0) day.coffeeCd -= dt;
  const cbtn = $("btn-coffee");
  cbtn.disabled = day.coffeeCd > 0;
  cbtn.textContent = day.coffeeCd > 0 ? Math.ceil(day.coffeeCd / 1000) : "☕";

  // المساعد الآلي يطبخ ما يحتاجه الزباين (أسرع مع كل مستوى، ويدفع مواده مثل الجميع)
  if (state.upgrades.robot) {
    day.robotIn -= dt;
    if (day.robotIn <= 0) {
      day.robotIn = 16000 - state.upgrades.robot * 4000; // م1: 12ث، م2: 8ث، م3: 4ث
      const needed = [];
      for (const c of day.customers) for (const o of c.order) if (!o.done) needed.push(o.dish);
      const avail = needed.filter(d =>
        !day.tray.some(t => t.dish.id === d.id) && !day.cooking.some(k => k.dish.id === d.id));
      if (avail.length && traySize() - day.tray.length - day.cooking.length > 0 && payMaterials(avail[0])) {
        day.cooking.push({ dish: avail[0], elapsed: 0, total: cookTime(avail[0]) });
        if (S3D.active && S3D.robotPing) S3D.robotPing();
        toast("🤖 المساعد الآلي بدأ يطبخ " + avail[0].name);
      }
    }
  }

  // اللوحة الذهبية 🏅: التقييم لا ينزل تحت 3.0
  if (state.upgrades.goldenSign && state.rating < 3) state.rating = 3;

  // وضع النار + أزيز الطبخ + إيقاع الذروة + ساعة الحائط
  document.body.classList.toggle("fire", day.combo >= 5);
  if (window.GameAudio) {
    GameAudio.sizzle(day.cooking.length > 0);
    GameAudio.setRush(day.rushLeft > 0);
  }
  if (S3D.active && S3D.setClock) {
    S3D.setClock(day.endless ? (now / 90000) % 1 : 1 - day.timeLeft / day.totalTime);
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
  updateFreshness();
  renderTopbar();

  // نهاية اليوم: انتهى الوقت وما بقي زبائن
  if (day.timeLeft <= 0 && day.customers.length === 0) { endDay(); return; }
  loopTimer = requestAnimationFrame(gameLoop);
}

function endDay() {
  day.running = false;
  cancelAnimationFrame(loopTimer);
  document.body.classList.remove("rush", "fire");
  if (window.GameAudio) GameAudio.stop();
  closeChat();
  // مكافأة الهدف اليومي (تُحسب على صافي الربح بعد خصم المواد الخام)
  day.goalMet = !day.endless && (day.earned - day.expenses) >= day.goal;
  if (day.goalMet) {
    day.goalBonus = Math.round(day.earned * 0.2);
    state.money += day.goalBonus;
    state.gold += 2;
    day.goldEarned += 2;
  }
  // المهمة الجانبية
  if (day.quest && day.quest.check(day)) {
    day.questDone = true;
    if (day.quest.reward.gold) { state.gold += day.quest.reward.gold; day.goldEarned += day.quest.reward.gold; }
    if (day.quest.reward.money) state.money += day.quest.reward.money;
  }
  state.totals.served += day.served;
  state.totals.angry += day.angry;
  state.totals.earned += day.earned;
  state.records.bestDayEarn = Math.max(state.records.bestDayEarn, day.earned);
  state.records.maxCombo = Math.max(state.records.maxCombo, day.maxCombo);
  if (day.endless) {
    state.records.endlessBest = Math.max(state.records.endlessBest, day.earned);
  } else {
    state.history.push({
      day: state.day, served: day.served, angry: day.angry, earned: day.earned,
      avgPatience: day.served ? day.patienceSum / day.served : 0,
    });
    if (state.history.length > 14) state.history.shift();
  }
  checkAchievements();
  showReport();
  if (!day.endless) state.day++;
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
    ${day.endless ? `♾️ <b>التحدي اللانهائي انتهى!</b> نتيجتك: <b>${day.earned}</b> 💵 ${day.earned >= state.records.endlessBest ? "🏆 رقم قياسي جديد!" : `(رقمك القياسي: ${state.records.endlessBest})`}` : `📅 اليوم <b>${state.day}</b> انتهى!`}<br>
    ${day.event ? `${day.event.name} — ${day.event.desc}<br>` : ""}
    ${day.quest ? `📌 المهمة: ${day.quest.name} ${day.questDone ? `✅ <b>+${day.quest.reward.gold ? day.quest.reward.gold + " " + GOLD_ICON : day.quest.reward.money + " 💵"}</b>` : "❌"}<br>` : ""}
    ${day.endless ? "" : `🎯 الهدف اليومي (صافي): <b>${day.earned - day.expenses}/${day.goal}</b> ${day.goalMet ? `✅ تحقق! مكافأة <b>+${day.goalBonus} 💵 +2 ${GOLD_ICON}</b>` : "❌ ما تحقق"}<br>`}
    ✅ زباين راضين: <b>${day.served}</b> &nbsp;|&nbsp; 💢 زباين زعلانين: <b>${day.angry}</b><br>
    💵 الإيرادات: <b>${day.earned}</b> &nbsp;|&nbsp; 🧾 مصاريف المواد الخام: <b style="color:#ff9f43">-${day.expenses}</b><br>
    📊 صافي الربح: <b style="color:${day.earned - day.expenses >= 0 ? "#2ecc71" : "#ff6b6b"}">${day.earned - day.expenses}</b> &nbsp;|&nbsp; ${GOLD_ICON} ذهب: <b>+${day.goldEarned}</b><br>
    ${day.fined ? `🏛️ غرامة وزارة التجارة: <b style="color:#ff6b6b">-${day.fined} 💵</b> (مخالفات المطعم: ${state.violations})<br>` : ""}
    ${state.complaints > 0 ? `⚠️ شكاوى معلّقة ضدك: <b>${state.complaints}</b> — توقّع تفتيشاً مفاجئاً بكرة!<br>` : ""}
    🔥 أعلى كومبو: <b>x${day.maxCombo}</b> &nbsp;|&nbsp; 🏆 تسليم مثالي: <b>${day.perfect}</b><br>
    🌟 متوسط رضا التسليم: <b>${avgP}%</b>${day.vipServed + day.vipAngry > 0 ? ` &nbsp;|&nbsp; ⭐ شخصيات مميزة: <b>${day.vipServed} راضي / ${day.vipAngry} زعلان</b>` : ""}<br>
    ${best ? `🥇 الأكثر مبيعاً: <b>${best.emoji} ${best.shortName || best.name}</b> (${bestN})` : "🥇 ما انباع شي اليوم 😅"}
  `;
  $("ai-analysis").innerHTML = aiAnalyze().map(t => `<div class="tip">${t}</div>`).join("");
  // عجلة الحظ تظهر عند تحقيق الهدف + إعلان مضاعفة الأرباح
  $("btn-wheel").classList.toggle("hidden", !day.goalMet);
  $("btn-wheel").disabled = false;
  $("wheel-result").classList.add("hidden");
  $("btn-ad-double").classList.toggle("hidden", day.adDoubled || (day.earned - day.expenses) <= 0);
  showScreen("screen-report");
}

/* ---------- عجلة الحظ ---------- */
function spinWheel() {
  const prizes = [
    { t: "💵 +120 فلوس", f: () => state.money += 120 },
    { t: `${GOLD_ICON} +3 ذهب`, f: () => state.gold += 3 },
    { t: "📈 +120 خبرة", f: () => state.xp += 120 },
    { t: "🤖 طبق AI مجاني", f: () => state.freeDish = (state.freeDish || 0) + 1 },
  ];
  const btn = $("btn-wheel"), el = $("wheel-result");
  btn.disabled = true;
  el.classList.remove("hidden");
  let i = 0;
  const spins = 9 + rint(0, 3);
  const iv = setInterval(() => {
    el.innerHTML = prizes[i % prizes.length].t;
    sfx.cook();
    i++;
    if (i >= spins) {
      clearInterval(iv);
      const p = prizes[(i - 1) % prizes.length];
      p.f();
      el.innerHTML = "🎉 ربحت: " + p.t;
      sfx.levelup();
      btn.classList.add("hidden");
      save();
    }
  }, 170);
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

  // تحليل مالي: المصاريف مقابل الإيرادات
  if (day.served > 0 && day.expenses > day.earned * 0.45) {
    tips.push(`🧾 مصاريف موادك عالية (${day.expenses} من ${day.earned}) — لا تطبخ إلا المطلوب فعلاً، وكل صنف بالسلة المهملات خسارة صافية.`);
  } else if (day.served >= 4 && day.expenses < day.earned * 0.25) {
    tips.push("📊 هوامش ربحك ممتازة — إدارة مواد خام محترفة!");
  }
  if (day.vipAngry >= 1) tips.push("💔 خسرت شخصية مميزة اليوم — الشخصيات (شيخ يوسف، أبو سمير…) تأثيرها على التقييم والأرباح مضاعف، خلّهم أولويتك.");
  if (day.maxCombo >= 5) tips.push(`🔥 كومبو x${day.maxCombo} رهيب! التسليم المتتالي السريع ضاعف أرباحك.`);
  else if (day.served >= 4 && day.maxCombo <= 2) tips.push("🔥 كومبوك ضعيف — سلّم بسرعة وبدون أخطاء عشان يرتفع المضاعف حتى ×1.8.");
  if (!day.goalMet && day.earned > 0) tips.push(`🎯 نقصك ${day.goal - day.earned} 💵 عن الهدف — الهدف المحقق يعطيك +20% مكافأة و3 ذهب.`);
  if (day.wrongServes >= 3) tips.push(`🎯 سلّمت ${day.wrongServes} أصناف خاطئة — تأكد من فقاعة الطلب قبل التسليم، الناقد يعاقبك عليها أكثر.`);
  if (day.perfect >= 3) tips.push(`${GOLD_ICON} ممتاز! ${day.perfect} تسليمات مثالية جابت لك ذهب. الذهب يفتح لك أطباق الذكاء الاصطناعي.`);
  if (day.freshServes >= 5) tips.push(`✨ سلّمت ${day.freshServes} أصناف وهي طازجة — الزباين يحسون بالفرق والصبر يرتفع!`);
  else if (day.served >= 4 && day.freshServes === 0) tips.push("✨ ولا صنف انسلّم طازج — الصنف أول 5 ثوانٍ من جهوزيته يعطي الزبون دفعة صبر، لا تخزّن بالصينية.");
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
  $("shop-gold").innerHTML = `${GOLD_ICON} ${state.gold}`;

  const list = $("upgrades-list");
  list.innerHTML = "";
  for (const u of UPGRADES) {
    const lvl = state.upgrades[u.id] || 0;
    const row = document.createElement("div");
    row.className = "upgrade-row";
    const maxed = lvl >= u.max;
    const cost = maxed ? 0 : u.cost(lvl);
    const unlocked = reqMet(u);
    row.innerHTML = `
      <span class="u-emoji">${unlocked ? u.emoji : "🔒"}</span>
      <span class="u-info"><span class="u-name">${u.name} ${u.max > 1 ? `(${lvl}/${u.max})` : lvl ? "✅" : ""}</span><br><span class="u-desc">${u.desc}${!unlocked ? `<br><b style="color:#ff9f43">${reqLabel(u)}</b>` : ""}</span></span>
    `;
    const btn = document.createElement("button");
    btn.className = "u-buy";
    btn.textContent = maxed ? "✅ مكتمل" : !unlocked ? "🔒" : `💵 ${cost}`;
    btn.disabled = maxed || !unlocked || state.money < cost;
    btn.onclick = () => {
      if (state.money < cost || !unlocked) return;
      state.money -= cost;
      state.upgrades[u.id] = (state.upgrades[u.id] || 0) + 1;
      sfx.levelup();
      toast(`✅ تم شراء: ${u.name}`);
      save();
      renderShop();
    };
    row.appendChild(btn);
    list.appendChild(row);
  }

  // المزايا الذهبية (مستويات بالذهب النادر)
  const plist = $("perks-list");
  plist.innerHTML = "";
  for (const p of PERKS) {
    const lv = perkLv(p.id);
    const maxed = lv >= p.max;
    const cost = maxed ? 0 : p.cost(lv);
    const row = document.createElement("div");
    row.className = "upgrade-row";
    row.innerHTML = `<span class="u-emoji">${p.emoji}</span>
      <span class="u-info"><span class="u-name">${p.name} (${lv}/${p.max})</span><br><span class="u-desc">${maxed ? "وصلت أعلى مستوى ✅" : p.desc(lv)}</span></span>`;
    const btn = document.createElement("button");
    btn.className = "u-buy";
    btn.innerHTML = maxed ? "✅ مكتمل" : `${GOLD_ICON} ${cost}`;
    btn.disabled = maxed || state.gold < cost;
    btn.onclick = () => {
      if (maxed || state.gold < cost) return;
      state.gold -= cost;
      state.perks[p.id] = lv + 1;
      sfx.levelup();
      toast(`⭐ ${p.emoji} ${p.name} — المستوى ${lv + 1}!`);
      save();
      renderShop();
    };
    row.appendChild(btn);
    plist.appendChild(row);
  }

  // البريميوم: منتجات بفلوس حقيقية + إعلان مكافئ
  const iapList = $("iap-list");
  iapList.innerHTML = "";
  // صف الإعلان المكافئ
  const adRow = document.createElement("div");
  adRow.className = "upgrade-row ad-row";
  const adOk = adReady();
  adRow.innerHTML = `<span class="u-emoji">🎬</span>
    <span class="u-info"><span class="u-name">شاهد إعلاناً واكسب!</span><br><span class="u-desc">مكافأة فورية: +60 💵 أو +1 ${GOLD_ICON} (كل 3 دقائق)</span></span>`;
  const adBtn = document.createElement("button");
  adBtn.className = "u-buy";
  adBtn.textContent = adOk ? "▶️ شاهد" : `⏳ ${Math.ceil(((state.adCdUntil || 0) - Date.now()) / 1000)}ث`;
  adBtn.disabled = !adOk;
  adBtn.onclick = watchShopAd;
  adRow.appendChild(adBtn);
  iapList.appendChild(adRow);
  for (const p of IAP_PRODUCTS) {
    const owned = p.once && state.iap[p.id];
    const row = document.createElement("div");
    row.className = "upgrade-row iap-row";
    row.innerHTML = `<span class="u-emoji">${p.emoji}</span>
      <span class="u-info"><span class="u-name">${p.name} ${owned ? "✅" : ""}</span><br><span class="u-desc">${p.desc}</span></span>`;
    const btn = document.createElement("button");
    btn.className = "u-buy iap-buy";
    btn.textContent = owned ? "✅ مملوكة" : p.price;
    btn.disabled = !!owned;
    btn.onclick = () => buyIAP(p);
    row.appendChild(btn);
    iapList.appendChild(row);
  }

  // ثيمات الديكور
  for (const t of THEME_DEFS) {
    const owned = state.themesOwned.includes(t.id);
    const active = state.theme === t.id;
    const vipLocked = t.vipOnly && !isVIP() && !owned;
    const row = document.createElement("div");
    row.className = "upgrade-row";
    row.innerHTML = `<span class="u-emoji">${vipLocked ? "🔒" : "🎨"}</span>
      <span class="u-info"><span class="u-name">${t.name}</span><br><span class="u-desc">${t.vipOnly ? "ثيم حصري لأعضاء 👑 VIP الذهبية" : "ثيم ديكور ثلاثي الأبعاد للمطعم"}</span></span>`;
    const btn = document.createElement("button");
    btn.className = "u-buy";
    btn.textContent = vipLocked ? "👑 VIP" : active ? "✓ مفعّل" : owned ? "فعّل" : `💵 ${t.cost}`;
    btn.disabled = vipLocked || active || (!owned && state.money < t.cost);
    btn.onclick = () => {
      if (!owned) {
        if (state.money < t.cost) return;
        state.money -= t.cost;
        state.themesOwned.push(t.id);
      }
      state.theme = t.id;
      if (S3D.active && S3D.setTheme) S3D.setTheme(t.id);
      toast(`🎨 الثيم المفعّل: ${t.name}`);
      sfx.levelup();
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
      <span class="m-desc">يبيع 💵 ${d.price} — مواده 🧾 ${d.cost || 2} (${d.mats || "مكونات أساسية"}) — ⏱️ ${(d.cook / 1000).toFixed(1)} ث${d.desc ? "<br>" + d.desc : ""}</span></span>
    `;
    ml.appendChild(row);
  }

  const cst = aiDishCost();
  $("btn-ai-dish").disabled = (state.gold < cst.gold || state.money < cst.money) && !(state.freeDish > 0);
  $("btn-ai-dish").innerHTML = state.freeDish > 0 ? "🎡 مجاني — ابتكر طبق جديد" : `💵 ${cst.money} + ${GOLD_ICON} ${cst.gold} — ابتكر طبق`;
  $("ai-dish-result").classList.add("hidden");
  pendingDish = null;
}

/* تكلفة ابتكار طبق جديد ترتفع مع كل طبق تملكه — الصنف الجديد استثمار حقيقي */
function aiDishCost() { return { money: 500 + state.aiDishes.length * 250, gold: 10 }; }

function aiDishFlow(regenerate) {
  if (!regenerate) {
    const cst = aiDishCost();
    if (state.freeDish > 0) {
      state.freeDish--;
      toast("🎡 استخدمت طبقك المجاني من عجلة الحظ!");
    } else if (state.gold < cst.gold || state.money < cst.money) {
      toast(`🧾 ابتكار طبق يحتاج ${cst.money} 💵 + ${cst.gold} ${GOLD_ICON}`);
      return;
    } else {
      state.gold -= cst.gold;
      state.money -= cst.money;
    }
  }
  pendingDish = aiGenerateDish();
  $("ai-dish-card").innerHTML = `
    <div class="d-name">${pendingDish.emoji} ${pendingDish.name}</div>
    <div>${pendingDish.desc}</div>
    <div>🧂 المكونات: ${pendingDish.ingredients.join("، ")}</div>
    <div>💵 السعر: <b>${pendingDish.price}</b> — ⏱️ وقت الطبخ: ${(pendingDish.cook / 1000).toFixed(1)} ث</div>
  `;
  $("ai-dish-result").classList.remove("hidden");
  $("shop-gold").innerHTML = `${GOLD_ICON} ${state.gold}`;
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
  $("stat-gold").innerHTML = `${GOLD_ICON} ${state.gold}`;
  $("stat-rating").textContent = `⭐ ${state.rating.toFixed(1)}`;
  $("stat-time").textContent = `⏰ ${Math.max(0, Math.ceil(day ? day.timeLeft / 1000 : 0))}`;
  $("stat-day").textContent = `📅 ${state.day}`;
  $("stat-goal").textContent = `🎯 ${day ? day.earned - day.expenses : 0}/${day ? day.goal : 0}`;
  const combo = $("stat-combo");
  if (day && day.combo >= 2) { combo.textContent = `🔥x${day.combo}`; combo.classList.remove("hidden"); }
  else combo.classList.add("hidden");
  if (day && day.endless) $("stat-time").textContent = `♾️ ${day.angry}/5 💢`;
  // شريط الخبرة والمهمة
  const lvl = playerLevel();
  $("lvl-chip").textContent = `⬆️${lvl}`;
  const cur = state.xp - xpForLevel(lvl);
  const span = xpForLevel(lvl + 1) - xpForLevel(lvl);
  $("xp-fill").style.width = Math.min(100, (cur / span) * 100) + "%";
  if (day && day.quest) {
    const done = day.quest.check(day);
    $("quest-chip").textContent = `📌 ${day.quest.name}${done ? " ✅" : ""}`;
    $("quest-chip").classList.toggle("done", done);
  }
}
function flashStat(id) {
  const el = $(id);
  el.classList.remove("flash");
  void el.offsetWidth;
  el.classList.add("flash");
}

function renderCustomers() {
  if (S3D.active) { renderCustomers3D(); return; }
  const area = $("customers-area");
  area.innerHTML = "";
  for (const c of day.customers) {
    const div = document.createElement("div");
    div.className = "customer";
    const selected = day.selectedTray >= 0 && day.tray[day.selectedTray];
    if (selected && c.order.some(o => !o.done && o.dish.id === day.tray[day.selectedTray].dish.id)) {
      div.classList.add("servable");
    }
    if (c.isVip) div.classList.add("vip");
    div.innerHTML = `
      ${c.chatPending ? '<span class="chat-hint">💬</span>' : ""}
      <span class="face">${c.isVip ? c.svg : moodFace(c)}</span>
      ${c.isVip ? '<span class="mood-badge"></span>' : ""}
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

/* الوضع ثلاثي الأبعاد: المجسم في المشهد + فقاعة HTML فوق رأسه */
function renderCustomers3D() {
  S3D.sync(day.customers);
  const selected = day.selectedTray >= 0 && day.tray[day.selectedTray];
  for (const c of day.customers) {
    const ov = S3D.getOverlay(c);
    if (!ov) continue;
    if (c.isInspector) {
      ov.classList.add("inspector");
      ov.innerHTML = `
        <div class="ov-name">🕵️ ${c.name}</div>
        <div class="order-bubble" style="font-size:12px;font-weight:bold">📋 تفتيش مفاجئ!</div>`;
      ov.onclick = (e) => { e.stopPropagation(); serveTrayItem(c); };
      c.el = ov;
      continue;
    }
    ov.classList.toggle("servable",
      !!(selected && c.order.some(o => !o.done && o.dish.id === day.tray[day.selectedTray].dish.id)));
    ov.classList.toggle("vip", !!c.isVip);
    ov.innerHTML = `
      <div class="ov-name">${c.chatPending ? "💬 " : ""}${c.name} <span class="ov-type">${c.type.label}</span> <span class="ov-mood"></span></div>
      <div class="order-bubble">${c.order.map(o => {
        const ic = S3D.dishIcon ? S3D.dishIcon(o.dish) : null;
        return `<span class="oitem ${o.done ? "done" : ""}">${ic ? `<img src="${ic}" alt="${o.dish.name}">` : o.dish.emoji}</span>`;
      }).join("")}</div>
      <div class="patience-bar"><div class="patience-fill" style="width:${(c.patience / c.maxPatience) * 100}%"></div></div>
    `;
    ov.onclick = (e) => { e.stopPropagation(); serveTrayItem(c); };
    c.el = ov;
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
    if (!c.el || c.isInspector) continue;
    const r = clamp(c.patience / c.maxPatience, 0, 1);
    const fill = c.el.querySelector(".patience-fill");
    if (fill) {
      fill.style.width = (r * 100) + "%";
      fill.style.background = r > 0.5 ? "var(--green)" : r > 0.25 ? "var(--accent)" : "var(--red)";
    }
    // جرس تحذير: الزبون على وشك الانفجار
    if (r < 0.25 && !c.warned) {
      c.warned = true;
      beep(1318, 0.1, "square", 0.12);
      setTimeout(() => beep(988, 0.12, "square", 0.12), 130);
    }
    c.el.classList.toggle("urgent", r < 0.25);
    // الوضع ثلاثي الأبعاد: إيموجي مزاج صغير بالفقاعة (المجسم نفسه يهتز ويحمرّ)
    const moodOv = c.el.querySelector(".ov-mood");
    if (moodOv) {
      moodOv.textContent = r > 0.6 ? "" : (r > 0.3 ? "😕" : "😡");
      continue;
    }
    // الوضع 2D الاحتياطي
    if (c.isVip) {
      const badge = c.el.querySelector(".mood-badge");
      if (badge) badge.textContent = r > 0.6 ? "" : (r > 0.3 ? "😕" : "😡");
    } else {
      const face = c.el.querySelector(".face");
      if (face) face.textContent = moodFace(c);
    }
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
      if (item.readyAt && performance.now() - item.readyAt < FRESH_MS()) slot.classList.add("fresh");
      const icon = S3D.active && S3D.dishIcon ? S3D.dishIcon(item.dish) : null;
      if (icon) slot.innerHTML = `<img src="${icon}" alt="${item.dish.name}">`;
      else slot.textContent = item.dish.emoji;
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
    const icon = S3D.active && S3D.dishIcon ? S3D.dishIcon(d) : null;
    b.innerHTML = `
      ${icon ? `<img class="s-img" src="${icon}" alt="${d.name}">` : `<span class="s-emoji">${d.emoji}</span>`}
      <span class="s-name">${d.shortName || d.name}</span>
      <span class="s-price">💵 ${d.price} | مواد 🧾 ${d.cost || 2}</span>
      <div class="cook-fill"></div>
    `;
    b.onclick = () => startCooking(d);
    area.appendChild(b);
  }
}

/* انتهاء صلاحية "الطازج" على أصناف الصينية */
function updateFreshness() {
  const slots = $("tray-slots").children;
  for (let i = 0; i < slots.length; i++) {
    const item = day.tray[i];
    slots[i].classList.toggle("fresh", !!(item && item.readyAt && performance.now() - item.readyAt < FRESH_MS()));
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
  t.innerHTML = msg;
  t.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove("show"), 1800);
}

function floatScore(el, text, bad) {
  const f = document.createElement("div");
  f.className = "float-score" + (bad ? " bad" : "");
  f.innerHTML = text;
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
  $("player-title").textContent = `⬆️${playerLevel()} — ${playerTitle()}`;
  $("btn-endless").classList.toggle("hidden", state.day < 8);
  const achCount = Object.keys(state.ach).filter(k => state.ach[k]).length;
  $("menu-stats").innerHTML = `
    📅 اليوم: ${state.day} &nbsp; | &nbsp; ⭐ ${state.rating.toFixed(1)} &nbsp; | &nbsp; 💵 ${state.money} &nbsp; | &nbsp; ${GOLD_ICON} ${state.gold}<br>
    ✅ زباين راضين: ${state.totals.served} &nbsp; | &nbsp; 🤖 أطباق مبتكرة: ${state.aiDishes.length} &nbsp; | &nbsp; 🏅 ${achCount}/${ACHIEVEMENTS.length}
    ${state.day < 8 ? "<br>♾️ التحدي اللانهائي يفتح بعد اليوم 7" : ""}
  `;
}

function renderAchievements() {
  const list = $("ach-list");
  list.innerHTML = "";
  for (const a of ACHIEVEMENTS) {
    const row = document.createElement("div");
    row.className = "ach-row" + (state.ach[a.id] ? " unlocked" : "");
    row.innerHTML = `<span class="a-emoji">${state.ach[a.id] ? a.emoji : "🔒"}</span>
      <span><span class="a-name">${a.name}</span><br><span class="a-desc">${a.desc}</span></span>`;
    list.appendChild(row);
  }
  $("records-box").innerHTML = `
    💵 أفضل يوم أرباح: <b>${state.records.bestDayEarn}</b><br>
    🔥 أعلى كومبو وصلته: <b>x${state.records.maxCombo}</b><br>
    ♾️ رقم التحدي اللانهائي: <b>${state.records.endlessBest}</b><br>
    📈 المستوى: <b>${playerLevel()}</b> — "${playerTitle()}"<br>
    🏛️ مخالفات وزارة التجارة: <b>${state.violations}</b><br>
    ✅ إجمالي الزباين الراضين: <b>${state.totals.served}</b> &nbsp;|&nbsp; 💰 إجمالي الأرباح: <b>${state.totals.earned}</b>`;
}

function bindEvents() {
  $("btn-start").onclick = () => { sfx.cook(); startDay(); };
  $("btn-endless").onclick = () => { sfx.levelup(); startDay(true); };
  $("btn-shop-menu").onclick = () => { renderShop(); showScreen("screen-shop"); };
  $("btn-achievements").onclick = () => { renderAchievements(); showScreen("screen-achievements"); };
  $("btn-ach-back").onclick = () => { renderMenuScreen(); showScreen("screen-menu"); };
  $("btn-wheel").onclick = spinWheel;
  $("btn-iap-confirm").onclick = confirmIAP;
  $("btn-iap-cancel").onclick = () => { $("iap-modal").classList.add("hidden"); pendingIAP = null; };
  $("btn-ad-double").onclick = () => {
    if (day.adDoubled) return;
    simulateAd(() => {
      day.adDoubled = true;
      const bonus = Math.max(0, day.earned - day.expenses);
      state.money += bonus;
      toast(`🎬 تضاعفت أرباح اليوم: +${bonus} 💵!`);
      sfx.coin();
      $("btn-ad-double").classList.add("hidden");
      save();
    });
  };
  $("btn-coffee").onclick = () => {
    if (!day.running || day.coffeeCd > 0 || !day.customers.length) return;
    const c = day.customers.reduce((a, b) => (a.patience / a.maxPatience < b.patience / b.maxPatience ? a : b));
    c.patience = Math.min(c.maxPatience, c.patience + c.maxPatience * 0.35);
    day.coffeeCd = 25000 - perkLv("coffeePro") * 6500;
    toast(`☕ قدمت قهوة عربية لـ${c.name} — انبسط وهدأ!`);
    sfx.serve();
  };
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

  $("tray-trash").onclick = () => {
    if (day.selectedTray < 0 || !day.tray[day.selectedTray]) { toast("👆 حدد صنفاً من الصينية عشان ترميه"); return; }
    const item = day.tray.splice(day.selectedTray, 1)[0];
    day.selectedTray = -1;
    sfx.wrong();
    toast(`🗑️ رميت ${item.dish.name} — وراحت عليك مواده (${item.dish.cost || 2} 💵)!`);
    renderTray(); renderCustomers();
  };

  $("chat-close").onclick = () => closeChat();
  $("btn-settings").onclick = () => $("settings-modal").classList.remove("hidden");
  $("btn-close-settings").onclick = () => $("settings-modal").classList.add("hidden");
  $("btn-sound").onclick = () => {
    state.sound = !state.sound;
    $("btn-sound").textContent = state.sound ? "🔊 المؤثرات: تعمل" : "🔇 المؤثرات: مغلقة";
    save();
  };
  $("btn-music").onclick = () => {
    state.music = !state.music;
    $("btn-music").textContent = state.music ? "🎵 الموسيقى: تعمل" : "🔕 الموسيقى: مغلقة";
    if (window.GameAudio) {
      GameAudio.setEnabled(state.music);
      if (state.music && day && day.running) GameAudio.start();
    }
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
// المشهد ثلاثي الأبعاد (WebGL) — يرجع للوضع 2D تلقائياً إذا فشل
S3D.init($("customers-area"), $("overlay3d"));
if (S3D.active) S3D.onCustomerClick = (c) => serveTrayItem(c);
$("btn-sound").textContent = state.sound ? "🔊 المؤثرات: تعمل" : "🔇 المؤثرات: مغلقة";
$("btn-music").textContent = state.music ? "🎵 الموسيقى: تعمل" : "🔕 الموسيقى: مغلقة";
renderMenuScreen();
showScreen("screen-menu");
