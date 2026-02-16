#!/usr/bin/env python3
"""Generate lottery-themed icons for Chrome extension."""
from PIL import Image, ImageDraw, ImageFont
import math, os

def create_lottery_icon(size):
    """Create icon styled like a real Thai lottery ticket."""
    img = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    
    pad = max(1, size // 16)
    
    # === พื้นหลังสี่เหลี่ยมมน สีเขียวอมฟ้า (สีสลากจริง) ===
    ticket_bg = (0, 128, 108, 255)      # เขียวเข้ม (Teal - สีหลักสลาก)
    ticket_border = (212, 175, 55, 255)  # ขอบทอง
    border_w = max(1, size // 20)
    corner_r = max(2, size // 8)
    
    # ขอบทอง
    draw.rounded_rectangle(
        [pad, pad, size - pad, size - pad],
        radius=corner_r,
        fill=ticket_border,
    )
    # พื้นเขียว
    draw.rounded_rectangle(
        [pad + border_w, pad + border_w, size - pad - border_w, size - pad - border_w],
        radius=max(1, corner_r - border_w),
        fill=ticket_bg,
    )
    
    # === ลายเส้นตกแต่ง (เส้นขอบด้านในแบบสลากจริง) ===
    if size >= 48:
        inner_pad = pad + border_w + max(2, size // 16)
        inner_color = (255, 223, 100, 60)
        draw.rounded_rectangle(
            [inner_pad, inner_pad, size - inner_pad, size - inner_pad],
            radius=max(1, corner_r - border_w - 2),
            outline=inner_color,
            width=max(1, size // 40),
        )
    
    # === แถบแดงด้านบนเล็กๆ (เหมือนส่วนหัวสลาก) ===
    if size >= 48:
        stripe_h = max(3, size // 10)
        stripe_y = pad + border_w + 1
        draw.rounded_rectangle(
            [pad + border_w + 1, stripe_y, size - pad - border_w - 1, stripe_y + stripe_h],
            radius=max(1, size // 20),
            fill=(180, 30, 30, 200),
        )
        # เขียน "สลากกินแบ่ง" ในแถบแดง (สำหรับ 128)
        if size >= 128:
            header_font_size = int(size * 0.08)
            try:
                for fn in ['/System/Library/Fonts/Supplemental/Thonburi.ttc', '/System/Library/Fonts/ThonburiUI.ttc']:
                    if os.path.exists(fn):
                        header_font = ImageFont.truetype(fn, header_font_size)
                        break
                else:
                    header_font = None
            except Exception:
                header_font = None
            if header_font:
                htxt = "สลากกินแบ่งรัฐบาล"
                hbbox = draw.textbbox((0, 0), htxt, font=header_font)
                htw = hbbox[2] - hbbox[0]
                hx = (size - htw) // 2
                hy = stripe_y + (stripe_h - (hbbox[3] - hbbox[1])) // 2 - hbbox[1]
                draw.text((hx, hy), htxt, fill=(255, 255, 255, 230), font=header_font)
    
    # === คำว่า "หวย" ตรงกลาง ===
    cx, cy = size // 2, size // 2
    
    if size <= 16:
        # 16px — ใช้ตัว "ห" ตัวเดียว
        font_size = int(size * 0.6)
        try:
            for fn in ['/System/Library/Fonts/Supplemental/Thonburi.ttc', '/System/Library/Fonts/ThonburiUI.ttc']:
                if os.path.exists(fn):
                    font = ImageFont.truetype(fn, font_size)
                    break
            else:
                font = ImageFont.truetype('/System/Library/Fonts/Supplemental/Arial Bold.ttf', font_size)
        except Exception:
            font = ImageFont.load_default()
        text = "ห"
        bbox = draw.textbbox((0, 0), text, font=font)
        tw, th = bbox[2] - bbox[0], bbox[3] - bbox[1]
        tx = cx - (bbox[0] + tw // 2)
        ty = cy - (bbox[1] + th // 2)
        draw.text((tx, ty), text, fill=(255, 223, 100, 255), font=font)
    else:
        font_size = int(size * 0.38) if size >= 128 else int(size * 0.42)
        font = None
        try:
            for fn in ['/System/Library/Fonts/Supplemental/Thonburi.ttc', '/System/Library/Fonts/ThonburiUI.ttc']:
                if os.path.exists(fn):
                    font = ImageFont.truetype(fn, font_size)
                    break
            if font is None:
                font = ImageFont.truetype('/System/Library/Fonts/Supplemental/Arial Bold.ttf', font_size)
        except Exception:
            font = ImageFont.load_default()
        
        text = "หวย"
        bbox = draw.textbbox((0, 0), text, font=font)
        tw, th = bbox[2] - bbox[0], bbox[3] - bbox[1]
        tx = cx - (bbox[0] + tw // 2)
        # เลื่อนลงเล็กน้อยเพราะมีแถบแดงด้านบน
        ty_offset = int(size * 0.04) if size >= 48 else 0
        ty = cy - (bbox[1] + th // 2) + ty_offset
        
        # เงา
        draw.text((tx + 1, ty + 1), text, fill=(0, 60, 50, 150), font=font)
        # ตัวหนังสือสีทอง
        draw.text((tx, ty), text, fill=(255, 223, 100, 255), font=font)
    
    # === ลายจุดตกแต่งมุม (สำหรับขนาดใหญ่) ===
    if size >= 48:
        dot_r = max(1, size // 40)
        dot_color = (255, 223, 100, 120)
        margin = pad + border_w + max(4, size // 12)
        corners = [
            (margin, size - margin),
            (size - margin, size - margin),
        ]
        for dx, dy in corners:
            draw.ellipse([dx - dot_r, dy - dot_r, dx + dot_r, dy + dot_r], fill=dot_color)
    
    return img


def main():
    out_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'icons')
    os.makedirs(out_dir, exist_ok=True)
    
    for size in [16, 48, 128]:
        icon = create_lottery_icon(size)
        path = os.path.join(out_dir, f'icon{size}.png')
        icon.save(path, 'PNG')
        print(f'✅ Created {path} ({size}x{size})')

if __name__ == '__main__':
    main()
