#!/usr/bin/env python3
"""Create the bilingual, opaque 1280×800 Chrome Web Store feature graphic.

Requires Pillow and Apple SD Gothic Neo (macOS). This is a labelled feature
overview, not a browser screenshot. It illustrates only shipped functionality.
"""

from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "store" / "feature-overview-1280x800.png"
FONT = "/System/Library/Fonts/AppleSDGothicNeo.ttc"
SCALE = 2
SIZE = (1280, 800)

BG = "#F5F7FC"
FG = "#14223C"
MUTED = "#5D6B83"
BLUE = "#2563EB"
LINE = "#DDE4F0"

canvas = Image.new("RGB", (SIZE[0] * SCALE, SIZE[1] * SCALE), BG)
draw = ImageDraw.Draw(canvas)


def rect(box, fill, radius=0, outline=None, width=1):
    scaled = tuple(round(v * SCALE) for v in box)
    draw.rounded_rectangle(scaled, radius=radius * SCALE, fill=fill,
                           outline=outline, width=width * SCALE)


def text(x, y, value, size=20, color=FG, weight="regular"):
    face = {"regular": 0, "medium": 2, "semibold": 4, "bold": 6}[weight]
    font = ImageFont.truetype(FONT, size * SCALE, index=face)
    draw.text((x * SCALE, y * SCALE), value, font=font, fill=color, anchor="lt")


def key(x, y, w, label):
    rect((x, y + 4, x + w, y + 60), "#CCD8F7", radius=10)
    rect((x, y, x + w, y + 54), "#FFFFFF", radius=10, outline="#D6E0F7")
    font = ImageFont.truetype(FONT, 27 * SCALE, index=4)
    draw.text(((x + w / 2) * SCALE, (y + 27) * SCALE), label,
              font=font, fill=FG, anchor="mm")


# Brand and a clear content label keep this an explanatory asset.
icon = Image.open(ROOT / "icons" / "icon-128.png").convert("RGBA")
icon = icon.resize((48 * SCALE, 48 * SCALE), Image.Resampling.LANCZOS)
canvas.paste(icon, (64 * SCALE, 43 * SCALE), icon)
text(126, 52, "URL Copier", 28, weight="bold")
text(64, 122, "Copy the URL.", 59, weight="bold")
text(64, 188, "Keep your flow.", 59, weight="bold")
text(67, 271, "단축키 한 번으로, 현재 탭 주소 그대로.", 24, color=MUTED)
text(1022, 59, "FEATURE OVERVIEW", 14, color=MUTED, weight="semibold")

# Real default command, with its macOS name directly below.
rect((786, 124, 1216, 311), "#E8EFFE", radius=24)
text(814, 145, "One shortcut. Full address.", 23, weight="semibold")
key(814, 188, 84, "Alt")
text(911, 206, "+", 27, color=MUTED)
key(942, 188, 121, "Shift")
text(1076, 206, "+", 27, color=MUTED)
key(1107, 188, 81, "C")
text(814, 269, "macOS: Option + Shift + C", 18, color=MUTED)

# A sample URL illustrates the exact plain-text output, without fabricating UI.
rect((64, 351, 806, 601), "#FFFFFF", radius=22, outline=LINE)
text(92, 379, "Copied as plain text", 25, weight="semibold")
text(92, 416, "일반 텍스트로 복사되는 주소 예시", 18, color=MUTED)
rect((92, 459, 778, 521), "#F0F4FB", radius=12)
text(109, 481, "https://example.com/page?ref=share#section", 23, weight="medium")
text(92, 548, "Query parameters and fragments stay unchanged.", 18, color=MUTED)

# This is explicitly a preview of the actual toast, not a browser screenshot.
rect((834, 351, 1216, 601), "#FFFFFF", radius=22, outline=LINE)
text(860, 379, "Copy confirmation preview", 22, weight="semibold")
text(860, 413, "복사 확인 알림 미리보기", 18, color=MUTED)
rect((860, 463, 1190, 521), "#2B2C2F", radius=10)
text(880, 482, "✓", 23, color="#81C995", weight="semibold")
text(913, 483, "URL copied", 21, color="#FFFFFF", weight="medium")
text(860, 548, "Bottom-right · Disappears in ~1.8s", 17, color=MUTED)

text(64, 646, "Unchanged URL", 24, weight="semibold")
text(64, 682, "주소를 가공하지 않고 그대로", 19, color=MUTED)
text(475, 646, "Processed on your device", 24, weight="semibold")
text(475, 682, "기기 안에서 처리 · 외부 전송 없음", 19, color=MUTED)
text(935, 646, "Make the key yours", 24, weight="semibold")
text(935, 682, "아이콘 → 크롬 단축키 설정", 19, color=MUTED)

draw.line((64 * SCALE, 737 * SCALE, 1216 * SCALE, 737 * SCALE), fill=LINE,
          width=SCALE)
text(64, 757, "GreedyLabs", 16, color=MUTED, weight="semibold")
text(1019, 757, "URL Copier · 기능 안내", 16, color=MUTED)

canvas = canvas.resize(SIZE, Image.Resampling.LANCZOS)
canvas.save(OUT, optimize=True)
print(OUT)
print(f"{canvas.width}×{canvas.height} · {canvas.mode} · opaque PNG")
