"""Generate ARCHITECTURE.pdf from ARCHITECTURE.md using reportlab."""
import re
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import mm
from reportlab.lib.colors import HexColor
from reportlab.lib.enums import TA_LEFT, TA_CENTER
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle,
    PageBreak, Preformatted, KeepTogether
)
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont

# Try to register a font that supports Cyrillic
import os
font_registered = False
for font_dir in [
    "/usr/share/fonts/truetype/dejavu",
    "/usr/share/fonts/TTF",
    "/usr/share/fonts/dejavu",
]:
    sans_path = os.path.join(font_dir, "DejaVuSans.ttf")
    mono_path = os.path.join(font_dir, "DejaVuSansMono.ttf")
    if os.path.exists(sans_path):
        pdfmetrics.registerFont(TTFont("DejaVu", sans_path))
        bold_path = sans_path.replace("Sans.", "Sans-Bold.")
        if os.path.exists(bold_path):
            pdfmetrics.registerFont(TTFont("DejaVuBold", bold_path))
        else:
            pdfmetrics.registerFont(TTFont("DejaVuBold", sans_path))
        if os.path.exists(mono_path):
            pdfmetrics.registerFont(TTFont("DejaVuMono", mono_path))
        else:
            pdfmetrics.registerFont(TTFont("DejaVuMono", sans_path))
        font_registered = True
        break

FONT = "DejaVu" if font_registered else "Helvetica"
FONT_BOLD = "DejaVuBold" if font_registered else "Helvetica-Bold"
FONT_MONO = "DejaVuMono" if font_registered else "Courier"

styles = getSampleStyleSheet()

# Custom styles
styles.add(ParagraphStyle(
    "DocTitle", parent=styles["Title"], fontName=FONT_BOLD,
    fontSize=22, spaceAfter=6, textColor=HexColor("#1e40af")
))
styles.add(ParagraphStyle(
    "H1", parent=styles["Heading1"], fontName=FONT_BOLD,
    fontSize=16, spaceBefore=18, spaceAfter=8, textColor=HexColor("#1e3a8a")
))
styles.add(ParagraphStyle(
    "H2", parent=styles["Heading2"], fontName=FONT_BOLD,
    fontSize=13, spaceBefore=12, spaceAfter=6, textColor=HexColor("#2563eb")
))
styles.add(ParagraphStyle(
    "H3", parent=styles["Heading3"], fontName=FONT_BOLD,
    fontSize=11, spaceBefore=8, spaceAfter=4, textColor=HexColor("#3b82f6")
))
styles.add(ParagraphStyle(
    "Body", parent=styles["Normal"], fontName=FONT,
    fontSize=9, leading=13, spaceAfter=4
))
styles.add(ParagraphStyle(
    "CodeBlock", fontName=FONT_MONO, fontSize=7, leading=9,
    leftIndent=10, spaceAfter=6, spaceBefore=4,
    backColor=HexColor("#f3f4f6"), borderPadding=4
))
styles.add(ParagraphStyle(
    "BulletItem", parent=styles["Normal"], fontName=FONT,
    fontSize=9, leading=12, leftIndent=15, bulletIndent=5, spaceAfter=2
))
styles.add(ParagraphStyle(
    "TableCell", fontName=FONT, fontSize=8, leading=10
))
styles.add(ParagraphStyle(
    "TableHeader", fontName=FONT_BOLD, fontSize=8, leading=10,
    textColor=HexColor("#ffffff")
))


def clean_text(text):
    """Remove markdown formatting for paragraph text."""
    text = re.sub(r'\*\*(.+?)\*\*', r'<b>\1</b>', text)
    text = re.sub(r'`(.+?)`', rf'<font face="{FONT_MONO}" size="8">\1</font>', text)
    text = text.replace("--", "\u2014")
    text = text.replace("→", "\u2192")
    text = text.replace("↔", "\u2194")
    text = text.replace("&", "&amp;")
    # Fix ampersand in already-converted tags
    text = text.replace("&amp;amp;", "&amp;")
    return text


def parse_table(lines):
    """Parse markdown table into list of rows."""
    rows = []
    for line in lines:
        line = line.strip()
        if line.startswith("|") and not re.match(r'^\|[\s\-\|]+\|$', line):
            cells = [c.strip() for c in line.split("|")[1:-1]]
            rows.append(cells)
    return rows


