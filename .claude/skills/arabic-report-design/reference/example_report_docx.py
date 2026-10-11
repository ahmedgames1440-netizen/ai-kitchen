#!/usr/bin/env python3
# NOTE: names, scores and photos below are placeholders from a past report. Replace all data with the user's own.
"""Word (.docx) version of the Knowledge Cup report, RTL, A4, Cairo embedded."""
import pathlib, re, uuid, zipfile, shutil
from PIL import Image, ImageOps
from docx import Document
from docx.shared import Pt, Mm, RGBColor, Emu
from docx.enum.text import WD_ALIGN_PARAGRAPH, WD_BREAK
from docx.enum.table import WD_TABLE_ALIGNMENT
from docx.enum.section import WD_SECTION
from docx.oxml.ns import qn, nsdecls
from docx.oxml import parse_xml, OxmlElement

B = pathlib.Path(__file__).parent
OUT = B / "report.docx"
FONT = "Cairo"
T9, T7, T1, T0 = "12403C", "1F5C57", "E8F0EE", "F3F7F6"
GOLD, GOLD_INK, GOLD_L, GOLD_0 = "B8923A", "7E5F17", "E3C26F", "F6EFDC"
INK, MUTED, LINE, WHITE = "1B2826", "4E5D5A", "D5DFDC", "FFFFFF"

SCHOOL = "اسم المدرسة"
TEACHERS = "اسم المعلمة الأولى واسم المعلمة الثانية"
PRINCIPAL = "اسم مديرة المدرسة"

CLASSES = [
    ("أول ثانوي", 30, [("رياضيات", 5), ("كيمياء", 5), ("تقنية رقمية", 5), ("أحياء", 5), ("إنجليزي", 5), ("دين", 5)]),
    ("ثاني ثانوي شعبة 2", 25.5, [("رياضيات", 3), ("فيزياء", 4), ("أحياء", 5), ("كيمياء", 5), ("تاريخ", 5), ("كفايات", 3.5)]),
    ("ثالث ثانوي شعبة 1", 25, [("كيمياء", 5), ("رياضيات", 4), ("تقنية رقمية", 3), ("فيزياء", 3), ("إنجليزي", 5), ("مهارات إدارية", 5)]),
    ("ثاني ثانوي شعبة 1", 23.5, [("رياضيات", 3), ("فيزياء", 4), ("أحياء", 3), ("كيمياء", 4), ("تاريخ", 5), ("كفايات", 4.5)]),
    ("ثالث ثانوي شعبة 2", 22.5, [("كيمياء", 3), ("رياضيات", 4), ("تقنية رقمية", 3), ("فيزياء", 2.5), ("إنجليزي", 5), ("مهارات إدارية", 5)]),
]
AVG = sum(c[1] for c in CLASSES) / 5
AVG_PCT = AVG / 30 * 100
num = lambda x: f"{x:g}"

MECH = ["تشكيل فريق ممثل لكل فصل.", "إعداد أسئلة مناسبة للمقررات ومستويات الصفوف.", "تقسيم المسابقة إلى جولات متدرجة الصعوبة.",
        "تحديد وقت للإجابة عن كل سؤال.", "رصد النقاط والإعلان عن الفريق الأعلى مجموعًا.", "تكريم الفصل الفائز بكأس المعرفة."]
PHASES = [
    ("الإعداد", "إعداد الأسئلة وتجهيز العرض وآلية احتساب النقاط.", "قبل المسابقة بأسبوع"),
    ("الإعلان", "تعريف الطالبات بالأهداف والشروط وآلية المنافسة.", "قبل المسابقة بأسبوع"),
    ("الاستعداد", "اختيار ممثلات الفصول ومراجعة المقررات المحددة.", "قبل المسابقة بيومين"),
    ("التنفيذ", "طرح الأسئلة وتنفيذ الجولات ورصد النقاط.", "خلال الأسبوع، الحصة السادسة"),
    ("النتائج والتكريم", "إعلان النتائج وتكريم الفريق الفائز وتوثيق النتائج.", "بعد المسابقة"),
]
AUD = [
    ("الصف الأول الثانوي، الشعبة 1", "رياضيات، كيمياء، تقنية رقمية، أحياء، إنجليزي، دين"),
    ("الصف الثاني الثانوي، الشعبة 1", "رياضيات، فيزياء، أحياء، كيمياء، تاريخ، كفايات"),
    ("الصف الثاني الثانوي، الشعبة 2", "رياضيات، فيزياء، أحياء، كيمياء، تاريخ، كفايات"),
    ("الصف الثالث الثانوي، الشعبة 1", "كيمياء، رياضيات، تقنية رقمية، فيزياء، إنجليزي، مهارات إدارية"),
    ("الصف الثالث الثانوي، الشعبة 2", "كيمياء، رياضيات، تقنية رقمية، فيزياء، إنجليزي، مهارات إدارية"),
]
APPENDIX = [
    ("img09", "ملصق المسابقة"), ("img03", "سبورة الثالث، شعبة 2"), ("img12", "سبورة الثاني، شعبة 2"),
    ("img04", "أسئلة الكيمياء"), ("img01", "شرح ورقة الكيمياء"), ("img06", "أسئلة الرياضيات"),
    ("img11", "اختبار التقنية الرقمية"), ("img08", "أوراق الأسئلة في أغلفتها"), ("img05", "الإجابة في مجموعات"),
    ("img07", "ورقة الفيزياء"), ("img10", "ورقة الفيزياء، لقطة ثانية"), ("img02", "ورقة الفيزياء، لقطة ثالثة"),
]

