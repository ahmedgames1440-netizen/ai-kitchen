#!/usr/bin/env python3
# NOTE: names, scores and photos below are placeholders from a past report. Replace all data with the user's own.
"""Builds report.html (RTL, A4) for the Knowledge Cup report."""
import re, pathlib

B = pathlib.Path(__file__).parent
ICON_DIR = B / "node_modules/@phosphor-icons/core/assets/regular"


def icon(name, size=22):
    svg = (ICON_DIR / f"{name}.svg").read_text()
    svg = re.sub(r'<svg ', f'<svg width="{size}" height="{size}" fill="currentColor" aria-hidden="true" ', svg, count=1)
    return svg


# ---------------------------------------------------------------- data
SCHOOL = "اسم المدرسة"
TEACHERS = "اسم المعلمة الأولى واسم المعلمة الثانية"
PRINCIPAL = "اسم مديرة المدرسة"

CLASSES = [  # name, total, [(subject, score)]
    ("أول ثانوي", 30, [("رياضيات", 5), ("كيمياء", 5), ("تقنية رقمية", 5), ("أحياء", 5), ("إنجليزي", 5), ("دين", 5)]),
    ("ثاني ثانوي شعبة 2", 25.5, [("رياضيات", 3), ("فيزياء", 4), ("أحياء", 5), ("كيمياء", 5), ("تاريخ", 5), ("كفايات", 3.5)]),
    ("ثالث ثانوي شعبة 1", 25, [("كيمياء", 5), ("رياضيات", 4), ("تقنية رقمية", 3), ("فيزياء", 3), ("إنجليزي", 5), ("مهارات إدارية", 5)]),
    ("ثاني ثانوي شعبة 1", 23.5, [("رياضيات", 3), ("فيزياء", 4), ("أحياء", 3), ("كيمياء", 4), ("تاريخ", 5), ("كفايات", 4.5)]),
    ("ثالث ثانوي شعبة 2", 22.5, [("كيمياء", 3), ("رياضيات", 4), ("تقنية رقمية", 3), ("فيزياء", 2.5), ("إنجليزي", 5), ("مهارات إدارية", 5)]),
]
for n, t, rows in CLASSES:
    assert abs(sum(s for _, s in rows) - t) < 1e-9, n
AVG = sum(t for _, t, _ in CLASSES) / len(CLASSES)  # 25.3
AVG_PCT = AVG / 30 * 100


def num(x):
    return f"{x:g}"


# ---------------------------------------------------------------- html pieces
def footer(n):
    return f"""<footer class="pf"><span>تقرير مسابقة «كأس المعرفة»</span><span>{SCHOOL}</span><span class="pn">{n}</span></footer>"""


def fig(src, cap, cls="", pos="center"):
    alt = re.sub(r"<[^>]+>", "", cap)
    return f"""<figure class="fig {cls}"><div class="ph"><img src="img/{src}" style="object-position:{pos}" alt="{alt}"></div><figcaption>{cap}</figcaption></figure>"""


def ranking():
    rows = []
    for i, (name, t, _) in enumerate(CLASSES, 1):
        top = " top" if i == 1 else ""
        rows.append(
            f"""<div class="rk{top}"><span class="rk-n">{i}</span><span class="rk-name">{name}</span>
            <span class="rk-bar"><i style="width:{t/30*100:.1f}%"></i></span><span class="rk-v">{num(t)}<small>/30</small></span></div>"""
        )
    return "\n".join(rows)


def class_card(name, total, rows, rank):
    items = []
    for s, v in rows:
        full = " full" if v == 5 else ""
        items.append(f"<li class='{full.strip()}'><span>{s}</span><b>{num(v)}<small>/5</small></b></li>")
    return f"""<article class="cc"><header><h4>{name}</h4><div class="tot"><b>{num(total)}</b><small>/30</small></div></header>
    <ul>{''.join(items)}</ul></article>"""


