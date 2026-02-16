/**
 * Service Worker — Thai Lottery Extension
 * แสดง badge บน icon เมื่ออยู่ในช่วงประกาศรางวัล
 */

const ALARM_NAME = 'lottery-check';
const CHECK_INTERVAL_MINUTES = 1;

// ===== วันและเวลาออกรางวัล =====
function isDrawDay(date = new Date()) {
  const d = date.getDate();
  return d === 1 || d === 16;
}

function isDrawTime(date = new Date()) {
  // ประกาศรางวัล 14:30 - 16:30 (เช็ค 14:00 - 18:00 เผื่อก่อน-หลัง)
  return isDrawDay(date) && date.getHours() >= 14 && date.getHours() <= 18;
}

function isPreDrawTime(date = new Date()) {
  // เช้าวันออกรางวัล ก่อน 14:00
  return isDrawDay(date) && date.getHours() < 14;
}

// ===== อัพเดท Badge =====
async function updateBadge() {
  const now = new Date();

  if (isDrawTime(now)) {
    // 🔴 กำลังประกาศรางวัล
    await chrome.action.setBadgeText({ text: 'LIVE' });
    await chrome.action.setBadgeBackgroundColor({ color: '#EF4444' });
    await chrome.action.setTitle({ title: '🔴 กำลังประกาศรางวัล! คลิกเพื่อดูผล' });
  } else if (isPreDrawTime(now)) {
    // 🟡 วันออกรางวัล รอประกาศ
    await chrome.action.setBadgeText({ text: '14:30' });
    await chrome.action.setBadgeBackgroundColor({ color: '#F59E0B' });
    await chrome.action.setTitle({ title: '⏳ วันออกรางวัล — รอประกาศผล 14:30 น.' });
  } else if (isDrawDay(now) && now.getHours() > 18) {
    // ✅ ประกาศผลแล้ว
    await chrome.action.setBadgeText({ text: '✅' });
    await chrome.action.setBadgeBackgroundColor({ color: '#22C55E' });
    await chrome.action.setTitle({ title: '✅ ประกาศผลแล้ว — คลิกเพื่อดูผลรางวัล' });
  } else {
    // วันปกติ — ไม่แสดง badge
    await chrome.action.setBadgeText({ text: '' });
    await chrome.action.setTitle({ title: 'Thai Lottery — ตรวจหวย' });
  }
}

// ===== Events =====

// เมื่อ Extension ถูกติดตั้งหรืออัพเดท
chrome.runtime.onInstalled.addListener(async () => {
  // สร้าง alarm เช็คทุก 1 นาที
  await chrome.alarms.create(ALARM_NAME, {
    delayInMinutes: 0.1,
    periodInMinutes: CHECK_INTERVAL_MINUTES
  });
  updateBadge();
});

// เมื่อ Service Worker เริ่มทำงาน (browser เปิด)
chrome.runtime.onStartup.addListener(() => {
  updateBadge();
});

// เมื่อ alarm ดัง
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === ALARM_NAME) {
    updateBadge();
  }
});
