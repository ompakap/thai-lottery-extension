/**
 * Thai Lottery Data Service v3
 * Static data (5 ปี) + Smart caching + API update
 * เปิดปุ๊บเห็นข้อมูลทันที ไม่ต้องรอ API
 */

const LotteryData = (() => {
  // ========== CONFIG ==========
  const API_BASE = 'https://lotto.api.rayriffy.com';
  const CACHE_KEY = 'lottery_cache_v5';
  const CACHE_LIST_KEY = 'lottery_list_cache_v5';
  const CURRENT_VERSION = '1.3.0';
  const DEFAULT_YEARS_BACK = 5;
  const LIVE_REFRESH_MS = 30 * 1000;
  const WAITING_REFRESH_MS = 5 * 60 * 1000;
  const NORMAL_REFRESH_MS = 60 * 60 * 1000;

  let allDraws = [];       // งวดที่โหลดแล้ว (default 5 ปี จาก static data)
  let extraDraws = [];     // งวดเก่าที่โหลดเพิ่มตาม on-demand
  let allDrawIds = null;   // รายชื่องวดทั้งหมดจาก /list
  let isLive = false;
  let refreshTimer = null;
  let lastFetchTime = 0;
  let onDataUpdated = null;
  let statusMessage = 'กำลังโหลด...';
  let loadingProgress = { loaded: 0, total: 0 };
  let isLoadingExtra = false;

  // ========== Thai Date Helpers ==========
  const thaiMonths = [
    '', 'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
    'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'
  ];
  const thaiMonthsShort = ['', 'ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];

  const thaiMonthToNum = {
    'มกราคม': '01', 'กุมภาพันธ์': '02', 'มีนาคม': '03', 'เมษายน': '04',
    'พฤษภาคม': '05', 'มิถุนายน': '06', 'กรกฎาคม': '07', 'สิงหาคม': '08',
    'กันยายน': '09', 'ตุลาคม': '10', 'พฤศจิกายน': '11', 'ธันวาคม': '12'
  };

  function thaiDateToISO(thaiDate) {
    if (!thaiDate) return '';
    if (/^\d{4}-\d{2}-\d{2}$/.test(thaiDate)) return thaiDate;
    const parts = thaiDate.trim().split(/\s+/);
    if (parts.length >= 3) {
      const day = String(parseInt(parts[0])).padStart(2, '0');
      const month = thaiMonthToNum[parts[1]] || '01';
      const year = parseInt(parts[2]) - 543;
      return `${year}-${month}-${day}`;
    }
    return thaiDate;
  }

  // cutoff date = 5 ปีย้อนหลัง
  function getCutoffDate() {
    const d = new Date();
    d.setFullYear(d.getFullYear() - DEFAULT_YEARS_BACK);
    return d.toISOString().substring(0, 10);
  }

  function isDrawDay(date = new Date()) {
    const d = date.getDate();
    return d === 1 || d === 16;
  }

  function isDrawTime(date = new Date()) {
    return isDrawDay(date) && date.getHours() >= 14 && date.getHours() <= 18;
  }

  // ========== API: Parse ==========
  function parseDrawResponse(data) {
    if (!data || !data.response) return null;
    const r = data.response;
    try {
      const prizesMap = {};
      (r.prizes || []).forEach(p => { prizesMap[p.id] = p.number || []; });
      const runningMap = {};
      (r.runningNumbers || []).forEach(rn => { runningMap[rn.id] = rn.number || []; });
      return {
        date: thaiDateToISO(r.date),
        first: prizesMap['prizeFirst']?.[0] || '------',
        near1: prizesMap['prizeFirstNear'] || ['------', '------'],
        prize2: prizesMap['prizeSecond'] || [],
        prize3: prizesMap['prizeThird'] || [],
        prize4: prizesMap['prizeForth'] || [],
        prize5: prizesMap['prizeFifth'] || [],
        front3: runningMap['runningNumberFrontThree'] || ['---', '---'],
        back3: runningMap['runningNumberBackThree'] || ['---', '---'],
        last2: runningMap['runningNumberBackTwo']?.[0] || '--',
        source: 'api'
      };
    } catch (e) {
      console.warn('[Lottery] Parse error:', e);
      return null;
    }
  }

  // ========== API: Fetch ==========
  async function apiFetch(url, timeout = 10000) {
    const res = await fetch(url, { signal: AbortSignal.timeout(timeout) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  }

  async function fetchLatest() {
    try {
      return parseDrawResponse(await apiFetch(`${API_BASE}/latest`));
    } catch (e) {
      console.warn('[Lottery] Latest fetch failed:', e.message);
      return null;
    }
  }

  async function fetchById(id) {
    try {
      return parseDrawResponse(await apiFetch(`${API_BASE}/lotto/${id}`));
    } catch (e) {
      console.warn(`[Lottery] Fetch ${id} failed:`, e.message);
      return null;
    }
  }

  // ดึงรายชื่องวดทั้งหมด (cached ใน memory + localStorage)
  async function fetchDrawIdList() {
    if (allDrawIds) return allDrawIds;
    const cached = loadListCache();
    if (cached) { allDrawIds = cached; return cached; }

    const ids = [];
    let page = 1, hasMore = true;
    while (hasMore) {
      try {
        const data = await apiFetch(`${API_BASE}/list/${page}`, 15000);
        const items = data?.response || [];
        if (items.length === 0) { hasMore = false; break; }
        items.forEach(item => ids.push({ id: item.id, date: thaiDateToISO(item.date) }));
        page++;
      } catch (e) {
        console.warn(`[Lottery] List page ${page} failed:`, e.message);
        hasMore = false;
      }
    }
    if (ids.length > 0) { allDrawIds = ids; saveListCache(ids); }
    return ids;
  }

  // ดึงหลายงวดพร้อมกัน (batch)
  async function fetchBatch(items, concurrency = 5, progressLabel = '') {
    const results = [];
    for (let i = 0; i < items.length; i += concurrency) {
      const batch = items.slice(i, i + concurrency);
      const settled = await Promise.allSettled(batch.map(it => fetchById(it.id)));
      settled.forEach(r => { if (r.status === 'fulfilled' && r.value) results.push(r.value); });
      loadingProgress.loaded = Math.min(i + concurrency, items.length);
      if (onDataUpdated && progressLabel) {
        statusMessage = `📥 ${progressLabel} ${loadingProgress.loaded}/${loadingProgress.total}...`;
        onDataUpdated('loading', null, false);
      }
    }
    return results;
  }

  // ========== Cache ==========
  function saveCache() {
    try {
      const data = { timestamp: Date.now(), version: CURRENT_VERSION, draws: allDraws.filter(d => d.source === 'api') };
      localStorage.setItem(CACHE_KEY, JSON.stringify(data));
    } catch (e) {
      try {
        const data = { timestamp: Date.now(), version: CURRENT_VERSION, draws: allDraws.filter(d => d.source === 'api').slice(0, 48) };
        localStorage.setItem(CACHE_KEY, JSON.stringify(data));
      } catch (e2) { console.warn('[Lottery] Cache save failed'); }
    }
  }

  function loadCache() {
    try {
      const raw = localStorage.getItem(CACHE_KEY);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch (e) { return null; }
  }

  function saveListCache(ids) {
    try {
      localStorage.setItem(CACHE_LIST_KEY, JSON.stringify({ timestamp: Date.now(), ids }));
    } catch (e) { /* ignore */ }
  }

  function loadListCache() {
    try {
      const raw = localStorage.getItem(CACHE_LIST_KEY);
      if (!raw) return null;
      const data = JSON.parse(raw);
      if (Date.now() - data.timestamp > 12 * 60 * 60 * 1000) return null;
      return data.ids;
    } catch (e) { return null; }
  }

  function mergeDraws(newDraws, target = 'main') {
    const arr = target === 'main' ? allDraws : extraDraws;
    const dateMap = new Map();
    arr.forEach(d => dateMap.set(d.date, d));
    newDraws.forEach(d => {
      if (d && d.date) {
        const existing = dateMap.get(d.date);
        if (!existing || d.source === 'api') dateMap.set(d.date, d);
      }
    });
    const sorted = [...dateMap.values()].sort((a, b) => new Date(b.date) - new Date(a.date));
    if (target === 'main') allDraws = sorted;
    else extraDraws = sorted;
  }

  // ตัดข้อมูลเกินออกจาก main cache
  function pruneOldDraws() {
    const cutoff = getCutoffDate();
    const old = allDraws.filter(d => d.date < cutoff);
    allDraws = allDraws.filter(d => d.date >= cutoff);
    if (old.length > 0) mergeDraws(old, 'extra');
  }

  // ========== Auto Refresh ==========
  function startAutoRefresh() {
    stopAutoRefresh();
    const tick = async () => {
      const now = new Date();
      let nextMs;
      if (isDrawTime(now)) {
        isLive = true;
        statusMessage = '🔴 LIVE — update อัตโนมัติทุก 30 วินาที';
        const latest = await fetchLatest();
        if (latest) {
          const oldFirst = allDraws[0]?.first;
          mergeDraws([latest]);
          saveCache();
          if (latest.first !== oldFirst && onDataUpdated) onDataUpdated('live', latest, true);
          else if (onDataUpdated) onDataUpdated('live', latest, false);
        }
        nextMs = LIVE_REFRESH_MS;
      } else if (isDrawDay(now) && now.getHours() < 14) {
        isLive = false;
        statusMessage = '⏳ วันออกรางวัล — รอประกาศผล 14:30 น.';
        if (onDataUpdated) onDataUpdated('waiting', null, false);
        nextMs = WAITING_REFRESH_MS;
      } else {
        isLive = false;
        if (Date.now() - lastFetchTime > NORMAL_REFRESH_MS) {
          const latest = await fetchLatest();
          if (latest) { mergeDraws([latest]); saveCache(); lastFetchTime = Date.now(); }
        }
        const cnt = allDraws.length;
        statusMessage = `✅ ข้อมูล ${cnt} งวด (5 ปีย้อนหลัง)`;
        nextMs = NORMAL_REFRESH_MS;
      }
      refreshTimer = setTimeout(tick, nextMs);
    };
    tick();
  }

  function stopAutoRefresh() {
    if (refreshTimer) { clearTimeout(refreshTimer); refreshTimer = null; }
  }

  // ========== Initialize ==========
  async function initialize() {
    // 1. โหลด static data ก่อน (เห็นข้อมูลทันที ไม่ต้องรอ)
    if (typeof LOTTERY_STATIC_DATA !== 'undefined' && LOTTERY_STATIC_DATA.length > 0) {
      allDraws = [...LOTTERY_STATIC_DATA].sort((a, b) => new Date(b.date) - new Date(a.date));
      statusMessage = `✅ ข้อมูล ${allDraws.length} งวด (5 ปี)`;
      if (onDataUpdated) onDataUpdated('static_loaded', null, false);
    }

    // 2. โหลด cache ทับ (อาจมีงวดใหม่กว่า static)
    const cache = loadCache();
    if (cache && cache.draws && cache.draws.length > 0) {
      mergeDraws(cache.draws);
      statusMessage = `✅ ข้อมูล ${allDraws.length} งวด`;
    }

    // 3. ดึงผลล่าสุดจาก API → เช็คว่าตรงกับที่มีอยู่หรือไม่
    const latestApi = await fetchLatest();

    if (latestApi) {
      const currentLatestDate = allDraws[0]?.date;
      const apiLatestDate = latestApi.date;

      mergeDraws([latestApi]);
      lastFetchTime = Date.now();

      if (currentLatestDate === apiLatestDate) {
        // ✅ ข้อมูลเป็นงวดล่าสุดแล้ว — ไม่ต้องดึงเพิ่ม
        saveCache();
        const cnt = allDraws.length;
        statusMessage = `✅ ข้อมูลล่าสุด (${cnt} งวด)`;
        if (onDataUpdated) onDataUpdated('updated', null, false);
      } else {
        // ❌ มีงวดใหม่ — ดึงเฉพาะงวดที่ขาดใน background
        saveCache(); // เซฟ latest ก่อน
        statusMessage = '📥 กำลังดึงงวดที่ขาด...';
        if (onDataUpdated) onDataUpdated('loading', null, false);
        fetchMissing2Years().catch(e => console.warn('[Lottery] bg fetch failed:', e));
      }
    } else if (allDraws.length > 0) {
      // API fail แต่มี static/cache → ใช้ได้เลย
      const cnt = allDraws.length;
      statusMessage = `✅ ข้อมูล ${cnt} งวด (offline)`;
    } else {
      statusMessage = '❌ ไม่สามารถเชื่อมต่อ API ได้';
      if (onDataUpdated) onDataUpdated('error', null, false);
    }

    // 3. Start auto-refresh
    startAutoRefresh();
    return allDraws;
  }

  // ดึงเฉพาะงวดที่ขาดภายใน 5 ปี
  async function fetchMissing2Years() {
    try {
      const ids = await fetchDrawIdList();
      if (!ids || ids.length === 0) return;

      const cutoff = getCutoffDate();
      const recentIds = ids.filter(it => it.date >= cutoff);
      const existingDates = new Set(allDraws.filter(d => d.source === 'api').map(d => d.date));
      const missing = recentIds.filter(it => !existingDates.has(it.date));

      if (missing.length === 0) {
        pruneOldDraws();
        saveCache();
        statusMessage = `✅ ข้อมูลครบ ${allDraws.length} งวด (5 ปี)`;
        if (onDataUpdated) onDataUpdated('updated', null, true);
        return;
      }

      loadingProgress = { loaded: 0, total: missing.length };
      const results = await fetchBatch(missing, 5, 'กำลังโหลด');

      if (results.length > 0) {
        mergeDraws(results);
        pruneOldDraws();
        saveCache();
      }

      statusMessage = `✅ ข้อมูลครบ ${allDraws.length} งวด (5 ปี)`;
      if (onDataUpdated) onDataUpdated('history_loaded', null, true);
    } catch (e) {
      console.warn('[Lottery] fetchMissing2Years failed:', e);
      statusMessage = '⚠️ โหลดย้อนหลังไม่ครบ';
    }
  }

  // ========== On-demand: โหลดปีที่ต้องการ ==========
  async function loadYear(year) {
    const yearStr = String(year);
    const existing = [...allDraws, ...extraDraws].filter(d => d.date.startsWith(yearStr));
    if (existing.length >= 20) return existing; // ปีละ ~24 งวด, ≥20 ถือว่ามีครบ

    if (isLoadingExtra) return existing;
    isLoadingExtra = true;

    try {
      const ids = await fetchDrawIdList();
      if (!ids) { isLoadingExtra = false; return existing; }

      const yearIds = ids.filter(it => it.date.startsWith(yearStr));
      const existingDates = new Set([...allDraws, ...extraDraws].map(d => d.date));
      const missing = yearIds.filter(it => !existingDates.has(it.date));

      if (missing.length === 0) {
        isLoadingExtra = false;
        return [...allDraws, ...extraDraws].filter(d => d.date.startsWith(yearStr))
          .sort((a, b) => new Date(b.date) - new Date(a.date));
      }

      loadingProgress = { loaded: 0, total: missing.length };
      statusMessage = `📥 โหลดปี พ.ศ. ${parseInt(yearStr) + 543}...`;
      if (onDataUpdated) onDataUpdated('loading_year', null, false);

      const results = await fetchBatch(missing, 5, `โหลดปี พ.ศ. ${parseInt(yearStr) + 543}`);
      if (results.length > 0) mergeDraws(results, 'extra');

      statusMessage = `✅ โหลดปี พ.ศ. ${parseInt(yearStr) + 543} สำเร็จ`;
      if (onDataUpdated) onDataUpdated('year_loaded', null, true);
    } catch (e) {
      console.warn(`[Lottery] loadYear ${year} failed:`, e);
      statusMessage = `⚠️ โหลดปี พ.ศ. ${parseInt(yearStr) + 543} ไม่สำเร็จ`;
    }

    isLoadingExtra = false;
    return [...allDraws, ...extraDraws].filter(d => d.date.startsWith(yearStr))
      .sort((a, b) => new Date(b.date) - new Date(a.date));
  }

  // โหลดข้อมูลลึกสำหรับ prediction/stats ที่ต้องการข้อมูลมากกว่า 5 ปี
  async function loadDeepHistory() {
    if (isLoadingExtra) return;
    isLoadingExtra = true;

    try {
      const ids = await fetchDrawIdList();
      if (!ids) { isLoadingExtra = false; return; }

      const existingDates = new Set([...allDraws, ...extraDraws].map(d => d.date));
      const missing = ids.filter(it => !existingDates.has(it.date));

      if (missing.length === 0) {
        statusMessage = `✅ ข้อมูลครบทั้งหมด ${getAllDrawsCombined().length} งวด`;
        if (onDataUpdated) onDataUpdated('deep_loaded', null, true);
        isLoadingExtra = false;
        return;
      }

      loadingProgress = { loaded: 0, total: missing.length };
      statusMessage = `📥 โหลดข้อมูลทั้งหมด 0/${missing.length}...`;
      if (onDataUpdated) onDataUpdated('loading_deep', null, false);

      const results = await fetchBatch(missing, 5, 'โหลดข้อมูลทั้งหมด');
      if (results.length > 0) mergeDraws(results, 'extra');

      statusMessage = `✅ ข้อมูลครบทั้งหมด ${getAllDrawsCombined().length} งวด`;
      if (onDataUpdated) onDataUpdated('deep_loaded', null, true);
    } catch (e) {
      console.warn('[Lottery] loadDeepHistory failed:', e);
      statusMessage = '⚠️ โหลดข้อมูลทั้งหมดไม่ครบ';
    }

    isLoadingExtra = false;
  }

  // รวม allDraws + extraDraws
  function getAllDrawsCombined() {
    const dateMap = new Map();
    allDraws.forEach(d => dateMap.set(d.date, d));
    extraDraws.forEach(d => { if (!dateMap.has(d.date)) dateMap.set(d.date, d); });
    return [...dateMap.values()].sort((a, b) => new Date(b.date) - new Date(a.date));
  }

  // ดึงปีทั้งหมดที่ API มี
  async function getAvailableYearsFromAPI() {
    const ids = await fetchDrawIdList();
    if (!ids) return [];
    const years = [...new Set(ids.map(it => it.date.substring(0, 4)))];
    return years.sort((a, b) => b - a);
  }

  // ========== Public API ==========
  return {
    initialize,
    stopAutoRefresh,

    onUpdate(cb) { onDataUpdated = cb; },
    isLiveMode() { return isLive; },
    isDrawDay() { return isDrawDay(new Date()); },
    getLastFetchTime() { return lastFetchTime; },
    getStatusMessage() { return statusMessage; },
    getLoadingProgress() { return loadingProgress; },
    getDataSource() { return allDraws[0]?.source || 'none'; },
    isLoadingExtraData() { return isLoadingExtra; },

    async forceRefresh() {
      statusMessage = '🔄 กำลังรีเฟรช...';
      if (onDataUpdated) onDataUpdated('refreshing', null, false);
      const latest = await fetchLatest();
      if (latest) {
        mergeDraws([latest]);
        saveCache();
        lastFetchTime = Date.now();
        statusMessage = '✅ รีเฟรชสำเร็จ';
        if (onDataUpdated) onDataUpdated('refreshed', latest, true);
        return true;
      }
      statusMessage = '❌ รีเฟรชไม่สำเร็จ';
      if (onDataUpdated) onDataUpdated('error', null, false);
      return false;
    },

    // ========== Data access ==========
    getAllDraws() { return allDraws; },
    getAllDrawsIncludingExtra() { return getAllDrawsCombined(); },
    getLatestDraw() { return allDraws[0]; },
    getDrawByDate(dateStr) {
      return allDraws.find(d => d.date === dateStr) || extraDraws.find(d => d.date === dateStr);
    },
    getDrawsByYear(year) {
      return [...allDraws, ...extraDraws].filter(d => d.date.startsWith(String(year)))
        .sort((a, b) => new Date(b.date) - new Date(a.date));
    },
    getDrawsByYearMonth(year, month) {
      const prefix = month ? `${year}-${month}` : String(year);
      return [...allDraws, ...extraDraws].filter(d => d.date.startsWith(prefix))
        .sort((a, b) => new Date(b.date) - new Date(a.date));
    },
    getRecentDraws(count) { return allDraws.slice(0, count); },

    // ปีที่มีข้อมูลใน cache (ทั้ง main + extra)
    getAvailableYears() {
      const years = [...new Set([...allDraws, ...extraDraws].map(d => d.date.substring(0, 4)))];
      return years.sort((a, b) => b - a);
    },

    // ปีทั้งหมดที่ API มี (async — ใช้ตอน populate dropdown)
    async getAllAvailableYears() { return getAvailableYearsFromAPI(); },

    // ========== On-demand loading (public) ==========
    async loadYear(year) { return loadYear(year); },
    async loadDeepHistory() { return loadDeepHistory(); },

    hasYearData(year) {
      const yearStr = String(year);
      return [...allDraws, ...extraDraws].filter(d => d.date.startsWith(yearStr)).length > 0;
    },

    isInDefaultRange(year) {
      const cutoffYear = new Date().getFullYear() - DEFAULT_YEARS_BACK;
      return parseInt(year) >= cutoffYear;
    },

    // ========== Search ==========
    searchNumber(query, options = {}) {
      const results = [];
      const q = query.trim();
      if (!q) return results;
      const searchIn = getAllDrawsCombined();
      searchIn.forEach(draw => {
        const matches = [];
        if (options.exact !== false) {
          if (draw.first.includes(q)) matches.push({ type: 'รางวัลที่ 1', number: draw.first, prize: '6,000,000' });
        }
        if (options.front3 && q.length <= 3) {
          draw.front3.forEach(n => { if (n.includes(q)) matches.push({ type: 'เลขหน้า 3 ตัว', number: n, prize: '4,000' }); });
        }
        if (options.back3 && q.length <= 3) {
          draw.back3.forEach(n => { if (n.includes(q)) matches.push({ type: 'เลขท้าย 3 ตัว', number: n, prize: '4,000' }); });
        }
        if (options.last2 && q.length <= 2) {
          if (draw.last2.includes(q)) matches.push({ type: 'เลขท้าย 2 ตัว', number: draw.last2, prize: '2,000' });
        }
        if (options.exact !== false) {
          draw.prize2?.forEach(n => { if (n.includes(q)) matches.push({ type: 'รางวัลที่ 2', number: n, prize: '200,000' }); });
          draw.prize3?.forEach(n => { if (n.includes(q)) matches.push({ type: 'รางวัลที่ 3', number: n, prize: '80,000' }); });
          draw.near1?.forEach(n => { if (n.includes(q)) matches.push({ type: 'ข้างเคียงที่ 1', number: n, prize: '100,000' }); });
        }
        if (matches.length > 0) results.push({ date: draw.date, matches });
      });
      return results;
    },

    getFirstPrizes(count) {
      const src = count === 'all' ? getAllDrawsCombined() : allDraws.slice(0, parseInt(count));
      return src.map(d => ({ date: d.date, first: d.first, front3: d.front3, back3: d.back3, last2: d.last2 })).reverse();
    },

    getLast2Digits(count) {
      const src = count === 'all' ? getAllDrawsCombined() : allDraws.slice(0, parseInt(count));
      return src.map(d => ({ date: d.date, number: d.last2 })).reverse();
    },

    getAnalysisData(type, count) {
      const src = count === 'all' ? getAllDrawsCombined() : allDraws.slice(0, parseInt(count));
      const draws = [...src].reverse();
      switch(type) {
        case 'first': return draws.map(d => ({ date: d.date, numbers: [d.first] }));
        case 'last2': return draws.map(d => ({ date: d.date, numbers: [d.last2] }));
        case 'front3': return draws.map(d => ({ date: d.date, numbers: d.front3 }));
        case 'back3': return draws.map(d => ({ date: d.date, numbers: d.back3 }));
        default: return draws.map(d => ({ date: d.date, numbers: [d.first] }));
      }
    },

    // ========== Format ==========
    formatDateThai(dateStr) {
      if (!dateStr || !dateStr.includes('-')) return dateStr || '';
      const [y, m, d] = dateStr.split('-');
      return `${parseInt(d)} ${thaiMonths[parseInt(m)]} ${parseInt(y) + 543}`;
    },
    formatDateShort(dateStr) {
      if (!dateStr || !dateStr.includes('-')) return dateStr || '';
      const [y, m, d] = dateStr.split('-');
      return `${parseInt(d)} ${thaiMonthsShort[parseInt(m)]} ${parseInt(y) + 543}`;
    }
  };
})();