# ------------------------------------------------------------------ images
CROPS = B / "crops"
CROPS.mkdir(exist_ok=True)


def crop(name, w_mm, h_mm, focus=(0.5, 0.5)):
    """cover-crop img/<name>.jpg to w:h, returns path (high enough res for print)."""
    out = CROPS / f"{name}_{w_mm}x{h_mm}.jpg"
    im = ImageOps.exif_transpose(Image.open(B / "img" / f"{name}.jpg")).convert("RGB")
    im = ImageOps.fit(im, (int(w_mm * 10), int(h_mm * 10)), Image.LANCZOS, centering=focus)
    im.save(out, quality=85, optimize=True)
    return out


# ------------------------------------------------------------------ xml helpers
def rpr(run, size=11, bold=False, color=INK, font=FONT):
    r = run._r
    pr = r.get_or_add_rPr()
    for el in list(pr):
        pr.remove(el)
    rf = OxmlElement("w:rFonts")
    for a in ("w:ascii", "w:hAnsi", "w:cs", "w:eastAsia"):
        rf.set(qn(a), font)
    pr.append(rf)
    if bold:
        pr.append(OxmlElement("w:b")); pr.append(OxmlElement("w:bCs"))
    c = OxmlElement("w:color"); c.set(qn("w:val"), color); pr.append(c)
    for tag in ("w:sz", "w:szCs"):
        s = OxmlElement(tag); s.set(qn("w:val"), str(int(size * 2))); pr.append(s)
    pr.append(OxmlElement("w:rtl"))


def para(container, text="", size=11, bold=False, color=INK, align=None, before=0, after=0, line=None, keep=False):
    p = container.add_paragraph() if not hasattr(container, "paragraphs") or True else None
    return _fill(p, text, size, bold, color, align, before, after, line)


def _fill(p, text, size, bold, color, align, before, after, line):
    pPr = p._p.get_or_add_pPr()
    pPr.append(OxmlElement("w:bidi"))
    sp = OxmlElement("w:spacing")
    sp.set(qn("w:before"), str(int(before * 20))); sp.set(qn("w:after"), str(int(after * 20)))
    if isinstance(line, tuple):
        sp.set(qn("w:line"), str(int(line[1] * 20))); sp.set(qn("w:lineRule"), "exact")
    elif line:
        sp.set(qn("w:line"), str(int(line * 240))); sp.set(qn("w:lineRule"), "auto")
    pPr.append(sp)
    if align == "center":
        jc = OxmlElement("w:jc"); jc.set(qn("w:val"), "center"); pPr.append(jc)
    elif align == "end":  # visual left in RTL
        jc = OxmlElement("w:jc"); jc.set(qn("w:val"), "right"); pPr.append(jc)
    if text:
        add_run(p, text, size, bold, color)
    return p


def add_run(p, text, size=11, bold=False, color=INK):
    r = p.add_run(text)
    rpr(r, size, bold, color)
    return r


def first_para(cell):
    """reuse the empty first paragraph of a cell."""
    p = cell.paragraphs[0]
    return p


def cell_text(cell, text, size=11, bold=False, color=INK, align=None, before=0, after=0, line=None, new=False):
    p = cell.add_paragraph() if new else cell.paragraphs[0]
    return _fill(p, text, size, bold, color, align, before, after, line)


def shade(cell, fill):
    tcPr = cell._tc.get_or_add_tcPr()
    for e in tcPr.findall(qn("w:shd")):
        tcPr.remove(e)
    shd = OxmlElement("w:shd")
    shd.set(qn("w:val"), "clear"); shd.set(qn("w:color"), "auto"); shd.set(qn("w:fill"), fill)
    tcPr.append(shd)


def borders(cell, color=LINE, sz=4, sides=("top", "left", "bottom", "right")):
    tcPr = cell._tc.get_or_add_tcPr()
    for e in tcPr.findall(qn("w:tcBorders")):
        tcPr.remove(e)
    b = OxmlElement("w:tcBorders")
    for s in ("top", "left", "bottom", "right"):
        el = OxmlElement(f"w:{s}")
        if s in sides and color:
            el.set(qn("w:val"), "single"); el.set(qn("w:sz"), str(sz)); el.set(qn("w:color"), color)
        else:
            el.set(qn("w:val"), "nil")
        b.append(el)
    tcPr.append(b)


def margins(cell, top=80, bottom=80, start=120, end=120):
    tcPr = cell._tc.get_or_add_tcPr()
    for e in tcPr.findall(qn("w:tcMar")):
        tcPr.remove(e)
    m = OxmlElement("w:tcMar")
    for k, v in (("top", top), ("left", start), ("bottom", bottom), ("right", end)):
        el = OxmlElement(f"w:{k}"); el.set(qn("w:w"), str(v)); el.set(qn("w:type"), "dxa"); m.append(el)
    tcPr.append(m)


def valign(cell, v="center"):
    tcPr = cell._tc.get_or_add_tcPr()
    el = OxmlElement("w:vAlign"); el.set(qn("w:val"), v); tcPr.append(el)


def set_w(cell, mm):
    cell.width = Mm(mm)


