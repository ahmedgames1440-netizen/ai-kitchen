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

  /* ---------- مواد وألوان (PBR واقعية) ---------- */
  const SKINS = [0xeeb98c, 0xdba876, 0xf2c49b, 0xc98e63];
  const THOBES = [0xf5f5f5, 0xdfe6e9, 0xcfd8dc, 0x90a4ae, 0x6d4c2f, 0x4e6e5d];
  const mat = (color, emissive = 0x000000) =>
    new THREE.MeshStandardMaterial({ color, emissive, roughness: 0.72, metalness: 0.04 });

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

  /* ---------- بناء شخصية كرتونية ---------- */
  function makeCharacter(c) {
    const g = new THREE.Group();
    const rnd = (arr) => arr[Math.floor(Math.random() * arr.length)];
    const skin = rnd(SKINS);
    const vip = c.vip || null;
    const female = c.gender === "f" && !vip;

    const bodyColor =
      female ? rnd([0x1a1a1a, 0x241b3a, 0x3d1626, 0x14251c]) : // عباءات
      vip === "khalil" ? 0x6d4c2f :
      vip === "salim"  ? 0x8d7350 :
      vip === "fanni"  ? 0x1976d2 : // أفرول الفني الأزرق
      vip === "edward" ? 0x8d6e63 : // جاكيت تويد
      vip ? 0xf5f5f5 : rnd(THOBES);

    // الجسم (ثوب / عباءة)
    const body = new THREE.Mesh(new THREE.CylinderGeometry(female ? 0.4 : 0.45, female ? 0.8 : 0.85, 1.9, 12), mat(bodyColor));
    body.position.y = 0.95;
    g.add(body);

    // رقبة وأكتاف — قوام أقرب للواقع
    const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.2, 0.28, 10), mat(female ? bodyColor : skin));
    neck.position.y = 1.92;
    g.add(neck);
    for (const side of [-1, 1]) {
      const sh = new THREE.Mesh(new THREE.SphereGeometry(0.26, 10, 8), mat(bodyColor));
      sh.position.set(side * 0.4, 1.76, 0.02);
      g.add(sh);
    }

    // ذراعان بكفوف — تعطي واقعية كبيرة للقوام
    for (const side of [-1, 1]) {
      const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.13, 0.85, 8), mat(bodyColor));
      arm.position.set(side * 0.58, 1.35, 0.05);
      arm.rotation.z = side * 0.32;
      g.add(arm);
      const hand = new THREE.Mesh(new THREE.SphereGeometry(0.13, 8, 7), mat(skin));
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
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.5, 16, 14), headMat);
    head.position.y = 2.15;
    if (vip === "salim") head.scale.y = 1.28;
    g.add(head);

    // ===== الوجه: ملامح واضحة =====
    const darkSkin = new THREE.Color(skin).multiplyScalar(0.82).getHex();
    const hairColor = (vip === "yousef" || vip === "salim" || vip === "samir" || vip === "edward") ? 0xd7d7d7 : 0x3a2a1a;
    // عيون كرتونية: بياض + بؤبؤ + لمعة (المنقبات: العيون فوق فتحة النقاب)
    const eyeZ = female ? 0.57 : 0.40; // عيون المنقبات بارزة أمام الحجاب
    for (const sx of [-0.19, 0.19]) {
      const white = new THREE.Mesh(new THREE.SphereGeometry(0.115, 12, 10), mat(0xffffff));
      white.position.set(sx, 2.24, eyeZ);
      white.scale.z = female ? 0.4 : 0.55;
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
      // رموش للمنقبات
      if (female) {
        const lash = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.03, 0.03), mat(0x1a1a1a));
        lash.position.set(sx, 2.32, eyeZ + 0.06);
        lash.rotation.z = sx < 0 ? 0.1 : -0.1;
        g.add(lash);
      }
      // حواجب (الفهد له حواجبه الغاضبة الخاصة، والمنقبات وجههن مغطى)
      if (vip !== "fahad" && !female) {
        const brow = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.06, 0.05), mat(hairColor));
        brow.position.set(sx, 2.42, 0.42);
        brow.rotation.z = sx < 0 ? 0.12 : -0.12;
        g.add(brow);
      }
    }
    // أنف (مغطى عند المنقبات)
    if (!female) {
      const nose = new THREE.Mesh(new THREE.SphereGeometry(0.085, 10, 8), mat(darkSkin));
      nose.position.set(0, 2.12, 0.48);
      nose.scale.set(0.9, 1.15, 0.9);
      g.add(nose);
    }
    // فم يتغير مع المزاج (مبتسم / محايد / عابس) — لحية الشيخ والنقاب يغطيانه
    let mouths = null;
    if (vip !== "yousef" && !female) {
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
        ? new THREE.MeshStandardMaterial({ map: getShemaghTexture(), roughness: 0.85, side: THREE.DoubleSide })
        : new THREE.MeshStandardMaterial({ color, roughness: 0.85, side: THREE.DoubleSide });
      const gh = new THREE.Mesh(new THREE.SphereGeometry(0.56, 16, 12), clothMat());
      gh.position.y = 2.32;
      gh.scale.set(1, 0.78, 1);
      g.add(gh);
      // أطراف تغطي الخلف والجوانب وتنسدل أطول (الوجه مكشوف)
      const flap = new THREE.Mesh(
        new THREE.CylinderGeometry(0.56, 0.7, 0.75, 12, 1, true, Math.PI * 0.3, Math.PI * 1.4),
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

    if (female) {
      // حجاب كامل + نقاب: تظهر العيون فقط، مع غطاء يتدلى على الكتفين
      const hijab = new THREE.Mesh(new THREE.SphereGeometry(0.57, 16, 14), mat(bodyColor));
      hijab.position.y = 2.18;
      g.add(hijab);
      const veil = new THREE.Mesh(
        new THREE.CylinderGeometry(0.5, 0.78, 1.05, 12, 1, true),
        new THREE.MeshStandardMaterial({ color: bodyColor, side: THREE.DoubleSide, roughness: 0.85 })
      );
      veil.position.y = 1.72;
      g.add(veil);
      // فتحة العيون (البرقع) — بارزة قدام سطح الحجاب
      const strip = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.18, 0.1), mat(skin));
      strip.position.set(0, 2.25, 0.54);
      g.add(strip);
    } else if (vip === "inspector") {
      addEars();
      addGhutra(0xc0392b, true, true); // شماغ رسمي منقوش
      // نظارة رسمية
      for (const sx of [-0.18, 0.18]) {
        const lens = new THREE.Mesh(new THREE.TorusGeometry(0.13, 0.022, 8, 16), mat(0x263238));
        lens.position.set(sx, 2.24, 0.46);
        g.add(lens);
      }
      const bridge = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.028, 0.028), mat(0x263238));
      bridge.position.set(0, 2.24, 0.47);
      g.add(bridge);
      // حقيبة رسمية بيده
      const bag = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.3, 0.12),
        new THREE.MeshStandardMaterial({ color: 0x3e2723, roughness: 0.4 }));
      bag.position.set(0.78, 0.72, 0.14);
      g.add(bag);
      const handle = new THREE.Mesh(new THREE.TorusGeometry(0.08, 0.02, 6, 12, Math.PI), mat(0x2a1a12));
      handle.position.set(0.78, 0.88, 0.14);
      g.add(handle);
    } else if (vip === "yousef") {
      addGhutra(0xffffff);
      // لحية طويلة بيضاء
      const beard = new THREE.Mesh(new THREE.ConeGeometry(0.3, 0.95, 10), mat(0xfafafa));
      beard.rotation.x = Math.PI;
      beard.position.set(0, 1.66, 0.3);
      g.add(beard);
    } else if (vip === "fahad") {
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
    } else if (vip === "fanni") {
      // الفني: كاب أزرق بمقدمة رمادية + أفرول وقميص أبيض + مفتاح ربط أحمر (مثل الصورة)
      addEars();
      const cap = new THREE.Mesh(new THREE.SphereGeometry(0.54, 14, 10, 0, Math.PI * 2, 0, Math.PI / 2), mat(0x1565c0));
      cap.position.y = 2.34;
      g.add(cap);
      const capTop = new THREE.Mesh(new THREE.SphereGeometry(0.42, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), mat(0xcfd8dc));
      capTop.position.y = 2.44;
      g.add(capTop);
      const brim = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.05, 0.34), mat(0x1565c0));
      brim.position.set(0, 2.4, 0.5);
      brim.rotation.x = -0.12;
      g.add(brim);
      // صدر القميص الأبيض + حمالات الأفرول
      const chest = new THREE.Mesh(new THREE.CylinderGeometry(0.47, 0.58, 0.62, 12), mat(0xf5f5f5));
      chest.position.y = 1.56;
      g.add(chest);
      for (const side of [-1, 1]) {
        const strap = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.55, 0.06), mat(0x0d47a1));
        strap.position.set(side * 0.22, 1.62, 0.44);
        strap.rotation.x = -0.12;
        g.add(strap);
      }
      // مفتاح الربط الأحمر على كتفه
      const wHandle = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.72, 0.07), mat(0xc62828));
      wHandle.position.set(0.72, 1.35, 0.12);
      wHandle.rotation.z = 0.5;
      g.add(wHandle);
      const wHead = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.24, 0.09),
        new THREE.MeshStandardMaterial({ color: 0x9e9e9e, roughness: 0.3, metalness: 0.7 }));
      wHead.position.set(0.9, 1.68, 0.12);
      wHead.rotation.z = 0.5;
      g.add(wHead);
      // شعر بني تحت الكاب
      const hair = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.1, 0.1), mat(0x4e342e));
      hair.position.set(0, 2.3, -0.42);
      g.add(hair);
    } else if (vip === "edward") {
      // الخواجة: شعر أبيض جانبي + شارب ولحية بيضاء + فست وربطة + عصا (مثل الصورة)
      addEars();
      for (const sx of [-0.44, 0.44]) {
        const hair = new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 7), mat(0xeceff1));
        hair.position.set(sx, 2.34, -0.05);
        hair.scale.set(0.7, 1, 1.1);
        g.add(hair);
      }
      const backHair = new THREE.Mesh(new THREE.SphereGeometry(0.45, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), mat(0xeceff1));
      backHair.rotation.x = Math.PI * 0.55;
      backHair.position.set(0, 2.28, -0.25);
      g.add(backHair);
      // شارب أبيض ضخم + لحية قصيرة
      for (const side of [-1, 1]) {
        const mst = new THREE.Mesh(new THREE.SphereGeometry(0.13, 8, 7), mat(0xfafafa));
        mst.position.set(side * 0.13, 1.99, 0.44);
        mst.scale.set(1.3, 0.6, 0.7);
        g.add(mst);
      }
      const beard = new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.35, 8), mat(0xfafafa));
      beard.rotation.x = Math.PI;
      beard.position.set(0, 1.73, 0.3);
      g.add(beard);
      // فست رمادي + ربطة عنق + ياقة
      const vest = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.72, 0.14), mat(0x546e7a));
      vest.position.set(0, 1.42, 0.36);
      g.add(vest);
      const collar = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.12, 0.1), mat(0xffffff));
      collar.position.set(0, 1.8, 0.4);
      g.add(collar);
      const tie = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.42, 0.06), mat(0x5d1a12));
      tie.position.set(0, 1.58, 0.45);
      g.add(tie);
      // عصا خشبية
      const cane = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 1.15, 8), mat(0x5d4037));
      cane.position.set(0.8, 0.58, 0.2);
      g.add(cane);
      const knob = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 6), mat(0x3e2723));
      knob.position.set(0.8, 1.18, 0.2);
      g.add(knob);
    } else {
      // زبون عادي: غترة بيضاء أو شماغ منقوش (مثل الصور المرجعية)
      const style = Math.random();
      if (style < 0.42) addGhutra(0xffffff);
      else if (style < 0.8) addGhutra(0xc0392b, true, true);
      else { addEars(); } // بدون غطاء
      // لحية عشوائية: سكسوكة سوداء / لحية كاملة / حليق
      const beardCol = rnd([0x141414, 0x2d1e12, 0x3a2a1a]);
      const bStyle = Math.random();
      if (bStyle < 0.4) {
        // سكسوكة + شنب (مثل صورة الشماغ الوردي)
        const goat = new THREE.Mesh(new THREE.ConeGeometry(0.14, 0.32, 8), mat(beardCol));
        goat.rotation.x = Math.PI;
        goat.position.set(0, 1.74, 0.34);
        g.add(goat);
        const mst = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.09, 0.08), mat(beardCol));
        mst.position.set(0, 1.99, 0.45);
        g.add(mst);
      } else if (bStyle < 0.72) {
        // لحية كاملة تحيط بالفك (مثل صورة العيون الخضراء)
        const jaw = new THREE.Mesh(new THREE.TorusGeometry(0.36, 0.11, 8, 16, Math.PI), mat(beardCol));
        jaw.rotation.z = Math.PI;
        jaw.position.set(0, 2.06, 0.28);
        jaw.scale.z = 0.6;
        g.add(jaw);
        const mst = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.1, 0.08), mat(beardCol));
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
    g.traverse(o => { if (o.isMesh) o.castShadow = true; });
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
        new THREE.MeshStandardMaterial({ color: 0xffd166, emissive: 0x8a6b1e, roughness: 0.25, metalness: 0.9 }));
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

      scene = new THREE.Scene();
      scene.fog = new THREE.Fog(0x1a1035, 16, 34);
      camera = new THREE.PerspectiveCamera(42, 1, 0.1, 60);
      camera.position.set(0, 3.3, 9.0);
      camera.lookAt(0, 2.05, 0);

      scene.add(new THREE.HemisphereLight(0xfff2e0, 0x2d1b4e, 0.9));
      const sun = new THREE.DirectionalLight(0xfff4e0, 1.5);
      sun.position.set(4, 9, 6);
      sun.castShadow = true;
      sun.shadow.mapSize.set(1024, 1024);
      sun.shadow.camera.left = -12; sun.shadow.camera.right = 12;
      sun.shadow.camera.top = 12; sun.shadow.camera.bottom = -6;
      sun.shadow.camera.near = 1; sun.shadow.camera.far = 30;
      sun.shadow.bias = -0.002;
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