mech = [
    ("users-three", "تشكيل فريق ممثل لكل فصل."),
    ("notebook", "إعداد أسئلة مناسبة للمقررات ومستويات الصفوف."),
    ("stack", "تقسيم المسابقة إلى جولات متدرجة الصعوبة."),
    ("timer", "تحديد وقت للإجابة عن كل سؤال."),
    ("chart-bar", "رصد النقاط والإعلان عن الفريق الأعلى مجموعًا."),
    ("trophy", "تكريم الفصل الفائز بكأس المعرفة."),
]
phases = [
    ("الإعداد", "إعداد الأسئلة وتجهيز العرض وآلية احتساب النقاط.", "قبل المسابقة بأسبوع"),
    ("الإعلان", "تعريف الطالبات بالأهداف والشروط وآلية المنافسة.", "قبل المسابقة بأسبوع"),
    ("الاستعداد", "اختيار ممثلات الفصول ومراجعة المقررات المحددة.", "قبل المسابقة بيومين"),
    ("التنفيذ", "طرح الأسئلة وتنفيذ الجولات ورصد النقاط.", "خلال الأسبوع، الحصة السادسة"),
    ("النتائج والتكريم", "إعلان النتائج وتكريم الفريق الفائز وتوثيق النتائج.", "بعد المسابقة"),
]
audience = [
    ("الصف الأول الثانوي", "الشعبة 1", "رياضيات، كيمياء، تقنية رقمية، أحياء، إنجليزي، دين"),
    ("الصف الثاني الثانوي", "الشعبة 1", "رياضيات، فيزياء، أحياء، كيمياء، تاريخ، كفايات"),
    ("الصف الثاني الثانوي", "الشعبة 2", "رياضيات، فيزياء، أحياء، كيمياء، تاريخ، كفايات"),
    ("الصف الثالث الثانوي", "الشعبة 1", "كيمياء، رياضيات، تقنية رقمية، فيزياء، إنجليزي، مهارات إدارية"),
    ("الصف الثالث الثانوي", "الشعبة 2", "كيمياء، رياضيات، تقنية رقمية، فيزياء، إنجليزي، مهارات إدارية"),
]

appendix = [
    ("img09.jpg", "ملصق المسابقة"),
    ("img03.jpg", "سبورة الثالث، شعبة 2"),
    ("img12.jpg", "سبورة الثاني، شعبة 2"),
    ("img04.jpg", "أسئلة الكيمياء"),
    ("img01.jpg", "شرح ورقة الكيمياء"),
    ("img06.jpg", "أسئلة الرياضيات"),
    ("img11.jpg", "اختبار التقنية الرقمية"),
    ("img08.jpg", "أوراق الأسئلة في أغلفتها"),
    ("img05.jpg", "الإجابة في مجموعات"),
    ("img07.jpg", "ورقة الفيزياء"),
    ("img10.jpg", "ورقة الفيزياء، لقطة ثانية"),
    ("img02.jpg", "ورقة الفيزياء، لقطة ثالثة"),
]