def row_h(row, mm, rule="atLeast"):
    trPr = row._tr.get_or_add_trPr()
    h = OxmlElement("w:trHeight"); h.set(qn("w:val"), str(int(mm * 56.7))); h.set(qn("w:hRule"), rule)
    trPr.append(h)
    cs = OxmlElement("w:cantSplit"); trPr.append(cs)


def make_table(container, rows, cols, widths_mm, gap=0):
    t = container.add_table(rows=rows, cols=cols)
    t.alignment = WD_TABLE_ALIGNMENT.CENTER
    tblPr = t._tbl.tblPr
    tblPr.append(OxmlElement("w:bidiVisual"))
    lay = OxmlElement("w:tblLayout"); lay.set(qn("w:type"), "fixed"); tblPr.append(lay)
    total = sum(widths_mm)
    for e in tblPr.findall(qn("w:tblW")):
        tblPr.remove(e)
    tw = OxmlElement("w:tblW"); tw.set(qn("w:w"), str(int(total * 56.7))); tw.set(qn("w:type"), "dxa"); tblPr.append(tw)
    # table-level cell margins zero, borders none
    tm = OxmlElement("w:tblCellMar")
    for k in ("top", "left", "bottom", "right"):
        el = OxmlElement(f"w:{k}"); el.set(qn("w:w"), "0"); el.set(qn("w:type"), "dxa"); tm.append(el)
    tblPr.append(tm)
    grid = t._tbl.tblGrid
    for gc, w in zip(grid.findall(qn("w:gridCol")), widths_mm):
        gc.set(qn("w:w"), str(int(w * 56.7)))
    for r in t.rows:
        for c, w in zip(r.cells, widths_mm):
            c.width = Mm(w)
            borders(c, None)
    return t


def spacer(doc, mm=3):
    p = doc.add_paragraph()
    _fill(p, "", 1, False, INK, None, 0, 0, None)
    pPr = p._p.get_or_add_pPr()
    sp = pPr.find(qn("w:spacing"))
    sp.set(qn("w:line"), str(int(mm * 56.7))); sp.set(qn("w:lineRule"), "exact")
    rp = OxmlElement("w:rPr"); sz = OxmlElement("w:sz"); sz.set(qn("w:val"), "2"); rp.append(sz); pPr.append(rp)
    return p


def page_break(doc):
    p = doc.add_paragraph()
    _fill(p, "", 1, False, INK, None, 0, 0, None)
    p.add_run().add_break(WD_BREAK.PAGE)
    return p


def heading(doc, text, first=False):
    p = doc.add_paragraph()
    _fill(p, text, 24, True, T9, None, 0, 8, 1.1)
    pPr = p._p.get_or_add_pPr()
    bd = OxmlElement("w:pBdr")
    bt = OxmlElement("w:bottom"); bt.set(qn("w:val"), "single"); bt.set(qn("w:sz"), "24"); bt.set(qn("w:space"), "6"); bt.set(qn("w:color"), GOLD)
    bd.append(bt)
    pPr.insert(1, bd)
    keep = OxmlElement("w:keepNext"); pPr.insert(0, keep)
    if not first:
        pb = OxmlElement("w:pageBreakBefore"); pPr.insert(0, pb)
    return p


def subhead(container, text, new=True, before=6):
    p = container.add_paragraph() if new else container.paragraphs[0]
    return _fill(p, text, 14, True, T7, None, before, 3, None)


def picture(cell, path, w_mm, new=False, align=None):
    p = cell.add_paragraph() if new else cell.paragraphs[0]
    _fill(p, "", 1, False, INK, align, 0, 0, None)
    r = p.add_run()
    r.add_picture(str(path), width=Mm(w_mm))
    return p


def inline_picture_round(*_):
    pass


def footer_setup(section):
    section.footer.is_linked_to_previous = False
    f = section.footer
    for p in list(f.paragraphs)[1:]:
        p._p.getparent().remove(p._p)
    p = f.paragraphs[0]
    pPr = p._p.get_or_add_pPr()
    pPr.append(OxmlElement("w:bidi"))
    bd = OxmlElement("w:pBdr"); bt = OxmlElement("w:top")
    bt.set(qn("w:val"), "single"); bt.set(qn("w:sz"), "4"); bt.set(qn("w:space"), "6"); bt.set(qn("w:color"), LINE)
    bd.append(bt); pPr.append(bd)
    tabs = OxmlElement("w:tabs")
    for val, pos in (("center", 5100), ("right", 0)):
        pass
    add_run(p, "تقرير مسابقة «كأس المعرفة»", 8.5, False, MUTED)
    add_run(p, "   |   ", 8.5, False, LINE)
    add_run(p, SCHOOL, 8.5, False, MUTED)
    add_run(p, "   |   ", 8.5, False, LINE)
    r = p.add_run()
    rpr(r, 10, True, T7)
    for t, txt in (("begin", None), (None, " PAGE "), ("end", None)):
        if t:
            fc = OxmlElement("w:fldChar"); fc.set(qn("w:fldCharType"), t); r._r.append(fc)
        else:
            it = OxmlElement("w:instrText"); it.set(qn("xml:space"), "preserve"); it.text = txt; r._r.append(it)


