import os
import re
import html
from io import BytesIO
from datetime import datetime
from typing import List, Dict, Any

from reportlab.lib.pagesizes import letter
from reportlab.lib import colors
from reportlab.platypus import (
    SimpleDocTemplate,
    Paragraph,
    Spacer,
    Table,
    TableStyle,
    KeepTogether
)
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.pdfgen import canvas
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont

# Global font fallback configuration
FONT_REGULAR = "Helvetica"
FONT_BOLD = "Helvetica-Bold"

nirmala_path = "C:/Windows/Fonts/Nirmala.ttc"
if os.path.exists(nirmala_path):
    try:
        # Register Nirmala UI for full Indic (Kannada, Hindi, Tamil, etc.) script support
        pdfmetrics.registerFont(TTFont('Nirmala', nirmala_path, subfontIndex=0))
        pdfmetrics.registerFont(TTFont('Nirmala-Bold', nirmala_path, subfontIndex=1))
        FONT_REGULAR = "Nirmala"
        FONT_BOLD = "Nirmala-Bold"
        print("[PDF] Nirmala Unicode font successfully registered for PDF rendering.")
    except Exception as e:
        print(f"[PDF Warning] Failed to register Nirmala font, using system Helvetica fallback: {e}")

class NumberedCanvas(canvas.Canvas):
    """Canvas that computes total pages dynamically and draws professional headers/footers."""
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self._saved_page_states = []

    def showPage(self):
        self._saved_page_states.append(dict(self.__dict__))
        self._startPage()

    def save(self):
        num_pages = len(self._saved_page_states)
        for state in self._saved_page_states:
            self.__dict__.update(state)
            self.draw_header_footer(num_pages)
            super().showPage()
        super().save()

    def draw_header_footer(self, page_count):
        self.saveState()
        self.setFont(FONT_REGULAR, 8)
        self.setFillColor(colors.HexColor("#64748B"))  # Slate Gray

        # Header - Skip on first page
        if self._pageNumber > 1:
            self.drawString(54, 750, "Postgres DB AI Agent - Conversation History")
            self.setStrokeColor(colors.HexColor("#E2E8F0"))
            self.setLineWidth(0.5)
            self.line(54, 742, 558, 742)

        # Footer - Draw on all pages
        self.setStrokeColor(colors.HexColor("#E2E8F0"))
        self.setLineWidth(0.5)
        self.line(54, 52, 558, 52)

        # Bottom text
        self.drawString(54, 38, f"Generated: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        self.drawRightString(558, 38, f"Page {self._pageNumber} of {page_count}")
        self.restoreState()


def md_to_html(text: str) -> str:
    """Preprocess basic Markdown syntax into ReportLab-supported HTML-like tags."""
    if not text:
        return ""
    
    # Escape HTML entities first to avoid parsing errors
    escaped = html.escape(text)

    # Convert headers
    # Note: Headings will be handled separately when splitting text by paragraph, 
    # but let's parse basic inline styling first.
    
    # Bold **text**
    escaped = re.sub(r'\*\*(.*?)\*\*', r'<b>\1</b>', escaped)

    # Inline code `code`
    escaped = re.sub(
        r'&amp;quot;(.*?)&amp;quot;', 
        r'\1', 
        escaped
    ) # Fix doubly-escaped quotes
    escaped = re.sub(
        r'`(.*?)`', 
        r'<font face="Courier" size="9" color="#C7254E"><b>\1</b></font>', 
        escaped
    )

    # Italics *text*
    escaped = re.sub(r'\*(.*?)\*', r'<i>\1</i>', escaped)

    # Convert newlines to breaks
    escaped = escaped.replace('\n', '<br/>')

    return escaped


def generate_pdf(messages: List[Dict[str, Any]]) -> BytesIO:
    """Generate a beautifully formatted PDF from the conversation history."""
    buffer = BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=letter,
        leftMargin=54,
        rightMargin=54,
        topMargin=54,
        bottomMargin=72
    )

    story = []
    styles = getSampleStyleSheet()

    # Define professional custom styles
    title_style = ParagraphStyle(
        'DocTitle',
        parent=styles['Normal'],
        fontName=FONT_BOLD,
        fontSize=20,
        leading=24,
        textColor=colors.white,
        alignment=0  # Left align
    )
    
    subtitle_style = ParagraphStyle(
        'DocSubtitle',
        parent=styles['Normal'],
        fontName=FONT_REGULAR,
        fontSize=10,
        leading=14,
        textColor=colors.HexColor("#94A3B8"), # Muted slate blue
        alignment=0
    )

    normal_style = ParagraphStyle(
        'CustomNormal',
        parent=styles['Normal'],
        fontName=FONT_REGULAR,
        fontSize=9.5,
        leading=14.5,
        textColor=colors.HexColor("#1E293B") # Dark slate
    )

    heading3_style = ParagraphStyle(
        'CustomHeading3',
        parent=normal_style,
        fontName=FONT_BOLD,
        fontSize=11,
        leading=15,
        textColor=colors.HexColor("#0F172A"),
        spaceBefore=8,
        spaceAfter=4
    )

    user_title_style = ParagraphStyle(
        'UserTitle',
        parent=normal_style,
        fontName=FONT_BOLD,
        fontSize=11.5,
        textColor=colors.HexColor("#3B82F6"), # Blue accent
        spaceBefore=12,
        spaceAfter=6
    )

    ai_title_style = ParagraphStyle(
        'AiTitle',
        parent=normal_style,
        fontName=FONT_BOLD,
        fontSize=11.5,
        textColor=colors.HexColor("#4F46E5"), # Indigo/purple accent
        spaceBefore=12,
        spaceAfter=6
    )

    sql_code_style = ParagraphStyle(
        'SqlCode',
        parent=normal_style,
        fontName='Courier',
        fontSize=8,
        leading=10,
        textColor=colors.HexColor("#0F172A")
    )

    # 1. Add Title Banner Block
    banner_content = [
        [Paragraph("AI DATABASE AGENT REPORT", title_style)],
        [Paragraph(f"Conversation Transcript • Generated {datetime.now().strftime('%B %d, %Y')}", subtitle_style)]
    ]
    
    # 504 pt is the exact printable width (612 width - 108 margins)
    banner_table = Table(banner_content, colWidths=[504])
    banner_table.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), colors.HexColor("#1E3A8A")), # Deep Navy Blue
        ('PADDING', (0,0), (-1,-1), 16),
        ('BOTTOMPADDING', (0,1), (-1,1), 16),
        ('ALIGN', (0,0), (-1,-1), 'LEFT'),
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
    ]))
    story.append(banner_table)
    story.append(Spacer(1, 15))

    # 2. Iterate and render messages
    for idx, msg in enumerate(messages):
        role = msg.get("role", "user")
        content = msg.get("content", "")
        
        if not content.strip():
            continue

        # Header Label (User vs Assistant)
        if role == "user":
            label_text = "👤 USER MESSAGE"
            title_p = Paragraph(label_text, user_title_style)
        else:
            label_text = "🤖 AI ASSISTANT"
            title_p = Paragraph(label_text, ai_title_style)

        story.append(title_p)

        # Split content into paragraphs to format headers properly
        paragraphs = content.split('\n')
        for p_text in paragraphs:
            if not p_text.strip():
                continue
            
            # Format headers
            if p_text.startswith("### "):
                p_el = Paragraph(md_to_html(p_text[4:]), heading3_style)
            elif p_text.startswith("## "):
                head_style = ParagraphStyle(
                    'CustomSubHeading',
                    parent=heading3_style,
                    fontSize=13,
                    textColor=colors.HexColor("#1E3A8A"),
                    spaceBefore=10,
                    spaceAfter=4
                )
                p_el = Paragraph(md_to_html(p_text[3:]), head_style)
            elif p_text.startswith("# "):
                head_style = ParagraphStyle(
                    'CustomMainHeading',
                    parent=heading3_style,
                    fontSize=14,
                    textColor=colors.HexColor("#1E3A8A"),
                    spaceBefore=12,
                    spaceAfter=6
                )
                p_el = Paragraph(md_to_html(p_text[2:]), head_style)
            elif p_text.strip().startswith("* ") or p_text.strip().startswith("- "):
                # Bullet list parsing
                bullet_text = f"• {md_to_html(p_text.strip()[2:])}"
                bullet_style = ParagraphStyle(
                    'BulletStyle',
                    parent=normal_style,
                    leftIndent=15,
                    firstLineIndent=-10,
                    spaceAfter=3
                )
                p_el = Paragraph(bullet_text, bullet_style)
            else:
                try:
                    p_el = Paragraph(md_to_html(p_text), normal_style)
                except Exception:
                    p_el = Paragraph(html.escape(p_text), normal_style)
            
            story.append(p_el)
            story.append(Spacer(1, 4))

        # Show executed queries if present in the message metadata
        executed_queries = msg.get("executedQueries")
        if executed_queries and isinstance(executed_queries, list):
            story.append(Spacer(1, 4))
            story.append(Paragraph("<b>Executed SQL Queries:</b>", heading3_style))
            story.append(Spacer(1, 2))
            
            for q in executed_queries:
                sql_query = q.get("args", {}).get("sql", "").strip()
                if not sql_query:
                    continue
                
                # Render SQL query inside a shaded grey block table (safe to keep together since individual queries are short)
                sql_p = Paragraph(html.escape(sql_query).replace('\n', '<br/>'), sql_code_style)
                sql_table = Table([[sql_p]], colWidths=[490])
                sql_table.setStyle(TableStyle([
                    ('BACKGROUND', (0,0), (-1,-1), colors.HexColor("#F1F5F9")),
                    ('BOX', (0,0), (-1,-1), 0.5, colors.HexColor("#CBD5E1")),
                    ('PADDING', (0,0), (-1,-1), 8),
                    ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
                ]))
                
                story.append(KeepTogether([sql_table]))
                story.append(Spacer(1, 6))

        # Horizontal separator line between messages
        separator = Table([[""]], colWidths=[504])
        separator.setStyle(TableStyle([
            ('LINEBELOW', (0,0), (-1,-1), 0.5, colors.HexColor("#E2E8F0")),
            ('BOTTOMPADDING', (0,0), (-1,-1), 6),
        ]))
        story.append(separator)
        story.append(Spacer(1, 10))

    # Build PDF doc using custom canvas
    doc.build(story, canvasmaker=NumberedCanvas)
    buffer.seek(0)
    return buffer
