/**
 * Thai Lottery Analysis Engine
 * เครื่องมือวิเคราะห์และทำนายเลขเด็ด
 */

const LotteryAnalysis = (() => {

  /**
   * 1. Frequency Analysis - วิเคราะห์ความถี่
   * นับความถี่ของแต่ละตัวเลขที่ออก
   */
  function frequencyAnalysis(data, digitType) {
    const freq = {};

    data.forEach(draw => {
      draw.numbers.forEach(num => {
        const digits = extractDigits(num, digitType);
        digits.forEach(d => {
          freq[d] = (freq[d] || 0) + 1;
        });
      });
    });

    // Sort by frequency
    const sorted = Object.entries(freq).sort((a, b) => b[1] - a[1]);
    
    return {
      frequency: freq,
      topNumbers: sorted.slice(0, 10),
      bottomNumbers: sorted.slice(-10).reverse(),
      total: data.length
    };
  }

  /**
   * 2. Hot-Cold Analysis - เลขร้อน/เลขเย็น
   * เลขร้อน = ออกบ่อยในช่วงหลัง
   * เลขเย็น = ไม่ออกมานาน
   */
  function hotColdAnalysis(data) {
    const recentCount = Math.min(12, Math.floor(data.length / 2));
    const recentData = data.slice(-recentCount);
    const olderData = data.slice(0, -recentCount);

    const recentFreq = {};
    const olderFreq = {};

    recentData.forEach(draw => {
      draw.numbers.forEach(num => {
        const digits = num.split('');
        digits.forEach(d => {
          recentFreq[d] = (recentFreq[d] || 0) + 1;
        });
        // Track whole numbers too
        recentFreq[num] = (recentFreq[num] || 0) + 1;
      });
    });

    olderData.forEach(draw => {
      draw.numbers.forEach(num => {
        const digits = num.split('');
        digits.forEach(d => {
          olderFreq[d] = (olderFreq[d] || 0) + 1;
        });
        olderFreq[num] = (olderFreq[num] || 0) + 1;
      });
    });

    // Hot: high recent, relative to older
    const hot = [];
    const cold = [];

    for (let i = 0; i <= 9; i++) {
      const d = String(i);
      const r = recentFreq[d] || 0;
      const o = olderFreq[d] || 0;
      const ratio = o > 0 ? r / (o / (olderData.length || 1)) * (recentData.length || 1) : r;
      hot.push({ digit: d, recent: r, older: o, ratio: ratio });
    }

    hot.sort((a, b) => b.ratio - a.ratio);

    // Last appearance tracking
    const lastAppearance = {};
    for (let i = data.length - 1; i >= 0; i--) {
      data[i].numbers.forEach(num => {
        if (!lastAppearance[num]) {
          lastAppearance[num] = { index: i, drawsAgo: data.length - 1 - i, date: data[i].date };
        }
      });
    }

    return {
      hotDigits: hot.slice(0, 5),
      coldDigits: hot.slice(-5).reverse(),
      lastAppearance: lastAppearance,
      recentPeriod: recentCount
    };
  }

  /**
   * 3. Gap Analysis - วิเคราะห์ช่วงห่าง
   * วิเคราะห์ว่าเลขออกห่างกันกี่งวด
   */
  function gapAnalysis(data) {
    // Track gaps for last 2 digits (0-99)
    const gaps = {};
    const currentGap = {};
    const avgGaps = {};

    // For each number, track when it appeared
    data.forEach((draw, idx) => {
      draw.numbers.forEach(num => {
        const last2 = num.slice(-2);
        if (!gaps[last2]) gaps[last2] = [];
        
        if (currentGap[last2] !== undefined) {
          gaps[last2].push(idx - currentGap[last2]);
        }
        currentGap[last2] = idx;
      });
    });

    // Calculate average gaps
    Object.keys(gaps).forEach(num => {
      if (gaps[num].length > 0) {
        avgGaps[num] = {
          avg: gaps[num].reduce((a, b) => a + b, 0) / gaps[num].length,
          min: Math.min(...gaps[num]),
          max: Math.max(...gaps[num]),
          lastSeen: currentGap[num] || 0,
          drawsSinceLastSeen: data.length - 1 - (currentGap[num] || 0),
          count: gaps[num].length
        };
      }
    });

    // Find numbers that are "overdue" (gap > average)
    const overdue = Object.entries(avgGaps)
      .filter(([, v]) => v.drawsSinceLastSeen > v.avg)
      .sort((a, b) => (b[1].drawsSinceLastSeen / b[1].avg) - (a[1].drawsSinceLastSeen / a[1].avg))
      .slice(0, 10);

    return {
      gaps: avgGaps,
      overdue: overdue,
      totalDraws: data.length
    };
  }

  /**
   * 4. Pair Analysis - คู่เลขที่มักออกด้วยกัน
   */
  function pairAnalysis(data) {
    const pairs = {};
    const digitPairs = {};

    data.forEach(draw => {
      draw.numbers.forEach(num => {
        const digits = num.split('');
        // consecutive digit pairs
        for (let i = 0; i < digits.length - 1; i++) {
          const pair = digits[i] + digits[i + 1];
          digitPairs[pair] = (digitPairs[pair] || 0) + 1;
        }
        // all 2-digit combinations
        for (let i = 0; i < digits.length; i++) {
          for (let j = i + 1; j < digits.length; j++) {
            const p = [digits[i], digits[j]].sort().join('');
            pairs[p] = (pairs[p] || 0) + 1;
          }
        }
      });
    });

    const topPairs = Object.entries(digitPairs)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 15);

    const topCombos = Object.entries(pairs)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 15);

    return {
      consecutivePairs: topPairs,
      combinations: topCombos,
      totalDraws: data.length
    };
  }

  /**
   * 5. Pattern Analysis - รูปแบบคู่-คี่, สูง-ต่ำ
   */
  function patternAnalysis(data) {
    const oddEvenPatterns = {};
    const highLowPatterns = {};
    const sumDistribution = {};
    const digitSums = [];

    data.forEach(draw => {
      draw.numbers.forEach(num => {
        const digits = num.split('').map(Number);
        
        // Odd-Even pattern
        const oe = digits.map(d => d % 2 === 0 ? 'E' : 'O').join('');
        oddEvenPatterns[oe] = (oddEvenPatterns[oe] || 0) + 1;

        // High-Low pattern (0-4 = Low, 5-9 = High)
        const hl = digits.map(d => d >= 5 ? 'H' : 'L').join('');
        highLowPatterns[hl] = (highLowPatterns[hl] || 0) + 1;

        // Sum of digits
        const sum = digits.reduce((a, b) => a + b, 0);
        const sumRange = `${Math.floor(sum / 5) * 5}-${Math.floor(sum / 5) * 5 + 4}`;
        sumDistribution[sumRange] = (sumDistribution[sumRange] || 0) + 1;
        digitSums.push(sum);
      });
    });

    // Most common patterns
    const topOE = Object.entries(oddEvenPatterns).sort((a, b) => b[1] - a[1]).slice(0, 5);
    const topHL = Object.entries(highLowPatterns).sort((a, b) => b[1] - a[1]).slice(0, 5);

    // Average digit sum
    const avgSum = digitSums.length > 0 
      ? digitSums.reduce((a, b) => a + b, 0) / digitSums.length 
      : 0;

    return {
      oddEven: topOE,
      highLow: topHL,
      sumDistribution: sumDistribution,
      averageDigitSum: avgSum,
      totalDraws: data.length
    };
  }

  /**
   * 6. Moving Average - ค่าเฉลี่ยเคลื่อนที่
   */
  function movingAverageAnalysis(data, window = 5) {
    const values = data.map(d => parseInt(d.numbers[0]));
    const ma = [];

    for (let i = window - 1; i < values.length; i++) {
      const slice = values.slice(i - window + 1, i + 1);
      const avg = slice.reduce((a, b) => a + b, 0) / window;
      ma.push({
        date: data[i].date,
        value: values[i],
        ma: Math.round(avg),
        trend: i > window ? (avg > ma[ma.length - 1]?.ma ? 'up' : 'down') : 'flat'
      });
    }

    // Predict next based on trend
    const recentMA = ma.slice(-5);
    const trend = recentMA.length >= 2 
      ? (recentMA[recentMA.length - 1].ma - recentMA[0].ma) / recentMA.length
      : 0;

    const predicted = Math.round(recentMA[recentMA.length - 1]?.ma + trend) || 0;

    return {
      movingAverages: ma,
      trend: trend > 0 ? 'ขาขึ้น' : trend < 0 ? 'ขาลง' : 'ทรงตัว',
      predictedValue: Math.max(0, predicted),
      window: window
    };
  }

  /**
   * 7. Combined Prediction - รวมทุกวิธี
   */
  function combinedPrediction(data) {
    const freq = frequencyAnalysis(data, 'single');
    const hotCold = hotColdAnalysis(data);
    const gap = gapAnalysis(data);
    const pairs = pairAnalysis(data);
    const pattern = patternAnalysis(data);
    const ma = movingAverageAnalysis(data);

    // Score each digit 0-9
    const scores = {};
    for (let i = 0; i <= 9; i++) {
      scores[i] = 0;
    }

    // Weight from frequency
    freq.topNumbers.forEach(([num, count], idx) => {
      if (num.length === 1) {
        scores[parseInt(num)] += (10 - idx) * 2;
      }
    });

    // Weight from hot digits
    hotCold.hotDigits.forEach((item, idx) => {
      scores[parseInt(item.digit)] += (5 - idx) * 3;
    });

    // Weight from cold digits (due for appearance)
    hotCold.coldDigits.forEach((item, idx) => {
      scores[parseInt(item.digit)] += (5 - idx) * 1.5;
    });

    // Weight from pairs
    pairs.consecutivePairs.slice(0, 5).forEach(([pair, count], idx) => {
      pair.split('').forEach(d => {
        scores[parseInt(d)] += (5 - idx);
      });
    });

    // Sort digits by score
    const rankedDigits = Object.entries(scores)
      .sort((a, b) => b[1] - a[1]);

    // Generate candidates
    const topDigits = rankedDigits.slice(0, 6).map(d => d[0]);
    
    // Generate 6-digit combinations
    const predicted6 = [];
    for (let i = 0; i < 3; i++) {
      let num = '';
      for (let j = 0; j < 6; j++) {
        const idx = (i + j) % topDigits.length;
        num += topDigits[idx];
      }
      predicted6.push(num);
    }

    // Generate 3-digit combinations
    const predicted3 = [];
    for (let i = 0; i < 4; i++) {
      let num = '';
      for (let j = 0; j < 3; j++) {
        const idx = (i + j) % topDigits.length;
        num += topDigits[idx];
      }
      predicted3.push(num);
    }

    // Generate 2-digit combinations
    const predicted2 = [];
    for (let i = 0; i < 5; i++) {
      let num = '';
      for (let j = 0; j < 2; j++) {
        const idx = (i + j) % topDigits.length;
        num += topDigits[idx];
      }
      predicted2.push(num);
    }

    // Calculate confidence (0-100)
    const maxScore = rankedDigits[0][1];
    const minScore = rankedDigits[rankedDigits.length - 1][1];
    const spread = maxScore - minScore;
    const confidence = Math.min(85, Math.max(15, Math.round((spread / maxScore) * 100)));

    return {
      scores: rankedDigits,
      predicted6: [...new Set(predicted6)],
      predicted3: [...new Set(predicted3)],
      predicted2: [...new Set(predicted2)],
      confidence: confidence,
      topDigits: topDigits,
      methods: {
        frequency: freq,
        hotCold: hotCold,
        gap: gap,
        pairs: pairs,
        pattern: pattern,
        movingAverage: ma
      }
    };
  }

  // Helper: Extract digits
  function extractDigits(num, type) {
    switch(type) {
      case 'single': return num.split('');
      case 'pairs': {
        const d = [];
        for (let i = 0; i < num.length - 1; i++) {
          d.push(num.substring(i, i + 2));
        }
        return d;
      }
      case 'whole': return [num];
      default: return num.split('');
    }
  }

  // ========== Chart Data Generators ==========

  /**
   * สร้างข้อมูลกราฟความถี่
   */
  function getFrequencyChartData(data, type) {
    const freq = {};
    
    data.forEach(draw => {
      draw.numbers.forEach(num => {
        const digits = num.split('');
        digits.forEach(d => {
          freq[d] = (freq[d] || 0) + 1;
        });
      });
    });

    const labels = Object.keys(freq).sort();
    const values = labels.map(l => freq[l]);

    return {
      labels,
      datasets: [{
        label: 'ความถี่',
        data: values,
        backgroundColor: values.map(v => {
          const max = Math.max(...values);
          const ratio = v / max;
          if (ratio > 0.8) return 'rgba(239, 68, 68, 0.7)';
          if (ratio > 0.5) return 'rgba(245, 158, 11, 0.7)';
          return 'rgba(107, 60, 225, 0.7)';
        }),
        borderColor: 'rgba(107, 60, 225, 1)',
        borderWidth: 1
      }]
    };
  }

  /**
   * สร้างข้อมูลกราฟเลขร้อน/เย็น
   */
  function getHotColdChartData(data) {
    const analysis = hotColdAnalysis(data);
    const allDigits = [...analysis.hotDigits, ...analysis.coldDigits];
    const uniqueDigits = [...new Map(allDigits.map(d => [d.digit, d])).values()];
    uniqueDigits.sort((a, b) => a.digit - b.digit);

    return {
      labels: uniqueDigits.map(d => `เลข ${d.digit}`),
      datasets: [
        {
          label: 'ล่าสุด (12 งวด)',
          data: uniqueDigits.map(d => d.recent),
          backgroundColor: 'rgba(239, 68, 68, 0.7)',
          borderColor: 'rgba(239, 68, 68, 1)',
          borderWidth: 1
        },
        {
          label: 'ก่อนหน้า',
          data: uniqueDigits.map(d => d.older),
          backgroundColor: 'rgba(59, 130, 246, 0.7)',
          borderColor: 'rgba(59, 130, 246, 1)',
          borderWidth: 1
        }
      ]
    };
  }

  /**
   * สร้างข้อมูลกราฟแนวโน้ม
   */
  function getTrendChartData(data) {
    const values = data.map(d => ({
      date: d.date,
      value: parseInt(d.numbers[0])
    }));

    // Moving average
    const window = 5;
    const maValues = [];
    for (let i = window - 1; i < values.length; i++) {
      const slice = values.slice(i - window + 1, i + 1);
      maValues.push(slice.reduce((a, b) => a + b.value, 0) / window);
    }

    return {
      labels: values.map(v => LotteryData.formatDateShort(v.date)),
      datasets: [
        {
          label: 'ค่าจริง',
          data: values.map(v => v.value),
          borderColor: 'rgba(107, 60, 225, 1)',
          backgroundColor: 'rgba(107, 60, 225, 0.1)',
          fill: true,
          tension: 0.4,
          pointRadius: 2
        },
        {
          label: `MA(${window})`,
          data: Array(window - 1).fill(null).concat(maValues),
          borderColor: 'rgba(245, 158, 11, 1)',
          borderWidth: 2,
          borderDash: [5, 5],
          fill: false,
          tension: 0.4,
          pointRadius: 0
        }
      ]
    };
  }

  /**
   * สร้างข้อมูลกราฟคู่เลข
   */
  function getPairsChartData(data) {
    const analysis = pairAnalysis(data);
    const top = analysis.consecutivePairs.slice(0, 10);

    return {
      labels: top.map(p => p[0]),
      datasets: [{
        label: 'จำนวนครั้ง',
        data: top.map(p => p[1]),
        backgroundColor: top.map((_, i) => {
          const colors = [
            'rgba(239, 68, 68, 0.7)', 'rgba(245, 158, 11, 0.7)', 
            'rgba(16, 185, 129, 0.7)', 'rgba(59, 130, 246, 0.7)',
            'rgba(139, 92, 246, 0.7)', 'rgba(236, 72, 153, 0.7)',
            'rgba(14, 165, 233, 0.7)', 'rgba(168, 85, 247, 0.7)',
            'rgba(234, 179, 8, 0.7)', 'rgba(34, 197, 94, 0.7)'
          ];
          return colors[i % colors.length];
        }),
        borderWidth: 1
      }]
    };
  }

  // ========== Public API ==========
  return {
    frequencyAnalysis,
    hotColdAnalysis,
    gapAnalysis,
    pairAnalysis,
    patternAnalysis,
    movingAverageAnalysis,
    combinedPrediction,

    getFrequencyChartData,
    getHotColdChartData,
    getTrendChartData,
    getPairsChartData,

    /**
     * วิเคราะห์ทั้งหมดและ return ผลสำหรับแสดงในหน้า predict
     */
    runFullAnalysis(count) {
      const data = LotteryData.getAnalysisData('first', count || 48);
      const dataLast2 = LotteryData.getAnalysisData('last2', count || 48);

      const freq = frequencyAnalysis(data, 'single');
      const hotCold = hotColdAnalysis(data);
      const gap = gapAnalysis(dataLast2);
      const pairs = pairAnalysis(data);
      const pattern = patternAnalysis(data);
      const ma = movingAverageAnalysis(data);
      const combined = combinedPrediction(data);

      return {
        frequency: {
          topDigits: freq.topNumbers.slice(0, 5).map(n => n[0]),
          label: `ตัวเลขที่ออกบ่อยสุด: ${freq.topNumbers.slice(0, 5).map(n => n[0]).join(', ')} (จาก ${freq.total} งวด)`
        },
        hotCold: {
          hot: hotCold.hotDigits.slice(0, 3).map(d => d.digit),
          cold: hotCold.coldDigits.slice(0, 3).map(d => d.digit),
          label: `ร้อน: ${hotCold.hotDigits.slice(0, 3).map(d => d.digit).join(',')} | เย็น: ${hotCold.coldDigits.slice(0, 3).map(d => d.digit).join(',')}`
        },
        gap: {
          overdue: gap.overdue.slice(0, 5).map(o => o[0]),
          label: `เลขที่ครบรอบ: ${gap.overdue.slice(0, 5).map(o => `${o[0]}(${o[1].drawsSinceLastSeen}งวด)`).join(', ')}`
        },
        pairs: {
          topPairs: pairs.consecutivePairs.slice(0, 5).map(p => p[0]),
          label: `คู่เลขยอดนิยม: ${pairs.consecutivePairs.slice(0, 5).map(p => p[0]).join(', ')}`
        },
        pattern: {
          topOE: pattern.oddEven[0],
          avgSum: Math.round(pattern.averageDigitSum),
          label: `รูปแบบยอดนิยม: ${pattern.oddEven[0]?.[0] || '-'} | ผลรวมเฉลี่ย: ${Math.round(pattern.averageDigitSum)}`
        },
        movingAverage: {
          trend: ma.trend,
          predicted: String(ma.predictedValue).padStart(6, '0'),
          label: `แนวโน้ม: ${ma.trend} | ค่าคาดการณ์: ${String(ma.predictedValue).padStart(6, '0')}`
        },
        combined: combined
      };
    }
  };
})();