# ------------------------------------------------------------------ build
def build():
    doc = Document()
    st = doc.styles["Normal"]
    st.font.name = FONT
    st.element.rPr.rFonts.set(qn("w:cs"), FONT)
    st.element.rPr.rFonts.set(qn("w:eastAsia"), FONT)

    # ---------------- cover section (zero margins)
    s0 = doc.sections[0]
    s0.page_width, s0.page_height = Mm(210), Mm(297)
    s0.left_margin = s0.right_margin = s0.top_margin = s0.bottom_margin = Mm(9)
    s0.header_distance = s0.footer_distance = Mm(4)
    cov = make_table(doc, 1, 2, [102, 90])
    row_h(cov.rows[0], 268, "exact")
    c_txt, c_art = cov.rows[0].cells
    for c in (c_txt, c_art):
        shade(c, T9)
    margins(c_txt, 700, 500, 300, 600)
    margins(c_art, 700, 500, 200, 300)
    # text cell
    X = lambda pt: ("exact", pt)
    cell_text(c_txt, "المملكة العربية السعودية", 13, True, WHITE, line=X(22))
    cell_text(c_txt, "وزارة التعليم", 11.5, False, "C5D8D4", new=True, line=X(20))
    cell_text(c_txt, SCHOOL, 11.5, False, "C5D8D4", new=True, line=X(20), after=120)
    cell_text(c_txt, "تقرير تنفيذ مسابقة", 19, False, GOLD_L, new=True, line=X(34), after=4)
    cell_text(c_txt, "كأس", 56, True, WHITE, new=True, line=X(70))
    kp = cell_text(c_txt, "المعرفة", 56, True, WHITE, new=True, line=X(70), after=14)
    _bd = OxmlElement("w:pBdr"); _b = OxmlElement("w:bottom")
    _b.set(qn("w:val"), "single"); _b.set(qn("w:sz"), "36"); _b.set(qn("w:space"), "10"); _b.set(qn("w:color"), GOLD_L)
    _bd.append(_b); kp._p.get_or_add_pPr().append(_bd)
    cell_text(c_txt, "«علمٌ نتنافس فيه، وإبداعٌ نرتقي به،", 14, False, "DCE9E6", new=True, line=X(26), before=10)
    cell_text(c_txt, "وتميّزٌ نصنعه معًا»", 14, False, "DCE9E6", new=True, line=X(26), after=100)
    for lab, val in (("إعداد المعلمتين", TEACHERS), ("مديرة المدرسة", PRINCIPAL), ("الموعد", "خلال الأسبوع، الحصة السادسة")):
        cell_text(c_txt, lab, 10.5, False, "C5D8D4", new=True, before=8, line=X(18))
        cell_text(c_txt, val, 12.5, True, WHITE, new=True, line=X(22))
    valign(c_art, "center")
    poster = crop("img09", 74, 111)
    picture(c_art, poster, 74)
    tail = doc.add_paragraph()
    _fill(tail, "", 1, False, INK, None, 0, 0, 1)
    tp = tail._p.get_or_add_pPr().find(qn("w:spacing"))
    tp.set(qn("w:line"), "20"); tp.set(qn("w:lineRule"), "exact")


    # ---------------- body section
    s1 = doc.add_section(WD_SECTION.NEW_PAGE)
    s1.left_margin = s1.right_margin = Mm(18)
    s1.top_margin = Mm(16)
    s1.bottom_margin = Mm(22)
    s1.footer_distance = Mm(9)
    footer_setup(s1)
    W = 174  # usable width mm

    # ---- page 2: summary
    heading(doc, "ملخص التقرير", first=True)
    para(doc, f"نفّذت {SCHOOL} مسابقة «كأس المعرفة» بين خمسة فصول من المرحلة الثانوية، في الحصة السادسة خلال الأسبوع. اجتمعت الطالبات في فرق لحل أسئلة المقررات الدراسية، وتنافسن على جمع النقاط والفوز بلقب «بطل كأس المعرفة».",
         13, False, INK, before=4, after=10, line=1.6)
    t = make_table(doc, 1, 4, [41, 41, 41, 41])
    # gaps via borders white thick: emulate with white borders
    stats = [("5", "فصول مشاركة من الصفوف الثلاثة", T0, T9, MUTED), ("6", "مواد دراسية في كل فصل", T0, T9, MUTED),
             ("30", "الدرجة العظمى لكل فصل", GOLD_0, T9, MUTED), (f"{AVG_PCT:.1f}%", "متوسط درجات الفصول الخمسة", T9, WHITE, "C5D8D4")]
    for c, (v, l, bg, fg, mu) in zip(t.rows[0].cells, stats):
        shade(c, bg); borders(c, WHITE, 36); margins(c, 200, 200, 150, 150)
        cell_text(c, v, 28, True, fg, line=1.1)
        cell_text(c, l, 10.5, False, mu, new=True, before=3, line=1.3)
    spacer(doc, 6)
    t = make_table(doc, 1, 2, [87, 87])
    for c, (h, body) in zip(t.rows[0].cells, [
        ("فكرة المسابقة", "مسابقة علمية بين خمس شعب دراسية، تتضمن أسئلة متنوعة في المواد المقررة لكل صف، وتُطرح بأسلوب تفاعلي باستخدام التقنية. تتنافس الفرق في جولات محددة لجمع النقاط والفوز بلقب «بطل كأس المعرفة»."),
        ("الهدف العام", "تعزيز التحصيل الدراسي لدى طالبات المرحلة الثانوية، وتنمية مهارات التفكير الناقد وسرعة الاستجابة والعمل الجماعي من خلال منافسة علمية محفزة بين الفصول الدراسية.")]):
        borders(c, WHITE, 36); margins(c, 60, 60, 100, 100)
        cell_text(c, h, 14, True, T7, after=3)
        cell_text(c, body, 11.5, False, INK, new=True, line=1.6)
    spacer(doc, 8)
    t = make_table(doc, 2, 2, [87, 87])
    info = [("المكان", SCHOOL), ("الموعد", "خلال الأسبوع، الحصة السادسة"), ("مديرة المدرسة", PRINCIPAL), ("إعداد المعلمتين", TEACHERS)]
    i = 0
    for r in t.rows:
        for c in r.cells:
            lab, val = info[i]; i += 1
            borders(c, LINE, 4); margins(c, 140, 140, 180, 180); valign(c)
            cell_text(c, lab, 9.5, False, MUTED)
            cell_text(c, val, 12, True, T9, new=True)

    # ---- page 3: mechanism & plan
    heading(doc, "آلية التنفيذ وخطة العمل")
    para(doc, "سارت المسابقة وفق ست خطوات واضحة، تبدأ بتشكيل الفرق وتنتهي بتكريم الفصل الفائز.", 11.5, False, INK, after=8)
    t = make_table(doc, 2, 3, [58, 58, 58])
    k = 0
    for r in t.rows:
        row_h(r, 26)
        for c in r.cells:
            shade(c, T0); borders(c, WHITE, 36); margins(c, 160, 160, 160, 160); valign(c)
            cell_text(c, MECH[k], 11.5, False, INK, line=1.5); k += 1
    spacer(doc, 8)
    subhead(doc, "مراحل الخطة", before=0)
    t = make_table(doc, 5, 3, [36, 90, 48])
    for r, (n, a, w) in zip(t.rows, PHASES):
        run = n == "التنفيذ"
        row_h(r, 17)
        c0, c1, c2 = r.cells
        for c in (c0, c1, c2):
            valign(c); margins(c, 100, 100, 160, 160)
            if run:
                shade(c, T9); borders(c, WHITE, 36)
            else:
                borders(c, WHITE, 36); shade(c, T0)
        cell_text(c0, n, 13.5, True, WHITE if run else T9)
        cell_text(c1, a, 11, False, WHITE if run else INK, line=1.4)
        shade(c2, GOLD_L if run else GOLD_0)
        cell_text(c2, w, 10, True, T9 if run else GOLD_INK, align="center")

    # ---- page 4: audience
    heading(doc, "الفئة المستهدفة والمواد")
    para(doc, "شاركت طالبات المرحلة الثانوية الأولى: الصف الأول الثانوي (الشعبة 1)، والصف الثاني الثانوي (الشعبتان 1 و2)، والصف الثالث الثانوي (الشعبتان 1 و2)، بإجمالي خمسة فصول.",
         11.5, False, INK, after=8, line=1.6)
    t = make_table(doc, 5, 2, [62, 112])
    for n, (r, (cls, subj)) in enumerate(zip(t.rows, AUD)):
        row_h(r, 15)
        for c in r.cells:
            valign(c); margins(c, 100, 100, 160, 160)
            borders(c, WHITE, 36); shade(c, T0 if n % 2 == 0 else WHITE)
        cell_text(r.cells[0], cls, 11.5, True, T9)
        cell_text(r.cells[1], subj, 10.5, False, MUTED, line=1.4)
    spacer(doc, 8)
    t = make_table(doc, 2, 2, [87, 87])
    for c, (img, foc, cap_b, cap) in zip(t.rows[0].cells, [
        ("img03", (0.5, 0.5), "سبورة الصف الثالث، شعبة 2.", " مواد المسابقة والتاريخ 25/4/1448، يوم الثلاثاء."),
        ("img12", (0.5, 0.5), "سبورة الصف الثاني، شعبة 2.", " مواد المسابقة مدونة قبل بدء الجولات.")]):
        margins(c, 0, 0, 60, 60)
        picture(c, crop(img, 84, 63, foc), 84)
    for c, (cap_b, cap) in zip(t.rows[1].cells, [
        ("سبورة الصف الثالث، شعبة 2.", " مواد المسابقة والتاريخ 25/4/1448، يوم الثلاثاء."),
        ("سبورة الصف الثاني، شعبة 2.", " مواد المسابقة مدونة قبل بدء الجولات.")]):
        margins(c, 40, 0, 60, 60)
        p = c.paragraphs[0]; _fill(p, "", 9.5, False, MUTED, None, 0, 0, 1.4)
        add_run(p, cap_b, 9.5, True, T9); add_run(p, cap, 9.5, False, MUTED)

    # ---- page 5: results
    heading(doc, "نتائج المسابقة")
    para(doc, "تُحتسب الدرجة من 5 في كل مادة، فيكون المجموع الأعلى 30 درجة. وفيما يلي ترتيب الفصول حسب المجموع.", 11.5, False, INK, after=8)
    order = sorted(CLASSES, key=lambda c: -c[1])
    BAR = 88.0
    t = make_table(doc, 5, 4, [10, 40, 94, 30])
    for n, (r, (name, tot, _)) in enumerate(zip(t.rows, order), 1):
        row_h(r, 9)
        for c in r.cells:
            valign(c); margins(c, 20, 20, 60, 60); borders(c, None)
        top = n == 1
        cell_text(r.cells[0], str(n), 13, True, GOLD_INK if top else T7)
        cell_text(r.cells[1], name, 11, True if top else False, GOLD_INK if top else INK)
        # bar via nested 2-cell table
        bc = r.cells[2]
        fill_w = BAR * tot / 30
        nt = make_table(bc, 1, 2, [fill_w, max(BAR - fill_w, 0.5)])
        row_h(nt.rows[0], 4.5, "exact")
        shade(nt.rows[0].cells[0], GOLD if top else T7)
        for cc in nt.rows[0].cells:
            cell_text(cc, "", 1)
        valign(bc)
        # python-docx appends a trailing paragraph after a nested table: make it 1pt tall
        cp = bc.paragraphs[-1]; _fill(cp, "", 1, False, INK, None, 0, 0, 1)
        cpp = cp._p.get_or_add_pPr().find(qn("w:spacing")); cpp.set(qn("w:line"), "20"); cpp.set(qn("w:lineRule"), "exact")
        bc._tc.remove(bc.paragraphs[0]._p)
        cell_text(r.cells[3], f"{num(tot)} / 30", 12, True, T9, align="end")
    spacer(doc, 5)
    t = make_table(doc, 2, 3, [58, 58, 58])
    cards = []
    for name, tot, rows in order:
        cards.append(("class", name, tot, rows))
    cards.append(("insight",))
    k = 0
    for r in t.rows:
        for c in r.cells:
            item = cards[k]; k += 1
            borders(c, WHITE, 36); margins(c, 100, 80, 140, 140)
            if item[0] == "class":
                _, name, tot, rows = item
                borders(c, LINE, 4); shade(c, WHITE)
                hp = c.paragraphs[0]; _fill(hp, "", 11, True, T9, None, 0, 3, 1.2)
                add_run(hp, name, 11, True, T9)
                add_run(hp, "   ", 11, False, T9)
                tr = add_run(hp, f" {num(tot)}/30 ", 11, True, WHITE)
                shd = OxmlElement("w:shd"); shd.set(qn("w:val"), "clear"); shd.set(qn("w:color"), "auto"); shd.set(qn("w:fill"), T9)
                tr._r.get_or_add_rPr().append(shd)
                for subj, v in rows:
                    p = c.add_paragraph(); _fill(p, "", 9.5, False, MUTED, None, 0.5, 0, None)
                    add_run(p, subj, 9.5, False, MUTED)
                    add_run(p, "  :  ", 9.5, False, LINE)
                    add_run(p, f"{num(v)}/5", 9.5, True, T7 if v == 5 else INK)
            else:
                shade(c, T9); borders(c, T9, 4)
                cell_text(c, "ملاحظات على النتائج", 12, True, GOLD_L, after=4)
                for line in ("حقق الصف الأول الثانوي الدرجة الكاملة 30 من 30.",
                             "الفارق بين الفصول الأربعة التالية 3 درجات فقط، من 22.5 إلى 25.5.",
                             "اللغة الإنجليزية: الدرجة الكاملة في الفصول الثلاثة المشاركة فيها.",
                             "التاريخ: الدرجة الكاملة في شعبتي الصف الثاني."):
                    cell_text(c, line, 9, False, "E4EEEC", new=True, before=3, line=1.3)

    # ---- page 6: papers
    heading(doc, "أوراق الأسئلة")
    para(doc, "أُعدت أسئلة كل مادة بمستوى الصف، وجُهزت في أوراق مطبوعة وأغلفة شفافة لكل فريق.", 11.5, False, INK, after=8)
    t = make_table(doc, 1, 2, [87, 87])
    big, side = t.rows[0].cells
    margins(big, 0, 0, 60, 60); margins(side, 0, 0, 60, 60)
    picture(big, crop("img04", 84, 126, (0.5, 0.35)), 84)
    p = big.add_paragraph(); _fill(p, "", 9.5, False, MUTED, None, 2, 6, 1.4)
    add_run(p, "أسئلة الكيمياء، الصف الثالث.", 9.5, True, T9); add_run(p, " اختيار من متعدد، صح أم خطأ، ومسائل حسابية ومفاهيمية.", 9.5, False, MUTED)
    picture(side, crop("img06", 84, 56, (0.5, 0.4)), 84)
    p = side.add_paragraph(); _fill(p, "", 9.5, False, MUTED, None, 2, 6, 1.4)
    add_run(p, "أسئلة الرياضيات، الصف الثاني.", 9.5, True, T9); add_run(p, " العلاقات والمصفوفات في ورقة جاهزة للفريق.", 9.5, False, MUTED)
    picture(side, crop("img11", 84, 56, (0.5, 0.5)), 84, new=True)
    p = side.add_paragraph(); _fill(p, "", 9.5, False, MUTED, None, 2, 0, 1.4)
    add_run(p, "اختبار التقنية الرقمية، الصف الثالث.", 9.5, True, T9); add_run(p, " أسئلة في إدارة المشروعات.", 9.5, False, MUTED)
    spacer(doc, 4)
    t = make_table(doc, 1, 1, [174])
    c = t.rows[0].cells[0]
    picture(c, crop("img08", 174, 42, (0.5, 0.5)), 174)
    p = c.add_paragraph(); _fill(p, "", 9.5, False, MUTED, None, 2, 0, 1.4)
    add_run(p, "أوراق الأسئلة جاهزة لكل فريق.", 9.5, True, T9); add_run(p, " كل مجموعة تستلم ورقتها في غلاف شفاف مع كرات ملونة.", 9.5, False, MUTED)

    # ---- page 7: atmosphere
    heading(doc, "أجواء المنافسة")
    para(doc, "اجتمعت الطالبات حول الطاولات في مجموعات تتشاور وتجيب، بينما شرحت المعلمات آلية كل ورقة.", 11.5, False, INK, after=8)
    t = make_table(doc, 1, 1, [174])
    c = t.rows[0].cells[0]
    picture(c, crop("img05", 174, 88, (0.5, 0.5)), 174)
    p = c.add_paragraph(); _fill(p, "", 9.5, False, MUTED, None, 2, 0, 1.4)
    add_run(p, "اختبار قواعد اللغة الإنجليزية.", 9.5, True, T9); add_run(p, " فريق يحل أسئلة Other, Others, Another.", 9.5, False, MUTED)
    spacer(doc, 6)
    t = make_table(doc, 2, 2, [87, 87])
    for c, (img, foc) in zip(t.rows[0].cells, [("img07", (0.5, 0.4)), ("img01", (0.5, 0.35))]):
        margins(c, 0, 0, 60, 60)
        picture(c, crop(img, 84, 90, foc), 84)
    for c, (b_, t_) in zip(t.rows[1].cells, [("ورقة الفيزياء.", " طالبة تكتب إجابتها."), ("شرح ورقة الكيمياء.", " المعلمة توضح الأسئلة قبل البدء.")]):
        margins(c, 40, 0, 60, 60)
        p = c.paragraphs[0]; _fill(p, "", 9.5, False, MUTED, None, 0, 0, 1.4)
        add_run(p, b_, 9.5, True, T9); add_run(p, t_, 9.5, False, MUTED)

    # ---- page 8: outcomes
    heading(doc, "النتائج المتوقعة ومؤشرات النجاح")
    para(doc, "تسعى المسابقة إلى أثر تعليمي يتجاوز يوم التنفيذ، ويُقاس نجاحها بمؤشرات محددة.", 11.5, False, INK, after=8)
    t = make_table(doc, 1, 2, [87, 87])
    a, b = t.rows[0].cells
    for c, h, items, dark in ((a, "النتائج المتوقعة", ["رفع التحصيل الدراسي", "تنمية التفكير والتحليل واتخاذ القرار", "تعزيز المنافسة الإيجابية", "اكتشاف الطالبات المتميزات"], False),
                              (b, "مؤشرات النجاح", ["نسبة المشاركة", "مستوى أداء الفرق", "تفاعل الطالبات", "مدى تحقق أهداف المسابقة"], True)):
        shade(c, T9 if dark else T0); borders(c, WHITE, 36); margins(c, 220, 220, 220, 220)
        cell_text(c, h, 14, True, GOLD_L if dark else T7, after=4)
        for it in items:
            p = c.add_paragraph(); _fill(p, "", 12, False, WHITE if dark else INK, None, 5, 0, 1.4)
            add_run(p, "●  ", 8, False, GOLD_L if dark else T7)
            add_run(p, it, 12, False, "E4EEEC" if dark else INK)
    spacer(doc, 8)
    subhead(doc, "الخلاصة", before=0)
    t = make_table(doc, 1, 3, [58, 58, 58])
    for c, (v, l) in zip(t.rows[0].cells, [("5", "فصول شاركت في المسابقة"), (f"{num(round(AVG,1))} / 30", "متوسط مجموع الدرجات"), ("30 / 30", "أعلى مجموع، حققه الصف الأول الثانوي")]):
        borders(c, WHITE, 36); margins(c, 160, 160, 160, 160); shade(c, WHITE); borders(c, LINE, 4)
        cell_text(c, v, 22, True, T9, line=1.1)
        cell_text(c, l, 10.5, False, MUTED, new=True, before=2, line=1.3)
    spacer(doc, 8)
    t = make_table(doc, 1, 1, [174])
    c = t.rows[0].cells[0]
    shade(c, T9); margins(c, 180, 180, 300, 300); valign(c)
    cell_text(c, "تكريم الفصل الفائز بكأس المعرفة، وتوثيق النتائج لتكون منطلقًا للنسخة القادمة.", 14, True, WHITE, line=1.6)
    spacer(doc, 6)
    t = make_table(doc, 1, 2, [82, 82])
    for c, (lab, val) in zip(t.rows[0].cells, [("إعداد المعلمتين", TEACHERS), ("مديرة المدرسة", PRINCIPAL)]):
        row_h(t.rows[0], 30)
        borders(c, INK, 6, ("top",)); margins(c, 120, 0, 0, 0); valign(c, "bottom")
        cell_text(c, lab, 10, False, MUTED)
        cell_text(c, val, 12.5, True, T9, new=True)

    # ---- page 9: appendix
    heading(doc, "ملحق الصور")
    para(doc, "جميع الصور الموثقة للمسابقة.", 11.5, False, INK, after=8)
    t = make_table(doc, 4, 3, [58, 58, 58])
    k = 0
    for r in t.rows:
        for c in r.cells:
            img, cap = APPENDIX[k]; k += 1
            margins(c, 0, 100, 60, 60)
            picture(c, crop(img, 54, 40, (0.5, 0.2) if img == "img09" else (0.5, 0.5)), 54)
            p = c.add_paragraph(); _fill(p, "", 9, False, MUTED, None, 2, 0, 1.3)
            add_run(p, f"{k}  ", 9, True, T9); add_run(p, cap, 9, False, MUTED)

    sort_children(doc.element)
    for sec in doc.sections:
        sort_children(sec.footer._element)
    doc.core_properties.title = "تقرير مسابقة كأس المعرفة"
    doc.core_properties.author = TEACHERS
    doc.save(OUT)
    embed_fonts(OUT)
    print("saved", OUT)


