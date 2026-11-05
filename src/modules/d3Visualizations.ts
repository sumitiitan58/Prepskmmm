import * as d3 from 'd3';
import type { StreakCalendarDay, TestSubmission } from '../types';
import { computePerformanceTrendsForD3 } from '../utils/examLogic';

/**
 * Renders the D3.js Study Streak Progression Curve & Daily Momentum Bars inside the
 * Home Dashboard 'Streak Widget' component.
 */
export function renderD3StreakProgressionWidget(
  container: HTMLElement | null,
  streakDays: StreakCalendarDay[],
  currentStreak: number
): void {
  if (!container) return;
  container.innerHTML = '';

  const width = Math.max(280, container.clientWidth || 440);
  const height = 165;
  const margin = { top: 22, right: 18, bottom: 30, left: 34 };
  const innerWidth = width - margin.left - margin.right;
  const innerHeight = height - margin.top - margin.bottom;

  const data = streakDays.map((day, idx) => {
    const isActive = day.status === 'streak_active' || day.status === 'completed';
    const isTodayPending = day.isToday && day.status === 'today_pending';
    // Build cumulative streak progression value for D3 curve
    const streakScore = isActive
      ? Math.min(100, 45 + (idx + 1) * 8)
      : isTodayPending
        ? 42
        : day.status === 'upcoming'
          ? Math.min(100, 55 + (idx + 1) * 8)
          : 15;
    return {
      dayLabel: `${day.dayShort} ${day.dateNumber}`,
      shortDay: day.dayShort,
      status: day.status,
      isToday: day.isToday,
      score: streakScore,
      streakDayNum: isActive ? Math.max(1, currentStreak - (5 - idx)) : 0,
    };
  });

  const svg = d3
    .select(container)
    .append('svg')
    .attr('viewBox', `0 0 ${width} ${height}`)
    .attr('class', 'w-full h-[165px] overflow-visible select-none')
    .attr('role', 'img')
    .attr('aria-label', `D3.js Study Streak Progression Chart showing ${currentStreak} active days`);

  const defs = svg.append('defs');
  const grad = defs
    .append('linearGradient')
    .attr('id', 'd3-streak-area-grad')
    .attr('x1', '0%')
    .attr('y1', '0%')
    .attr('x2', '0%')
    .attr('y2', '100%');
  grad.append('stop').attr('offset', '0%').attr('stop-color', '#10B981').attr('stop-opacity', 0.36);
  grad.append('stop').attr('offset', '100%').attr('stop-color', '#4F46E5').attr('stop-opacity', 0.03);

  const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);

  const x = d3
    .scalePoint<string>()
    .domain(data.map((d) => d.dayLabel))
    .range([0, innerWidth])
    .padding(0.35);

  const y = d3.scaleLinear().domain([0, 105]).range([innerHeight, 0]);

  // Horizontal dashed gridlines
  g.append('g')
    .selectAll('line')
    .data([25, 50, 75, 100])
    .join('line')
    .attr('x1', 0)
    .attr('x2', innerWidth)
    .attr('y1', (d) => y(d))
    .attr('y2', (d) => y(d))
    .attr('stroke', '#E2E8F0')
    .attr('stroke-dasharray', '3,3');

  // Y axis labels
  g.append('g')
    .selectAll('text')
    .data([0, 50, 100])
    .join('text')
    .attr('x', -8)
    .attr('y', (d) => y(d) + 3)
    .attr('text-anchor', 'end')
    .attr('fill', '#64748B')
    .attr('font-size', '9px')
    .attr('font-family', 'JetBrains Mono, monospace')
    .text((d) => `${d}%`);

  // Background vertical bars per day
  const barWidth = Math.min(28, Math.max(14, innerWidth / 10));
  g.selectAll('.streak-day-bar')
    .data(data)
    .join('rect')
    .attr('class', 'streak-day-bar')
    .attr('x', (d) => (x(d.dayLabel) ?? 0) - barWidth / 2)
    .attr('y', (d) => y(d.score))
    .attr('width', barWidth)
    .attr('height', (d) => Math.max(4, innerHeight - y(d.score)))
    .attr('rx', 5)
    .attr('fill', (d) =>
      d.status === 'streak_active'
        ? '#10B981'
        : d.isToday
          ? '#F59E0B'
          : d.status === 'upcoming'
            ? '#E0E7FF'
            : '#CBD5E1'
    )
    .attr('opacity', (d) => (d.status === 'upcoming' ? 0.55 : 0.25));

  // Smooth D3 Area under progression curve
  const areaGen = d3
    .area<(typeof data)[0]>()
    .x((d) => x(d.dayLabel) ?? 0)
    .y0(innerHeight)
    .y1((d) => y(d.score))
    .curve(d3.curveMonotoneX);

  g.append('path').datum(data).attr('fill', 'url(#d3-streak-area-grad)').attr('d', areaGen);

  // Smooth D3 Line
  const lineGen = d3
    .line<(typeof data)[0]>()
    .x((d) => x(d.dayLabel) ?? 0)
    .y((d) => y(d.score))
    .curve(d3.curveMonotoneX);

  g.append('path')
    .datum(data)
    .attr('fill', 'none')
    .attr('stroke', '#4F46E5')
    .attr('stroke-width', 2.5)
    .attr('d', lineGen);

  // Data Nodes
  g.selectAll('.streak-node')
    .data(data)
    .join('circle')
    .attr('class', 'streak-node')
    .attr('cx', (d) => x(d.dayLabel) ?? 0)
    .attr('cy', (d) => y(d.score))
    .attr('r', (d) => (d.isToday ? 6 : 4.5))
    .attr('fill', (d) =>
      d.status === 'streak_active'
        ? '#10B981'
        : d.isToday
          ? '#F59E0B'
          : d.status === 'upcoming'
            ? '#6366F1'
            : '#94A3B8'
    )
    .attr('stroke', '#FFFFFF')
    .attr('stroke-width', 2);

  // Node status badges above points
  g.selectAll('.streak-node-label')
    .data(data)
    .join('text')
    .attr('x', (d) => x(d.dayLabel) ?? 0)
    .attr('y', (d) => y(d.score) - 9)
    .attr('text-anchor', 'middle')
    .attr('font-size', '9px')
    .attr('font-weight', '700')
    .attr('font-family', 'JetBrains Mono, monospace')
    .attr('fill', (d) =>
      d.status === 'streak_active' ? '#047857' : d.isToday ? '#B45309' : '#64748B'
    )
    .text((d) =>
      d.isToday
        ? 'TODAY'
        : d.status === 'streak_active'
          ? '✓'
          : d.status === 'upcoming'
            ? 'NEXT'
            : '–'
    );

  // X Axis Day Labels
  g.append('g')
    .selectAll('text')
    .data(data)
    .join('text')
    .attr('x', (d) => x(d.dayLabel) ?? 0)
    .attr('y', innerHeight + 18)
    .attr('text-anchor', 'middle')
    .attr('font-size', '10px')
    .attr('font-weight', (d) => (d.isToday ? '800' : '600'))
    .attr('fill', (d) => (d.isToday ? '#4F46E5' : '#475569'))
    .text((d) => d.dayLabel);
}

