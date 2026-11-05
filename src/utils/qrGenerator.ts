import type { FormulaSheet } from '../types';

/**
 * Generates a deterministic, crisp SVG QR code representation for a given UPI payload string.
 */
export function generateUpiQrSvg(payload: string, accentHex = '#6366f1'): string {
  const size = 21;
  const grid: boolean[][] = Array.from({ length: size }, () =>
    Array.from({ length: size }, () => false)
  );

  const drawFinder = (r0: number, c0: number) => {
    for (let r = 0; r < 7; r++) {
      for (let c = 0; c < 7; c++) {
        const isBorder = r === 0 || r === 6 || c === 0 || c === 6;
        const isInner = r >= 2 && r <= 4 && c >= 2 && c <= 4;
        if (isBorder || isInner) {
          grid[r0 + r][c0 + c] = true;
        }
      }
    }
  };

  drawFinder(0, 0);
  drawFinder(0, size - 7);
  drawFinder(size - 7, 0);

  // Timing patterns
  for (let i = 8; i < size - 8; i++) {
    grid[6][i] = i % 2 === 0;
    grid[i][6] = i % 2 === 0;
  }

  // Deterministic hash from payload
  let hash = 2166136261;
  for (let i = 0; i < payload.length; i++) {
    hash ^= payload.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }

  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      const inTopLeft = r < 8 && c < 8;
      const inTopRight = r < 8 && c >= size - 8;
      const inBottomLeft = r >= size - 8 && c < 8;
      const isTiming = r === 6 || c === 6;
      if (inTopLeft || inTopRight || inBottomLeft || isTiming) continue;

      const bitIndex = (r * size + c) % 31;
      const charCode = payload.charCodeAt((r * 7 + c * 13) % payload.length);
      const val = ((hash >>> bitIndex) ^ charCode ^ (r * 17 + c * 31)) & 1;
      grid[r][c] = val === 1;
    }
  }

  const cellSize = 8;
  const padding = 12;
  const totalPx = size * cellSize + padding * 2;
  let rects = '';

  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (!grid[r][c]) continue;
      const x = padding + c * cellSize;
      const y = padding + r * cellSize;
      const isFinderCorner =
        (r < 7 && c < 7) || (r < 7 && c >= size - 7) || (r >= size - 7 && c < 7);
      const fill = isFinderCorner ? '#09090b' : '#18181b';
      rects += `<rect x="${x}" y="${y}" width="${cellSize - 0.6}" height="${cellSize - 0.6}" rx="1.5" fill="${fill}" />`;
    }
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${totalPx} ${totalPx}" class="w-44 h-44 mx-auto rounded-xl bg-white p-1.5 shadow-sm" role="img" aria-label="Dynamic UPI Payment QR Code">
    <rect width="${totalPx}" height="${totalPx}" rx="10" fill="#ffffff" />
    ${rects}
    <rect x="${totalPx / 2 - 16}" y="${totalPx / 2 - 16}" width="32" height="32" rx="6" fill="${accentHex}" stroke="#ffffff" stroke-width="3" />
    <text x="${totalPx / 2}" y="${totalPx / 2 + 4}" text-anchor="middle" fill="#ffffff" font-family="Plus Jakarta Sans, sans-serif" font-weight="700" font-size="10">UPI</text>
  </svg>`;
}

/**
 * Triggers a clean browser download of a Formula Sheet as a formatted printable study document.
 */
export function downloadFormulaSheetFile(sheet: FormulaSheet): void {
  const lines: string[] = [
    `====================================================================`,
    `PREPSKM HIGH-YIELD FORMULA REPOSITORY — ${sheet.classLevel.toUpperCase()}`,
    `Title   : ${sheet.title}`,
    `Subject : ${sheet.subject} (${sheet.chapter})`,
    `Pages   : ${sheet.pageCount} Condensed Revision Sheets`,
    `====================================================================`,
    ``,
    ...sheet.highYieldFormulas.flatMap((f, idx) => [
      `${idx + 1}. ${f.label}`,
      `   Equation : ${f.equation}`,
      `   Concept  : ${f.note}`,
      ``,
    ]),
    `--------------------------------------------------------------------`,
    `Curated by Sumit (IITR) • Prepskm JEE & NEET Mentorship Portal`,
  ];

  const blob = new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${sheet.id}_${sheet.subject.toLowerCase()}_formulas.txt`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