ORDERS = {
    "pPr": ["pStyle","keepNext","keepLines","pageBreakBefore","framePr","widowControl","numPr","suppressLineNumbers","pBdr","shd","tabs","suppressAutoHyphens","kinsoku","wordWrap","overflowPunct","topLinePunct","autoSpaceDE","autoSpaceDN","bidi","adjustRightInd","snapToGrid","spacing","ind","contextualSpacing","mirrorIndents","suppressOverlap","jc","textDirection","textAlignment","textboxTightWrap","outlineLvl","divId","cnfStyle","rPr","sectPr","pPrChange"],
    "rPr": ["rStyle","rFonts","b","bCs","i","iCs","caps","smallCaps","strike","dstrike","outline","shadow","emboss","imprint","noProof","snapToGrid","vanish","webHidden","color","spacing","w","kern","position","sz","szCs","highlight","u","effect","bdr","shd","fitText","vertAlign","rtl","cs","em","lang","eastAsianLayout","specVanish","oMath"],
    "tcPr": ["cnfStyle","tcW","gridSpan","hMerge","vMerge","tcBorders","shd","noWrap","tcMar","textDirection","tcFitText","vAlign","hideMark"],
    "tblPr": ["tblStyle","tblpPr","tblOverlap","bidiVisual","tblStyleRowBandSize","tblStyleColBandSize","tblW","jc","tblCellSpacing","tblInd","tblBorders","shd","tblLayout","tblCellMar","tblLook"],
    "trPr": ["cnfStyle","divId","gridBefore","gridAfter","wBefore","wAfter","cantSplit","trHeight","tblHeader","tblCellSpacing","jc","hidden"],
}


