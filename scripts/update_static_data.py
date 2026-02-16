#!/usr/bin/env python3
"""
update_static_data.py — ดึงข้อมูลหวย 5 ปีย้อนหลังจาก API แล้ว generate lotteryStaticData.js
ใช้ก่อน publish extension version ใหม่

Usage:
  python3 scripts/update_static_data.py

Output:
  lotteryStaticData.js (ในโฟลเดอร์เดียวกับ script)
"""

import json, urllib.request, sys, time, os

API = "https://lotto.api.rayriffy.com"
YEARS_BACK = 5
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
OUTPUT = os.path.join(SCRIPT_DIR, '..', 'lotteryStaticData.js')

THAI_MONTHS = {
    'มกราคม': '01', 'กุมภาพันธ์': '02', 'มีนาคม': '03', 'เมษายน': '04',
    'พฤษภาคม': '05', 'มิถุนายน': '06', 'กรกฎาคม': '07', 'สิงหาคม': '08',
    'กันยายน': '09', 'ตุลาคม': '10', 'พฤศจิกายน': '11', 'ธันวาคม': '12'
}


def thai_to_iso(s):
    parts = s.strip().split()
    if len(parts) >= 3:
        d = parts[0].zfill(2)
        m = THAI_MONTHS.get(parts[1], '01')
        y = int(parts[2]) - 543
        return f"{y}-{m}-{d}"
    return s


def api_get(url, retries=3):
    for attempt in range(retries):
        try:
            req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
            return json.loads(urllib.request.urlopen(req, timeout=15).read().decode('utf-8'))
        except Exception as e:
            if attempt < retries - 1:
                time.sleep(1)
            else:
                raise e


def parse_draw(data):
    if not data or 'response' not in data:
        return None
    r = data['response']
    prizes = {p['id']: p.get('number', []) for p in r.get('prizes', [])}
    running = {rn['id']: rn.get('number', []) for rn in r.get('runningNumbers', [])}
    return {
        'date': thai_to_iso(r['date']),
        'first': (prizes.get('prizeFirst') or ['------'])[0],
        'near1': prizes.get('prizeFirstNear', ['------', '------']),
        'prize2': prizes.get('prizeSecond', []),
        'prize3': prizes.get('prizeThird', []),
        'prize4': prizes.get('prizeForth', []),
        'prize5': prizes.get('prizeFifth', []),
        'front3': running.get('runningNumberFrontThree', ['---', '---']),
        'back3': running.get('runningNumberBackThree', ['---', '---']),
        'last2': (running.get('runningNumberBackTwo') or ['--'])[0],
        'source': 'static'
    }


def main():
    from datetime import datetime, timedelta

    today = datetime.now()
    cutoff = (today - timedelta(days=YEARS_BACK * 365)).strftime('%Y-%m-%d')

    print(f"🎰 Thai Lottery Static Data Generator")
    print(f"   ย้อนหลัง {YEARS_BACK} ปี (ตั้งแต่ {cutoff})")
    print(f"   Output: {os.path.abspath(OUTPUT)}")
    print()

    # Step 1: Get all draw IDs
    print("📋 ดึงรายชื่องวด...")
    all_ids = []
    page = 1
    while True:
        try:
            data = api_get(f"{API}/list/{page}")
            items = data.get('response', [])
            if not items:
                break
            for it in items:
                iso = thai_to_iso(it['date'])
                all_ids.append({'id': it['id'], 'date': iso})
            print(f"   หน้า {page}: {len(items)} งวด")
            page += 1
        except Exception as e:
            print(f"   หน้า {page} ล้มเหลว: {e}")
            break

    print(f"   รวม: {len(all_ids)} งวด")

    # Step 2: Filter by cutoff
    recent = sorted([x for x in all_ids if x['date'] >= cutoff], key=lambda x: x['date'], reverse=True)
    print(f"\n📅 งวดใน {YEARS_BACK} ปี: {len(recent)} งวด")
    if recent:
        print(f"   ตั้งแต่ {recent[-1]['date']} ถึง {recent[0]['date']}")

    # Step 3: Fetch each draw
    print(f"\n📥 ดึงผลรางวัล...")
    draws = []
    failed = []
    for i, item in enumerate(recent):
        try:
            data = api_get(f"{API}/lotto/{item['id']}")
            draw = parse_draw(data)
            if draw:
                draws.append(draw)
                print(f"   [{i+1}/{len(recent)}] ✅ {draw['date']} รางวัลที่ 1: {draw['first']}")
            else:
                failed.append(item['id'])
                print(f"   [{i+1}/{len(recent)}] ❌ {item['id']} parse failed")
            time.sleep(0.1)  # rate limit
        except Exception as e:
            failed.append(item['id'])
            print(f"   [{i+1}/{len(recent)}] ❌ {item['id']} error: {e}")

    draws.sort(key=lambda x: x['date'], reverse=True)

    # Step 4: Write JS
    now = datetime.now().strftime('%Y-%m-%d %H:%M')
    header = f"/** Static lottery data — {YEARS_BACK} years ({draws[-1]['date']} to {draws[0]['date']})\n"
    header += f" * Generated: {now}\n"
    header += f" * Total: {len(draws)} draws\n"
    header += f" * Script: scripts/update_static_data.py\n */\n\n"

    js = header + "const LOTTERY_STATIC_DATA = "
    js += json.dumps(draws, ensure_ascii=False, separators=(',', ':'))
    js += ";\n"

    with open(OUTPUT, 'w', encoding='utf-8') as f:
        f.write(js)

    size_kb = os.path.getsize(OUTPUT) / 1024

    print(f"\n{'='*50}")
    print(f"✅ สำเร็จ!")
    print(f"   ไฟล์: {os.path.abspath(OUTPUT)}")
    print(f"   ขนาด: {size_kb:.1f} KB")
    print(f"   จำนวน: {len(draws)} งวด")
    if failed:
        print(f"   ⚠️ ล้มเหลว: {len(failed)} งวด ({', '.join(failed)})")
    print(f"\n💡 อย่าลืม bump version ใน manifest.json และ popup.html ด้วย!")


if __name__ == '__main__':
    main()