CSS = """
@font-face{font-family:"CairoR";src:url(fonts/Cairo-Regular.ttf);font-weight:400}
@font-face{font-family:"CairoR";src:url(fonts/Cairo-SemiBold.ttf);font-weight:600}
@font-face{font-family:"CairoR";src:url(fonts/Cairo-Bold.ttf);font-weight:700}
@font-face{font-family:"CairoR";src:url(fonts/Cairo-ExtraBold.ttf);font-weight:800}
:root{
  --t9:#12403C; --t7:#1F5C57; --t2:#D3E4E1; --t1:#E8F0EE; --t0:#F3F7F6;
  --gold:#B8923A; --gold-ink:#7E5F17; --gold-l:#E3C26F; --gold-0:#F6EFDC;
  --ink:#1B2826; --muted:#4E5D5A; --line:#D5DFDC; --page:#FBFCFB; --r:14px;
}
@page{size:A4;margin:0}
*{box-sizing:border-box;margin:0;padding:0}
html{font-family:"CairoR","Cairo",sans-serif;color:var(--ink);-webkit-print-color-adjust:exact;print-color-adjust:exact}
body{background:#fff;direction:rtl}
.page{width:210mm;height:297mm;position:relative;overflow:hidden;background:var(--page);padding:16mm 16mm 22mm;display:flex;flex-direction:column;page-break-after:always;break-after:page}
.page:last-child{page-break-after:auto;break-after:auto}
h1,h2,h3,h4{line-height:1.3}
h2{font-size:25pt;font-weight:800;color:var(--t9);margin-bottom:3mm}
h2::after{content:"";display:block;width:16mm;height:1.4mm;background:var(--gold);margin-top:3mm;border-radius:2mm}
h3{font-size:14pt;font-weight:700;color:var(--t7);margin-bottom:2mm}
p{font-size:11.5pt;line-height:1.95;color:var(--ink)}
.lead{font-size:14.5pt;line-height:2.05;color:var(--ink)}
.pf{position:absolute;inset-inline:16mm;bottom:9mm;display:flex;justify-content:space-between;align-items:center;font-size:8.5pt;color:var(--muted);border-top:.3mm solid var(--line);padding-top:3mm}
.pf .pn{font-weight:700;color:var(--t7);font-size:10pt}

/* cover */
.cover{background:var(--t9);color:#EEF4F3;padding:0;flex-direction:row}
.cover .bar{position:absolute;inset-inline-start:0;top:0;bottom:0;width:5mm;background:var(--gold)}
.cv-text{flex:1;padding:20mm 20mm 18mm 8mm;margin-inline-start:5mm;display:flex;flex-direction:column;justify-content:space-between}
.cv-org{font-size:11.5pt;line-height:1.9;color:#C5D8D4}
.cv-org b{color:#fff;font-weight:700;display:block;font-size:13pt}
.cv-title small{display:block;font-size:19pt;font-weight:600;color:var(--gold-l);margin-bottom:3mm}
.cv-title h1{font-size:60pt;font-weight:800;line-height:1.12;color:#fff}
.cv-title p{margin-top:8mm;font-size:14.5pt;line-height:1.9;color:#DCE9E6;max-width:82mm}
.cv-meta{display:grid;gap:3.5mm;font-size:11pt;color:#C5D8D4}
.cv-meta div{display:flex;flex-direction:column}
.cv-meta b{color:#fff;font-size:12.5pt;font-weight:700}
.cv-art{width:100mm;padding:20mm 14mm 18mm 14mm;display:flex;align-items:center}
.cv-art .ph{width:100%;border-radius:var(--r);overflow:hidden;border:1.2mm solid var(--gold-l);aspect-ratio:2/3;box-shadow:0 6mm 14mm rgba(0,0,0,.28)}
.cv-art img{width:100%;height:100%;object-fit:cover;display:block}

/* stats */
.stats{display:grid;grid-template-columns:repeat(4,1fr);gap:4mm;margin:9mm 0 10mm}
.st{border-radius:var(--r);padding:8mm 5mm;background:var(--t0);border:.3mm solid var(--line)}
.st svg{color:var(--t7);margin-bottom:3mm}
.st b{display:block;font-size:30pt;font-weight:800;color:var(--t9);line-height:1.1}
.st b small{font-size:13pt;font-weight:600;color:var(--muted)}
.st span{font-size:10.5pt;color:var(--muted);line-height:1.6;display:block;margin-top:1.5mm}
.st.hi{background:var(--t9);border-color:var(--t9)}
.st.hi svg{color:var(--gold-l)} .st.hi b{color:#fff} .st.hi b small,.st.hi span{color:#C5D8D4}
.st.gd{background:var(--gold-0);border-color:#E7D9AE}
.st.gd svg{color:var(--gold-ink)}
.two{display:grid;grid-template-columns:1fr 1fr;gap:9mm}
.two p{font-size:12pt}
.info{display:grid;grid-template-columns:1fr 1fr;gap:4mm;margin:12mm 0 0}
.in{background:#fff;border:.3mm solid var(--line);border-radius:var(--r);padding:5mm 6mm;display:flex;gap:4mm;align-items:center}
.in svg{color:var(--t7);flex:none}
.in span{display:block;font-size:9.5pt;color:var(--muted)}
.in b{font-size:11.5pt;color:var(--t9);font-weight:700;line-height:1.6}
.note{background:var(--t0);border-radius:var(--r);padding:7mm 8mm;border:.3mm solid var(--line)}
.motto{margin-top:auto;background:var(--t9);color:#fff;border-radius:var(--r);padding:8mm 10mm;display:flex;align-items:center;gap:6mm}
.motto svg{color:var(--gold-l);flex:none}
.motto p{color:#fff;font-size:15pt;font-weight:600;line-height:1.8}

/* mechanism + timeline */
.mech{display:grid;grid-template-columns:repeat(3,1fr);gap:4mm;margin:6mm 0 7mm}
.mc{background:var(--t0);border:.3mm solid var(--line);border-radius:var(--r);padding:5mm 5mm}
.mc svg{color:var(--t7);margin-bottom:2.5mm}
.mc p{font-size:11pt;line-height:1.7}
.tl{display:grid;gap:3.5mm}
.tl-i{display:grid;grid-template-columns:38mm 1fr 44mm;gap:4mm;align-items:center;background:#fff;border:.3mm solid var(--line);border-radius:var(--r);padding:4mm 6mm}
.tl-i h4{white-space:nowrap;font-size:13pt;font-weight:800;color:var(--t9)}
.tl-i p{font-size:10.5pt;line-height:1.65}
.tl-i .when{font-size:10pt;font-weight:700;color:var(--gold-ink);background:var(--gold-0);border-radius:var(--r);padding:2mm 3mm;text-align:center}
.tl-i.run{background:var(--t9);border-color:var(--t9)}
.tl-i.run h4,.tl-i.run p{color:#fff}
.tl-i.run .when{background:var(--gold-l);color:var(--t9)}

/* audience */
.aud{display:grid;gap:3mm;margin:6mm 0 8mm}
.au{display:grid;grid-template-columns:64mm 1fr;gap:5mm;align-items:center;border-radius:var(--r);padding:5mm 6mm}
.au:nth-child(odd){background:var(--t0)}
.au b{white-space:nowrap;font-size:12pt;color:var(--t9);font-weight:700}
.au b span{font-weight:600;color:var(--gold-ink);margin-inline-start:2mm}
.au p{font-size:10.5pt;line-height:1.7;color:var(--muted)}

/* figures */
.fig{display:flex;flex-direction:column;gap:2mm}
.fig .ph{border-radius:var(--r);overflow:hidden;background:var(--t1);flex:1;min-height:0}
.fig img{width:100%;height:100%;object-fit:cover;display:block}
.fig figcaption{font-size:9.5pt;color:var(--muted);line-height:1.6}
.fig figcaption b{color:var(--t9);font-weight:700}
.duo{display:grid;grid-template-columns:1fr 1fr;gap:5mm;height:72mm;margin-top:2mm}

/* results */
.rank{display:grid;gap:3mm;margin:5mm 0 7mm}
.rk{display:grid;grid-template-columns:8mm 38mm 1fr 24mm;gap:4mm;align-items:center;font-size:11pt}
.rk-n{font-weight:800;color:var(--t7);font-size:13pt}
.rk-name{font-weight:600}
.rk-bar{height:4.5mm;display:block}
.rk-bar i{display:block;height:100%;background:var(--t7);border-radius:2mm}
.rk-v{font-weight:800;font-size:13pt;color:var(--t9);text-align:end}
.rk-v small{font-weight:600;color:var(--muted);font-size:9pt}
.rk.top .rk-bar i{background:var(--gold)}
.rk.top .rk-name,.rk.top .rk-n{color:var(--gold-ink)}
.cards{display:grid;grid-template-columns:repeat(3,1fr);gap:4.5mm}
.cc{background:#fff;border:.3mm solid var(--line);border-radius:var(--r);padding:5mm 5mm 4mm}
.cc header{display:flex;justify-content:space-between;align-items:flex-start;gap:2mm;margin-bottom:3mm}
.cc h4{font-size:11.5pt;font-weight:800;color:var(--t9);line-height:1.5}
.tot{background:var(--t9);color:#fff;border-radius:var(--r);padding:1.5mm 3mm;white-space:nowrap}
.tot b{font-size:12.5pt;font-weight:800}.tot small{font-size:8.5pt;color:#C5D8D4}
.cc ul{list-style:none;display:grid;gap:1.4mm}
.cc li{display:flex;justify-content:space-between;font-size:10.5pt;color:var(--muted)}
.cc li b{color:var(--ink);font-weight:700}
.cc li b small{color:var(--muted);font-weight:400;font-size:8pt}
.cc li.full b{color:var(--t7)}
.insight{background:var(--t9);border-radius:var(--r);padding:5mm;color:#fff}
.insight h4{font-size:12pt;color:var(--gold-l);font-weight:800;margin-bottom:2.5mm}
.insight ul{list-style:none;display:grid;gap:2.3mm}
.insight li{font-size:10pt;line-height:1.7;color:#E4EEEC}

/* photos */
.mosaic{display:grid;grid-template-columns:1fr 1fr;grid-template-rows:68mm 68mm 52mm;gap:5mm 5mm;margin-top:5mm;flex:1;min-height:0}
.mosaic .tall{grid-row:1 / span 2}
.mosaic .wide{grid-column:1 / span 2}
.mosaic2{display:grid;grid-template-columns:1fr 1fr;grid-template-rows:104mm 106mm;gap:5mm;margin-top:5mm;flex:1;min-height:0}
.mosaic2 .wide{grid-column:1 / span 2}

/* outcomes */
.out{display:grid;grid-template-columns:1fr 1fr;gap:6mm;margin:7mm 0 9mm}
.ob{border-radius:var(--r);padding:9mm 8mm;border:.3mm solid var(--line);background:var(--t0)}
.ob.dk{background:var(--t9);border-color:var(--t9)}
.ob.dk h3{color:var(--gold-l)} .ob.dk li{color:#E4EEEC}
.ob ul{list-style:none;display:grid;gap:3mm;margin-top:2mm}
.ob li{display:flex;gap:3mm;align-items:flex-start;font-size:12.5pt;line-height:1.7}
.ob li svg{flex:none;margin-top:1mm;color:var(--t7)} .ob.dk li svg{color:var(--gold-l)}
.sum{display:grid;grid-template-columns:repeat(3,1fr);gap:4mm;margin-bottom:8mm}
.sm{background:#fff;border:.3mm solid var(--line);border-radius:var(--r);padding:6mm}
.sm b{display:block;font-size:24pt;font-weight:800;color:var(--t9);line-height:1.2}
.sm b small{font-size:11pt;color:var(--muted);font-weight:600}
.sm span{font-size:10.5pt;color:var(--muted);line-height:1.6;display:block;margin-top:1mm}
.sign{display:grid;grid-template-columns:1fr 1fr;gap:10mm;margin-top:auto;padding-top:6mm}
.sg{border-top:.4mm solid var(--ink);padding-top:3mm;font-size:11pt;line-height:1.8}
.sg span{display:block;color:var(--muted);font-size:10pt}
.sg b{font-weight:700;color:var(--t9);font-size:12.5pt}
.sg-space{height:20mm}

/* appendix */
.grid12{display:grid;grid-template-columns:repeat(3,1fr);gap:4mm;margin-top:5mm;flex:1;min-height:0;grid-auto-rows:1fr}
.th{display:flex;flex-direction:column;gap:1.5mm;min-height:0}
.th .ph{flex:1;border-radius:var(--r);overflow:hidden;min-height:0}
.th img{width:100%;height:100%;object-fit:cover;display:block}
.th span{font-size:9pt;color:var(--muted);line-height:1.4}
.th span b{color:var(--t9);font-weight:800;margin-inline-end:1.5mm}
"""


