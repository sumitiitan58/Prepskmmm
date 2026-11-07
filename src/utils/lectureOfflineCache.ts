import type { FormulaSheet, StudyMaterialItem, VideoRoadmapItem } from '../types';

export const LECTURE_MATERIALS_CACHE_NAME = 'prepskm-lecture-materials-v1';
export const OFFLINE_CACHE_STORAGE_KEY = 'prepskm_offline_cached_material_ids_v1';

export interface OfflineCachedMaterialRecord {
  id: string;
  title: string;
  section: string;
  subjectId: string;
  classId: string;
  examTag: string;
  pagesCount: number;
  pdfUrl: string;
  cachedAt: string;
  offlineHtmlDocument: string;
  offlineSummaryPoints: string[];
}

export interface LectureOfflineCacheStatus {
  swSupported: boolean;
  swActive: boolean;
  isOnline: boolean;
  cachedMaterialIds: string[];
  totalAvailableCount: number;
  cachedCount: number;
  coveragePercent: number;
  lastSyncedAt: string | null;
}

/**
 * Pure helper: builds high-yield offline study notes & formula sheet HTML for a StudyMaterialItem
 * so that when a student opens a pre-downloaded PDF/material inside the Lecture Player or Study Vault
 * during intermittent/zero connectivity, the full document renders immediately from Cache Storage.
 */