/**
 * Renders a D3.js Subject-Wise Accuracy Bar Chart with a 75% NTA Topper Benchmark Line.
 */
export function renderD3SubjectAccuracyChart(
  container: HTMLElement | null,
  submissions: TestSubmission[]
): void {
  if (!container) return;
  container.innerHTML = '';

  const { subjectAggregates } = computePerformanceTrendsForD3(submissions);
  const width = Math.max(300, container.clientWidth || 500);
  const height = 250;
  const margin = { top: 26, right: 24, bottom: 42, left: 46 };
  const innerWidth = width - margin.left - margin.right;
  const innerHeight = height - margin.top - margin.bottom;

  const palette: Record<string, string> = {
    Physics: '#4F46E5',
    Chemistry: '#10B981',
    Math: '#F59E0B',
    Biology: '#EC4899',
  };

  const svg = d3
    .select(container)
    .append('svg')
    .attr('viewBox', `0 0 ${width} ${height}`)
    .attr('class', 'w-full h-[250px] overflow-visible select-none')
    .attr('role', 'img')
    .attr('aria-label', 'D3.js Subject-wise Accuracy Bar Chart');

  const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);

  const x = d3
    .scaleBand<string>()
    .domain(subjectAggregates.map((d) => d.subject))
    .range([0, innerWidth])
    .padding(0.36);

  const y = d3.scaleLinear().domain([0, 100]).range([innerHeight, 0]);

  // Gridlines
  g.append('g')
    .selectAll('line')
    .data([0, 25, 50, 75, 100])
    .join('line')
    .attr('x1', 0)
    .attr('x2', innerWidth)
    .attr('y1', (d) => y(d))
    .attr('y2', (d) => y(d))
    .attr('stroke', '#E2E8F0')
    .attr('stroke-dasharray', (d) => (d === 0 ? 'none' : '4,4'));

  // Y-axis ticks
  g.append('g')
    .selectAll('text')
    .data([0, 25, 50, 75, 100])
    .join('text')
    .attr('x', -10)
    .attr('y', (d) => y(d) + 4)
    .attr('text-anchor', 'end')
    .attr('font-size', '10px')
    .attr('font-family', 'JetBrains Mono, monospace')
    .attr('fill', '#64748B')
    .text((d) => `${d}%`);

  // 75% Topper Target Line
  g.append('line')
    .attr('x1', 0)
    .attr('x2', innerWidth)
    .attr('y1', y(75))
    .attr('y2', y(75))
    .attr('stroke', '#10B981')
    .attr('stroke-width', 1.5)
    .attr('stroke-dasharray', '6,4');

  g.append('text')
    .attr('x', innerWidth - 4)
    .attr('y', y(75) - 6)
    .attr('text-anchor', 'end')
    .attr('font-size', '9px')
    .attr('font-weight', '700')
    .attr('fill', '#047857')
    .text('99%ile Target (75%)');

  // Bars
  g.selectAll('.subject-acc-bar')
    .data(subjectAggregates)
    .join('rect')
    .attr('class', 'subject-acc-bar')
    .attr('x', (d) => x(d.subject) ?? 0)
    .attr('y', (d) => y(d.avgAccuracy))
    .attr('width', x.bandwidth())
    .attr('height', (d) => Math.max(4, innerHeight - y(d.avgAccuracy)))
    .attr('rx', 8)
    .attr('fill', (d) => palette[d.subject] || '#4F46E5');

  // Value badges above bars
  g.selectAll('.subject-acc-val')
    .data(subjectAggregates)
    .join('text')
    .attr('class', 'subject-acc-val')
    .attr('x', (d) => (x(d.subject) ?? 0) + x.bandwidth() / 2)
    .attr('y', (d) => y(d.avgAccuracy) - 8)
    .attr('text-anchor', 'middle')
    .attr('font-size', '11px')
    .attr('font-weight', '800')
    .attr('font-family', 'JetBrains Mono, monospace')
    .attr('fill', '#0F172A')
    .text((d) => `${d.avgAccuracy}% (${d.totalCorrect}✓/${d.totalWrong}✗)`);

  // X-axis Subject Labels
  g.append('g')
    .selectAll('text')
    .data(subjectAggregates)
    .join('text')
    .attr('x', (d) => (x(d.subject) ?? 0) + x.bandwidth() / 2)
    .attr('y', innerHeight + 22)
    .attr('text-anchor', 'middle')
    .attr('font-size', '12px')
    .attr('font-weight', '700')
    .attr('fill', '#1E293B')
    .text((d) => d.subject);
}