def build():
    p = []
    # ---- 1 cover
    p.append(f"""
<section class="page cover">
  <div class="bar"></div>
  <div class="cv-text">
    <div class="cv-org"><b>المملكة العربية السعودية</b>وزارة التعليم<br>{SCHOOL}</div>
    <div class="cv-title"><small>تقرير تنفيذ مسابقة</small><h1>كأس<br>المعرفة</h1>
      <p>«علمٌ نتنافس فيه، وإبداعٌ نرتقي به، وتميّزٌ نصنعه معًا»</p></div>
    <div class="cv-meta">
      <div><span>إعداد المعلمتين</span><b>{TEACHERS}</b></div>
      <div><span>مديرة المدرسة</span><b>{PRINCIPAL}</b></div>
      <div><span>الموعد</span><b>خلال الأسبوع، الحصة السادسة</b></div>
    </div>
  </div>
  <div class="cv-art"><div class="ph"><img src="img/img09.jpg" alt="ملصق مسابقة كأس المعرفة"></div></div>
</section>""")

    # ---- 2 summary
    p.append(f"""
<section class="page">
  <h2>ملخص التقرير</h2>
  <p class="lead">نفّذت {SCHOOL} مسابقة «كأس المعرفة» بين خمسة فصول من المرحلة الثانوية، في الحصة السادسة خلال الأسبوع. اجتمعت الطالبات في فرق لحل أسئلة المقررات الدراسية، وتنافسن على جمع النقاط والفوز بلقب «بطل كأس المعرفة».</p>
  <div class="stats">
    <div class="st">{icon('users-three',26)}<b>5</b><span>فصول مشاركة من الصفوف الثلاثة</span></div>
    <div class="st">{icon('books',26)}<b>6</b><span>مواد دراسية في كل فصل</span></div>
    <div class="st gd">{icon('target',26)}<b>30</b><span>الدرجة العظمى لكل فصل</span></div>
    <div class="st hi">{icon('chart-line-up',26)}<b>{AVG_PCT:.1f}<small>%</small></b><span>متوسط درجات الفصول الخمسة</span></div>
  </div>
  <div class="two">
    <div><h3>الهدف العام</h3>
      <p>تعزيز التحصيل الدراسي لدى طالبات المرحلة الثانوية، وتنمية مهارات التفكير الناقد وسرعة الاستجابة والعمل الجماعي من خلال منافسة علمية محفزة بين الفصول الدراسية.</p></div>
    <div><h3>فكرة المسابقة</h3>
      <p>مسابقة علمية بين خمس شعب دراسية، تتضمن أسئلة متنوعة في المواد المقررة لكل صف، وتُطرح بأسلوب تفاعلي باستخدام التقنية. تتنافس الفرق في جولات محددة لجمع النقاط والفوز بلقب «بطل كأس المعرفة».</p></div>
  </div>
  <div class="info">
    <div class="in">{icon('graduation-cap',28)}<div><span>المكان</span><b>{SCHOOL}</b></div></div>
    <div class="in">{icon('clock',28)}<div><span>الموعد</span><b>خلال الأسبوع، الحصة السادسة</b></div></div>
    <div class="in">{icon('seal-check',28)}<div><span>مديرة المدرسة</span><b>{PRINCIPAL}</b></div></div>
    <div class="in">{icon('notebook',28)}<div><span>إعداد المعلمتين</span><b>{TEACHERS}</b></div></div>
  </div>
  {footer(2)}
</section>""")

    # ---- 3 mechanism & plan
    mech_html = "".join(f'<div class="mc">{icon(i,26)}<p>{t}</p></div>' for i, t in mech)
    tl_html = "".join(
        f'<div class="tl-i{" run" if n == "التنفيذ" else ""}"><h4>{n}</h4><p>{a}</p><div class="when">{w}</div></div>'
        for n, a, w in phases
    )
    p.append(f"""
<section class="page">
  <h2>آلية التنفيذ وخطة العمل</h2>
  <p>سارت المسابقة وفق ست خطوات واضحة، تبدأ بتشكيل الفرق وتنتهي بتكريم الفصل الفائز.</p>
  <div class="mech">{mech_html}</div>
  <h3>مراحل الخطة</h3>
  <div class="tl">{tl_html}</div>
  {footer(3)}
</section>""")

    # ---- 4 audience + whiteboards
    aud_html = "".join(f'<div class="au"><b>{c}<span>{s}</span></b><p>{m}</p></div>' for c, s, m in audience)
    p.append(f"""
<section class="page">
  <h2>الفئة المستهدفة والمواد</h2>
  <p>شاركت طالبات المرحلة الثانوية الأولى: الصف الأول الثانوي (الشعبة 1)، والصف الثاني الثانوي (الشعبتان 1 و2)، والصف الثالث الثانوي (الشعبتان 1 و2)، بإجمالي خمسة فصول.</p>
  <div class="aud">{aud_html}</div>
  <div class="duo">
    {fig('img03.jpg','<b>سبورة الصف الثالث، شعبة 2.</b> مواد المسابقة والتاريخ 25/4/1448، يوم الثلاثاء.')}
    {fig('img12.jpg','<b>سبورة الصف الثاني، شعبة 2.</b> مواد المسابقة مدونة قبل بدء الجولات.')}
  </div>
  {footer(4)}
</section>""")

    # ---- 5 results
    order = sorted(range(len(CLASSES)), key=lambda i: -CLASSES[i][1])
    cards = [class_card(*CLASSES[i], rank=r + 1) for r, i in enumerate(order)]
    insight = f"""<article class="insight"><h4>ملاحظات على النتائج</h4><ul>
      <li>حقق الصف الأول الثانوي الدرجة الكاملة 30 من 30.</li>
      <li>الفارق بين الفصول الأربعة التالية 3 درجات فقط، من 22.5 إلى 25.5.</li>
      <li>اللغة الإنجليزية: الدرجة الكاملة في الفصول الثلاثة المشاركة فيها.</li>
      <li>التاريخ: الدرجة الكاملة في شعبتي الصف الثاني.</li></ul></article>"""
    p.append(f"""
<section class="page">
  <h2>نتائج المسابقة</h2>
  <p>تُحتسب الدرجة من 5 في كل مادة، فيكون المجموع الأعلى 30 درجة. وفيما يلي ترتيب الفصول حسب المجموع.</p>
  <div class="rank">{ranking()}</div>
  <div class="cards">{''.join(cards)}{insight}</div>
  {footer(5)}
</section>""")

    # ---- 6 papers
    p.append(f"""
<section class="page">
  <h2>أوراق الأسئلة</h2>
  <p>أُعدت أسئلة كل مادة بمستوى الصف، وجُهزت في أوراق مطبوعة وأغلفة شفافة لكل فريق.</p>
  <div class="mosaic">
    {fig('img04.jpg','<b>أسئلة الكيمياء، الصف الثالث.</b> اختيار من متعدد، صح أم خطأ، ومسائل حسابية ومفاهيمية.','tall','center 30%')}
    {fig('img06.jpg','<b>أسئلة الرياضيات، الصف الثاني.</b> العلاقات والمصفوفات في ورقة جاهزة للفريق.','', 'center 35%')}
    {fig('img11.jpg','<b>اختبار التقنية الرقمية، الصف الثالث.</b> أسئلة في إدارة المشروعات.','', 'center 45%')}
    {fig('img08.jpg','<b>أوراق الأسئلة جاهزة لكل فريق.</b> كل مجموعة تستلم ورقتها في غلاف شفاف مع كرات ملونة.','wide','center 50%')}
  </div>
  {footer(6)}
</section>""")

    # ---- 7 atmosphere
    p.append(f"""
<section class="page">
  <h2>أجواء المنافسة</h2>
  <p>اجتمعت الطالبات حول الطاولات في مجموعات تتشاور وتجيب، بينما شرحت المعلمات آلية كل ورقة.</p>
  <div class="mosaic2">
    {fig('img05.jpg','<b>اختبار قواعد اللغة الإنجليزية.</b> فريق يحل أسئلة <bdi dir="ltr">Other, Others, Another</bdi>.','wide','center 50%')}
    {fig('img07.jpg','<b>ورقة الفيزياء.</b> طالبة تكتب إجابتها.','', 'center 40%')}
    {fig('img01.jpg','<b>شرح ورقة الكيمياء.</b> المعلمة توضح الأسئلة قبل البدء.','', 'center 35%')}
  </div>
  {footer(7)}
</section>""")

    # ---- 8 outcomes + signatures
    check = icon("seal-check", 22)
    outs = ["رفع التحصيل الدراسي", "تنمية التفكير والتحليل واتخاذ القرار", "تعزيز المنافسة الإيجابية", "اكتشاف الطالبات المتميزات"]
    kpis = ["نسبة المشاركة", "مستوى أداء الفرق", "تفاعل الطالبات", "مدى تحقق أهداف المسابقة"]
    li = lambda items: "".join(f"<li>{check}<span>{t}</span></li>" for t in items)
    p.append(f"""
<section class="page">
  <h2>النتائج المتوقعة ومؤشرات النجاح</h2>
  <p>تسعى المسابقة إلى أثر تعليمي يتجاوز يوم التنفيذ، ويُقاس نجاحها بمؤشرات محددة.</p>
  <div class="out">
    <div class="ob"><h3>النتائج المتوقعة</h3><ul>{li(outs)}</ul></div>
    <div class="ob dk"><h3>مؤشرات النجاح</h3><ul>{li(kpis)}</ul></div>
  </div>
  <h3>الخلاصة</h3>
  <div class="sum">
    <div class="sm"><b>5</b><span>فصول شاركت في المسابقة</span></div>
    <div class="sm"><b>{num(round(AVG,1))}<small>/30</small></b><span>متوسط مجموع الدرجات</span></div>
    <div class="sm"><b>30<small>/30</small></b><span>أعلى مجموع، حققه الصف الأول الثانوي</span></div>
  </div>
  <div class="motto">{icon('trophy',40)}<p>تكريم الفصل الفائز بكأس المعرفة، وتوثيق النتائج لتكون منطلقًا للنسخة القادمة.</p></div>
  <div class="sign">
    <div class="sg"><div class="sg-space"></div><span>إعداد المعلمتين</span><b>{TEACHERS}</b></div>
    <div class="sg"><div class="sg-space"></div><span>مديرة المدرسة</span><b>{PRINCIPAL}</b></div>
  </div>
  {footer(8)}
</section>""")

    # ---- 9 appendix
    th = "".join(
        f'<div class="th"><div class="ph"><img src="img/{f}" alt="{c}"></div><span><b>{i}</b>{c}</span></div>'
        for i, (f, c) in enumerate(appendix, 1)
    )
    p.append(f"""
<section class="page">
  <h2>ملحق الصور</h2>
  <p>جميع الصور الموثقة للمسابقة.</p>
  <div class="grid12">{th}</div>
  {footer(9)}
</section>""")

    html = f"""<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>تقرير مسابقة كأس المعرفة</title><style>{CSS}</style></head><body>{''.join(p)}</body></html>"""
    (B / "report.html").write_text(html, encoding="utf-8")
    assert "—" not in html and "–" not in html, "dash found"
    print("ok", len(html))


build()