def build_table(rows):
    """Build a reportlab Table from parsed rows."""
    if not rows:
        return None

    header = rows[0]
    data_rows = rows[1:]

    table_data = []
    # Header
    table_data.append([Paragraph(clean_text(c), styles["TableHeader"]) for c in header])
    # Data
    for row in data_rows:
        table_data.append([Paragraph(clean_text(c), styles["TableCell"]) for c in row])

    num_cols = len(header)
    col_width = (A4[0] - 40*mm) / num_cols

    t = Table(table_data, colWidths=[col_width] * num_cols)
    t.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), HexColor("#2563eb")),
        ("TEXTCOLOR", (0, 0), (-1, 0), HexColor("#ffffff")),
        ("ALIGN", (0, 0), (-1, -1), "LEFT"),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("FONTNAME", (0, 0), (-1, 0), FONT_BOLD),
        ("FONTSIZE", (0, 0), (-1, -1), 8),
        ("BOTTOMPADDING", (0, 0), (-1, 0), 6),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 1), (-1, -1), 4),
        ("GRID", (0, 0), (-1, -1), 0.5, HexColor("#d1d5db")),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [HexColor("#ffffff"), HexColor("#f9fafb")]),
    ]))
    return t


def md_to_story(md_text):
    """Convert markdown text to reportlab story elements."""
    story = []
    lines = md_text.split("\n")
    i = 0
    in_code = False
    code_lines = []
    in_table = False
    table_lines = []

    while i < len(lines):
        line = lines[i]

        # Code block
        if line.strip().startswith("```"):
            if in_code:
                code_text = "\n".join(code_lines)
                if code_text.strip():
                    story.append(Preformatted(code_text, styles["CodeBlock"]))
                code_lines = []
                in_code = False
            else:
                # Flush table if any
                if in_table:
                    rows = parse_table(table_lines)
                    t = build_table(rows)
                    if t:
                        story.append(t)
                        story.append(Spacer(1, 4))
                    table_lines = []
                    in_table = False
                in_code = True
            i += 1
            continue

        if in_code:
            code_lines.append(line)
            i += 1
            continue

        # Table
        if line.strip().startswith("|"):
            if not in_table:
                in_table = True
                table_lines = []
            table_lines.append(line)
            i += 1
            continue
        elif in_table:
            rows = parse_table(table_lines)
            t = build_table(rows)
            if t:
                story.append(t)
                story.append(Spacer(1, 4))
            table_lines = []
            in_table = False

        stripped = line.strip()

        # Skip empty lines / horizontal rules
        if stripped == "" or stripped == "---":
            story.append(Spacer(1, 4))
            i += 1
            continue

        # Headings
        if stripped.startswith("# ") and not stripped.startswith("## "):
            story.append(Paragraph(clean_text(stripped[2:]), styles["DocTitle"]))
            i += 1
            continue
        if stripped.startswith("## "):
            story.append(Spacer(1, 8))
            story.append(Paragraph(clean_text(stripped[3:]), styles["H1"]))
            i += 1
            continue
        if stripped.startswith("### "):
            story.append(Paragraph(clean_text(stripped[4:]), styles["H2"]))
            i += 1
            continue
        if stripped.startswith("#### "):
            story.append(Paragraph(clean_text(stripped[5:]), styles["H3"]))
            i += 1
            continue

        # Bullet points
        if stripped.startswith("- ") or stripped.startswith("* "):
            text = clean_text(stripped[2:])
            story.append(Paragraph(f"\u2022 {text}", styles["BulletItem"]))
            i += 1
            continue

        # Regular paragraph
        if stripped:
            story.append(Paragraph(clean_text(stripped), styles["Body"]))

        i += 1

    # Flush remaining table
    if in_table:
        rows = parse_table(table_lines)
        t = build_table(rows)
        if t:
            story.append(t)

    return story


# Read markdown
with open("/app/docs/ARCHITECTURE.md", "r", encoding="utf-8") as f:
    md_content = f.read()

# Build PDF
doc = SimpleDocTemplate(
    "/app/docs/ARCHITECTURE.pdf",
    pagesize=A4,
    leftMargin=20*mm, rightMargin=20*mm,
    topMargin=15*mm, bottomMargin=15*mm,
)

story = md_to_story(md_content)
doc.build(story)
print("PDF generated: /app/docs/ARCHITECTURE.pdf")
