"""
Generate Chrome Web Store promotional images for Thai Lottery Extension.
Requires: pip install Pillow
"""
from PIL import Image, ImageDraw, ImageFont
import os

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
STORE_DIR = os.path.join(os.path.dirname(SCRIPT_DIR), 'store')
ICON_PATH = os.path.join(os.path.dirname(SCRIPT_DIR), 'icons', 'icon128.png')

# Colors
BG_DARK = '#0f1923'
BG_CARD = '#1a2332'
GOLD = '#ffd700'
TEAL = '#008b8b'
RED = '#c0392b'
WHITE = '#ffffff'
LIGHT_GRAY = '#b0b0b0'
BLUE = '#4fc3f7'

def get_font(size, bold=False):
    """Try to get a Thai-capable font."""
    thai_fonts = [
        '/System/Library/Fonts/Thonburi.ttc',
        '/System/Library/Fonts/Supplemental/Thonburi.ttc',
        '/Library/Fonts/Thonburi.ttc',
        '/System/Library/Fonts/Supplemental/Arial Unicode.ttf',
    ]
    for fp in thai_fonts:
        if os.path.exists(fp):
            try:
                return ImageFont.truetype(fp, size)
            except:
                continue
    return ImageFont.load_default()

def draw_rounded_rect(draw, xy, radius, fill):
    x0, y0, x1, y1 = xy
    draw.rounded_rectangle(xy, radius=radius, fill=fill)

