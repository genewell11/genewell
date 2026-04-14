"""
Commercial-grade PDF generation with Genewell branding.
FORCE COVER PAGE WITH USER GRID - ABSOLUTE OVERWRITE.
"""
import io
from datetime import date
from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import mm
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle,
    PageBreak, HRFlowable
)
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_JUSTIFY

from .utils import map_scores, get_macros, get_essential_pathology_tests

# Brand colors
BRAND_PURPLE = colors.HexColor('#7C3AED')
BRAND_PINK = colors.HexColor('#EC4899')
LIGHT_BG = colors.HexColor('#F5F3FF')
DARK_TEXT = colors.HexColor('#1F2937')
MID_TEXT = colors.HexColor('#4B5563')
LIGHT_TEXT = colors.HexColor('#9CA3AF')
ACCENT_RED = colors.HexColor('#DC2626')
WHITE = colors.white

def build_styles():
    styles = {
        'cover_title': ParagraphStyle('cover_title', fontSize=32, textColor=BRAND_PURPLE,
                                       fontName='Helvetica-Bold', alignment=TA_CENTER, spaceAfter=8),
        'cover_subtitle': ParagraphStyle('cover_subtitle', fontSize=14, textColor=MID_TEXT,
                                          fontName='Helvetica', alignment=TA_CENTER, spaceAfter=6),
        'section_heading': ParagraphStyle('section_heading', fontSize=18, textColor=BRAND_PURPLE,
                                           fontName='Helvetica-Bold', spaceBefore=12, spaceAfter=8),
        'body': ParagraphStyle('body', fontSize=11, textColor=DARK_TEXT,
                                fontName='Helvetica', leading=16, spaceAfter=6, alignment=TA_JUSTIFY),
        'bullet': ParagraphStyle('bullet', fontSize=11, textColor=DARK_TEXT,
                                  fontName='Helvetica', leading=15, spaceAfter=4,
                                  leftIndent=14, bulletIndent=0),
        'disclaimer': ParagraphStyle('disclaimer', fontSize=10, textColor=ACCENT_RED,
                                      fontName='Helvetica-Bold', spaceAfter=6, alignment=TA_LEFT),
        'disclaimer_text': ParagraphStyle('disclaimer_text', fontSize=9, textColor=DARK_TEXT,
                                           fontName='Helvetica', leading=13, spaceAfter=6),
        'citation': ParagraphStyle('citation', fontSize=9, textColor=LIGHT_TEXT,
                                    fontName='Helvetica-Oblique', spaceAfter=4),
    }
    return styles

def build_cover(story, styles, user, scores):
    story.append(Spacer(1, 20 * mm))
    story.append(Paragraph('🌿 GENEWELL WELLNESS BLUEPRINT', styles['cover_title']))
    story.append(Paragraph('Personalized Health & Wellness Analysis Report', styles['cover_subtitle']))
    story.append(Spacer(1, 10 * mm))
    
    # THE GRID - 4 COLUMNS
    user_info = [
        ['CLIENT NAME:', user.name.upper(), 'DATE:', date.today().strftime('%d %B %Y')],
        ['ORDER ID:', str(user.order_id).split('-')[-1], 'PLAN:', user.get_plan_type_display()],
        ['AGE:', f"{user.age} years", 'GENDER:', user.gender.upper()],
        ['HEIGHT:', f"{user.height_cm} cm", 'WEIGHT:', f"{user.weight_kg} kg"],
        ['BMI:', f"{user.bmi} ({'Overweight' if user.bmi >= 25 else 'Normal'})", 'TDEE:', f"{int(user.tdee)} kcal"],
    ]
    
    t = Table(user_info, colWidths=[40*mm, 45*mm, 40*mm, 45*mm])
    t.setStyle(TableStyle([
        ('FONTNAME', (0, 0), (-1, -1), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, -1), 10),
        ('TEXTCOLOR', (0, 0), (0, -1), BRAND_PURPLE),
        ('TEXTCOLOR', (2, 0), (2, -1), BRAND_PURPLE),
        ('BACKGROUND', (0, 0), (-1, -1), LIGHT_BG),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.grey),
        ('LEFTPADDING', (0, 0), (-1, -1), 10),
        ('TOPPADDING', (0, 0), (-1, -1), 8),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
    ]))
    story.append(t)
    story.append(Spacer(1, 15 * mm))
    
    story.append(Paragraph('<b>⚠️ IMPORTANT MEDICAL DISCLAIMER</b>', styles['disclaimer']))
    story.append(Paragraph(
        'This report is for educational purposes only. It is NOT medical advice. '
        'Always consult a doctor before starting any new diet or exercise program.',
        styles['disclaimer_text']
    ))
    story.append(PageBreak())

def generate_wellness_pdf(user, app_url='http://localhost:8000'):
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=A4, rightMargin=15*mm, leftMargin=15*mm, topMargin=15*mm, bottomMargin=15*mm)
    styles = build_styles()
    scores = map_scores(user)
    macros = get_macros(user)
    story = []
    
    # CRITICAL: EXPLICIT CALL TO build_cover
    build_cover(story, styles, user, scores)
    
    # Page 2: Metabolic Profile
    story.append(Paragraph('Your Metabolic Profile', styles['section_heading']))
    story.append(Paragraph(f"<b>Basal Metabolic Rate (BMR): {int(user.bmr)} kcal/day</b>", styles['body']))
    story.append(Paragraph(f"<b>Total Daily Energy Expenditure (TDEE): {int(user.tdee)} kcal/day</b>", styles['body']))
    story.append(Paragraph(f"<b>Body Mass Index (BMI): {user.bmi}</b>", styles['body']))
    
    # ESSENTIAL & PREMIUM: Include pathology tests
    if user.plan_type in ('essential', 'premium', 'coaching'):
        story.append(Spacer(1, 5*mm))
        story.append(Paragraph('Recommended Pathology Lab Tests', styles['section_heading']))
        tests = get_essential_pathology_tests(user)
        for i, test in enumerate(tests, 1):
            story.append(Paragraph(f"<b>{i}. {test['name']}</b>", styles['body']))
            story.append(Paragraph(f"{test['reason']} ({test['frequency']})", styles['body']))
            story.append(Spacer(1, 2*mm))
    
    doc.build(story)
    buffer.seek(0)
    return buffer