/**
 * Renders a D3.js Multi-Series Improvement Trend Line & Area Graph across Mock Test Attempts.
 */
export function renderD3ImprovementTrendGraph(
  container: HTMLElement | null,
  submissions: TestSubmission[]
): void {
  if (!container) return;
  container.innerHTML = '';

  const { chronologicalTrend } = computePerformanceTrendsForD3(submissions);
  const width = Math.max(300, container.clientWidth || 500);
  const height = 250;
  const margin = { top: 26, right: 26, bottom: 42, left: 46 };
  const innerWidth = width - margin.left - margin.right;
  const innerHeight = height - margin.top - margin.bottom;

  const svg = d3
    .select(container)
    .append('svg')
    .attr('viewBox', `0 0 ${width} ${height}`)
    .attr('class', 'w-full h-[250px] overflow-visible select-none')
    .attr('role', 'img')
    .attr('aria-label', 'D3.js Mock Test Improvement & Accuracy Trend Graph');

  const defs = svg.append('defs');
  const areaGrad = defs
    .append('linearGradient')
    .attr('id', 'd3-improvement-grad')
    .attr('x1', '0%')
    .attr('y1', '0%')
    .attr('x2', '0%')
    .attr('y2', '100%');
  areaGrad
    .append('stop')
    .attr('offset', '0%')
    .attr('stop-color', '#4F46E5')
    .attr('stop-opacity', 0.28);
  areaGrad
    .append('stop')
    .attr('offset', '100%')
    .attr('stop-color', '#4F46E5')
    .attr('stop-opacity', 0.02);

  const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);

  const x = d3
    .scalePoint<string>()
    .domain(chronologicalTrend.map((d) => `${d.shortLabel} (${d.dateLabel})`))
    .range([0, innerWidth])
    .padding(0.25);

  const y = d3.scaleLinear().domain([0, 100]).range([innerHeight, 0]);

  // Gridlines
  g.append('g')
    .selectAll('line')
    .data([0, 25, 50, 75, 100])
    .join('line')
    .attr('x1', 0)
    .attr('x2', innerWidth)
    .attr('y1', (d) => y(d))
    .attr('y2', (d) => y(d))
    .attr('stroke', '#E2E8F0')
    .attr('stroke-dasharray', (d) => (d === 0 ? 'none' : '4,4'));

  // Y-axis labels
  g.append('g')
    .selectAll('text')
    .data([0, 25, 50, 75, 100])
    .join('text')
    .attr('x', -10)
    .attr('y', (d) => y(d) + 4)
    .attr('text-anchor', 'end')
    .attr('font-size', '10px')
    .attr('font-family', 'JetBrains Mono, monospace')
    .attr('fill', '#64748B')
    .text((d) => `${d}%`);

  if (chronologicalTrend.length > 0) {
    const areaAccuracy = d3
      .area<(typeof chronologicalTrend)[0]>()
      .x((d) => x(`${d.shortLabel} (${d.dateLabel})`) ?? 0)
      .y0(innerHeight)
      .y1((d) => y(d.accuracyPercent))
      .curve(d3.curveMonotoneX);

    g.append('path')
      .datum(chronologicalTrend)
      .attr('fill', 'url(#d3-improvement-grad)')
      .attr('d', areaAccuracy);

    // Line 1: Accuracy % (Indigo)
    const lineAccuracy = d3
      .line<(typeof chronologicalTrend)[0]>()
      .x((d) => x(`${d.shortLabel} (${d.dateLabel})`) ?? 0)
      .y((d) => y(d.accuracyPercent))
      .curve(d3.curveMonotoneX);

    g.append('path')
      .datum(chronologicalTrend)
      .attr('fill', 'none')
      .attr('stroke', '#4F46E5')
      .attr('stroke-width', 3)
      .attr('d', lineAccuracy);

    // Line 2: Score % (Emerald dashed)
    const lineScore = d3
      .line<(typeof chronologicalTrend)[0]>()
      .x((d) => x(`${d.shortLabel} (${d.dateLabel})`) ?? 0)
      .y((d) => y(d.scorePercent))
      .curve(d3.curveMonotoneX);

    g.append('path')
      .datum(chronologicalTrend)
      .attr('fill', 'none')
      .attr('stroke', '#10B981')
      .attr('stroke-width', 2.2)
      .attr('stroke-dasharray', '5,4')
      .attr('d', lineScore);

    // Accuracy Points & Labels
    g.selectAll('.acc-point')
      .data(chronologicalTrend)
      .join('circle')
      .attr('class', 'acc-point')
      .attr('cx', (d) => x(`${d.shortLabel} (${d.dateLabel})`) ?? 0)
      .attr('cy', (d) => y(d.accuracyPercent))
      .attr('r', 5.5)
      .attr('fill', '#4F46E5')
      .attr('stroke', '#FFFFFF')
      .attr('stroke-width', 2);

    g.selectAll('.acc-label')
      .data(chronologicalTrend)
      .join('text')
      .attr('x', (d) => x(`${d.shortLabel} (${d.dateLabel})`) ?? 0)
      .attr('y', (d) => y(d.accuracyPercent) - 10)
      .attr('text-anchor', 'middle')
      .attr('font-size', '11px')
      .attr('font-weight', '800')
      .attr('font-family', 'JetBrains Mono, monospace')
      .attr('fill', '#4F46E5')
      .text((d) => `${d.accuracyPercent}% Acc`);

    // Score Points
    g.selectAll('.score-point')
      .data(chronologicalTrend)
      .join('circle')
      .attr('class', 'score-point')
      .attr('cx', (d) => x(`${d.shortLabel} (${d.dateLabel})`) ?? 0)
      .attr('cy', (d) => y(d.scorePercent))
      .attr('r', 4.5)
      .attr('fill', '#10B981')
      .attr('stroke', '#FFFFFF')
      .attr('stroke-width', 1.5);
  }

  // X-axis Test Labels
  g.append('g')
    .selectAll('text')
    .data(chronologicalTrend)
    .join('text')
    .attr('x', (d) => x(`${d.shortLabel} (${d.dateLabel})`) ?? 0)
    .attr('y', innerHeight + 22)
    .attr('text-anchor', 'middle')
    .attr('font-size', '11px')
    .attr('font-weight', '700')
    .attr('fill', '#334155')
    .text((d) => `${d.shortLabel} · ${d.dateLabel}`);
}
