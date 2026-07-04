/* ============================================================
   مشهد المطعم ثلاثي الأبعاد — Three.js
   شخصيات low-poly مبنية بالكود + طبقة HTML للفقاعات والأسماء
   إذا فشل WebGL أو ما تحمّلت المكتبة → اللعبة ترجع تلقائياً للوضع 2D
   ============================================================ */
"use strict";

window.S3D = (() => {
  let renderer, scene, camera, container, overlayLayer;
  let raycaster, pointer;
  let maxAniso = 1; // أقصى تصفية أنيزوتروبية مدعومة — تُحسب بعد إنشاء الـrenderer
  const chars = new Map();   // uid -> { group, ov, head, t, slotX, entering, leaving, height, baseTint }
  let slotSpread = 4.2;
  let running = false;
  let lastT = 0;
  let spitMeat = null;   // سيخ الشاورما الدوار

  const api = {
    active: false,
    onCustomerClick: null,   // تحدد من game.js
  };

  /* ---------- مواد وألوان (PBR واقعية) ---------- */
  const SKINS = [0xeeb98c, 0xdba876, 0xf2c49b, 0xc98e63];
  const THOBES = [0xf5f5f5, 0xdfe6e9, 0xcfd8dc, 0x90a4ae, 0x6d4c2f, 0x4e6e5d];
  const mat = (color, emissive = 0x000000) =>
    new THREE.MeshPhysicalMaterial({
      color, emissive, roughness: 0.55, metalness: 0.05,
      clearcoat: 0.35, clearcoatRoughness: 0.3, // لمسة لامعة كالمجسمات الجاهزة (figurine look)
    });

  /* تكستر مرسوم على كانفس */
  function canvasTexture(w, h, draw) {
    const c = document.createElement("canvas");
    c.width = w; c.height = h;
    draw(c.getContext("2d"), w, h);
    const t = new THREE.CanvasTexture(c);
    if ("colorSpace" in t) t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }
  function woodTexture() {
    return canvasTexture(512, 512, (g, w, h) => {
      g.fillStyle = "#7a5230"; g.fillRect(0, 0, w, h);
      for (let y = 0; y < h; y += 64) { // ألواح
        g.fillStyle = `rgb(${105 + Math.random() * 25},${68 + Math.random() * 18},${38 + Math.random() * 12})`;
        g.fillRect(0, y, w, 62);
        g.fillStyle = "rgba(0,0,0,.35)"; g.fillRect(0, y + 62, w, 2);
        for (let i = 0; i < 26; i++) { // عروق الخشب
          g.strokeStyle = `rgba(60,35,15,${0.08 + Math.random() * 0.12})`;
          g.lineWidth = 1 + Math.random() * 2;
          g.beginPath();
          const yy = y + 6 + Math.random() * 52;
          g.moveTo(0, yy);
          g.bezierCurveTo(w * 0.3, yy + (Math.random() * 14 - 7), w * 0.7, yy + (Math.random() * 14 - 7), w, yy);
          g.stroke();
        }
      }
    });
  }
  function wallTexture() {
    return canvasTexture(512, 256, (g, w, h) => {
      const gr = g.createLinearGradient(0, 0, 0, h);
      gr.addColorStop(0, "#332553"); gr.addColorStop(1, "#241a40");
      g.fillStyle = gr; g.fillRect(0, 0, w, h);
      for (let i = 0; i < 900; i++) { // خشونة الجبس
        g.fillStyle = `rgba(255,255,255,${Math.random() * 0.03})`;
        g.fillRect(Math.random() * w, Math.random() * h, 2, 2);
      }
      g.fillStyle = "rgba(0,0,0,.3)"; g.fillRect(0, h - 26, w, 26); // إزار سفلي
    });
  }
  function signTexture() {
    return canvasTexture(1024, 256, (g, w, h) => {
      g.fillStyle = "#12081f"; g.fillRect(0, 0, w, h);
      g.strokeStyle = "#ff9f43"; g.lineWidth = 8;
      g.strokeRect(14, 14, w - 28, h - 28);
      g.textAlign = "center";
      g.shadowColor = "#ff9f43"; g.shadowBlur = 34;
      g.fillStyle = "#ffd166";
      g.font = "900 96px Cairo, Arial";
      g.fillText("مطعم المستقبل", w / 2, 118);
      g.shadowColor = "#6c5ce7"; g.shadowBlur = 24;
      g.fillStyle = "#a29bfe";
      g.font = "700 52px Arial";
      g.fillText("A I   K I T C H E N", w / 2, 200);
    });
  }
  function windowTexture() {
    return canvasTexture(256, 256, (g, w, h) => {
      const gr = g.createLinearGradient(0, 0, 0, h);
      gr.addColorStop(0, "#0d1440"); gr.addColorStop(1, "#251a4d");
      g.fillStyle = gr; g.fillRect(0, 0, w, h);
      for (let i = 0; i < 40; i++) { // نجوم
        g.fillStyle = `rgba(255,255,255,${0.3 + Math.random() * 0.7})`;
        g.fillRect(Math.random() * w, Math.random() * h * 0.5, 2, 2);
      }
      g.fillStyle = "#ffe9a8"; // هلال
      g.beginPath(); g.arc(200, 48, 22, 0, Math.PI * 2); g.fill();
      g.fillStyle = "#0d1440";
      g.beginPath(); g.arc(210, 42, 20, 0, Math.PI * 2); g.fill();
      for (let b = 0; b < 7; b++) { // أبراج المدينة
        const bw = 22 + Math.random() * 26, bh = 60 + Math.random() * 90, bx = b * 36;
        g.fillStyle = "#1a0f33";
        g.fillRect(bx, h - bh, bw, bh);
        for (let wy = h - bh + 8; wy < h - 8; wy += 14)
          for (let wx = bx + 4; wx < bx + bw - 6; wx += 10)
            if (Math.random() < 0.5) { g.fillStyle = "#ffd166"; g.fillRect(wx, wy, 5, 7); }
      }
    });
  }
  /* نقشة الشماغ الأحمر (كروس-هاتش مثل الصور المرجعية) */
  let shemaghTex = null;
  function getShemaghTexture() {
    if (!shemaghTex) {
      shemaghTex = canvasTexture(128, 128, (g, w, h) => {
        g.fillStyle = "#f7f1ea"; g.fillRect(0, 0, w, h);
        g.strokeStyle = "#c0392b"; g.lineWidth = 2.5;
        for (let i = -h; i < w + h; i += 13) {
          g.beginPath(); g.moveTo(i, 0); g.lineTo(i + h, h); g.stroke();
          g.beginPath(); g.moveTo(i + h, 0); g.lineTo(i, h); g.stroke();
        }
        g.strokeStyle = "rgba(192,57,43,.45)"; g.lineWidth = 1;
        for (let i = -h; i < w + h; i += 6.5) {
          g.beginPath(); g.moveTo(i, 0); g.lineTo(i + h, h); g.stroke();
        }
      });
      shemaghTex.wrapS = shemaghTex.wrapT = THREE.RepeatWrapping;
      shemaghTex.repeat.set(2, 2);
    }
    return shemaghTex;
  }

  function menuBoardTexture() {
    return canvasTexture(256, 320, (g, w, h) => {
      g.fillStyle = "#241505"; g.fillRect(0, 0, w, h);
      g.strokeStyle = "#8d6e63"; g.lineWidth = 10; g.strokeRect(8, 8, w - 16, h - 16);
      g.textAlign = "center"; g.fillStyle = "#ffd166";
      g.font = "900 34px Cairo, Arial"; g.fillText("المنيو", w / 2, 52);
      g.font = "700 22px Cairo, Arial"; g.fillStyle = "#f5e6c8";
      const items = ["شاورما ٨", "بطاطس ٥", "مشروب ٣", "فلافل ٦", "برجر ١٠", "طبق الشيف الآلي ؟"];
      items.forEach((s, i) => g.fillText(s, w / 2, 100 + i * 36));
    });
  }

  /* لافتة الخروج فوق الأبواب الجانبية */
  function exitSignTexture() {
    return canvasTexture(320, 128, (g, w, h) => {
      g.fillStyle = "#0e6b3a"; g.fillRect(0, 0, w, h);
      g.strokeStyle = "#ffd166"; g.lineWidth = 6; g.strokeRect(6, 6, w - 12, h - 12);
      g.textAlign = "center"; g.fillStyle = "#ffffff";
      g.font = "900 54px Cairo, Arial";
      g.fillText("🚪 الخروج", w / 2, 78);
    });
  }

  /* ---------- بناء شخصية كرتونية ---------- */
  function makeCharacter(c) {
    const vip = c.vip || null;
    const female = c.gender === "f" && !vip;

    // شخصيات صار لها نموذج GLTF حقيقي — بدون أي "كبسولات" مبنية بالكود بعد اليوم
    if (vip === "salim") return salimTemplate ? buildStaticFromModel(salimTemplate) : buildLoadingPlaceholder();
    if (vip === "khalil") return regularTemplates.littleBackpacker ? buildStaticFromModel(regularTemplates.littleBackpacker) : buildLoadingPlaceholder();
    if (vip === "fanni") return regularTemplates.thumbsUpHandyman ? buildStaticFromModel(regularTemplates.thumbsUpHandyman) : buildLoadingPlaceholder();
    if (vip === "edward") return regularTemplates.grandpaCane ? buildStaticFromModel(regularTemplates.grandpaCane) : buildLoadingPlaceholder();
    if (vip === "yousef") return regularTemplates.walkingWisdom ? buildStaticFromModel(regularTemplates.walkingWisdom) : buildLoadingPlaceholder();
    if (vip === "inspector") return regularTemplates.midnightElegance ? buildStaticFromModel(regularTemplates.midnightElegance) : buildLoadingPlaceholder();
    if (vip === "muniOfficer") return buildMunicipalityOfficer();
    if (female) {
      // زبونة: نموذج حقيقي دائماً من مجموعة متنوعة (منقّبة بألوان مختلفة، عباءة بوجه مكشوف، حجاب عصري، أو بدون حجاب)
      const pool = ["veiledInBlack", "midnightAbaya", "casualChicHijab", "casualChic"].filter((k) => regularTemplates[k]);
      if (!pool.length) return buildLoadingPlaceholder();
      const pick = pool[Math.floor(Math.random() * pool.length)];
      return pick === "veiledInBlack" ? buildFemaleFromModel(c) : buildStaticFromModel(regularTemplates[pick]);
    }
    if (!vip) {
      // زبون عادي (رجل): نموذج GLTF حقيقي دائماً من مجموعة متنوعة
      const pool = ["blueThobe", "businessman", "emeraldRobed", "jollyPortly", "constructionExec", "grayKurta", "clockworkGentleman"]
        .filter((k) => regularTemplates[k]);
      if (!pool.length) return buildLoadingPlaceholder();
      const pick = pool[Math.floor(Math.random() * pool.length)];
      return buildStaticFromModel(regularTemplates[pick]);
    }

    // الشخصيات المميزة المتبقية (أحمد الفهد، أبو سمير)
    // ما زالت مبنية بالكود مؤقتاً — ما توفر لها نموذج GLTF جاهز بعد
    const g = new THREE.Group();
    const rnd = (arr) => arr[Math.floor(Math.random() * arr.length)];
    const skin = rnd(SKINS);
    const bodyColor = 0xf5f5f5;

    // الجسم (ثوب) — أسطح أنعم لملمس شبه واقعي بدل الشكل المضلّع
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.85, 1.9, 24), mat(bodyColor));
    body.position.y = 0.95;
    g.add(body);

    // رقبة وأكتاف — قوام أقرب للواقع
    const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.2, 0.28, 16), mat(skin));
    neck.position.y = 1.92;
    g.add(neck);
    for (const side of [-1, 1]) {
      const sh = new THREE.Mesh(new THREE.SphereGeometry(0.26, 16, 12), mat(bodyColor));
      sh.position.set(side * 0.4, 1.76, 0.02);
      g.add(sh);
    }

    // ذراعان بكفوف — تعطي واقعية كبيرة للقوام
    for (const side of [-1, 1]) {
      const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.13, 0.85, 14), mat(bodyColor));
      arm.position.set(side * 0.58, 1.35, 0.05);
      arm.rotation.z = side * 0.32;
      g.add(arm);
      const hand = new THREE.Mesh(new THREE.SphereGeometry(0.13, 12, 10), mat(skin));
      hand.position.set(side * 0.72, 0.95, 0.08);
      g.add(hand);
    }

    // سترة أبو سمير الحمراء
    if (vip === "samir") {
      const vest = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.72, 0.95, 12), mat(0x8e1c1c));
      vest.position.y = 1.42;
      g.add(vest);
    }

    // الرأس
    const headMat = mat(skin);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.5, 28, 22), headMat);
    head.position.y = 2.15;
    g.add(head);

    // ===== الوجه: ملامح واضحة =====
    const darkSkin = new THREE.Color(skin).multiplyScalar(0.82).getHex();
    const hairColor = vip === "samir" ? 0xd7d7d7 : 0x3a2a1a;
    // عيون كرتونية: بياض + بؤبؤ + لمعة
    const eyeZ = 0.40;
    for (const sx of [-0.19, 0.19]) {
      const white = new THREE.Mesh(new THREE.SphereGeometry(0.115, 12, 10), mat(0xffffff));
      white.position.set(sx, 2.24, eyeZ);
      white.scale.z = 0.55;
      g.add(white);
      // قزحية ملونة (بني/أخضر/عسلي مثل الصور) + بؤبؤ أسود
      const irisCol = c._iris || (c._iris = Math.random() < 0.2 ? 0x2e7d32 : (Math.random() < 0.35 ? 0x8d6e63 : 0x4e342e));
      const iris = new THREE.Mesh(new THREE.SphereGeometry(0.055, 10, 8), mat(irisCol));
      iris.position.set(sx, 2.24, eyeZ + 0.07);
      g.add(iris);
      const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.028, 8, 8), mat(0x0d0704));
      pupil.position.set(sx, 2.24, eyeZ + 0.11);
      g.add(pupil);
      const shine = new THREE.Mesh(new THREE.SphereGeometry(0.018, 6, 6),
        new THREE.MeshLambertMaterial({ color: 0xffffff, emissive: 0x999999 }));
      shine.position.set(sx + 0.03, 2.27, eyeZ + 0.1);
      g.add(shine);
      // حواجب (الفهد له حواجبه الغاضبة الخاصة)
      if (vip !== "fahad") {
        const brow = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.06, 0.05), mat(hairColor));
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
    // فم يتغير مع المزاج (مبتسم / محايد / عابس)
    let mouths = null;
    {
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

    // غطاء الرأس (مطابق للصور: شماغ منقوش متدلٍ على الصدر + عقال مزدوج)
    const addGhutra = (color, agal = true, pattern = false) => {
      const clothMat = () => pattern
        ? new THREE.MeshPhysicalMaterial({ map: getShemaghTexture(), roughness: 0.7, side: THREE.DoubleSide, clearcoat: 0.2, clearcoatRoughness: 0.4 })
        : new THREE.MeshPhysicalMaterial({ color, roughness: 0.7, side: THREE.DoubleSide, clearcoat: 0.2, clearcoatRoughness: 0.4 });
      const gh = new THREE.Mesh(new THREE.SphereGeometry(0.56, 28, 22), clothMat());
      gh.position.y = 2.32;
      gh.scale.set(1, 0.78, 1);
      g.add(gh);
      // أطراف تغطي الخلف والجوانب وتنسدل أطول (الوجه مكشوف)
      const flap = new THREE.Mesh(
        new THREE.CylinderGeometry(0.56, 0.7, 0.75, 24, 1, true, Math.PI * 0.3, Math.PI * 1.4),
        clothMat()
      );
      flap.position.y = 2.02;
      g.add(flap);
      // طرفان متدليان على الصدر مثل الصور المرجعية
      for (const side of [-1, 1]) {
        const tail = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.75, 0.07), clothMat());
        tail.position.set(side * 0.33, 1.55, 0.34);
        tail.rotation.z = side * 0.14;
        tail.rotation.x = -0.1;
        g.add(tail);
      }
      // عقال مزدوج (حلقتان فوق بعض)
      if (agal) {
        for (const ay of [2.5, 2.58]) {
          const ring = new THREE.Mesh(new THREE.TorusGeometry(0.44, 0.045, 8, 20), mat(0x141414));
          ring.rotation.x = Math.PI / 2;
          ring.position.y = ay;
          g.add(ring);
        }
      }
    };

    if (vip === "fahad") {
      addGhutra(0xc0392b, true, true);
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
    }

    // ظل دائري
    const shadow = new THREE.Mesh(
      new THREE.CircleGeometry(0.85, 20),
      new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.25 })
    );
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.y = 0.02;
    g.add(shadow);

    g.traverse(o => { if (o.isMesh) o.castShadow = true; });
    return { group: g, head, headMat, height: 2.95, mouths };
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
        iconRenderer.setSize(192, 192);
        iconScene = new THREE.Scene();
        iconScene.add(new THREE.HemisphereLight(0xffffff, 0x555577, 1.35));
        const d = new THREE.DirectionalLight(0xffffff, 0.9);
        d.position.set(2, 4, 3);
        iconScene.add(d);
        iconCam = new THREE.PerspectiveCamera(35, 1, 0.1, 10);
        iconCam.position.set(0.72, 0.9, 1.3); // أقرب = أيقونة أكبر وأوضح
        iconCam.lookAt(0, 0.26, 0);
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

  /* ---------- ديكور المطعم (واقعي) ---------- */
  let floorMat = null, wallMat = null, clockHands = null, steam = [], robot = null;
  let leftDoorGroup = null, rightDoorGroup = null;

  /* ---------- نماذج GLTF حقيقية بدل بعض الشخصيات المبنية بالكود ---------- */
  const MODEL_HEIGHT = 2.95; // نفس ارتفاع رأس بقية الشخصيات تقريباً (لتموضع فقاعة الحوار)

  /* يعاير المقياس والوضع مرة وحدة حسب الصندوق المحيط الحقيقي للنموذج، ويثبّت القدمين على y=0 */
  function autoScaleGround(model, targetHeight) {
    const box = new THREE.Box3().setFromObject(model);
    const size = new THREE.Vector3();
    box.getSize(size);
    const scale = targetHeight / Math.max(size.y, 0.001);
    model.scale.setScalar(scale);
    const box2 = new THREE.Box3().setFromObject(model);
    model.position.y -= box2.min.y;
  }

  /* ظل دائري تحت القدمين (نفس أسلوب باقي الشخصيات) */
  function groundShadow() {
    const shadow = new THREE.Mesh(
      new THREE.CircleGeometry(0.85, 20),
      new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.25 })
    );
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.y = 0.02;
    return shadow;
  }

  let salimTemplate = null;
  // بقية الشخصيات (رجال/نساء VIP وعاديين) → THREE.Group بعد التحميل، كلها بنفس المفتاح المستخدم في makeCharacter
  const regularTemplates = {};
  let modelsLoadStarted = false;

  function preloadRealModels() {
    if (modelsLoadStarted || typeof GLTFLoader === "undefined") return;
    modelsLoadStarted = true;
    const loader = new GLTFLoader();

    const loadStatic = (onDone, url, label) => {
      loader.load(url, (gltf) => {
        const model = gltf.scene;
        autoScaleGround(model, MODEL_HEIGHT);
        model.traverse((o) => {
          if (o.isMesh) {
            o.castShadow = true; o.receiveShadow = true;
            const mats = Array.isArray(o.material) ? o.material : [o.material];
            for (const mat of mats) {
              if (!mat) continue;
              for (const key of ["map", "normalMap", "roughnessMap", "metalnessMap", "emissiveMap"]) {
                if (mat[key]) mat[key].anisotropy = maxAniso;
              }
            }
          }
        });
        onDone(model);
      }, undefined, (err) => console.warn(`تعذر تحميل نموذج ${label} — استخدام الشكل الافتراضي`, err));
    };

    loadStatic((m) => { salimTemplate = m; }, "models/old_gentleman.glb", "العم سالم");
    loadStatic((m) => { regularTemplates.blueThobe = m; }, "models/blue_thobe.glb", "الثوب الأزرق");
    loadStatic((m) => { regularTemplates.businessman = m; }, "models/businessman.glb", "رجل الأعمال");
    loadStatic((m) => { regularTemplates.emeraldRobed = m; }, "models/emerald_robed.glb", "الجلباب الزمردي");
    loadStatic((m) => { regularTemplates.jollyPortly = m; }, "models/jolly_portly.glb", "الرجل البشوش");
    loadStatic((m) => { regularTemplates.littleBackpacker = m; }, "models/little_backpacker.glb", "خليل");
    loadStatic((m) => { regularTemplates.thumbsUpHandyman = m; }, "models/thumbs_up_handyman.glb", "أبو شاكر الفني");
    loadStatic((m) => { regularTemplates.veiledInBlack = m; }, "models/veiled_in_black.glb", "المنقبة");
    loadStatic((m) => { regularTemplates.grandpaCane = m; }, "models/grandpa_cane.glb", "الخواجة إدوارد");
    loadStatic((m) => { regularTemplates.constructionExec = m; }, "models/construction_exec.glb", "زبون (تنفيذي)");
    loadStatic((m) => { regularTemplates.grayKurta = m; }, "models/gray_kurta.glb", "زبون (كردتة رمادية)");
    loadStatic((m) => { regularTemplates.clockworkGentleman = m; }, "models/clockwork_gentleman.glb", "زبون (الساعاتي)");
    loadStatic((m) => { regularTemplates.walkingWisdom = m; }, "models/walking_wisdom.glb", "شيخ يوسف");
    loadStatic((m) => { regularTemplates.midnightElegance = m; }, "models/midnight_elegance.glb", "مفتش وزارة التجارة");
    loadStatic((m) => { regularTemplates.casualChic = m; }, "models/casual_chic.glb", "زبونة (عصرية)");
    loadStatic((m) => { regularTemplates.casualChicHijab = m; }, "models/casual_chic_hijab.glb", "زبونة (حجاب)");
    loadStatic((m) => { regularTemplates.midnightAbaya = m; }, "models/midnight_abaya.glb", "زبونة (عباءة)");
  }

  /* ألوان عباءة متنوعة للمنقبة (تلوين حقيقي: مضروب بالتكستر + لمسة توهج خفيفة على الظل) */
  const ABAYA_TINTS = [
    { color: 0xffffff, emissive: 0x000000 }, // أسود أصلي
    { color: 0xb5677a, emissive: 0x330010 }, // كستنائي
    { color: 0x6f86b5, emissive: 0x001433 }, // كحلي
    { color: 0x6fb590, emissive: 0x00330f }, // أخضر داكن
    { color: 0x9b7ab5, emissive: 0x1c0033 }, // بنفسجي داكن
    { color: 0xb59b7a, emissive: 0x241800 }, // بني داكن
  ];

  /* شخصية منقّبة من نموذج GLTF حقيقي، بلون عباءة عشوائي لكل زبونة (نفس النموذج، تنويع بالتلوين) */
  function buildFemaleFromModel(c) {
    const g = new THREE.Group();
    const model = regularTemplates.veiledInBlack.clone(true);
    g.add(model);
    const tint = c._tint || (c._tint = ABAYA_TINTS[Math.floor(Math.random() * ABAYA_TINTS.length)]);
    let headMat = null;
    model.traverse((o) => {
      if (o.isMesh) {
        o.material = o.material.clone(); // مادة خاصة لكل نسخة كي لا يتغير لون بقية الزبونات
        o.material.color.setHex(tint.color);
        o.material.emissive.setHex(tint.emissive);
        if (!headMat) headMat = o.material;
      }
    });
    g.add(groundShadow());
    return { group: g, head: null, headMat, height: MODEL_HEIGHT, mouths: null };
  }

  /* شكل مؤقت بسيط (بدون تفاصيل) يظهر فقط في الثانية الأولى النادرة قبل اكتمال تحميل النماذج */
  function buildLoadingPlaceholder() {
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.45, 1.6, 4, 8), mat(0x9e9e9e));
    body.position.y = 1.25;
    g.add(body);
    g.add(groundShadow());
    return { group: g, head: null, headMat: body.material, height: MODEL_HEIGHT, mouths: null };
  }

  /* غلاف علوي فارغ: حلقة الرسم تكتب فوق group.position.y كل إطار (اهتزاز المشي)،
     فلازم تبقى إزاحة "تثبيت القدمين على الأرض" على النموذج الابن لا الغلاف نفسه */
  function buildStaticFromModel(template) {
    const g = new THREE.Group();
    const model = template.clone(true);
    g.add(model);
    let headMat = null;
    g.traverse((o) => { if (o.isMesh && !headMat) headMat = o.material; });
    g.add(groundShadow());
    return { group: g, head: null, headMat, height: MODEL_HEIGHT, mouths: null };
  }

  /* موظف البلدية: بذلة كاكي/زيتونية رسمية + قبعة + شارة + لوحة تفتيش — مختلف بصرياً عن مفتش وزارة التجارة */
  function buildMunicipalityOfficer() {
    const g = new THREE.Group();
    const skin = 0xdba876;
    const uniform = 0x5d6b3f; // كاكي زيتوني

    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.46, 0.85, 1.9, 24), mat(uniform));
    body.position.y = 0.95;
    g.add(body);

    const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.2, 0.28, 16), mat(skin));
    neck.position.y = 1.92;
    g.add(neck);
    for (const side of [-1, 1]) {
      const sh = new THREE.Mesh(new THREE.SphereGeometry(0.26, 16, 12), mat(uniform));
      sh.position.set(side * 0.4, 1.76, 0.02);
      g.add(sh);
    }
    for (const side of [-1, 1]) {
      const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.13, 0.85, 14), mat(uniform));
      arm.position.set(side * 0.58, 1.35, 0.05);
      arm.rotation.z = side * 0.32;
      g.add(arm);
      const hand = new THREE.Mesh(new THREE.SphereGeometry(0.13, 12, 10), mat(skin));
      hand.position.set(side * 0.72, 0.95, 0.08);
      g.add(hand);
    }

    // شارة رسمية على الصدر
    const badge = new THREE.Mesh(new THREE.CircleGeometry(0.1, 16), new THREE.MeshStandardMaterial({ color: 0xffd166, roughness: 0.3, metalness: 0.6 }));
    badge.position.set(-0.28, 1.5, 0.44);
    g.add(badge);

    const headMat = mat(skin);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.5, 28, 22), headMat);
    head.position.y = 2.15;
    g.add(head);

    const darkSkin = new THREE.Color(skin).multiplyScalar(0.82).getHex();
    for (const sx of [-0.19, 0.19]) {
      const white = new THREE.Mesh(new THREE.SphereGeometry(0.115, 12, 10), mat(0xffffff));
      white.position.set(sx, 2.24, 0.40);
      white.scale.z = 0.55;
      g.add(white);
      const iris = new THREE.Mesh(new THREE.SphereGeometry(0.055, 10, 8), mat(0x4e342e));
      iris.position.set(sx, 2.24, 0.47);
      g.add(iris);
      const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.028, 8, 8), mat(0x0d0704));
      pupil.position.set(sx, 2.24, 0.51);
      g.add(pupil);
      const brow = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.06, 0.05), mat(0x2a1f14));
      brow.position.set(sx, 2.42, 0.42);
      brow.rotation.z = sx < 0 ? 0.12 : -0.12;
      g.add(brow);
    }
    const nose = new THREE.Mesh(new THREE.SphereGeometry(0.085, 10, 8), mat(darkSkin));
    nose.position.set(0, 2.12, 0.48);
    nose.scale.set(0.9, 1.15, 0.9);
    g.add(nose);

    const my = 1.93, mz = 0.46;
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

    // قبعة رسمية بمظلة
    const cap = new THREE.Mesh(new THREE.SphereGeometry(0.53, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2), mat(0x3f4a2c));
    cap.position.y = 2.32;
    g.add(cap);
    const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.56, 0.56, 0.04, 20), mat(0x2f3720));
    brim.position.set(0, 2.2, 0.08);
    g.add(brim);

    // لوحة تفتيش بيده
    const board = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.46, 0.05), new THREE.MeshStandardMaterial({ color: 0x8d6e63, roughness: 0.5 }));
    board.position.set(0.78, 0.85, 0.14);
    g.add(board);
    const paper = new THREE.Mesh(new THREE.PlaneGeometry(0.26, 0.36), mat(0xf5f0e6));
    paper.position.set(0.78, 0.85, 0.17);
    g.add(paper);

    const shadow = groundShadow();
    g.add(shadow);
    g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    return { group: g, head, headMat, height: 2.95, mouths: { happy, mid, sad } };
  }

  /* جدار جانبي عمودي بباب خروج — يواجه الكاميرا مباشرة (نفس اتجاه النوافذ الخلفية) */
  function buildDoorGroup() {
    const grp = new THREE.Group();

    // جدار جانبي عريض يحيط بالمطعم من هذا الطرف
    const sideWall = new THREE.Mesh(new THREE.PlaneGeometry(2.9, 8.5), wallMat);
    sideWall.position.set(0, 4, -0.6);
    sideWall.receiveShadow = true;
    grp.add(sideWall);

    // إطار الباب الخشبي
    const frameMat = new THREE.MeshStandardMaterial({ color: 0x6d4c2f, roughness: 0.6 });
    const frame = new THREE.Mesh(new THREE.BoxGeometry(1.75, 3.05, 0.16), frameMat);
    frame.position.set(0, 1.55, -0.2);
    frame.castShadow = true;
    grp.add(frame);

    // فتحة الباب: منظر ليلي خارجي يوحي بخروج حقيقي من المطعم
    const opening = new THREE.Mesh(new THREE.PlaneGeometry(1.45, 2.65),
      new THREE.MeshBasicMaterial({ map: windowTexture() }));
    opening.position.set(0, 1.55, -0.11);
    grp.add(opening);

    // عتبة الباب
    const sill = new THREE.Mesh(new THREE.BoxGeometry(1.85, 0.09, 0.32),
      new THREE.MeshStandardMaterial({ color: 0x8d6e63, roughness: 0.6 }));
    sill.position.set(0, 0.045, 0.02);
    sill.receiveShadow = true;
    grp.add(sill);

    // لافتة "الخروج" فوق الباب
    const signMesh = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 0.56),
      new THREE.MeshBasicMaterial({ map: exitSignTexture() }));
    signMesh.position.set(0, 3.25, -0.11);
    grp.add(signMesh);

    return grp;
  }

  function buildRoom() {
    // أرضية خشبية بتكستر حقيقي
    const woodTex = woodTexture();
    woodTex.wrapS = woodTex.wrapT = THREE.RepeatWrapping;
    woodTex.repeat.set(4, 2);
    floorMat = new THREE.MeshStandardMaterial({ map: woodTex, roughness: 0.55, metalness: 0.08 });
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(34, 16), floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    scene.add(floor);

    // جدار خلفي بتكستر جبس
    wallMat = new THREE.MeshStandardMaterial({ map: wallTexture(), roughness: 0.9 });
    const wall = new THREE.Mesh(new THREE.PlaneGeometry(34, 10), wallMat);
    wall.position.set(0, 5, -3.2);
    wall.receiveShadow = true;
    scene.add(wall);

    // جداران جانبيان بباب خروج حقيقي — الزبون يمشي نحوهما ليخرج فعلياً من المطعم
    leftDoorGroup = buildDoorGroup();
    leftDoorGroup.position.x = -(slotSpread + 2.7);
    scene.add(leftDoorGroup);
    rightDoorGroup = buildDoorGroup();
    rightDoorGroup.position.x = slotSpread + 2.7;
    scene.add(rightDoorGroup);

    // لوحة نيون بنص عربي حقيقي
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(7.6, 1.9),
      new THREE.MeshBasicMaterial({ map: signTexture() }));
    sign.position.set(0, 5.7, -3.05);
    scene.add(sign);
    const signGlow = new THREE.PointLight(0xff9f43, 1.6, 9);
    signGlow.position.set(0, 5.6, -2.2);
    scene.add(signGlow);

    // نوافذ تطل على مدينة المستقبل ليلاً
    const winTex = windowTexture();
    for (const sx of [-6.8, 6.8]) {
      const frame = new THREE.Mesh(new THREE.BoxGeometry(2.9, 2.5, 0.12), mat(0x3a2a5a));
      frame.position.set(sx, 4.4, -3.12);
      scene.add(frame);
      const win = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 2.2),
        new THREE.MeshBasicMaterial({ map: winTex }));
      win.position.set(sx, 4.4, -3.05);
      scene.add(win);
    }

    // لوحة منيو معلقة
    const board = new THREE.Mesh(new THREE.PlaneGeometry(1.9, 2.4),
      new THREE.MeshStandardMaterial({ map: menuBoardTexture(), roughness: 0.85 }));
    board.position.set(-4.2, 4.6, -3.05);
    scene.add(board);

    // ساعة حائط تعكس وقت اليوم
    const clock = new THREE.Group();
    const rim = new THREE.Mesh(new THREE.TorusGeometry(0.55, 0.07, 10, 24), mat(0x8d6e63));
    clock.add(rim);
    const face = new THREE.Mesh(new THREE.CircleGeometry(0.52, 24), mat(0xf5f0e6));
    face.position.z = -0.02;
    clock.add(face);
    const hHand = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.3, 0.02), mat(0x222222));
    hHand.position.y = 0.12;
    const hPivot = new THREE.Group(); hPivot.add(hHand); hPivot.position.z = 0.03;
    const mHand = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.42, 0.02), mat(0xc0392b));
    mHand.position.y = 0.18;
    const mPivot = new THREE.Group(); mPivot.add(mHand); mPivot.position.z = 0.04;
    clock.add(hPivot); clock.add(mPivot);
    clock.position.set(4.2, 5.2, -3.05);
    scene.add(clock);
    clockHands = { hPivot, mPivot };

    // كاونتر رخامي على قاعدة خشبية
    const counter = new THREE.Mesh(new THREE.BoxGeometry(16, 0.9, 1.1), mat(0x4e342e));
    counter.position.set(0, 0.45, 2.6);
    counter.castShadow = true; counter.receiveShadow = true;
    scene.add(counter);
    const slab = new THREE.Mesh(new THREE.BoxGeometry(16.3, 0.13, 1.3),
      new THREE.MeshStandardMaterial({ color: 0xd7ccc8, roughness: 0.25, metalness: 0.15 }));
    slab.position.set(0, 0.96, 2.6);
    slab.receiveShadow = true;
    scene.add(slab);

    // سيخ شاورما دوار + بخار
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 2.6, 8),
      new THREE.MeshStandardMaterial({ color: 0xbdbdbd, roughness: 0.3, metalness: 0.8 }));
    pole.position.set(6.4, 1.9, 0.6);
    scene.add(pole);
    spitMeat = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.7, 1.5, 12), mat(0xa9743f, 0x2a1808));
    spitMeat.position.set(6.4, 2.0, 0.6);
    spitMeat.castShadow = true;
    scene.add(spitMeat);
    // جسيمات البخار
    const steamTex = canvasTexture(64, 64, (g) => {
      const gr = g.createRadialGradient(32, 32, 4, 32, 32, 30);
      gr.addColorStop(0, "rgba(255,255,255,.65)");
      gr.addColorStop(1, "rgba(255,255,255,0)");
      g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
    });
    for (let i = 0; i < 7; i++) {
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: steamTex, transparent: true, opacity: 0 }));
      sp.scale.setScalar(0.5);
      sp.position.set(6.4, 2.9, 0.6);
      sp.userData.phase = i / 7;
      scene.add(sp);
      steam.push(sp);
    }

    // أصناف معروضة على الكاونتر
    const displays = [["burger", -4.4], ["fries", -5.6], ["drink", -6.7]];
    for (const [k, x] of displays) {
      const m = makeDishModel(k);
      m.scale.setScalar(1.15);
      m.position.set(x, 1.03, 2.5);
      m.rotation.y = Math.random() * Math.PI;
      m.traverse(o => { if (o.isMesh) o.castShadow = true; });
      scene.add(m);
    }

    // إضاءات معلقة دافئة (نقطية حقيقية)
    for (const sx of [-3.5, 0, 3.5]) {
      const cord = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 1.4, 6), mat(0x222222));
      cord.position.set(sx, 6.5, -0.5);
      scene.add(cord);
      const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.22, 12, 10),
        new THREE.MeshStandardMaterial({ color: 0xffe9a8, emissive: 0xd6a94f, emissiveIntensity: 1.4 }));
      bulb.position.set(sx, 5.8, -0.5);
      scene.add(bulb);
      const pl = new THREE.PointLight(0xffd9a0, 0.65, 9);
      pl.position.set(sx, 5.6, -0.3);
      scene.add(pl);
    }

    // المساعد الآلي (يظهر عند شرائه)
    robot = new THREE.Group();
    const rBody = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.38, 0.62, 14),
      new THREE.MeshStandardMaterial({ color: 0xdfe6e9, roughness: 0.3, metalness: 0.6 }));
    rBody.position.y = 0.32;
    robot.add(rBody);
    const rHead = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.34, 0.4),
      new THREE.MeshStandardMaterial({ color: 0xb2bec3, roughness: 0.3, metalness: 0.6 }));
    rHead.position.y = 0.85;
    robot.add(rHead);
    const rEye = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.08, 0.02),
      new THREE.MeshStandardMaterial({ color: 0x00e5ff, emissive: 0x00b8d4, emissiveIntensity: 2 }));
    rEye.position.set(0, 0.87, 0.21);
    robot.add(rEye);
    const ant = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.22, 6), mat(0x636e72));
    ant.position.y = 1.12;
    robot.add(ant);
    const antTip = new THREE.Mesh(new THREE.SphereGeometry(0.045, 8, 6),
      new THREE.MeshStandardMaterial({ color: 0xff5252, emissive: 0xd32f2f, emissiveIntensity: 2 }));
    antTip.position.y = 1.25;
    robot.add(antTip);
    robot.position.set(4.6, 1.02, 2.5);
    robot.visible = false;
    robot.traverse(o => { if (o.isMesh) o.castShadow = true; });
    scene.add(robot);
  }

  /* واجهات للتحكم من اللعبة */
  api.setClock = function (progress) { // 0..1 من اليوم
    if (!clockHands) return;
    clockHands.mPivot.rotation.z = -progress * Math.PI * 2 * 4;
    clockHands.hPivot.rotation.z = -progress * Math.PI * 2 * 0.5 - 1;
  };
  api.setRobot = function (on) { if (robot) robot.visible = on; };
  api.robotPing = function () { if (robot) robot.userData.hop = 1; };

  /* ثيمات الديكور */
  const THEMES = {
    classic: { wall: 0xffffff, floor: 0xffffff, fog: 0x1a1035 },
    neon:    { wall: 0x7d6bff, floor: 0x9a8bd0, fog: 0x120b2e },
    desert:  { wall: 0xffcf9e, floor: 0xffb870, fog: 0x2e1e10 },
  };
  api.setTheme = function (name) {
    const t = THEMES[name] || THEMES.classic;
    if (wallMat) wallMat.color.setHex(t.wall);
    if (floorMat) floorMat.color.setHex(t.floor);
    if (scene && scene.fog) scene.fog.color.setHex(t.fog);
  };

  /* عملات ذهبية تطير عند الدفع */
  api.flyCoins = function (uid, n) {
    if (!api.active) return;
    const e = chars.get(uid);
    if (!e) return;
    for (let i = 0; i < Math.min(n, 6); i++) {
      const coin = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.03, 12),
        new THREE.MeshStandardMaterial({ color: 0xffd166, emissive: 0xb8860b, emissiveIntensity: 0.7, roughness: 0.35, metalness: 0.3 }));
      coin.position.set(e.group.position.x + (Math.random() - 0.5) * 0.6, 1.8, 0.5);
      coin.rotation.x = Math.PI / 2;
      scene.add(coin);
      flying.push({ m: coin, t: -i * 0.08, from: coin.position.clone(),
        toE: { group: { position: new THREE.Vector3(0, 6.5, -1) } }, coin: true });
    }
  };

  /* ---------- تهيئة ---------- */
  api.init = function (containerEl, overlayEl) {
    if (typeof THREE === "undefined") return false;
    try {
      container = containerEl;
      overlayLayer = overlayEl;
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
      renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
      renderer.shadowMap.enabled = true;
      renderer.shadowMap.type = THREE.PCFSoftShadowMap;
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.15;
      if ("outputColorSpace" in renderer) renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.domElement.id = "canvas3d";
      container.prepend(renderer.domElement);
      maxAniso = renderer.capabilities.getMaxAnisotropy();

      scene = new THREE.Scene();
      scene.fog = new THREE.Fog(0x1a1035, 16, 34);
      camera = new THREE.PerspectiveCamera(42, 1, 0.1, 60);
      camera.position.set(0, 3.3, 9.0);
      camera.lookAt(0, 2.05, 0);

      scene.add(new THREE.HemisphereLight(0xfff2e0, 0x2d1b4e, 0.9));
      const sun = new THREE.DirectionalLight(0xfff4e0, 1.5);
      sun.position.set(4, 9, 6);
      sun.castShadow = true;
      sun.shadow.mapSize.set(2048, 2048);
      sun.shadow.camera.left = -12; sun.shadow.camera.right = 12;
      sun.shadow.camera.top = 12; sun.shadow.camera.bottom = -6;
      sun.shadow.camera.near = 1; sun.shadow.camera.far = 30;
      sun.shadow.bias = -0.002;
      scene.add(sun);
      // إضاءة تعبئة ناعمة من جهة الكاميرا — تنوّر الوجه المقابل للشمس (إضاءة ثلاثية الاتجاه)
      const fill = new THREE.DirectionalLight(0xd6e4ff, 0.5);
      fill.position.set(-3, 4, 8);
      scene.add(fill);
      // إضاءة حافة خلفية خفيفة تفصل الشخصيات عن الخلفية (لمعان المجسمات الجاهزة)
      const rim = new THREE.PointLight(0xfff0d0, 0.55, 14);
      rim.position.set(0, 5, -1.5);
      scene.add(rim);

      buildRoom();
      preloadRealModels();

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
    // حرّك بابي الخروج مع تغيّر عرض الشاشة كي يبقيا عند حافة منطقة الوقوف
    if (leftDoorGroup) leftDoorGroup.position.x = -(slotSpread + 2.7);
    if (rightDoorGroup) rightDoorGroup.position.x = slotSpread + 2.7;
  }

  function slotX(i, n) {
    if (n <= 1) return 0;
    return -slotSpread + (2 * slotSpread * i) / (n - 1);
  }

  /* تلوين مادة (أو أكثر) للتعبير عن المزاج — بعض الشخصيات (الثوب الأزرق) لها مادتان (هيكل متحرك + نموذج ثابت) */
  function tintEmissive(e, hex) {
    const col = new THREE.Color(hex);
    const mats = Array.isArray(e.headMat) ? e.headMat : [e.headMat];
    for (const m of mats) if (m) m.emissive = col;
  }

  /* ---------- مزامنة الزبائن مع game.js ---------- */
  api.sync = function (customers) {
    const seen = new Set();
    customers.forEach((c, i) => {
      seen.add(c.uid);
      let e = chars.get(c.uid);
      if (!e) {
        const built = makeCharacter(c);
        if (c.scaleVar && !c.vip) {
          built.group.scale.multiplyScalar(c.scaleVar);
          built.height *= c.scaleVar;
        }
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
    e.leaveT = 0;
    e.leaveScale = e.group.scale.x || 1;
    if (!happy) tintEmissive(e, 0x661111);
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

    // بخار الشاورما المتصاعد
    for (const sp of steam) {
      const p = ((now / 4000) + sp.userData.phase) % 1;
      sp.position.y = 2.8 + p * 1.7;
      sp.position.x = 6.4 + Math.sin(p * 8 + sp.userData.phase * 6) * 0.18;
      sp.material.opacity = (p < 0.15 ? p / 0.15 : 1 - p) * 0.45;
      sp.scale.setScalar(0.4 + p * 0.8);
    }

    // المساعد الآلي: تمايل + قفزة عند الطبخ
    if (robot && robot.visible) {
      robot.rotation.y = Math.sin(now / 900) * 0.35;
      let hopY = 0;
      if (robot.userData.hop > 0) {
        hopY = Math.sin(robot.userData.hop * Math.PI) * 0.28;
        robot.userData.hop -= dt * 2.2;
      }
      robot.position.y = 1.02 + hopY;
    }

    // الأطباق والعملات الطائرة
    for (let i = flying.length - 1; i >= 0; i--) {
      const f = flying[i];
      f.t += dt / 0.55;
      const k = Math.max(0, Math.min(f.t, 1));
      const to = f.toE.group.position;
      f.m.position.lerpVectors(f.from, new THREE.Vector3(to.x, f.coin ? to.y : 1.5, f.coin ? to.z : 0.5), k);
      f.m.position.y += Math.sin(k * Math.PI) * 1.3;
      f.m.rotation.y += dt * 6;
      if (f.t >= 1) { scene.remove(f.m); flying.splice(i, 1); }
    }

    for (const e of chars.values()) {
      e.t += dt;
      const g = e.group;
      if (e.leaving) {
        // خروج: يمشي واقفاً نحو باب المطعم (سعيد يمين بثبات / زعلان يسار بخطوات سريعة)
        e.leaveT += dt;
        const speed = e.leaving > 0 ? 6.2 : 8.5;
        g.position.x += (e.leaving > 0 ? speed : -speed) * dt;
        g.position.y = Math.max(0, Math.sin(e.leaveT * 15) * 0.1); // خطوات مشي طبيعية
        g.rotation.z = Math.sin(e.leaveT * 15) * 0.05; // تمايل بسيط فقط، بدون انقلاب
        g.rotation.y = e.leaving > 0 ? -0.3 : 0.3; // يستدير نحو اتجاه خروجه
        const shrink = Math.max(0.2, 1 - e.leaveT * 0.7); // يصغر تدريجياً وهو يبتعد (منظور الخروج)
        g.scale.setScalar(e.leaveScale * shrink);
      } else {
        // انزلاق نحو مكان الوقوف
        const distToSlot = Math.abs(e.slotX - g.position.x);
        g.position.x += (e.slotX - g.position.x) * Math.min(1, dt * 4);
        // أثناء الدخول: تمايل مشي أوضح وأسرع (يحاكي الخطوات) — بعد الوصول: تمايل هادئ يوحي بالحياة أثناء الانتظار
        const walking = distToSlot > 0.06;
        const bobFreq = walking ? 9 : 2.1;
        const bobAmp = walking ? 0.09 : 0.045;
        g.position.y = Math.sin(e.t * bobFreq) * bobAmp;
        // اهتزاز غضب عند قرب نفاد الصبر (يطغى على التمايل العادي)
        const c = e.cust;
        const r = c ? c.patience / c.maxPatience : 1;
        if (r < 0.3) {
          g.rotation.z = Math.sin(e.t * 30) * 0.05;
          tintEmissive(e, 0x551111);
        } else {
          // تمايل جانبي خفيف متزامن مع الحركة الرأسية (كأنه يحرك وزنه بين قدميه)
          g.rotation.z = Math.sin(e.t * bobFreq) * (walking ? 0.035 : 0.012);
          tintEmissive(e, 0x000000);
        }
        // الفم يتبع المزاج
        if (e.mouths) {
          e.mouths.happy.visible = r > 0.55;
          e.mouths.mid.visible = r <= 0.55 && r > 0.3;
          e.mouths.sad.visible = r <= 0.3;
        }
      }
      // تموضع طبقة الفقاعات فوق الرأس — بحد أدنى يمنع خروجها من أعلى الشاشة
      // (يحصل بالوضع العرضي حيث ارتفاع منطقة الزبائن يصير صغير نسبياً)
      if (e.ov) {
        const v = new THREE.Vector3(g.position.x, e.height * g.scale.y + 0.15, g.position.z);
        v.project(camera);
        const w = container.clientWidth, h = container.clientHeight;
        const topPx = (-v.y * 0.5 + 0.5) * h;
        e.ov.style.left = ((v.x * 0.5 + 0.5) * w) + "px";
        e.ov.style.top = Math.max(topPx, Math.min(105, h * 0.4)) + "px";
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
