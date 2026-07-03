/* ============================================================
   مشهد المطعم ثلاثي الأبعاد — Three.js
   شخصيات low-poly مبنية بالكود + طبقة HTML للفقاعات والأسماء
   إذا فشل WebGL أو ما تحمّلت المكتبة → اللعبة ترجع تلقائياً للوضع 2D
   ============================================================ */
"use strict";

window.S3D = (() => {
  let renderer, scene, camera, container, overlayLayer;
  let raycaster, pointer;
  const chars = new Map();   // uid -> { group, ov, head, t, slotX, entering, leaving, height, baseTint }
  let slotSpread = 4.2;
  let running = false;
  let lastT = 0;
  let spitMeat = null;   // سيخ الشاورما الدوار

  const api = {
    active: false,
    onCustomerClick: null,   // تحدد من game.js
  };

  /* ---------- مواد وألوان ---------- */
  const SKINS = [0xeeb98c, 0xdba876, 0xf2c49b, 0xc98e63];
  const THOBES = [0xf5f5f5, 0xdfe6e9, 0xcfd8dc, 0x90a4ae, 0x6d4c2f, 0x4e6e5d];
  const mat = (color, emissive = 0x000000) =>
    new THREE.MeshLambertMaterial({ color, emissive });

  /* ---------- بناء شخصية كرتونية ---------- */
  function makeCharacter(c) {
    const g = new THREE.Group();
    const rnd = (arr) => arr[Math.floor(Math.random() * arr.length)];
    const skin = rnd(SKINS);
    const vip = c.vip || null;

    const bodyColor =
      vip === "khalil" ? 0x6d4c2f :
      vip === "salim"  ? 0x8d7350 :
      vip ? 0xf5f5f5 : rnd(THOBES);

    // الجسم (ثوب)
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.85, 1.9, 12), mat(bodyColor));
    body.position.y = 0.95;
    g.add(body);

    // سترة أبو سمير الحمراء
    if (vip === "samir") {
      const vest = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.72, 0.95, 12), mat(0x8e1c1c));
      vest.position.y = 1.42;
      g.add(vest);
    }

    // الرأس
    const headMat = mat(skin);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.5, 16, 14), headMat);
    head.position.y = 2.15;
    if (vip === "salim") head.scale.y = 1.28;
    g.add(head);

    // ===== الوجه: ملامح واضحة =====
    const darkSkin = new THREE.Color(skin).multiplyScalar(0.82).getHex();
    const hairColor = (vip === "yousef" || vip === "salim" || vip === "samir") ? 0x9e9e9e : 0x3a2a1a;
    // عيون كرتونية: بياض + بؤبؤ + لمعة
    for (const sx of [-0.19, 0.19]) {
      const white = new THREE.Mesh(new THREE.SphereGeometry(0.115, 12, 10), mat(0xffffff));
      white.position.set(sx, 2.24, 0.40);
      white.scale.z = 0.55;
      g.add(white);
      const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 8), mat(0x21150d));
      pupil.position.set(sx, 2.24, 0.475);
      g.add(pupil);
      const shine = new THREE.Mesh(new THREE.SphereGeometry(0.018, 6, 6),
        new THREE.MeshLambertMaterial({ color: 0xffffff, emissive: 0x999999 }));
      shine.position.set(sx + 0.03, 2.27, 0.5);
      g.add(shine);
      // حواجب (الفهد له حواجبه الغاضبة الخاصة)
      if (vip !== "fahad") {
        const brow = new THREE.Mesh(new THREE.BoxGeometry(0.17, 0.045, 0.05), mat(hairColor));
        brow.position.set(sx, 2.42, 0.42);
        brow.rotation.z = sx < 0 ? 0.12 : -0.12;
        g.add(brow);
      }
    }
    // أنف
    const nose = new THREE.Mesh(new THREE.SphereGeometry(0.085, 10, 8), mat(darkSkin));
    nose.position.set(0, 2.12, 0.48);
    nose.scale.set(0.9, 1.15, 0.9);
    g.add(nose);
    // فم يتغير مع المزاج (مبتسم / محايد / عابس) — لحية شيخ يوسف تغطي فمه
    let mouths = null;
    if (vip !== "yousef") {
      const my = (vip === "fahad" || vip === "samir") ? 1.83 : 1.93; // تحت الشنب
      const mz = 0.46;
      const mMat = mat(0x7a3b2e);
      const happy = new THREE.Mesh(new THREE.TorusGeometry(0.13, 0.028, 6, 12, Math.PI), mMat);
      happy.rotation.z = Math.PI;
      happy.position.set(0, my + 0.05, mz);
      const mid = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.04, 0.04), mMat);
      mid.position.set(0, my, mz);
      mid.visible = false;
      const sad = new THREE.Mesh(new THREE.TorusGeometry(0.11, 0.028, 6, 12, Math.PI), mMat);
      sad.position.set(0, my - 0.06, mz);
      sad.visible = false;
      g.add(happy); g.add(mid); g.add(sad);
      mouths = { happy, mid, sad };
    }
    // أذنان (لغير لابسي الغترة — طرفها يغطي الأذنين)
    const addEars = () => {
      for (const sx of [-0.47, 0.47]) {
        const ear = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 8), mat(skin));
        ear.position.set(sx, 2.16, 0.05);
        ear.scale.set(0.55, 1, 0.8);
        g.add(ear);
      }
    };

    // غطاء الرأس
    const addGhutra = (color, agal = true) => {
      const gh = new THREE.Mesh(new THREE.SphereGeometry(0.56, 16, 12), mat(color));
      gh.position.y = 2.32;
      gh.scale.set(1, 0.78, 1);
      g.add(gh);
      // أطراف الغترة (تغطي الخلف والجوانب فقط — الوجه مكشوف)
      const flap = new THREE.Mesh(
        new THREE.CylinderGeometry(0.56, 0.64, 0.6, 12, 1, true, Math.PI * 0.3, Math.PI * 1.4),
        new THREE.MeshLambertMaterial({ color, side: THREE.DoubleSide })
      );
      flap.position.y = 2.1;
      g.add(flap);
      if (agal) {
        const ring = new THREE.Mesh(new THREE.TorusGeometry(0.44, 0.06, 8, 20), mat(0x1a1a1a));
        ring.rotation.x = Math.PI / 2;
        ring.position.y = 2.52;
        g.add(ring);
      }
    };

    if (vip === "yousef") {
      addGhutra(0xffffff);
      // لحية طويلة بيضاء
      const beard = new THREE.Mesh(new THREE.ConeGeometry(0.3, 0.95, 10), mat(0xfafafa));
      beard.rotation.x = Math.PI;
      beard.position.set(0, 1.66, 0.3);
      g.add(beard);
    } else if (vip === "fahad") {
      addGhutra(0xc0392b);
      // شارب أسود كبير + حواجب غاضبة
      const mst = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.13, 0.1), mat(0x1a1a1a));
      mst.position.set(0, 1.99, 0.45);
      g.add(mst);
      for (const sx of [-0.18, 0.18]) {
        const brow = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.05, 0.05), mat(0x1a1a1a));
        brow.position.set(sx, 2.36, 0.44);
        brow.rotation.z = sx < 0 ? -0.45 : 0.45;
        g.add(brow);
      }
    } else if (vip === "samir") {
      addEars();
      // طربوش أحمر + شارب رمادي
      const fez = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.36, 0.45, 12), mat(0xb71c1c));
      fez.position.y = 2.75;
      g.add(fez);
      const tas = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 8), mat(0x5d4037));
      tas.position.set(0.28, 2.62, 0);
      g.add(tas);
      const mst = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.15, 0.1), mat(0x9e9e9e));
      mst.position.set(0, 1.97, 0.45);
      g.add(mst);
    } else if (vip === "salim") {
      addEars();
      // نظارات + سكسوكة رمادية
      for (const sx of [-0.18, 0.18]) {
        const lens = new THREE.Mesh(new THREE.TorusGeometry(0.14, 0.025, 8, 16), mat(0x555555));
        lens.position.set(sx, 2.24, 0.46);
        g.add(lens);
      }
      const bridge = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.03, 0.03), mat(0x555555));
      bridge.position.set(0, 2.24, 0.47);
      g.add(bridge);
      const goat = new THREE.Mesh(new THREE.ConeGeometry(0.15, 0.4, 8), mat(0x9a9a9a));
      goat.rotation.x = Math.PI;
      goat.position.set(0, 1.72, 0.32);
      g.add(goat);
    } else if (vip === "khalil") {
      // طفل أصلع — بدون غطاء رأس (فمه من أفواه المزاج)
      addEars();
    } else {
      // زبون عادي: غطاء عشوائي
      const style = Math.random();
      if (style < 0.4) addGhutra(0xffffff);
      else if (style < 0.65) addGhutra(0xc0392b);
      else if (style < 0.8) {
        addEars();
        const fez = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.36, 0.45, 12), mat(0xb71c1c));
        fez.position.y = 2.75;
        g.add(fez);
      } else addEars(); // بدون غطاء
      if (Math.random() < 0.35) {
        const mst = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.11, 0.09), mat(0x3a2a1a));
        mst.position.set(0, 1.99, 0.45);
        g.add(mst);
      }
    }

    // ظل دائري
    const shadow = new THREE.Mesh(
      new THREE.CircleGeometry(0.85, 20),
      new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.25 })
    );
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.y = 0.02;
    g.add(shadow);

    if (vip === "khalil") g.scale.setScalar(0.72);
    const height = (vip === "khalil" ? 0.72 : 1) * (vip === "salim" ? 3.1 : 2.95);
    return { group: g, head, headMat, height, mouths };
  }

  /* ============================================================
     مجسمات الأصناف — برجر بطبقاته، شاورما ملفوفة، بطاطس، مشروب…
     تُستخدم: أيقونات للأزرار/الصينية + طيران الطلب + عرض على الكاونتر
     ============================================================ */
  function dishKind(dish) {
    if (["shawarma", "fries", "drink", "falafel", "burger"].includes(dish.id)) return dish.id;
    const e = dish.emoji || "";
    if ("🌮🫔".includes(e)) return "taco";
    if ("🥙🥪".includes(e)) return "sandwich";
    if ("🍱🥘🍜".includes(e)) return "bowl";
    if ("🍗🍖🍢".includes(e)) return "drumstick";
    return "dome";
  }

  function makeDishModel(kind) {
    const g = new THREE.Group();
    const add = (geo, color, x = 0, y = 0, z = 0, emissive = 0x000000) => {
      const m = new THREE.Mesh(geo, mat(color, emissive));
      m.position.set(x, y, z);
      g.add(m);
      return m;
    };
    const C = THREE.CylinderGeometry, S = THREE.SphereGeometry, B = THREE.BoxGeometry;

    if (kind === "burger") {
      add(new C(0.33, 0.35, 0.12, 14), 0xe0a35c, 0, 0.06);                       // خبزة سفلية
      add(new C(0.36, 0.36, 0.09, 14), 0x4e2e15, 0, 0.16);                       // لحم
      const cheese = add(new B(0.52, 0.03, 0.52), 0xf9ca24, 0, 0.215); cheese.rotation.y = 0.5; // جبن
      add(new C(0.34, 0.34, 0.05, 14), 0xd63031, 0, 0.25);                       // طماطم
      const let1 = add(new S(0.37, 12, 8), 0x6ab04c, 0, 0.29); let1.scale.set(1, 0.22, 1);      // خس
      const top = add(new S(0.35, 14, 10), 0xe8b063, 0, 0.33); top.scale.set(1, 0.72, 1);       // خبزة علوية
      for (let i = 0; i < 6; i++) {                                              // سمسم
        const a = (i / 6) * Math.PI * 2;
        add(new S(0.022, 5, 4), 0xfff3d6, Math.cos(a) * 0.17, 0.52, Math.sin(a) * 0.17);
      }
    } else if (kind === "shawarma") {
      const wrap = add(new C(0.13, 0.2, 0.75, 12), 0xd9a55a, 0, 0.4); wrap.rotation.z = 0.35;   // لفة الصاج المحمصة
      const grill1 = add(new B(0.28, 0.02, 0.28), 0xb07b33, 0, 0.45); grill1.rotation.z = 0.35; // خطوط تحميص
      const paper = add(new C(0.205, 0.225, 0.26, 12), 0xf5f0e6, -0.13, 0.17); paper.rotation.z = 0.35; // ورق التغليف
      for (let i = 0; i < 4; i++) {                                              // حشوة من فوق
        add(new S(0.055, 7, 6), [0x7cb342, 0xc0392b, 0x8d5524, 0xf6c445][i],
            0.1 + (i % 2) * 0.07, 0.76 + (i > 1 ? 0.03 : 0), (i % 2 ? 0.05 : -0.05));
      }
    } else if (kind === "fries") {
      add(new B(0.42, 0.4, 0.26), 0xd63031, 0, 0.2);                             // علبة حمراء
      add(new B(0.43, 0.12, 0.27), 0xffe9a8, 0, 0.1);                            // شريط أصفر
      for (let i = 0; i < 7; i++) {                                              // أصابع البطاطس
        const f = add(new B(0.07, 0.55, 0.07), 0xf6c445, -0.14 + i * 0.05, 0.45, (i % 2 ? 0.06 : -0.05));
        f.rotation.z = (i - 3) * 0.06;
      }
    } else if (kind === "drink") {
      add(new C(0.2, 0.15, 0.55, 14), 0xd63031, 0, 0.28);                        // كوب
      add(new C(0.205, 0.19, 0.12, 14), 0xffffff, 0, 0.5);                       // حزام أبيض
      add(new C(0.21, 0.21, 0.05, 14), 0xf5f5f5, 0, 0.58);                       // غطاء
      const straw = add(new C(0.028, 0.028, 0.4, 8), 0xffffff, 0.08, 0.75); straw.rotation.z = -0.25; // شفاطة
    } else if (kind === "falafel") {
      add(new C(0.42, 0.48, 0.06, 16), 0xf5f5f5, 0, 0.03);                       // صحن
      for (let i = 0; i < 4; i++) {
        const a = (i / 4) * Math.PI * 2;
        add(new S(0.13, 9, 7), 0x8d5524, Math.cos(a) * 0.2, 0.16, Math.sin(a) * 0.2); // أقراص
        add(new S(0.035, 5, 4), 0x6ab04c, Math.cos(a) * 0.2, 0.28, Math.sin(a) * 0.2); // بقدونس
      }
    } else if (kind === "taco") {
      for (const side of [-1, 1]) {                                              // صدفة مطوية
        const sh = add(new B(0.5, 0.42, 0.05), 0xf6c445, side * 0.14, 0.22);
        sh.rotation.z = side * -0.5;
      }
      for (let i = 0; i < 3; i++)
        add(new S(0.08, 7, 6), [0x6ab04c, 0xc0392b, 0x8d5524][i], -0.1 + i * 0.1, 0.42);
    } else if (kind === "sandwich") {
      add(new B(0.55, 0.09, 0.4), 0xe8c48f, 0, 0.05);                            // خبز سفلي
      add(new B(0.56, 0.05, 0.41), 0x6ab04c, 0, 0.12);                           // خس
      add(new B(0.54, 0.06, 0.39), 0xc0392b, 0, 0.17);                           // حشوة
      const cheese = add(new B(0.58, 0.03, 0.43), 0xf9ca24, 0, 0.21); cheese.rotation.y = 0.25;
      const topB = add(new B(0.55, 0.09, 0.4), 0xdba876, 0, 0.26); topB.rotation.y = 0.06;
    } else if (kind === "bowl") {
      add(new C(0.4, 0.24, 0.3, 16), 0x3867d6, 0, 0.15);                         // زبدية
      const rice = add(new S(0.36, 12, 8), 0xf6c445, 0, 0.3); rice.scale.set(1, 0.4, 1);        // محتوى
      add(new S(0.06, 6, 5), 0xc0392b, 0.1, 0.42, 0.05);
      add(new S(0.05, 6, 5), 0x6ab04c, -0.12, 0.42, -0.04);
    } else if (kind === "drumstick") {
      const meat = add(new S(0.24, 12, 9), 0xa9743f, -0.08, 0.26); meat.scale.set(1.25, 1, 1);  // لحم
      const bone = add(new C(0.045, 0.045, 0.35, 8), 0xf5f5f5, 0.28, 0.32); bone.rotation.z = -1.1; // عظمة
      add(new S(0.06, 6, 5), 0xf5f5f5, 0.44, 0.38);
      add(new S(0.06, 6, 5), 0xf5f5f5, 0.42, 0.26);
    } else { // dome — طبق فاخر مغطى
      add(new C(0.45, 0.5, 0.06, 16), 0xf5f5f5, 0, 0.03);
      const dome = add(new S(0.36, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2), 0xb0bec5, 0, 0.06);
      add(new S(0.05, 8, 6), 0x8d99ae, 0, 0.46);
    }
    return g;
  }

  /* أيقونات الأصناف: نرندر المجسم في مشهد صغير ونحوله لصورة */
  const iconCache = {};
  let iconRenderer = null, iconScene = null, iconCam = null;
  api.dishIcon = function (dish) {
    if (!api.active) return null;
    const key = dishKind(dish);
    if (iconCache[key]) return iconCache[key];
    try {
      if (!iconRenderer) {
        iconRenderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
        iconRenderer.setSize(128, 128);
        iconScene = new THREE.Scene();
        iconScene.add(new THREE.HemisphereLight(0xffffff, 0x555577, 1.35));
        const d = new THREE.DirectionalLight(0xffffff, 0.9);
        d.position.set(2, 4, 3);
        iconScene.add(d);
        iconCam = new THREE.PerspectiveCamera(35, 1, 0.1, 10);
        iconCam.position.set(0.85, 1.05, 1.55);
        iconCam.lookAt(0, 0.27, 0);
      }
      const model = makeDishModel(key);
      iconScene.add(model);
      iconRenderer.render(iconScene, iconCam);
      const url = iconRenderer.domElement.toDataURL("image/png");
      iconScene.remove(model);
      iconCache[key] = url;
      return url;
    } catch (e) { return null; }
  };

  /* طيران الطلب من الكاونتر إلى الزبون */
  const flying = [];
  api.flyDish = function (dish, uid) {
    if (!api.active) return;
    const e = chars.get(uid);
    if (!e) return;
    const m = makeDishModel(dishKind(dish));
    m.scale.setScalar(1.25);
    m.position.set(e.group.position.x * 0.3, 1.1, 4.6);
    scene.add(m);
    flying.push({ m, t: 0, from: m.position.clone(), toE: e });
  };

  /* ---------- ديكور المطعم ---------- */
  function buildRoom() {
    // أرضية خشبية
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(34, 16), mat(0x6d4c33));
    floor.rotation.x = -Math.PI / 2;
    scene.add(floor);
    // خطوط بلاط خفيفة
    for (let i = -4; i <= 4; i++) {
      const line = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.01, 16), mat(0x5d3f28));
      line.position.set(i * 2.2, 0.01, 0);
      scene.add(line);
    }
    // جدار خلفي
    const wall = new THREE.Mesh(new THREE.PlaneGeometry(34, 10), mat(0x2a1e4a));
    wall.position.set(0, 5, -3.2);
    scene.add(wall);
    // لوحة نيون
    const sign = new THREE.Mesh(new THREE.BoxGeometry(6.5, 1, 0.15),
      new THREE.MeshLambertMaterial({ color: 0xff9f43, emissive: 0xcc6f1e }));
    sign.position.set(0, 5.6, -3.1);
    scene.add(sign);
    for (const sx of [-6.5, 6.5]) {
      const win = new THREE.Mesh(new THREE.BoxGeometry(2.6, 2.2, 0.1),
        new THREE.MeshLambertMaterial({ color: 0x6c5ce7, emissive: 0x4a3db8 }));
      win.position.set(sx, 4.4, -3.1);
      scene.add(win);
    }
    // كاونتر أمامي منخفض
    const counter = new THREE.Mesh(new THREE.BoxGeometry(16, 0.9, 1.1), mat(0x4e342e));
    counter.position.set(0, 0.45, 2.6);
    scene.add(counter);
    const slab = new THREE.Mesh(new THREE.BoxGeometry(16.3, 0.13, 1.3), mat(0x8d6e63));
    slab.position.set(0, 0.96, 2.6);
    scene.add(slab);
    // سيخ شاورما ديكوري
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 2.6, 8), mat(0xbdbdbd));
    pole.position.set(6.4, 1.9, 0.6);
    scene.add(pole);
    spitMeat = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.7, 1.5, 10), mat(0xa9743f, 0x341f0d));
    spitMeat.position.set(6.4, 2.0, 0.6);
    scene.add(spitMeat);
    // أصناف معروضة على الكاونتر
    const displays = [["burger", -4.4], ["fries", -5.6], ["drink", -6.7]];
    for (const [k, x] of displays) {
      const m = makeDishModel(k);
      m.scale.setScalar(1.15);
      m.position.set(x, 1.03, 2.5);
      m.rotation.y = Math.random() * Math.PI;
      scene.add(m);
    }
    // إضاءات معلقة
    for (const sx of [-3.5, 0, 3.5]) {
      const cord = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 1.4, 6), mat(0x222222));
      cord.position.set(sx, 6.5, -0.5);
      scene.add(cord);
      const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.22, 10, 10),
        new THREE.MeshLambertMaterial({ color: 0xffe9a8, emissive: 0xd6a94f }));
      bulb.position.set(sx, 5.8, -0.5);
      scene.add(bulb);
    }
  }

  /* ---------- تهيئة ---------- */
  api.init = function (containerEl, overlayEl) {
    if (typeof THREE === "undefined") return false;
    try {
      container = containerEl;
      overlayLayer = overlayEl;
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
      renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
      renderer.domElement.id = "canvas3d";
      container.prepend(renderer.domElement);

      scene = new THREE.Scene();
      camera = new THREE.PerspectiveCamera(42, 1, 0.1, 60);
      camera.position.set(0, 3.3, 9.0);
      camera.lookAt(0, 2.05, 0);

      scene.add(new THREE.HemisphereLight(0xfff2e0, 0x2d1b4e, 1.15));
      const sun = new THREE.DirectionalLight(0xffffff, 0.85);
      sun.position.set(3, 7, 5);
      scene.add(sun);

      buildRoom();

      raycaster = new THREE.Raycaster();
      pointer = new THREE.Vector2();
      renderer.domElement.addEventListener("click", onCanvasClick);

      new ResizeObserver(resize).observe(container);
      resize();

      api.active = true;
      running = true;
      lastT = performance.now();
      requestAnimationFrame(tick);
      return true;
    } catch (e) {
      api.active = false;
      return false;
    }
  };

  function resize() {
    if (!renderer) return;
    const w = container.clientWidth || 1, h = container.clientHeight || 1;
    renderer.setSize(w, h);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    // وسّع أو ضيّق أماكن الوقوف حسب عرض الشاشة
    const halfW = Math.tan((camera.fov / 2) * Math.PI / 180) * 9.0 * camera.aspect;
    slotSpread = Math.min(4.3, Math.max(2.4, halfW * 0.62));
  }

  function slotX(i, n) {
    if (n <= 1) return 0;
    return -slotSpread + (2 * slotSpread * i) / (n - 1);
  }

  /* ---------- مزامنة الزبائن مع game.js ---------- */
  api.sync = function (customers) {
    const seen = new Set();
    customers.forEach((c, i) => {
      seen.add(c.uid);
      let e = chars.get(c.uid);
      if (!e) {
        const built = makeCharacter(c);
        e = { ...built, t: Math.random() * 6, entering: 1, leaving: 0, ov: null, cust: c };
        e.group.position.set(-slotSpread - 6, 0, 0);
        scene.add(e.group);
        const ov = document.createElement("div");
        ov.className = "ov3d";
        overlayLayer.appendChild(ov);
        e.ov = ov;
        chars.set(c.uid, e);
      }
      e.cust = c;
      e.slotX = slotX(i, Math.max(customers.length, 1));
    });
    // الزبائن اللي راحوا بدون leave (نهاية اليوم مثلاً)
    for (const [uid, e] of chars) {
      if (!seen.has(uid) && !e.leaving) disposeChar(uid);
    }
  };

  api.leave = function (c, happy) {
    const e = chars.get(c.uid);
    if (!e) return;
    e.leaving = happy ? 1 : -1;
    if (!happy) e.headMat.emissive = new THREE.Color(0x661111);
    if (e.mouths) {
      e.mouths.happy.visible = happy;
      e.mouths.mid.visible = false;
      e.mouths.sad.visible = !happy;
    }
    if (e.ov) { e.ov.remove(); e.ov = null; }
    setTimeout(() => disposeChar(c.uid), 750);
  };

  function disposeChar(uid) {
    const e = chars.get(uid);
    if (!e) return;
    scene.remove(e.group);
    if (e.ov) e.ov.remove();
    chars.delete(uid);
  }

  api.clear = function () {
    for (const uid of [...chars.keys()]) disposeChar(uid);
  };

  /* ---------- حلقة الرسم ---------- */
  function tick(now) {
    if (!running) return;
    requestAnimationFrame(tick);
    // وفّر البطارية إذا الشاشة مخفية
    if (!container.offsetParent) return;
    const dt = Math.min((now - lastT) / 1000, 0.1);
    lastT = now;

    if (spitMeat) spitMeat.rotation.y += dt * 1.2;

    // الأطباق الطائرة نحو الزبائن
    for (let i = flying.length - 1; i >= 0; i--) {
      const f = flying[i];
      f.t += dt / 0.55;
      const k = Math.min(f.t, 1);
      const to = f.toE.group.position;
      f.m.position.lerpVectors(f.from, new THREE.Vector3(to.x, 1.5, 0.5), k);
      f.m.position.y += Math.sin(k * Math.PI) * 1.3;
      f.m.rotation.y += dt * 6;
      if (k >= 1) { scene.remove(f.m); flying.splice(i, 1); }
    }

    for (const e of chars.values()) {
      e.t += dt;
      const g = e.group;
      if (e.leaving) {
        // خروج: سعيد يمين / زعلان يسار مع دوران
        g.position.x += (e.leaving > 0 ? 7 : -7) * dt;
        g.rotation.z += (e.leaving > 0 ? -1.2 : 2.2) * dt;
        g.scale.multiplyScalar(Math.max(0, 1 - 1.4 * dt));
      } else {
        // انزلاق نحو مكان الوقوف
        g.position.x += (e.slotX - g.position.x) * Math.min(1, dt * 4);
        // تمايل خفيف
        g.position.y = Math.sin(e.t * 2.1) * 0.05;
        // اهتزاز غضب عند قرب نفاد الصبر
        const c = e.cust;
        const r = c ? c.patience / c.maxPatience : 1;
        if (r < 0.3) {
          g.rotation.z = Math.sin(e.t * 30) * 0.05;
          e.headMat.emissive = new THREE.Color(0x551111);
        } else {
          g.rotation.z = 0;
          e.headMat.emissive = new THREE.Color(0x000000);
        }
        // الفم يتبع المزاج
        if (e.mouths) {
          e.mouths.happy.visible = r > 0.55;
          e.mouths.mid.visible = r <= 0.55 && r > 0.3;
          e.mouths.sad.visible = r <= 0.3;
        }
      }
      // تموضع طبقة الفقاعات فوق الرأس
      if (e.ov) {
        const v = new THREE.Vector3(g.position.x, e.height * g.scale.y + 0.15, g.position.z);
        v.project(camera);
        const w = container.clientWidth, h = container.clientHeight;
        e.ov.style.left = ((v.x * 0.5 + 0.5) * w) + "px";
        e.ov.style.top = ((-v.y * 0.5 + 0.5) * h) + "px";
      }
    }
    renderer.render(scene, camera);
  }

  /* ---------- نقر على المجسم مباشرة ---------- */
  function onCanvasClick(ev) {
    if (!api.onCustomerClick) return;
    const rect = renderer.domElement.getBoundingClientRect();
    pointer.x = ((ev.clientX - rect.left) / rect.width) * 2 - 1;
    pointer.y = -((ev.clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(pointer, camera);
    const groups = [...chars.values()].filter(e => !e.leaving).map(e => e.group);
    const hits = raycaster.intersectObjects(groups, true);
    if (!hits.length) return;
    let obj = hits[0].object;
    while (obj && !groups.includes(obj)) obj = obj.parent;
    if (!obj) return;
    for (const e of chars.values()) {
      if (e.group === obj) { api.onCustomerClick(e.cust); return; }
    }
  }

  api.getOverlay = (c) => { const e = chars.get(c.uid); return e ? e.ov : null; };

  return api;
})();
