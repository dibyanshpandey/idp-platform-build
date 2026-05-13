import fitz  # PyMuPDF
import io
from collections import defaultdict

def analyze_font(file_bytes: bytes, filename: str) -> dict:
    """
    Detects font subsetting anomalies in PDFs.
    If a page contains a font that is not used anywhere else in the document,
    it may indicate injected or forged text blocks — a common technique
    where a forger pastes text from a different source using a non-native font.
    """
    if not filename.lower().endswith(".pdf"):
        return {
            "status": "Pass",
            "reason": "Not a PDF, skipping font analysis."
        }

    try:
        doc = fitz.open(stream=file_bytes, filetype="pdf")

        if len(doc) == 0:
            return {
                "status": "Pass",
                "reason": "Empty PDF, no fonts to analyze."
            }

        # Build a global font usage map: font_name -> set of page numbers
        font_usage = defaultdict(set)
        page_font_map = {}

        for page_num in range(len(doc)):
            page = doc.load_page(page_num)
            fonts = page.get_fonts(full=True)
            page_fonts = set()

            for font in fonts:
                # font tuple: (xref, ext, type, basefont, name, encoding)
                font_name = font[3] if font[3] else font[4]
                if font_name:
                    font_name = font_name.strip()
                    font_usage[font_name].add(page_num)
                    page_fonts.add(font_name)

            page_font_map[page_num] = page_fonts

        # If there's only one page, we can't do cross-page analysis
        if len(doc) <= 1 and len(font_usage) <= 2:
            doc.close()
            return {
                "status": "Pass",
                "reason": "Single page document with consistent fonts."
            }

        # Detect orphan fonts: used on exactly one page and not the primary font
        all_fonts = list(font_usage.keys())
        if len(all_fonts) == 0:
            doc.close()
            return {
                "status": "Pass",
                "reason": "No embedded fonts detected."
            }

        # Find the most common font (the "primary" font)
        primary_font = max(font_usage.keys(), key=lambda f: len(font_usage[f]))

        anomalies = []
        for font_name, pages in font_usage.items():
            if font_name == primary_font:
                continue
            if len(pages) == 1:
                page_num = list(pages)[0]
                anomalies.append(f"Font '{font_name}' appears only on page {page_num + 1}")

        doc.close()

        if len(anomalies) > 0:
            detail = "; ".join(anomalies[:3])
            return {
                "status": "Fail",
                "reason": f"Font anomaly detected: {detail}. This may indicate injected text from a different source."
            }

        return {
            "status": "Pass",
            "reason": f"All {len(all_fonts)} fonts are consistently used across the document."
        }
    except Exception as e:
        return {
            "status": "Review",
            "reason": f"Font analysis failed: {str(e)}"
        }