def sort_children(root):
    for tag, order in ORDERS.items():
        for el in root.iter(qn(f"w:{tag}")):
            kids = list(el)
            def key(k):
                n = k.tag.split("}")[1]
                return order.index(n) if n in order else len(order)
            kids_sorted = sorted(kids, key=key)
            if kids_sorted != kids:
                for k in kids:
                    el.remove(k)
                for k in kids_sorted:
                    el.append(k)


# ------------------------------------------------------------------ font embedding
def obfuscate(data: bytes, guid: str) -> bytes:
    key = bytes.fromhex(guid.replace("-", "").strip("{}"))[::-1]
    b = bytearray(data)
    for i in range(32):
        b[i] ^= key[i % 16]
    return bytes(b)


def embed_fonts(path):
    tmp = path.with_suffix(".tmp")
    fonts = [("embedRegular", B / "fonts/CairoW-Regular.ttf"), ("embedBold", B / "fonts/CairoW-Bold.ttf")]
    guids = [str(uuid.uuid4()).upper() for _ in fonts]
    zin = zipfile.ZipFile(path)
    zout = zipfile.ZipFile(tmp, "w", zipfile.ZIP_DEFLATED)
    names = zin.namelist()
    for n in names:
        data = zin.read(n)
        if n == "word/fontTable.xml":
            x = data.decode("utf8")
            emb = "".join(f'<w:{tag} r:id="rIdFont{i+1}" w:fontKey="{{{g}}}"/>' for i, ((tag, _), g) in enumerate(zip(fonts, guids)))
            font_el = f'<w:font w:name="{FONT}"><w:charset w:val="B2"/><w:family w:val="auto"/><w:pitch w:val="variable"/>{emb}</w:font>'
            if 'xmlns:r=' not in x.split(">", 2)[1] and "xmlns:r=" not in x[:600]:
                x = x.replace("<w:fonts ", '<w:fonts xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" ', 1)
            x = x.replace("</w:fonts>", font_el + "</w:fonts>")
            data = x.encode("utf8")
        elif n == "word/settings.xml":
            x = data.decode("utf8")
            if "embedTrueTypeFonts" not in x:
                x = re.sub(r"(<w:settings[^>]*>)", r"\1<w:embedTrueTypeFonts/>", x, count=1)
            data = x.encode("utf8")
        elif n == "[Content_Types].xml":
            x = data.decode("utf8")
            if 'Extension="odttf"' not in x:
                x = x.replace("<Default ", '<Default Extension="odttf" ContentType="application/vnd.openxmlformats-officedocument.obfuscatedFont"/><Default ', 1)
            data = x.encode("utf8")
        zout.writestr(n, data)
    rels = "".join(
        f'<Relationship Id="rIdFont{i+1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/font" Target="fonts/font{i+1}.odttf"/>'
        for i in range(len(fonts)))
    zout.writestr("word/_rels/fontTable.xml.rels",
                  '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' + rels + "</Relationships>")
    for i, ((_, fp), g) in enumerate(zip(fonts, guids)):
        zout.writestr(f"word/fonts/font{i+1}.odttf", obfuscate(fp.read_bytes(), g))
    zout.close(); zin.close()
    shutil.move(tmp, path)


build()