def create_small_promo():
    """Small promo tile: 440x280"""
    W, H = 440, 280
    img = Image.new('RGB', (W, H), BG_DARK)
    draw = ImageDraw.Draw(img)
    
    # Background gradient effect
    draw_rounded_rect(draw, (20, 20, W-20, H-20), 20, BG_CARD)
    
    # Gold top accent
    draw.rectangle((20, 20, W-20, 28), fill=GOLD)
    
    # Icon
    if os.path.exists(ICON_PATH):
        icon = Image.open(ICON_PATH).resize((64, 64), Image.LANCZOS)
        img.paste(icon, (W//2 - 32, 45), icon if icon.mode == 'RGBA' else None)
    
    # Title
    font_title = get_font(28, bold=True)
    font_sub = get_font(16)
    font_small = get_font(13)
    
    title = "ตรวจหวย"
    bbox = draw.textbbox((0,0), title, font=font_title)
    tw = bbox[2] - bbox[0]
    draw.text((W//2 - tw//2, 120), title, fill=GOLD, font=font_title)
    
    sub = "วิเคราะห์เลขเด็ด"
    bbox = draw.textbbox((0,0), sub, font=font_sub)
    sw = bbox[2] - bbox[0]
    draw.text((W//2 - sw//2, 158), sub, fill=WHITE, font=font_sub)
    
    # Feature pills
    features = ["📋 ผลรางวัล", "🔍 ค้นหา", "📊 สถิติ", "🎯 ทำนาย"]
    pill_w = 90
    total_w = len(features) * pill_w + (len(features)-1) * 8
    start_x = W//2 - total_w//2
    
    for i, feat in enumerate(features):
        x = start_x + i * (pill_w + 8)
        draw_rounded_rect(draw, (x, 200, x+pill_w, 228), 12, TEAL)
        bbox = draw.textbbox((0,0), feat, font=font_small)
        fw = bbox[2] - bbox[0]
        draw.text((x + pill_w//2 - fw//2, 205), feat, fill=WHITE, font=font_small)
    
    # Bottom text
    bottom = "5+ ปีข้อมูล • 7 วิธีวิเคราะห์ • ฟรี"
    bbox = draw.textbbox((0,0), bottom, font=font_small)
    bw = bbox[2] - bbox[0]
    draw.text((W//2 - bw//2, 248), bottom, fill=LIGHT_GRAY, font=font_small)
    
    img.save(os.path.join(STORE_DIR, 'promo_small_440x280.png'))
    print("✅ Created promo_small_440x280.png")

def create_large_promo():
    """Large promo tile: 920x680"""
    W, H = 920, 680
    img = Image.new('RGB', (W, H), BG_DARK)
    draw = ImageDraw.Draw(img)
    
    # Main card
    draw_rounded_rect(draw, (40, 40, W-40, H-40), 24, BG_CARD)
    
    # Gold top bar
    draw.rectangle((40, 40, W-40, 52), fill=GOLD)
    
    # Icon
    if os.path.exists(ICON_PATH):
        icon = Image.open(ICON_PATH).resize((96, 96), Image.LANCZOS)
        img.paste(icon, (W//2 - 48, 75), icon if icon.mode == 'RGBA' else None)
    
    font_large = get_font(48, bold=True)
    font_med = get_font(24)
    font_small = get_font(18)
    font_xs = get_font(15)
    
    # Title
    title = "ตรวจหวย"
    bbox = draw.textbbox((0,0), title, font=font_large)
    tw = bbox[2] - bbox[0]
    draw.text((W//2 - tw//2, 185), title, fill=GOLD, font=font_large)
    
    sub = "วิเคราะห์เลขเด็ด"
    bbox = draw.textbbox((0,0), sub, font=font_med)
    sw = bbox[2] - bbox[0]
    draw.text((W//2 - sw//2, 245), sub, fill=WHITE, font=font_med)
    
    # Divider
    draw.line((W//2 - 100, 295, W//2 + 100, 295), fill=GOLD, width=2)
    
    # Feature cards
    features = [
        ("📋", "ผลรางวัลล่าสุด", "อัพเดทอัตโนมัติ"),
        ("🔍", "ค้นหาเลข", "ค้นทุกประเภทรางวัล"),
        ("📅", "ย้อนหลัง 5 ปี", "120+ งวด"),
        ("📊", "สถิติ & กราฟ", "Frequency, Trend"),
        ("🎯", "วิเคราะห์เลขเด็ด", "7 วิธีทางสถิติ"),
        ("🔔", "แจ้งเตือน LIVE", "Badge วันหวยออก"),
    ]
    
    card_w = 120
    card_h = 110
    cols = 3
    rows = 2
    gap = 20
    total_cw = cols * card_w + (cols-1) * gap
    total_ch = rows * card_h + (rows-1) * gap
    start_x = W//2 - total_cw//2
    start_y = 320
    
    for i, (emoji, title, desc) in enumerate(features):
        col = i % cols
        row = i // cols
        x = start_x + col * (card_w + gap)
        y = start_y + row * (card_h + gap)
        
        draw_rounded_rect(draw, (x, y, x+card_w, y+card_h), 12, '#243447')
        
        # Emoji
        bbox = draw.textbbox((0,0), emoji, font=font_med)
        ew = bbox[2] - bbox[0]
        draw.text((x + card_w//2 - ew//2, y + 10), emoji, font=font_med)
        
        # Title
        bbox = draw.textbbox((0,0), title, font=font_xs)
        tw = bbox[2] - bbox[0]
        draw.text((x + card_w//2 - tw//2, y + 48), title, fill=WHITE, font=font_xs)
        
        # Desc
        bbox = draw.textbbox((0,0), desc, font=font_xs)
        dw = bbox[2] - bbox[0]
        draw.text((x + card_w//2 - dw//2, y + 72), desc, fill=LIGHT_GRAY, font=font_xs)
    
    # Bottom
    bottom = "ฟรี • ไม่เก็บข้อมูลส่วนตัว • Open Source"
    bbox = draw.textbbox((0,0), bottom, font=font_small)
    bw = bbox[2] - bbox[0]
    draw.text((W//2 - bw//2, H - 80), bottom, fill=LIGHT_GRAY, font=font_small)
    
    img.save(os.path.join(STORE_DIR, 'promo_large_920x680.png'))
    print("✅ Created promo_large_920x680.png")

def create_marquee_promo():
    """Marquee promo: 1400x560"""
    W, H = 1400, 560
    img = Image.new('RGB', (W, H), BG_DARK)
    draw = ImageDraw.Draw(img)
    
    # Background card
    draw_rounded_rect(draw, (30, 30, W-30, H-30), 24, BG_CARD)
    draw.rectangle((30, 30, W-30, 40), fill=GOLD)
    
    # Left side — icon and title
    if os.path.exists(ICON_PATH):
        icon = Image.open(ICON_PATH).resize((128, 128), Image.LANCZOS)
        img.paste(icon, (120, 100), icon if icon.mode == 'RGBA' else None)
    
    font_huge = get_font(56, bold=True)
    font_large = get_font(32)
    font_med = get_font(22)
    font_small = get_font(17)
    
    draw.text((100, 260), "ตรวจหวย", fill=GOLD, font=font_huge)
    draw.text((100, 330), "วิเคราะห์เลขเด็ด", fill=WHITE, font=font_large)
    draw.text((100, 390), "ดูผล • ค้นหา • สถิติ • ทำนาย", fill=LIGHT_GRAY, font=font_med)
    draw.text((100, 440), "5+ ปีข้อมูล | 7 วิธีวิเคราะห์ | ฟรี 100%", fill=BLUE, font=font_small)
    
    # Right side — feature list
    right_x = 700
    features = [
        "📋  ดูผลรางวัลล่าสุดทันที",
        "🔍  ค้นหาเลขทุกประเภทรางวัล",
        "📅  ข้อมูลย้อนหลังกว่า 120 งวด",
        "📊  กราฟสถิติ Frequency / Trend",
        "🎯  วิเคราะห์เลขเด็ด 7 วิธี",
        "🔔  แจ้งเตือน LIVE วันหวยออก",
    ]
    
    for i, feat in enumerate(features):
        y = 110 + i * 60
        draw_rounded_rect(draw, (right_x, y, W - 80, y + 45), 10, '#243447')
        draw.text((right_x + 16, y + 10), feat, fill=WHITE, font=font_small)
    
    # Bottom bar
    draw.line((100, H - 70, W - 100, H - 70), fill='#2a3a4a', width=1)
    bottom = "Chrome Extension • ไม่เก็บข้อมูลส่วนตัว • Open Source"
    bbox = draw.textbbox((0,0), bottom, font=font_small)
    bw = bbox[2] - bbox[0]
    draw.text((W//2 - bw//2, H - 55), bottom, fill='#667788', font=font_small)
    
    img.save(os.path.join(STORE_DIR, 'promo_marquee_1400x560.png'))
    print("✅ Created promo_marquee_1400x560.png")

def create_screenshot():
    """Placeholder screenshot guide: 1280x800 or 640x400"""
    W, H = 1280, 800
    img = Image.new('RGB', (W, H), BG_DARK)
    draw = ImageDraw.Draw(img)
    
    font = get_font(28)
    font_small = get_font(18)
    
    # Center message
    msg = "📸 Screenshots"
    bbox = draw.textbbox((0,0), msg, font=font)
    tw = bbox[2] - bbox[0]
    draw.text((W//2 - tw//2, H//2 - 60), msg, fill=GOLD, font=font)
    
    msg2 = "Take actual screenshots of the extension popup"
    bbox = draw.textbbox((0,0), msg2, font=font_small)
    tw = bbox[2] - bbox[0]
    draw.text((W//2 - tw//2, H//2), msg2, fill=LIGHT_GRAY, font=font_small)
    
    msg3 = "Recommended: 1280x800 or 640x400"
    bbox = draw.textbbox((0,0), msg3, font=font_small)
    tw = bbox[2] - bbox[0]
    draw.text((W//2 - tw//2, H//2 + 40), msg3, fill=LIGHT_GRAY, font=font_small)
    
    img.save(os.path.join(STORE_DIR, 'screenshot_placeholder.png'))
    print("✅ Created screenshot_placeholder.png (take real screenshots to replace)")

if __name__ == '__main__':
    os.makedirs(STORE_DIR, exist_ok=True)
    create_small_promo()
    create_large_promo()
    create_marquee_promo()
    create_screenshot()
    print(f"\n📁 All images saved to: {STORE_DIR}")
    print("\n📌 Image sizes required by Chrome Web Store:")
    print("   • Small promo tile: 440×280 (required)")
    print("   • Large promo tile: 920×680 (optional)")
    print("   • Marquee promo:    1400×560 (optional)")
    print("   • Screenshots:      1280×800 or 640×400 (1-5 required)")
    print("\n💡 For screenshots, take actual screenshots of the extension in use!")
