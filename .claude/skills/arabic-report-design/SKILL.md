---
name: arabic-report-design
description: Use whenever the user asks for a report, document, brief, certificate, summary, plan or any printable/shareable file, especially in Arabic. Builds a professionally designed RTL A4 document with clear Cairo typography, a restrained brand palette, embedded photos and tables, and delivers BOTH a PDF and a Word (.docx) file. Also use its design rules for any Arabic page or program UI.
---

# Arabic report design (PDF + Word)

Goal: when the user asks for a report, produce something that looks designed, not generated. Always deliver **PDF and Word**, send both with `SendUserFile`, and keep the content faithful to the user's own data. Never invent names, dates, numbers or results.

## Workflow
1. **Read everything first.** Open every file and image the user supplied (Read tool shows images). Note what is actually visible; do not guess unreadable text.
2. **Design read (one line):** document kind, audience, tone, palette. Reuse the user's own brand assets (poster colors, logo) before inventing a palette.
3. **Apply the design skills**: `design-taste-frontend` (hierarchy, anti-slop rules), `high-end-visual-design`, `minimalist-ui` when the tone is calm, `full-output-enforcement` (never abbreviate content).
4. **Set up tools:** `bash .claude/skills/arabic-report-design/setup.sh <workdir>` (installs Playwright core, Phosphor icons, Cairo fonts, python-docx).
5. **Build the PDF** from HTML: copy `reference/example_report_html.py` and `reference/render_pdf.mjs` into the workdir, replace the data and copy, run it. Chromium is preinstalled at `/opt/pw-browsers/chromium-*/chrome-linux/chrome`; never run `playwright install`.
6. **Build the Word file** from `reference/example_report_docx.py` (python-docx, Cairo embedded).
7. **Verify visually:** render PDF pages to PNG (`pdftoppm -r 60`), view them, fix overflow, clipped text, empty gaps. Convert the .docx with `soffice --headless --convert-to pdf` and confirm the same page count.
8. Save outputs inside the project folder, send both files, summarize in a few lines. If the user's input folder contains photos of people (students, children), do not commit it to a public repo or to `main`: the Pages workflow publishes the whole repo root.

## Design rules
- **Font:** Cairo (400/600/700/800). Never letter-space Arabic. Body 11 to 12pt, lead 13.5 to 14.5pt, headings 24 to 26pt bold.
- **Palette:** one dark brand color, one accent (used sparingly), light tints, off-white page `#FBFCFB`, off-black text `#1B2826`. Pure black and pure white are not used for text and backgrounds. Check contrast (body 4.5:1).
- **Shape:** one radius (14px) everywhere. No decorative dots, no scroll cues, no em-dash characters anywhere in visible text (use a comma, colon or hyphen).
- **Structure:** cover, summary with 3 to 4 stat tiles, process or plan, data table or ranking, photo pages with plain captions, closing and signatures, photo appendix. Eyebrow labels sparingly. One heading style with a short gold rule.
- **Images:** real photos from the user, cropped with `object-fit: cover`, captions below (never text pills on top of photos). Icons only from Phosphor (`@phosphor-icons/core`), never hand-drawn SVG.
- **Numbers:** western digits, units attached (`25/30`). Derived values (averages, ranks) must be computable from the supplied data.

## Pitfalls learned
- HTML to PDF: `.page{width:210mm;height:297mm;overflow:hidden}` hides overflow silently. Always view every page.
- RTL tables in Word need `w:bidiVisual` on `tblPr` (not `w:bidi`), and child elements of `pPr/rPr/tcPr/tblPr` must be in schema order (the example script sorts them).
- A full-bleed table on a zero-margin cover page spills a blank second page. Use 9mm margins and a card (row height 268mm exact).
- `cell.add_table()` appends an extra paragraph after the nested table; shrink it to 1pt or rows become tall.
- Add `pageBreakBefore` on headings instead of separate page-break paragraphs (avoids blank pages).
- Cairo has tall line metrics: in Word use exact line heights for big cover text.
- Embed Cairo in the docx (obfuscated `odttf`) so Word on other machines keeps the typography; the example script does it.
- Network: CDN downloads can be blocked by the proxy. Get fonts from npm (`@expo-google-fonts/cairo`), which `setup.sh` already does.
