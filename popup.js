/**
 * Thai Lottery Chrome Extension - Main Popup Logic
 */

document.addEventListener('DOMContentLoaded', () => {
  let currentChart = null;

  // ========== Helper Functions (register FIRST) ==========
  function showLoading(show) {
    document.getElementById('statusBar').textContent = show ? 'กำลังโหลดข้อมูล...' : LotteryData.getStatusMessage();
  }

  function updateStatusBar(status, data) {
    const bar = document.getElementById('statusBar');
    bar.textContent = LotteryData.getStatusMessage();
    bar.className = 'status-bar';
    if (status === 'live') bar.classList.add('live');
    if (status === 'error') bar.classList.add('error');
  }

  function updateLiveBadge() {
    const badge = document.getElementById('liveBadge');
    if (LotteryData.isLiveMode()) {
      badge.classList.remove('hidden');
    } else {
      badge.classList.add('hidden');
    }
  }

  function showNotification(msg) {
    const el = document.createElement('div');
    el.className = 'toast-notification';
    el.textContent = msg;
    document.body.appendChild(el);
    setTimeout(() => el.classList.add('show'), 10);
    setTimeout(() => {
      el.classList.remove('show');
      setTimeout(() => el.remove(), 300);
    }, 3000);
  }

  // Refresh button (register immediately)
  document.getElementById('refreshBtn').addEventListener('click', async () => {
    const btn = document.getElementById('refreshBtn');
    btn.classList.add('spinning');
    await LotteryData.forceRefresh();
    loadLatestResults();
    btn.classList.remove('spinning');
  });

  // ========== Tab Navigation ==========
  const tabs = document.querySelectorAll('.tab');
  const tabContents = document.querySelectorAll('.tab-content');

  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      const target = tab.dataset.tab;
      
      tabs.forEach(t => t.classList.remove('active'));
      tabContents.forEach(tc => tc.classList.remove('active'));
      
      tab.classList.add('active');
      document.getElementById(`tab-${target}`).classList.add('active');

      // Load tab-specific data
      if (target === 'history') loadHistory();
      if (target === 'stats') loadStats();
    });
  });

  // ========== Tab 1: Latest Results ==========
  function loadLatestResults() {
    const draw = LotteryData.getLatestDraw();
    if (!draw) return;

    document.getElementById('latestDrawDate').textContent = 
      `งวดวันที่ ${LotteryData.formatDateThai(draw.date)}`;

    document.getElementById('firstPrize').textContent = draw.first;
    
    document.getElementById('front3').textContent = draw.front3.join('   ');
    document.getElementById('back3').textContent = draw.back3.join('   ');
    document.getElementById('last2').textContent = draw.last2;
    document.getElementById('nearFirst').textContent = draw.near1.join('   ');

    // Prize 2-5
    renderPrizeGrid('prize2', draw.prize2);
    renderPrizeGrid('prize3', draw.prize3);
    renderPrizeGrid('prize4', draw.prize4);
    renderPrizeGrid('prize5', draw.prize5);

    // Sorted numbers
    loadSortedNumbers(draw);
  }

  function renderPrizeGrid(elementId, numbers) {
    const el = document.getElementById(elementId);
    el.innerHTML = numbers.map(n => `<div class="num">${n}</div>`).join('');
  }

  function loadSortedNumbers(draw) {
    const allNumbers = [
      draw.first,
      ...draw.prize2,
      ...draw.prize3,
      ...draw.prize4,
      ...draw.prize5
    ];
    
    const sorted = [...allNumbers].sort((a, b) => parseInt(a) - parseInt(b));
    renderSortedNumbers(sorted);

    document.getElementById('sortAsc').addEventListener('click', (e) => {
      e.target.classList.add('active');
      document.getElementById('sortDesc').classList.remove('active');
      const s = [...allNumbers].sort((a, b) => parseInt(a) - parseInt(b));
      renderSortedNumbers(s);
    });

    document.getElementById('sortDesc').addEventListener('click', (e) => {
      e.target.classList.add('active');
      document.getElementById('sortAsc').classList.remove('active');
      const s = [...allNumbers].sort((a, b) => parseInt(b) - parseInt(a));
      renderSortedNumbers(s);
    });
  }

  function renderSortedNumbers(numbers) {
    const el = document.getElementById('sortedNumbers');
    el.innerHTML = numbers.map(n => `<div class="num">${n}</div>`).join('');
  }

  // Toggle full results
  document.getElementById('toggleFullResults').addEventListener('click', () => {
    const el = document.getElementById('fullResults');
    const btn = document.getElementById('toggleFullResults');
    el.classList.toggle('hidden');
    btn.textContent = el.classList.contains('hidden') 
      ? 'แสดงผลรางวัลทั้งหมด ▼' 
      : 'ซ่อนผลรางวัล ▲';
  });

  // ========== Tab 2: Search ==========
  document.getElementById('searchBtn').addEventListener('click', performSearch);
  document.getElementById('searchInput').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') performSearch();
  });

  // Only allow numbers
  document.getElementById('searchInput').addEventListener('input', (e) => {
    e.target.value = e.target.value.replace(/[^0-9]/g, '');
  });

  function performSearch() {
    const query = document.getElementById('searchInput').value.trim();
    if (!query) return;

    const options = {
      exact: document.getElementById('searchExact').checked,
      front3: document.getElementById('searchFront3').checked,
      back3: document.getElementById('searchBack3').checked,
      last2: document.getElementById('searchLast2').checked
    };

    const results = LotteryData.searchNumber(query, options);
    renderSearchResults(results, query);
  }

  function renderSearchResults(results, query) {
    const el = document.getElementById('searchResults');

    if (results.length === 0) {
      el.innerHTML = `<div class="no-results">ไม่พบเลข "${query}" ในผลรางวัลย้อนหลัง</div>`;
      return;
    }

    const latestDraw = LotteryData.getLatestDraw();
    const latestDate = latestDraw ? latestDraw.date : null;

    // แยกผลลัพธ์เป็น 2 กลุ่ม: งวดล่าสุด vs ย้อนหลัง
    const latestResults = latestDate ? results.filter(r => r.date === latestDate) : [];
    const historyResults = latestDate ? results.filter(r => r.date !== latestDate) : results;

    // ตรวจ exact match ในงวดล่าสุด
    let congratsMatches = [];
    if (latestResults.length > 0) {
      congratsMatches = latestResults[0].matches.filter(m => m.number === query);
    }

    const totalMatches = results.reduce((acc, r) => acc + r.matches.length, 0);
    let html = `<div style="margin-bottom:8px;color:var(--text-muted);font-size:12px;">
      พบ ${totalMatches} รายการ จาก ${results.length} งวด
    </div>`;

    // ===== Section: งวดล่าสุด =====
    if (latestResults.length > 0) {
      // แบนเนอร์ยินดีถ้าตรง 100%
      if (congratsMatches.length > 0) {
        const prizeNames = congratsMatches.map(m => `${m.type} (รับ ${m.prize} บ.)`).join(', ');
        html += `
          <div class="congrats-banner">
            <div class="congrats-icon">🎉🎊🎆</div>
            <div class="congrats-title">ยินดีด้วย! คุณถูกรางวัล!</div>
            <div class="congrats-detail">
              เลข <strong>${query}</strong> ตรงกับ <strong>${prizeNames}</strong>
            </div>
            <div class="congrats-draw">📅 งวดล่าสุด: ${LotteryData.formatDateThai(latestDate)}</div>
          </div>
        `;
      }

      html += `<div class="search-section-header search-section-latest">
        ⭐ งวดล่าสุด — ${LotteryData.formatDateThai(latestDate)}
      </div>`;

      latestResults.forEach(result => {
        result.matches.forEach(match => {
          const isExact = match.number === query;
          const highlighted = highlightMatch(match.number, query);
          html += `
            <div class="search-result-item${isExact ? ' congrats-match' : ''}">
              <div>
                <div class="date">${LotteryData.formatDateShort(result.date)}${isExact ? ' ⭐ ตรง!' : ''}</div>
                <div class="number">${highlighted}</div>
              </div>
              <div style="text-align:right">
                <div class="match-type${isExact ? ' match-type-congrats' : ''}">${match.type}</div>
                <div style="font-size:11px;color:var(--success);margin-top:4px;">${match.prize} บ.</div>
              </div>
            </div>
          `;
        });
      });
    } else if (latestDate) {
      html += `<div class="search-section-header search-section-latest">
        ⭐ งวดล่าสุด — ${LotteryData.formatDateThai(latestDate)}
      </div>`;
      html += `<div class="search-not-found-latest">❌ ไม่พบเลข "${query}" ในงวดล่าสุด</div>`;
    }

    // ===== Section: งวดย้อนหลัง =====
    if (historyResults.length > 0) {
      html += `<div class="search-section-header search-section-history">
        📅 ย้อนหลัง — ${historyResults.length} งวด
      </div>`;

      let historyCount = 0;
      historyResults.slice(0, 50).forEach(result => {
        result.matches.forEach(match => {
          historyCount++;
          const highlighted = highlightMatch(match.number, query);
          html += `
            <div class="search-result-item">
              <div>
                <div class="date">${LotteryData.formatDateShort(result.date)}</div>
                <div class="number">${highlighted}</div>
              </div>
              <div style="text-align:right">
                <div class="match-type">${match.type}</div>
                <div style="font-size:11px;color:var(--success);margin-top:4px;">${match.prize} บ.</div>
              </div>
            </div>
          `;
        });
      });

      if (historyResults.length > 50) {
        html += `<div class="placeholder-text">แสดง 50 งวดแรก จากทั้งหมด ${historyResults.length} งวด</div>`;
      }
    }

    el.innerHTML = html;
  }

  function highlightMatch(number, query) {
    const idx = number.indexOf(query);
    if (idx === -1) return number;
    return number.substring(0, idx) + 
           `<span class="hl">${query}</span>` + 
           number.substring(idx + query.length);
  }

  // ========== Tab 3: History ==========
  let historyYearsLoaded = false;

  async function loadHistory() {
    const yearSelect = document.getElementById('historyYear');

    if (!historyYearsLoaded) {
      // ดึงปีทั้งหมดจาก API (รวมปีเก่าๆ ที่ยังไม่ได้โหลด)
      yearSelect.innerHTML = '<option value="">กำลังโหลดรายชื่อปี...</option>';
      try {
        const apiYears = await LotteryData.getAllAvailableYears();
        const years = apiYears.length > 0 ? apiYears : LotteryData.getAvailableYears();
        yearSelect.innerHTML = '';
        years.forEach(y => {
          const opt = document.createElement('option');
          opt.value = y;
          const inCache = LotteryData.hasYearData(y);
          const isDefault = LotteryData.isInDefaultRange(y);
          let label = `พ.ศ. ${parseInt(y) + 543}`;
          if (!inCache && !isDefault) label += ' (โหลดเพิ่ม)';
          opt.textContent = label;
          yearSelect.appendChild(opt);
        });
        historyYearsLoaded = true;
      } catch (e) {
        const years = LotteryData.getAvailableYears();
        yearSelect.innerHTML = '';
        years.forEach(y => {
          const opt = document.createElement('option');
          opt.value = y;
          opt.textContent = `พ.ศ. ${parseInt(y) + 543}`;
          yearSelect.appendChild(opt);
        });
        historyYearsLoaded = true;
      }
    }

    renderHistory();
  }

  document.getElementById('historyYear').addEventListener('change', renderHistory);
  document.getElementById('historyMonth').addEventListener('change', renderHistory);

  async function renderHistory() {
    const year = document.getElementById('historyYear').value;
    const month = document.getElementById('historyMonth').value;
    const list = document.getElementById('historyList');

    if (!year) {
      list.innerHTML = '<p class="placeholder-text">เลือกปีเพื่อดูผลย้อนหลัง</p>';
      return;
    }

    // ถ้าปีนี้ยังไม่มีข้อมูล → โหลด on-demand
    if (!LotteryData.hasYearData(year) || !LotteryData.isInDefaultRange(year)) {
      list.innerHTML = '<div class="loading-indicator"><div class="spinner"></div><p>กำลังโหลดข้อมูลปี พ.ศ. ' + (parseInt(year) + 543) + '...</p></div>';
      await LotteryData.loadYear(year);
    }

    const draws = LotteryData.getDrawsByYearMonth(year, month);
    
    if (draws.length === 0) {
      list.innerHTML = '<p class="placeholder-text">ไม่มีข้อมูลในช่วงที่เลือก</p>';
      return;
    }

    list.innerHTML = draws.map(draw => `
      <div class="history-item" data-date="${draw.date}">
        <div class="h-summary">
          <div class="h-date">📅 ${LotteryData.formatDateThai(draw.date)}</div>
          <div class="h-prizes">
            <div class="h-prize">
              <div class="label">รางวัลที่ 1</div>
              <div class="value" style="color:var(--gold)">${draw.first}</div>
            </div>
            <div class="h-prize">
              <div class="label">หน้า 3 ตัว</div>
              <div class="value">${draw.front3.join(', ')}</div>
            </div>
            <div class="h-prize">
              <div class="label">ท้าย 2 ตัว</div>
              <div class="value" style="color:var(--accent)">${draw.last2}</div>
            </div>
          </div>
          <div class="h-toggle">▼ ดูแบบเต็ม</div>
        </div>
        <div class="h-full-results">
          <div class="h-full-section">
            <div class="h-full-label">รางวัลข้างเคียงรางวัลที่ 1</div>
            <div class="h-full-nums">${(draw.near1 || []).join(', ')}</div>
          </div>
          <div class="h-full-section">
            <div class="h-full-label">เลขท้าย 3 ตัว</div>
            <div class="h-full-nums">${(draw.back3 || []).join(', ')}</div>
          </div>
          <div class="h-full-section">
            <div class="h-full-label">รางวัลที่ 2 (รางวัลละ 200,000 บาท)</div>
            <div class="h-full-grid">${(draw.prize2 || []).map(n => `<span>${n}</span>`).join('')}</div>
          </div>
          <div class="h-full-section">
            <div class="h-full-label">รางวัลที่ 3 (รางวัลละ 80,000 บาท)</div>
            <div class="h-full-grid">${(draw.prize3 || []).map(n => `<span>${n}</span>`).join('')}</div>
          </div>
          <div class="h-full-section">
            <div class="h-full-label">รางวัลที่ 4 (รางวัลละ 40,000 บาท)</div>
            <div class="h-full-grid">${(draw.prize4 || []).map(n => `<span>${n}</span>`).join('')}</div>
          </div>
          <div class="h-full-section">
            <div class="h-full-label">รางวัลที่ 5 (รางวัลละ 20,000 บาท)</div>
            <div class="h-full-grid">${(draw.prize5 || []).map(n => `<span>${n}</span>`).join('')}</div>
          </div>
        </div>
      </div>
    `).join('');

    // click to expand/collapse
    list.querySelectorAll('.history-item').forEach(item => {
      item.querySelector('.h-summary').addEventListener('click', () => {
        item.classList.toggle('expanded');
        const toggle = item.querySelector('.h-toggle');
        if (item.classList.contains('expanded')) {
          toggle.textContent = '▲ ย่อ';
        } else {
          toggle.textContent = '▼ ดูแบบเต็ม';
        }
      });
    });
  }

  // ========== Tab 4: Stats ==========
  let currentChartType = 'frequency';
  
  function loadStats() {
    renderChart(currentChartType);
  }

  document.querySelectorAll('[data-chart]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      document.querySelectorAll('[data-chart]').forEach(b => b.classList.remove('active'));
      e.target.classList.add('active');
      currentChartType = e.target.dataset.chart;
      renderChart(currentChartType);
    });
  });

  document.getElementById('statsRange').addEventListener('change', async (e) => {
    if (e.target.value === 'all') {
      // ถ้าเลือก "ทั้งหมด" แต่ยังไม่มี deep data → โหลดเพิ่ม
      const total = LotteryData.getAllDrawsIncludingExtra().length;
      const main = LotteryData.getAllDraws().length;
      if (total <= main) {
        document.getElementById('statsSummary').innerHTML = '<div class="loading-indicator"><div class="spinner"></div><p>กำลังโหลดข้อมูลทั้งหมด...</p></div>';
        await LotteryData.loadDeepHistory();
      }
    }
    renderChart(currentChartType);
  });
  document.getElementById('statsDigit').addEventListener('change', () => renderChart(currentChartType));

  function renderChart(type) {
    const range = document.getElementById('statsRange').value;
    const digitType = document.getElementById('statsDigit').value;
    const data = LotteryData.getAnalysisData(digitType, range);
    const ctx = document.getElementById('statsChart').getContext('2d');

    if (currentChart) {
      currentChart.destroy();
    }

    let chartData, chartOptions, chartType;

    switch(type) {
      case 'frequency':
        chartData = LotteryAnalysis.getFrequencyChartData(data, digitType);
        chartType = 'bar';
        chartOptions = {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false },
            title: { display: true, text: 'ความถี่ตัวเลข 0-9', color: '#F1F5F9' }
          },
          scales: {
            y: { 
              ticks: { color: '#94A3B8' },
              grid: { color: 'rgba(51, 65, 85, 0.5)' }
            },
            x: { 
              ticks: { color: '#94A3B8' },
              grid: { display: false }
            }
          }
        };
        renderFrequencySummary(data);
        break;

      case 'hot-cold':
        chartData = LotteryAnalysis.getHotColdChartData(data);
        chartType = 'bar';
        chartOptions = {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { labels: { color: '#F1F5F9' } },
            title: { display: true, text: 'เลขร้อน vs เลขเย็น', color: '#F1F5F9' }
          },
          scales: {
            y: { 
              ticks: { color: '#94A3B8' },
              grid: { color: 'rgba(51, 65, 85, 0.5)' }
            },
            x: { 
              ticks: { color: '#94A3B8' },
              grid: { display: false }
            }
          }
        };
        renderHotColdSummary(data);
        break;

      case 'trend':
        chartData = LotteryAnalysis.getTrendChartData(data);
        chartType = 'line';
        chartOptions = {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { labels: { color: '#F1F5F9' } },
            title: { display: true, text: 'แนวโน้มตัวเลข', color: '#F1F5F9' }
          },
          scales: {
            y: { 
              ticks: { color: '#94A3B8' },
              grid: { color: 'rgba(51, 65, 85, 0.5)' }
            },
            x: { 
              ticks: { color: '#94A3B8', maxTicksLimit: 10 },
              grid: { display: false }
            }
          }
        };
        renderTrendSummary(data);
        break;

      case 'pairs':
        chartData = LotteryAnalysis.getPairsChartData(data);
        chartType = 'doughnut';
        chartOptions = {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { 
              position: 'right',
              labels: { color: '#F1F5F9', font: { size: 11 } }
            },
            title: { display: true, text: 'คู่เลขยอดนิยม', color: '#F1F5F9' }
          }
        };
        renderPairsSummary(data);
        break;
    }

    currentChart = new Chart(ctx, {
      type: chartType,
      data: chartData,
      options: chartOptions
    });
  }

  function renderFrequencySummary(data) {
    const analysis = LotteryAnalysis.frequencyAnalysis(data, 'single');
    const el = document.getElementById('statsSummary');
    el.innerHTML = `
      <h4>📊 สรุปความถี่ (${analysis.total} งวด)</h4>
      ${analysis.topNumbers.slice(0, 5).map(([num, count]) => `
        <div class="stat-row">
          <span class="stat-label">เลข ${num}</span>
          <span class="stat-value hot">${count} ครั้ง (${(count/analysis.total*100).toFixed(1)}%)</span>
        </div>
      `).join('')}
      <h4 style="margin-top:10px">เลขที่ออกน้อย</h4>
      ${analysis.bottomNumbers.slice(0, 3).map(([num, count]) => `
        <div class="stat-row">
          <span class="stat-label">เลข ${num}</span>
          <span class="stat-value cold">${count} ครั้ง</span>
        </div>
      `).join('')}
    `;
  }

  function renderHotColdSummary(data) {
    const analysis = LotteryAnalysis.hotColdAnalysis(data);
    const el = document.getElementById('statsSummary');
    el.innerHTML = `
      <h4>🔥 เลขร้อน (ออกบ่อยล่าสุด)</h4>
      ${analysis.hotDigits.slice(0, 5).map(d => `
        <div class="stat-row">
          <span class="stat-label">เลข ${d.digit}</span>
          <span class="stat-value hot">ล่าสุด ${d.recent} ครั้ง</span>
        </div>
      `).join('')}
      <h4 style="margin-top:10px">❄️ เลขเย็น</h4>
      ${analysis.coldDigits.slice(0, 5).map(d => `
        <div class="stat-row">
          <span class="stat-label">เลข ${d.digit}</span>
          <span class="stat-value cold">ล่าสุด ${d.recent} ครั้ง</span>
        </div>
      `).join('')}
    `;
  }

  function renderTrendSummary(data) {
    const analysis = LotteryAnalysis.movingAverageAnalysis(data);
    const el = document.getElementById('statsSummary');
    el.innerHTML = `
      <h4>📈 สรุปแนวโน้ม</h4>
      <div class="stat-row">
        <span class="stat-label">แนวโน้ม</span>
        <span class="stat-value">${analysis.trend}</span>
      </div>
      <div class="stat-row">
        <span class="stat-label">MA Window</span>
        <span class="stat-value">${analysis.window} งวด</span>
      </div>
      <div class="stat-row">
        <span class="stat-label">ค่าคาดการณ์</span>
        <span class="stat-value hot">${String(analysis.predictedValue).padStart(6, '0')}</span>
      </div>
    `;
  }

  function renderPairsSummary(data) {
    const analysis = LotteryAnalysis.pairAnalysis(data);
    const el = document.getElementById('statsSummary');
    el.innerHTML = `
      <h4>🔢 คู่เลขที่ออกบ่อย</h4>
      ${analysis.consecutivePairs.slice(0, 8).map(([pair, count]) => `
        <div class="stat-row">
          <span class="stat-label">คู่ ${pair}</span>
          <span class="stat-value">${count} ครั้ง</span>
        </div>
      `).join('')}
    `;
  }

  // ========== Tab 5: Predict ==========
  document.getElementById('runPredict').addEventListener('click', runPrediction);

  // ปุ่มโหลดข้อมูลทั้งหมดสำหรับทำนาย
  const deepLoadBtn = document.getElementById('deepLoadBtn');
  if (deepLoadBtn) {
    deepLoadBtn.addEventListener('click', async () => {
      deepLoadBtn.textContent = '📥 กำลังโหลด...';
      deepLoadBtn.disabled = true;
      await LotteryData.loadDeepHistory();
      const total = LotteryData.getAllDrawsIncludingExtra().length;
      deepLoadBtn.textContent = `✅ โหลดครบแล้ว (${total} งวด)`;
      showNotification(`โหลดข้อมูลทั้งหมด ${total} งวดสำเร็จ`);
      updatePredictDataRange(document.getElementById('predictDeep')?.checked ? 'all' : 48);
    });
  }

  // อัพเดท data range เมื่อ checkbox เปลี่ยน
  const predictDeepCb = document.getElementById('predictDeep');
  if (predictDeepCb) {
    predictDeepCb.addEventListener('change', () => {
      updatePredictDataRange(predictDeepCb.checked ? 'all' : 48);
    });
  }

  // แสดง data range เริ่มต้นทันที
  updatePredictDataRange(48);

  function runPrediction() {
    const btn = document.getElementById('runPredict');
    btn.textContent = '🔄 กำลังวิเคราะห์...';
    btn.disabled = true;

    const useDeep = document.getElementById('predictDeep')?.checked;
    const analysisCount = useDeep ? 'all' : 48;

    // Update data range info
    updatePredictDataRange(analysisCount);

    // Simulate processing time for effect
    setTimeout(() => {
      const result = LotteryAnalysis.runFullAnalysis(analysisCount);
      
      // Frequency
      renderMethodResult('freqResult', 
        result.frequency.topDigits.map(d => ({label: 'ตัวเลข', value: d})),
        result.frequency.label
      );

      // Hot-Cold
      renderMethodResult('hotColdResult', [
        ...result.hotCold.hot.map(d => ({label: '🔥 ร้อน', value: d})),
        ...result.hotCold.cold.map(d => ({label: '❄️ เย็น', value: d}))
      ], result.hotCold.label);

      // Gap
      renderMethodResult('gapResult',
        result.gap.overdue.map(d => ({label: 'ครบรอบ', value: d})),
        result.gap.label
      );

      // Pairs
      renderMethodResult('pairResult',
        result.pairs.topPairs.map(d => ({label: 'คู่', value: d})),
        result.pairs.label
      );

      // Pattern
      const patternEl = document.getElementById('patternResult');
      patternEl.innerHTML = `
        <div class="lucky-label">${result.pattern.label}</div>
        <span class="lucky-num">${result.pattern.avgSum}</span>
        <span style="font-size:11px;color:var(--text-dim)">ผลรวมตัวเลขเฉลี่ย</span>
      `;

      // Moving Average
      const maEl = document.getElementById('maResult');
      maEl.innerHTML = `
        <div class="lucky-label">${result.movingAverage.label}</div>
        <span class="lucky-num">${result.movingAverage.predicted}</span>
        <span style="font-size:11px;color:var(--text-dim)">แนวโน้ม: ${result.movingAverage.trend}</span>
      `;

      // Combined
      renderCombinedResult(result.combined);

      btn.textContent = '🔮 วิเคราะห์เลขเด็ดงวดถัดไป';
      btn.disabled = false;
    }, 800);
  }

  function updatePredictDataRange(count) {
    const el = document.getElementById('predictDataRange');
    if (!el) return;
    try {
      const draws = count === 'all' 
        ? LotteryData.getAllDrawsIncludingExtra() 
        : LotteryData.getAllDraws().slice(0, parseInt(count));
      if (!draws || draws.length === 0) {
        el.textContent = '📋 ยังไม่มีข้อมูล';
        return;
      }
      const sorted = [...draws].sort((a, b) => a.date.localeCompare(b.date));
      const oldest = sorted[0].date;
      const newest = sorted[sorted.length - 1].date;
      const fmtDate = (iso) => {
        const [y, m, d] = iso.split('-');
        return `${parseInt(d)}/${parseInt(m)}/${parseInt(y) + 543}`;
      };
      el.innerHTML = `📋 อ้างอิงข้อมูล <strong>${draws.length}</strong> งวด | ตั้งแต่ <strong>${fmtDate(oldest)}</strong> ถึง <strong>${fmtDate(newest)}</strong>`;
    } catch (e) {
      el.textContent = '📋 ไม่สามารถโหลดข้อมูลได้';
    }
  }

  function renderMethodResult(elementId, items, label) {
    const el = document.getElementById(elementId);
    el.innerHTML = `
      <div class="lucky-label">${label}</div>
      ${items.map(item => `<span class="lucky-num">${item.value}</span>`).join('')}
    `;
  }

  function renderCombinedResult(combined) {
    const el = document.getElementById('combinedResult');
    const conf = combined.confidence;
    const confClass = conf > 60 ? 'high' : conf > 35 ? 'medium' : 'low';

    el.innerHTML = `
      <div class="lucky-label">🎯 เลข 6 หลัก (จากการวิเคราะห์ผสม)</div>
      ${combined.predicted6.map(n => `<span class="lucky-num">${n}</span>`).join('')}
      
      <div class="lucky-label" style="margin-top:8px">🎯 เลข 3 หลัก</div>
      ${combined.predicted3.map(n => `<span class="lucky-num">${n}</span>`).join('')}
      
      <div class="lucky-label" style="margin-top:8px">🎯 เลข 2 หลัก</div>
      ${combined.predicted2.map(n => `<span class="lucky-num">${n}</span>`).join('')}

      <div class="lucky-label" style="margin-top:8px">📊 ตัวเลขเด่น</div>
      ${combined.topDigits.map(d => `<span class="lucky-num">${d}</span>`).join('')}

      <div class="confidence-bar">
        <div class="confidence-fill ${confClass}" style="width:${conf}%"></div>
      </div>
      <div class="confidence-text">ความมั่นใจ: ${conf}% (จากการวิเคราะห์ทางสถิติ)</div>
    `;
  }

  // ========== Initialize Data (non-blocking) ==========
  // Set up callback BEFORE initialize so updates during loading are caught
  LotteryData.onUpdate((status, data, isNew) => {
    updateStatusBar(status, data);
    if (isNew && data) {
      loadLatestResults();
      showNotification('ผลรางวัลอัพเดทแล้ว!');
    }
    updateLiveBadge();
  });

  showLoading(true);

  // Initialize async — UI is already interactive
  LotteryData.initialize().then(() => {
    showLoading(false);
    updateStatusBar('loaded', null);
    updateLiveBadge();
    loadLatestResults();
  }).catch(err => {
    console.error('[Popup] Init error:', err);
    showLoading(false);
    document.getElementById('statusBar').textContent = '❌ โหลดข้อมูลไม่สำเร็จ';
  });
});