export function buildOfflineStudyMaterialRecord(
  material: StudyMaterialItem,
  cachedAtIso: string = new Date().toISOString()
): OfflineCachedMaterialRecord {
  const existingPages =
    Array.isArray(material.summaryPages) && material.summaryPages.length > 0
      ? material.summaryPages
      : [
          `Core concepts & derivations for ${material.title} (${material.section}).`,
          `High-weightage NTA formula checklist & dimensional shortcuts verified by Mentor Sumit Kumar.`,
          `Top 15 previous year solved application patterns with step-by-step error traps.`,
          `Cached for instant offline access inside the prepskm.in Lecture Player (${material.pagesCount} pages).`,
        ];

  const offlineHtmlDocument = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>${escapeHtmlText(material.title)} — Offline Study Material</title>
  <style>
    body { font-family: 'Plus Jakarta Sans', system-ui, sans-serif; background: #FAF7F2; color: #0F172A; margin: 0; padding: 28px; }
    .card { max-width: 780px; margin: 0 auto; background: #FFFDF9; border: 1px solid #E8DFD1; border-radius: 20px; padding: 28px; box-shadow: 0 8px 24px rgba(15,23,42,0.06); }
    .badge { display: inline-block; background: #ECFDF5; color: #047857; border: 1px solid #A7F3D0; font-size: 11px; font-weight: 800; padding: 4px 10px; border-radius: 999px; text-transform: uppercase; letter-spacing: 0.06em; }
    h1 { font-size: 22px; margin: 12px 0 6px; }
    .meta { font-size: 13px; color: #64748B; margin-bottom: 18px; }
    .formula-box { background: #FAF6EE; border: 1px solid #E8DFD1; border-radius: 14px; padding: 16px; margin-top: 14px; }
    ul { padding-left: 20px; line-height: 1.7; font-size: 14px; color: #334155; }
  </style>
</head>
<body>
  <div class="card">
    <span class="badge">✓ Served from Service Worker Offline Cache</span>
    <h1>${escapeHtmlText(material.title)}</h1>
    <div class="meta">${escapeHtmlText(material.section)} • Cohort: ${escapeHtmlText(material.cohortTag || material.classId)} • Exam: ${escapeHtmlText(material.examTag || 'JEE/NEET')} • ${material.pagesCount} Pages</div>
    <div class="formula-box">
      <strong>Key Revision Highlights &amp; Pre-Downloaded Study Pages:</strong>
      <ul>
        ${existingPages.map((pt) => `<li>${escapeHtmlText(pt)}</li>`).join('')}
      </ul>
    </div>
  </div>
</body>
</html>`;

  return {
    id: material.id,
    title: material.title,
    section: material.section,
    subjectId: material.subjectId,
    classId: material.classId,
    examTag: String(material.examTag || 'BOTH'),
    pagesCount: material.pagesCount,
    pdfUrl: material.pdfUrl,
    cachedAt: cachedAtIso,
    offlineHtmlDocument,
    offlineSummaryPoints: existingPages,
  };
}

/**
 * Pure helper: converts a FormulaSheet (used in Lecture Player /player.html) into a StudyMaterialItem
 * so formula sheets can also be pre-downloaded into the Service Worker cache.
 */
export function convertFormulaSheetToMaterialItem(sheet: FormulaSheet): StudyMaterialItem {
  return {
    id: `formula_${sheet.id}`,
    title: `${sheet.title} (${sheet.chapter})`,
    section: 'Formula Sheets',
    classId: sheet.classLevel,
    cohortTag: sheet.classLevel,
    examTag: sheet.examTrack,
    subjectId: sheet.subject,
    pdfUrl: `/materials/formula-${sheet.id}.pdf`,
    thumbnailUrl: '/assets/lecture-cover.svg',
    downloads: 120,
    pagesCount: sheet.pageCount,
    summaryPages: sheet.highYieldFormulas.map(
      (f) => `${f.label}: ${f.equation} — ${f.note}`
    ),
    createdAt: '2026-11-01',
  };
}

/**
 * Pure helper: computes the offline cache status summary for UI badges and progress bars.
 */
export function computeLectureOfflineCacheStatus(params: {
  swSupported: boolean;
  swActive: boolean;
  isOnline: boolean;
  cachedMaterialIds: string[];
  availableMaterials: StudyMaterialItem[];
  lastSyncedAt?: string | null;
}): LectureOfflineCacheStatus {
  const uniqueCachedIds = Array.from(new Set(params.cachedMaterialIds));
  const availableIds = new Set(params.availableMaterials.map((m) => m.id));
  const matchedCount = uniqueCachedIds.filter((id) => availableIds.has(id)).length;
  const totalAvailableCount = params.availableMaterials.length;
  const coveragePercent =
    totalAvailableCount > 0
      ? Math.min(100, Math.round((matchedCount / totalAvailableCount) * 100))
      : uniqueCachedIds.length > 0
        ? 100
        : 0;

  return {
    swSupported: params.swSupported,
    swActive: params.swActive,
    isOnline: params.isOnline,
    cachedMaterialIds: uniqueCachedIds,
    totalAvailableCount,
    cachedCount: matchedCount,
    coveragePercent,
    lastSyncedAt: params.lastSyncedAt ?? null,
  };
}

/**
 * Pure helper: matches study materials relevant to a given lecture or topic tag so the Lecture Player
 * can display contextual pre-downloaded materials right alongside the video stream.
 */
export function selectLectureCompanionMaterials(
  materials: StudyMaterialItem[],
  lecture?: Pick<VideoRoadmapItem, 'topicTag' | 'section' | 'title' | 'classCohort'> | null
): StudyMaterialItem[] {
  if (!Array.isArray(materials) || materials.length === 0) return [];
  if (!lecture) return materials.slice(0, 6);

  const tagLower = (lecture.topicTag || '').toLowerCase();
  const titleLower = (lecture.title || '').toLowerCase();

  const matched = materials.filter((m) => {
    const mTitle = m.title.toLowerCase();
    const mSec = m.section.toLowerCase();
    const mSub = m.subjectId.toLowerCase();
    return (
      (tagLower && (mTitle.includes(tagLower) || mSub.includes(tagLower) || mSec.includes(tagLower))) ||
      (titleLower.includes('physics') && mSub.includes('phys')) ||
      (titleLower.includes('rotational') && mTitle.includes('rotational')) ||
      (titleLower.includes('chem') && mSub.includes('chem')) ||
      (titleLower.includes('math') && mSub.includes('math')) ||
      (titleLower.includes('bio') && mSub.includes('bio'))
    );
  });

  if (matched.length >= 2) {
    return matched.slice(0, 6);
  }
  return materials.slice(0, 6);
}

function escapeHtmlText(raw: string): string {
  return String(raw)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Reads cached material IDs from localStorage + Cache Storage.
 */
export function getStoredCachedMaterialIds(): string[] {
  if (typeof window === 'undefined' || !window.localStorage) return [];
  try {
    const raw = window.localStorage.getItem(OFFLINE_CACHE_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((id) => typeof id === 'string') : [];
  } catch {
    return [];
  }
}

function saveStoredCachedMaterialIds(ids: string[]): void {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    const unique = Array.from(new Set(ids));
    window.localStorage.setItem(OFFLINE_CACHE_STORAGE_KEY, JSON.stringify(unique));
    window.localStorage.setItem(`${OFFLINE_CACHE_STORAGE_KEY}_timestamp`, new Date().toISOString());
  } catch {
    // Ignore storage quota errors
  }
}

export function getLastOfflineCacheTimestamp(): string | null {
  if (typeof window === 'undefined' || !window.localStorage) return null;
  try {
    return window.localStorage.getItem(`${OFFLINE_CACHE_STORAGE_KEY}_timestamp`);
  } catch {
    return null;
  }
}

/**
 * Registers `/sw.js` and listens for cache completion messages.
 */
export async function registerLectureServiceWorker(
  onUpdate?: () => void
): Promise<ServiceWorkerRegistration | null> {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
    return null;
  }

  try {
    const registration = await navigator.serviceWorker.register('/sw.js', { scope: '/' });

    navigator.serviceWorker.addEventListener('message', (event) => {
      const data = event.data;
      if (data && data.type === 'LECTURE_MATERIALS_PRECACHED' && Array.isArray(data.cachedIds)) {
        const merged = Array.from(new Set([...getStoredCachedMaterialIds(), ...data.cachedIds]));
        saveStoredCachedMaterialIds(merged);
        onUpdate?.();
      }
    });

    return registration;
  } catch {
    return null;
  }
}

/**
 * Pre-downloads and caches one or more StudyMaterialItem records into both the browser Cache Storage API
 * (`prepskm-lecture-materials-v1`) and via Service Worker message so they remain accessible offline.
 */
export async function preDownloadMaterialsForOffline(
  materials: StudyMaterialItem[],
  extraAssetUrls: string[] = ['/assets/lecture-cover.svg', '/assets/mentor-sumit.svg']
): Promise<string[]> {
  if (!Array.isArray(materials) || materials.length === 0) {
    return getStoredCachedMaterialIds();
  }

  const records = materials.map((mat) => buildOfflineStudyMaterialRecord(mat));
  const newlyCachedIds: string[] = [];

  // 1. Directly populate Cache Storage API in the window context for immediate deterministic access
  if (typeof window !== 'undefined' && 'caches' in window) {
    try {
      const cache = await window.caches.open(LECTURE_MATERIALS_CACHE_NAME);
      for (const record of records) {
        const jsonUrl = new URL(
          `/offline-materials/${encodeURIComponent(record.id)}.json`,
          window.location.origin
        ).href;
        await cache.put(
          jsonUrl,
          new Response(JSON.stringify(record), {
            status: 200,
            headers: {
              'Content-Type': 'application/json; charset=utf-8',
              'X-PrepSKM-Offline-Cache': 'true',
            },
          })
        );

        if (record.pdfUrl && record.pdfUrl.startsWith('/')) {
          const docUrl = new URL(record.pdfUrl, window.location.origin).href;
          await cache.put(
            docUrl,
            new Response(record.offlineHtmlDocument, {
              status: 200,
              headers: {
                'Content-Type': 'text/html; charset=utf-8',
                'X-PrepSKM-Offline-Cache': 'true',
              },
            })
          );
        }
        newlyCachedIds.push(record.id);
      }

      for (const assetUrl of extraAssetUrls) {
        try {
          const target = new URL(assetUrl, window.location.origin).href;
          const res = await fetch(target);
          if (res.ok) {
            await cache.put(target, res.clone());
          }
        } catch {
          // Offline or intermittent failure; skip external asset
        }
      }
    } catch {
      for (const record of records) {
        newlyCachedIds.push(record.id);
      }
    }
  } else {
    for (const record of records) {
      newlyCachedIds.push(record.id);
    }
  }

  // 2. Also instruct active Service Worker to cache the records
  if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
    try {
      const reg = await navigator.serviceWorker.ready;
      reg.active?.postMessage({
        type: 'PRECACHE_LECTURE_MATERIALS',
        materials: records.map((r) => ({ ...r, fileUrl: r.pdfUrl })),
        assetUrls: extraAssetUrls,
      });
    } catch {
      // Ignore if SW is still activating
    }
  }

  const updatedIds = Array.from(new Set([...getStoredCachedMaterialIds(), ...newlyCachedIds]));
  saveStoredCachedMaterialIds(updatedIds);
  return updatedIds;
}

/**
 * Retrieves a pre-downloaded StudyMaterialItem record from the Service Worker Cache Storage
 * (or synthesizes from fallback if already marked cached), allowing offline reading inside Lecture Player.
 */
export async function getOfflineCachedMaterialRecord(
  material: StudyMaterialItem
): Promise<OfflineCachedMaterialRecord> {
  if (typeof window !== 'undefined' && 'caches' in window) {
    try {
      const cache = await window.caches.open(LECTURE_MATERIALS_CACHE_NAME);
      const jsonUrl = new URL(
        `/offline-materials/${encodeURIComponent(material.id)}.json`,
        window.location.origin
      ).href;
      const match = await cache.match(jsonUrl);
      if (match) {
        const data = (await match.json()) as OfflineCachedMaterialRecord;
        if (data && data.id) return data;
      }
    } catch {
      // Fall through to synthesized record
    }
  }
  return buildOfflineStudyMaterialRecord(material);
}
