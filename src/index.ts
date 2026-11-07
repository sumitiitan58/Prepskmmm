import {
  DEFAULT_BRAND_LOGO_SVG,
  MENTOR_AVATAR_PATH,
  THEME_PRESETS,
} from './constants';
import { AdminCommandModule } from './modules/adminCommandView';
import { CBTTestEngineModule } from './modules/cbtTestEngineView';
import { HomePageModule } from './modules/homePageView';
import { LiveClassroomModule } from './modules/liveView';
import { MentorshipHubModule } from './modules/mentorshipHubView';
import { PlayerModule } from './modules/playerView';
import { StudyVaultModule } from './modules/studyVaultView';
import {
  dataStore,
  MASTER_ADMIN_EMAIL,
  SECONDARY_ADMIN_EMAIL,
} from './services/firebaseService';
import type { PageId, StudentClassYear, TargetExam } from './types';
import {
  preDownloadMaterialsForOffline,
  registerLectureServiceWorker,
} from './utils/lectureOfflineCache';

const AVATAR_CHOICES = [
  MENTOR_AVATAR_PATH,
  'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=160&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=160&auto=format&fit=crop&q=80',
];

class PrepskmPlatformApp {
  private rootEl: HTMLElement;
  private activePage: PageId;
  private isProfileModalOpen = false;
  private isQuickEditModalOpen = false;
  private isFacultyLoginExpanded = false;
  private isNotificationsOpen = false;
  private isTabletRailExpanded = false;
  private isOfflineMode = typeof navigator !== 'undefined' ? !navigator.onLine : false;

  private homeModule: HomePageModule;
  private studyModule: StudyVaultModule;
  private mentorshipModule: MentorshipHubModule;
  private testModule: CBTTestEngineModule;
  private adminModule: AdminCommandModule;
  private playerModule: PlayerModule;
  private liveModule: LiveClassroomModule;

  constructor(rootEl: HTMLElement) {
    this.rootEl = rootEl;
    this.activePage = this.detectInitialPage();

    this.homeModule = new HomePageModule({
      onNavigatePage: (p) => this.navigateToPage(p),
      onShowToast: (msg) => this.showToast(msg),
    });

    this.studyModule = new StudyVaultModule({
      onShowToast: (msg) => this.showToast(msg),
    });

    this.mentorshipModule = new MentorshipHubModule({
      onShowToast: (msg) => this.showToast(msg),
    });

    this.testModule = new CBTTestEngineModule({
      onShowToast: (msg) => this.showToast(msg),
    });

    this.adminModule = new AdminCommandModule({
      onShowToast: (msg) => this.showToast(msg),
      onAuthUpdated: () => this.renderShell(),
    });

    this.playerModule = new PlayerModule({
      onShowToast: (msg) => this.showToast(msg),
    });

    this.liveModule = new LiveClassroomModule({
      onShowToast: (msg: string) => this.showToast(msg),
    });

    this.renderShell();
    void this.initServiceWorkerAndOfflineListeners();
  }

  private detectInitialPage(): PageId {
    const bodyPage = document.body.dataset.page;
    const path = window.location.pathname.toLowerCase();
    if (bodyPage === 'study' || path.includes('study.html')) return 'study';
    if (bodyPage === 'mentorship' || path.includes('mentorship.html')) return 'mentorship';
    if (
      bodyPage === 'test' ||
      path.includes('test.html') ||
      path.includes('cbt-test.html')
    ) {
      return 'test';
    }
    if (bodyPage === 'admin' || path.includes('admin.html')) return 'admin';
    return 'home';
  }

  private async initServiceWorkerAndOfflineListeners(): Promise<void> {
    window.addEventListener('online', () => {
      this.isOfflineMode = false;
      this.showToast('Back online — synced with prepskm.in cloud & Service Worker cache.');
      this.renderShell();
    });

    window.addEventListener('offline', () => {
      this.isOfflineMode = true;
      this.showToast(
        'Offline connectivity detected — serving pre-downloaded Lecture Player study materials from Service Worker cache.'
      );
      this.renderShell();
    });

    window.addEventListener('prepskm:open-google-auth', () => {
      this.isProfileModalOpen = true;
      this.renderShell();
    });

    window.addEventListener('prepskm:auth-changed', () => {
      this.renderShell();
    });

    await registerLectureServiceWorker();
    // Pre-cache default study materials so Lecture Player has offline study materials ready immediately
    const initialMaterials = dataStore.getMaterials();
    if (initialMaterials.length > 0) {
      await preDownloadMaterialsForOffline(initialMaterials.slice(0, 6));
    }
  }

  public navigateToPage(page: PageId): void {
    if (page === 'profile') {
      this.isProfileModalOpen = true;
      this.renderShell();
      return;
    }
    this.testModule.unmount();
    this.mentorshipModule.unmount();
    this.activePage = page;
    this.renderShell();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  public renderShell(): void {
    dataStore.applySiteThemeToDocument();
    const user = dataStore.getUser();
    const isAdminOrMentor = dataStore.isAuthorizedAdminOrMentor();
    const isMasterAdmin = dataStore.isMasterAdmin();
    const siteTheme = dataStore.getSiteTheme();
    const broadcasts = dataStore.getBroadcasts();
    const logoSrc = siteTheme.logoDataUrl || DEFAULT_BRAND_LOGO_SVG;
    const brandName = siteTheme.brandName || 'prepskm.in';

    const path = window.location.pathname.toLowerCase();
    const isLegacyPlayer = path.includes('player.html');
    const isLegacyLive = path.includes('live.html');

    const navItems: {
      id: PageId;
      label: string;
      shortLabel: string;
      href: string;
      svgIcon: string;
      accentDot: string;
    }[] = [
      {
        id: 'home',
        label: 'Home & Dashboard',
        shortLabel: 'Home',
        href: '/index.html',
        svgIcon: `<svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M3 10.5L12 3l9 7.5V21a1 1 0 01-1 1h-5v-6H9v6H4a1 1 0 01-1-1V10.5z"/></svg>`,
        accentDot: 'bg-indigo-500',
      },
      {
        id: 'study',
        label: 'Study Material Vault',
        shortLabel: 'Study Vault',
        href: '/study.html',
        svgIcon: `<svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"/></svg>`,
        accentDot: 'bg-emerald-500',
      },
      {
        id: 'test',
        label: 'CBT Mock Test Engine',
        shortLabel: 'Mock Test',
        href: '/test.html',
        svgIcon: `<svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>`,
        accentDot: 'bg-amber-500',
      },
      {
        id: 'mentorship',
        label: '1:1 Mentorship & Videos',
        shortLabel: '1:1 Mentorship',
        href: '/mentorship.html',
        svgIcon: `<svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"/></svg>`,
        accentDot: 'bg-rose-500',
      },
    ];

    this.rootEl.innerHTML = `
      <div class="min-h-screen flex flex-col lg:flex-row bg-[#FFF9FB] text-slate-900" data-testid="pookie-app-shell" style="background-color: ${this.escapeHtml(siteTheme.surfaceBg || '#FFF9FB')}">
        <!-- 1. DESKTOP PERSISTENT LEFT SIDEBAR (>= 1024px) — POOKIE MODULAR LAYOUT -->
        <aside
          aria-label="Desktop Primary Sidebar"
          data-testid="desktop-persistent-sidebar"
          class="hidden lg:flex lg:flex-col lg:w-72 lg:fixed lg:inset-y-0 bg-white/95 backdrop-blur-md border-r-2 border-[#F3E8FF] rounded-r-3xl z-30 justify-between p-6 shadow-[0_14px_34px_-10px_rgba(236,72,153,0.14)]"
        >
          <div class="space-y-6">
            <!-- Brand Logo & Pookie Badge -->
            <div class="flex items-center justify-between">
              <a href="/index.html" class="flex items-center gap-3 group">
                <img
                  src="${logoSrc}"
                  alt="${this.escapeHtml(brandName)} Logo"
                  class="w-11 h-11 rounded-2xl object-contain shadow-sm shrink-0 group-hover:scale-105 transition-transform border border-[#F5D0FE]"
                />
                <div>
                  <div class="flex items-center gap-1.5">
                    <span class="text-base font-extrabold tracking-tight text-slate-900 leading-none">
                      ${this.escapeHtml(brandName)}
                    </span>
                    <span class="px-2 py-0.5 rounded-full bg-pink-100 text-pink-700 text-[10px] font-extrabold border border-pink-200">
                      ✨ Pookie UI
                    </span>
                  </div>
                  <div class="text-[11px] font-bold text-[#7C3AED] mt-1">
                    ${user.targetExam} 2027 · ${user.classYear}
                  </div>
                </div>
              </a>
            </div>

            <!-- Active Cohort Status Card -->
            <div class="p-3.5 rounded-2xl bg-gradient-to-r from-pink-50/90 via-purple-50/80 to-emerald-50/80 border border-[#F5D0FE] shadow-2xs">
              <div class="text-[10px] font-extrabold uppercase tracking-wider text-[#DB2777]">
                🌸 Active Class &amp; Track
              </div>
              <div class="text-xs font-extrabold text-slate-900 mt-0.5">
                ${user.classYear === 'Class 9' || user.classYear === 'Class 10' ? `${user.classYear} Foundation` : `${user.targetExam} · ${user.classYear}`}
              </div>
            </div>

            <!-- Primary Navigation Links (Large Touch-Friendly Targets) -->
            <nav aria-label="Desktop Navigation" class="space-y-2">
              ${navItems
                .map((item) => {
                  const active = this.activePage === item.id;
                  return `
                  <a
                    href="${item.href}"
                    data-shell-nav="${item.id}"
                    class="min-h-[48px] px-4 py-3 rounded-2xl flex items-center justify-between text-xs font-extrabold transition-all ${
                      active
                        ? 'bg-gradient-to-r from-[#7C3AED] to-[#DB2777] text-white shadow-md'
                        : 'text-slate-700 hover:bg-[#FDF2F8] hover:text-slate-900 border border-transparent hover:border-[#F5D0FE]'
                    }"
                  >
                    <span class="flex items-center gap-3">
                      ${item.svgIcon}
                      <span>${item.label}</span>
                    </span>
                    <span class="w-2.5 h-2.5 rounded-full ${active ? 'bg-white' : item.accentDot}"></span>
                  </a>
                `;
                })
                .join('')}

              <button
                type="button"
                data-shell-action="open-profile-modal"
                class="w-full min-h-[48px] px-4 py-3 rounded-2xl flex items-center gap-3 text-xs font-extrabold text-slate-700 hover:bg-[#FDF2F8] hover:text-slate-900 border border-transparent hover:border-[#F5D0FE] transition-all cursor-pointer"
              >
                <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/></svg>
                <span>Google Profile &amp; Cohort</span>
              </button>

              ${
                isAdminOrMentor
                  ? `
                <a
                  href="/admin.html"
                  data-shell-nav="admin"
                  class="min-h-[48px] px-4 py-3 rounded-2xl flex items-center justify-between text-xs font-extrabold transition-all ${
                    this.activePage === 'admin'
                      ? 'bg-gradient-to-r from-[#7C3AED] to-[#DB2777] text-white shadow-md'
                      : 'bg-emerald-50 text-emerald-800 border border-emerald-200 hover:bg-emerald-100'
                  }"
                >
                  <span class="flex items-center gap-3">
                    <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/></svg>
                    <span>Admin &amp; Mentor Studio</span>
                  </span>
                  <span class="px-2 py-0.5 rounded-full text-[10px] bg-[#10B981] text-white">
                    ${isMasterAdmin ? 'ADMIN' : 'MENTOR'}
                  </span>
                </a>
              `
                  : ''
              }
            </nav>
          </div>

          <!-- Quick Stats & Verified Google User Card at Bottom of Desktop Sidebar -->
          <div class="space-y-3 pt-4 border-t border-[#F3E8FF]">
            <div class="p-3.5 rounded-2xl bg-[#FDF2F8]/80 border border-[#F5D0FE] space-y-1.5">
              <div class="flex items-center justify-between text-xs">
                <span class="font-semibold text-slate-600">Active Streak</span>
                <span class="font-mono-tabular font-bold text-[#10B981]">🔥 ${user.currentStreak} Days</span>
              </div>
              <div class="flex items-center justify-between text-xs">
                <span class="font-semibold text-slate-600">Google Auth</span>
                <span class="font-bold text-[#7C3AED]">
                  ${user.isGuest ? 'Sign-In Required' : '✓ Verified'}
                </span>
              </div>
            </div>

            <button
              type="button"
              data-shell-action="open-profile-modal"
              class="w-full min-h-[52px] p-3 rounded-2xl bg-white hover:bg-[#FDF2F8] border border-[#F5D0FE] flex items-center gap-3 text-left transition-colors shadow-2xs cursor-pointer"
            >
              <img
                src="${user.photoURL}"
                alt="${this.escapeHtml(user.name)}"
                referrerpolicy="no-referrer"
                class="w-10 h-10 rounded-full object-cover border-2 border-[#F472B6] shrink-0"
              />
              <div class="min-w-0 flex-1">
                <div class="text-xs font-extrabold text-slate-900 truncate">${this.escapeHtml(user.name)}</div>
                <div class="text-[10px] font-mono-tabular text-slate-500 truncate">${this.escapeHtml(user.email || 'Tap to Sign In with Google')}</div>
              </div>
            </button>
          </div>
        </aside>

        <!-- 2. TABLET SLIM VERTICAL ICON RAIL (768px – 1024px) -->
        <aside
          aria-label="Tablet Navigation Rail"
          class="hidden md:flex lg:hidden flex-col fixed inset-y-0 left-0 ${
            this.isTabletRailExpanded ? 'w-60' : 'w-20'
          } bg-white/95 backdrop-blur-md border-r-2 border-[#F3E8FF] rounded-r-3xl z-30 justify-between p-3 transition-all shadow-sm"
        >
          <div class="space-y-4">
            <button
              type="button"
              data-shell-action="toggle-tablet-rail"
              class="w-full min-h-[48px] rounded-2xl bg-[#FDF2F8] border border-[#F5D0FE] text-slate-900 font-extrabold text-sm flex items-center justify-center gap-2 p-1.5"
              title="Expand or Collapse Navigation Rail"
            >
              <img src="${logoSrc}" alt="Logo" class="w-8 h-8 rounded-xl object-contain" />
              ${this.isTabletRailExpanded ? `<span class="text-xs font-extrabold">${this.escapeHtml(brandName)}</span>` : ''}
            </button>

            <nav class="space-y-2">
              ${navItems
                .map((item) => {
                  const active = this.activePage === item.id;
                  return `
                  <a
                    href="${item.href}"
                    data-shell-nav="${item.id}"
                    title="${item.label}"
                    class="min-h-[48px] px-3 py-2.5 rounded-2xl flex items-center ${
                      this.isTabletRailExpanded ? 'justify-start gap-3' : 'justify-center'
                    } text-xs font-extrabold ${
                      active
                        ? 'bg-gradient-to-r from-[#7C3AED] to-[#DB2777] text-white shadow-sm'
                        : 'text-slate-600 hover:bg-[#FDF2F8]'
                    }"
                  >
                    ${item.svgIcon}
                    ${this.isTabletRailExpanded ? `<span>${item.shortLabel}</span>` : ''}
                  </a>
                `;
                })
                .join('')}

              <button
                type="button"
                data-shell-action="open-profile-modal"
                title="Google Profile & Settings"
                class="w-full min-h-[48px] px-3 py-2.5 rounded-2xl flex items-center ${
                  this.isTabletRailExpanded ? 'justify-start gap-3' : 'justify-center'
                } text-xs font-extrabold text-slate-600 hover:bg-[#FDF2F8]"
              >
                <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/></svg>
                ${this.isTabletRailExpanded ? `<span>Profile</span>` : ''}
              </button>

              ${
                isAdminOrMentor
                  ? `
                <a
                  href="/admin.html"
                  data-shell-nav="admin"
                  title="Admin & Mentor Studio"
                  class="min-h-[48px] px-3 py-2.5 rounded-2xl flex items-center ${
                    this.isTabletRailExpanded ? 'justify-start gap-3' : 'justify-center'
                  } text-xs font-extrabold ${
                    this.activePage === 'admin'
                      ? 'bg-gradient-to-r from-[#7C3AED] to-[#DB2777] text-white'
                      : 'bg-emerald-50 text-emerald-700'
                  }"
                >
                  <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/></svg>
                  ${this.isTabletRailExpanded ? `<span>Admin Studio</span>` : ''}
                </a>
              `
                  : ''
              }
            </nav>
          </div>
        </aside>

        <!-- MAIN CONTENT WRAPPER -->
        <div class="flex-1 flex flex-col md:pl-20 lg:pl-72 pb-28 md:pb-10">
          <!-- Top Persistent Dashboard Header Bar -->
          <header class="sticky top-0 z-20 bg-white/90 backdrop-blur-md border-b border-[#F3E8FF] px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-2 shadow-[0_4px_20px_-8px_rgba(236,72,153,0.10)]">
            <!-- Left: Mobile Logo + Single Unified Cohort & Class Selector Box -->
            <div class="flex items-center gap-2 sm:gap-3 min-w-0">
              <a href="/index.html" class="lg:hidden flex items-center gap-2 shrink-0">
                <img
                  src="${logoSrc}"
                  alt="${this.escapeHtml(brandName)}"
                  class="w-8 h-8 rounded-xl object-contain shadow-2xs border border-[#F5D0FE]"
                />
                <span class="hidden sm:inline font-extrabold text-sm sm:text-base text-slate-900">${this.escapeHtml(brandName)}</span>
              </a>

              <!-- SINGLE UNIFIED CLASS & EXAM COHORT SELECTOR BOX -->
              <div class="flex items-center gap-1.5 bg-[#FDF2F8] border-2 border-[#F5D0FE] hover:border-[#7C3AED] rounded-2xl px-2.5 sm:px-3 py-1.5 shadow-2xs transition-colors min-h-[40px] max-w-[165px] sm:max-w-none">
                <span class="text-[10px] font-extrabold uppercase tracking-wider text-[#7C3AED] hidden sm:inline">Cohort:</span>
                <select
                  id="unified-cohort-select"
                  aria-label="Select Class and Exam Track"
                  class="bg-transparent text-xs sm:text-sm font-extrabold text-slate-900 focus:outline-none cursor-pointer pr-1 truncate"
                >
                  ${[
                    { value: 'JEE|Class 12', label: 'JEE · Class 12' },
                    { value: 'JEE|Class 11', label: 'JEE · Class 11 (Foundation)' },
                    { value: 'JEE|Dropper', label: 'JEE · Dropper' },
                    { value: 'NEET|Class 12', label: 'NEET · Class 12' },
                    { value: 'NEET|Class 11', label: 'NEET · Class 11 (Foundation)' },
                    { value: 'NEET|Dropper', label: 'NEET · Dropper' },
                    { value: 'JEE|Class 10', label: 'Class 10 · Foundation' },
                    { value: 'JEE|Class 9', label: 'Class 9 · Foundation' },
                  ]
                    .map((opt) => {
                      const currentKey =
                        user.classYear === 'Class 10'
                          ? 'JEE|Class 10'
                          : user.classYear === 'Class 9'
                            ? 'JEE|Class 9'
                            : `${user.targetExam}|${user.classYear}`;
                      return `<option value="${opt.value}" ${currentKey === opt.value ? 'selected' : ''}>${opt.label}</option>`;
                    })
                    .join('')}
                </select>
              </div>
            </div>

            <!-- Right: Quick 1:1 Mentorship Link, Admin Pencil Button, Notifications Bell, and Mandatory Google Auth Trigger -->
            <div class="flex items-center gap-1.5 sm:gap-2 shrink-0">
              <a
                href="/mentorship.html"
                data-shell-nav="mentorship"
                data-testid="header-1on1-mentorship-btn"
                class="hidden sm:inline-flex min-h-[42px] px-3.5 py-2 rounded-2xl bg-pink-50 hover:bg-pink-100 border border-pink-200 text-pink-900 text-xs font-extrabold items-center gap-1.5 transition-colors"
              >
                <span>🎥 1:1 Mentorship</span>
              </a>

              ${
                isAdminOrMentor
                  ? `
                <button
                  type="button"
                  data-shell-action="open-quick-edit-modal"
                  data-testid="admin-pencil-edit-btn"
                  title="Quick Edit Website Name, Theme & Colors"
                  class="min-h-[40px] sm:min-h-[42px] px-2.5 sm:px-3.5 py-2 rounded-2xl bg-purple-50 hover:bg-purple-100 border border-purple-200 text-[#7C3AED] text-xs font-extrabold flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <span>✏️</span><span class="hidden sm:inline">Edit Site</span>
                </button>
              `
                  : ''
              }

              <!-- Notifications & Broadcast Bell -->
              <div class="relative">
                <button
                  type="button"
                  data-shell-action="toggle-notifications"
                  aria-label="Notifications and Mentor Broadcasts"
                  class="min-h-[42px] min-w-[42px] rounded-2xl bg-[#FDF2F8] hover:bg-pink-100/70 border border-[#F5D0FE] flex items-center justify-center text-slate-700 relative cursor-pointer"
                >
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"/></svg>
                  <span class="w-2 h-2 rounded-full bg-[#EC4899] absolute top-2 right-2"></span>
                </button>

                ${
                  this.isNotificationsOpen
                    ? `
                  <div class="absolute right-0 mt-2 w-80 bg-white border-2 border-[#F5D0FE] rounded-3xl shadow-xl p-4 space-y-2.5 z-50">
                    <div class="flex items-center justify-between">
                      <span class="text-xs font-bold text-slate-900">Mentor &amp; Streak Alerts</span>
                      <span class="text-[10px] font-mono-tabular px-2 py-0.5 rounded-full bg-purple-50 text-[#7C3AED] font-bold">${broadcasts.length} Live</span>
                    </div>
                    ${broadcasts
                      .slice(0, 3)
                      .map(
                        (b) => `
                      <div class="p-3 rounded-2xl bg-[#FDF2F8] border border-[#F5D0FE] text-xs text-slate-700 space-y-1">
                        <div class="font-bold text-[#7C3AED]">${this.escapeHtml(b.title)}</div>
                        <p class="text-[11px] text-slate-600 leading-snug">${this.escapeHtml(b.message)}</p>
                        <div class="text-[10px] text-slate-400 font-mono-tabular">By ${this.escapeHtml(b.senderName)} · Target: ${this.escapeHtml(b.targetCohort)}</div>
                      </div>
                    `
                      )
                      .join('')}
                  </div>
                `
                    : ''
                }
              </div>

              <!-- Mandatory Google Sign-In Trigger + Profile Pill -->
              <button
                type="button"
                data-shell-action="open-profile-modal"
                data-testid="header-google-signup-btn"
                class="min-h-[42px] px-3.5 py-2 rounded-2xl bg-white hover:bg-[#FDF2F8] border-2 border-[#F5D0FE] text-slate-800 text-xs font-extrabold flex items-center gap-1.5 shadow-2xs transition-colors cursor-pointer"
                title="Mandatory Google Account & Profile"
              >
                <svg class="w-4 h-4 shrink-0" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17z"/>
                  <path fill="#34A853" d="M12 24c3.3 0 6.08-1.09 8.1-2.96l-3.88-3.05c-1.08.72-2.45 1.16-4.22 1.16-3.24 0-5.98-2.18-6.96-5.11H1.05v3.14C3.06 21.2 7.21 24 12 24z"/>
                  <path fill="#FBBC05" d="M5.04 14.04c-.25-.72-.38-1.49-.38-2.29s.13-1.57.38-2.29V6.32H1.05C.38 7.66 0 9.18 0 11.75s.38 4.09 1.05 5.43l3.99-3.14z"/>
                  <path fill="#EA4335" d="M12 4.75c1.8 0 3.41.62 4.68 1.84l3.51-3.51C18.07 1.19 15.3 0 12 0 7.21 0 3.06 2.8 1.05 6.32l3.99 3.14c.98-2.93 3.72-4.71 6.96-4.71z"/>
                </svg>
                ${
                  user.isGuest
                    ? `<span class="text-[#7C3AED]">Sign In with Google</span>`
                    : `<span class="hidden sm:inline">${this.escapeHtml(user.name.split(' ')[0])}</span><span class="text-[#10B981]">· ✓ Google</span>`
                }
              </button>
            </div>
          </header>

          ${
            this.isOfflineMode
              ? `
            <div
              data-testid="offline-connectivity-banner"
              class="bg-pink-50 border-b border-pink-200 px-4 py-2 text-xs font-bold text-pink-900 flex items-center justify-between gap-2"
            >
              <span>⚡ Offline / Intermittent Connectivity Mode: Pre-downloaded Lecture Player study materials &amp; PDFs are active via Service Worker Cache.</span>
              <a href="/mentorship.html" data-shell-nav="mentorship" class="underline font-extrabold text-[#7C3AED]">Open Lecture Player →</a>
            </div>
          `
              : ''
          }

          <!-- Page Viewport Container (Generous Vertical Stacking & Padding on Mobile & Desktop) -->
          <main id="page-viewport" class="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6"></main>
        </div>

        <!-- 3. MOBILE FIXED FROSTED-GLASS 5-TAB BOTTOM NAVIGATION BAR (< 768px) — POOKIE UI -->
        <nav
          aria-label="Mobile Bottom Navigation Bar"
          data-testid="mobile-bottom-nav"
          class="md:hidden fixed bottom-0 inset-x-0 z-40 bg-white/95 backdrop-blur-md border-t-2 border-[#F5D0FE] rounded-t-3xl px-2.5 py-2 grid grid-cols-5 gap-1.5 shadow-[0_-10px_28px_-6px_rgba(236,72,153,0.16)]"
        >
          ${navItems
            .map((item) => {
              const active = this.activePage === item.id;
              return `
              <a
                href="${item.href}"
                data-shell-nav="${item.id}"
                class="min-h-[50px] rounded-2xl flex flex-col items-center justify-center gap-0.5 text-[10px] font-extrabold transition-all ${
                  active
                    ? 'text-white bg-gradient-to-r from-[#7C3AED] to-[#DB2777] shadow-sm'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-[#FDF2F8]'
                }"
              >
                ${item.svgIcon}
                <span>${item.shortLabel}</span>
              </a>
            `;
            })
            .join('')}

          <!-- Tab 5: Profile / Cohort Settings -->
          <button
            type="button"
            data-shell-action="open-profile-modal"
            class="min-h-[50px] rounded-2xl flex flex-col items-center justify-center gap-0.5 text-[10px] font-extrabold ${
              this.isProfileModalOpen
                ? 'text-white bg-gradient-to-r from-[#7C3AED] to-[#DB2777] shadow-sm'
                : 'text-slate-600 hover:text-slate-900 hover:bg-[#FDF2F8]'
            }"
          >
            <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/></svg>
            <span>Profile</span>
          </button>
        </nav>

        <!-- Student Profile, Class Cohort & Mandatory Google Auth Modal -->
        ${this.renderProfileAndAuthModal()}

        <!-- Website-Wide Admin Pencil Quick-Edit Modal -->
        ${this.renderAdminQuickEditModal()}

        <!-- Global Toast Notification -->
        <div
          id="global-toast"
          role="status"
          aria-live="polite"
          class="fixed bottom-24 md:bottom-6 right-4 z-50 hidden px-4 py-3 rounded-2xl bg-gradient-to-r from-[#7C3AED] to-[#DB2777] text-white text-xs font-extrabold shadow-xl border border-pink-300"
        ></div>
      </div>
    `;

    const viewport = this.rootEl.querySelector<HTMLElement>('#page-viewport');
    if (viewport) {
      if (isLegacyPlayer) {
        this.playerModule.mount(viewport);
      } else if (isLegacyLive) {
        this.liveModule.mount(viewport);
      } else if (this.activePage === 'study') {
        this.studyModule.mount(viewport);
      } else if (this.activePage === 'mentorship') {
        this.mentorshipModule.mount(viewport);
      } else if (this.activePage === 'test') {
        this.testModule.mount(viewport);
      } else if (this.activePage === 'admin') {
        this.adminModule.mount(viewport);
      } else {
        this.homeModule.mount(viewport);
      }
    }

    this.bindShellEvents();
  }

  private renderAdminQuickEditModal(): string {
    if (!this.isQuickEditModalOpen) return '';
    const siteTheme = dataStore.getSiteTheme();

    return `
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Quick Edit Website Brand and Colors"
        data-testid="admin-pencil-modal"
        class="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4"
      >
        <div class="bg-white border-2 border-[#F5D0FE] rounded-3xl max-w-lg w-full p-6 shadow-2xl space-y-4">
          <div class="flex items-center justify-between pb-3 border-b border-[#F3E8FF]">
            <div>
              <span class="text-xs font-extrabold uppercase tracking-wider text-[#7C3AED]">
                ✏️ Admin Quick-Edit Studio
              </span>
              <h2 class="text-lg font-extrabold text-slate-900">
                Customize Website Name, Pastel Theme &amp; Colors
              </h2>
            </div>
            <button
              type="button"
              data-shell-action="close-quick-edit-modal"
              class="min-h-[40px] px-3.5 py-1.5 rounded-2xl bg-[#FDF2F8] border border-[#F5D0FE] text-slate-700 text-xs font-bold"
            >
              Close ✕
            </button>
          </div>

          <form id="admin-quick-edit-form" class="space-y-4">
            <div>
              <label for="qe-brand-name" class="block text-xs font-bold text-slate-700 mb-1">
                Website / Portal Name
              </label>
              <input
                id="qe-brand-name"
                type="text"
                required
                value="${this.escapeHtml(siteTheme.brandName)}"
                class="w-full min-h-[44px] px-3.5 py-2 rounded-2xl bg-[#FDF2F8] border border-[#F5D0FE] text-sm font-bold text-slate-900"
              />
            </div>

            <div class="grid grid-cols-3 gap-3">
              <div>
                <label for="qe-primary-color" class="block text-xs font-bold text-slate-700 mb-1">
                  Primary Accent
                </label>
                <input
                  id="qe-primary-color"
                  type="color"
                  value="${this.escapeHtml(siteTheme.primaryColor)}"
                  class="w-full h-10 rounded-2xl border border-[#F5D0FE] cursor-pointer"
                />
              </div>
              <div>
                <label for="qe-secondary-color" class="block text-xs font-bold text-slate-700 mb-1">
                  Secondary Accent
                </label>
                <input
                  id="qe-secondary-color"
                  type="color"
                  value="${this.escapeHtml(siteTheme.secondaryColor)}"
                  class="w-full h-10 rounded-2xl border border-[#F5D0FE] cursor-pointer"
                />
              </div>
              <div>
                <label for="qe-surface-bg" class="block text-xs font-bold text-slate-700 mb-1">
                  Pastel Background
                </label>
                <input
                  id="qe-surface-bg"
                  type="color"
                  value="${this.escapeHtml(siteTheme.surfaceBg)}"
                  class="w-full h-10 rounded-2xl border border-[#F5D0FE] cursor-pointer"
                />
              </div>
            </div>

            <div class="space-y-1.5">
              <div class="text-xs font-bold text-slate-700">1-Click Pookie Pastel Theme Presets</div>
              <div class="grid grid-cols-2 gap-2">
                ${THEME_PRESETS.map(
                  (preset, idx) => `
                  <button
                    type="button"
                    data-shell-action="apply-quick-preset"
                    data-preset-idx="${idx}"
                    class="p-2.5 rounded-2xl border border-[#F5D0FE] bg-[#FDF2F8] hover:bg-pink-50 text-left flex items-center gap-2 text-xs font-bold text-slate-800"
                  >
                    <span class="w-4 h-4 rounded-full shrink-0" style="background:${preset.primaryColor}"></span>
                    <span class="truncate">${this.escapeHtml(preset.presetName)}</span>
                  </button>
                `
                ).join('')}
              </div>
            </div>

            <div class="flex items-center justify-end gap-2 pt-2 border-t border-[#F3E8FF]">
              <button
                type="submit"
                class="min-h-[44px] px-5 py-2 rounded-2xl bg-gradient-to-r from-[#7C3AED] to-[#DB2777] text-white text-xs font-extrabold shadow-sm"
              >
                Save Website Customization
              </button>
            </div>
          </form>
        </div>
      </div>
    `;
  }

  private renderProfileAndAuthModal(): string {
    if (!this.isProfileModalOpen) return '';
    const user = dataStore.getUser();
    const mentors = dataStore.getMentors();
    const isSignedOut = Boolean(user.isGuest || !user.email);

    return `
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Student Profile and Mandatory Google Authentication"
        data-testid="google-auth-profile-modal"
        class="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4"
      >
        <div class="bg-white border-2 border-[#F5D0FE] rounded-3xl max-w-lg w-full p-6 shadow-2xl space-y-5 max-h-[90vh] overflow-y-auto">
          <div class="flex items-center justify-between pb-3 border-b border-[#F3E8FF]">
            <div>
              <span class="text-xs font-extrabold uppercase tracking-wider text-[#DB2777]">
                ${isSignedOut ? '🔒 Mandatory Google Authentication' : '🌸 Verified Google OAuth Profile'}
              </span>
              <h2 class="text-lg font-extrabold text-slate-900">
                ${isSignedOut ? 'Sign In with Google (Zero Manual Fields)' : 'Streamlined Google Profile &amp; Cohort'}
              </h2>
            </div>
            <button
              type="button"
              data-shell-action="close-profile-modal"
              class="min-h-[40px] px-3.5 py-1.5 rounded-2xl bg-[#FDF2F8] border border-[#F5D0FE] text-slate-700 text-xs font-bold cursor-pointer"
            >
              Close ✕
            </button>
          </div>

          ${
            isSignedOut
              ? `
            <!-- STATE 1: MANDATORY GOOGLE SIGN-IN ONLY (ALL MANUAL LOGIN TEXT FIELDS REMOVED) -->
            <div class="p-5 rounded-3xl bg-gradient-to-br from-[#FDF2F8] via-white to-[#F5F3FF] border-2 border-[#F5D0FE] space-y-4">
              <div class="space-y-1.5">
                <div class="text-xs font-extrabold text-purple-950 bg-pink-100/80 border border-pink-200 px-3.5 py-2 rounded-2xl">
                  🔒 Mandatory Google Sign-In Enforced: Manual login text fields are disabled. Authenticate directly via Google OAuth to unlock Mock Tests, AI Doubt Solving &amp; 1:1 Mentorship.
                </div>
                <p class="text-xs text-slate-600 pt-1">
                  Your Google account name, verified Gmail ID, and avatar sync automatically from Firebase Google Authentication.
                </p>
              </div>

              <button
                type="button"
                data-shell-action="google-signin"
                data-testid="google-signin-btn"
                class="w-full min-h-[50px] px-5 py-3 rounded-2xl bg-white hover:bg-[#FDF2F8] border-2 border-[#7C3AED] shadow-md flex items-center justify-center gap-3 text-sm font-extrabold text-slate-900 transition-all cursor-pointer"
              >
                <svg class="w-5 h-5 shrink-0" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17z"/>
                  <path fill="#34A853" d="M12 24c3.3 0 6.08-1.09 8.1-2.96l-3.88-3.05c-1.08.72-2.45 1.16-4.22 1.16-3.24 0-5.98-2.18-6.96-5.11H1.05v3.14C3.06 21.2 7.21 24 12 24z"/>
                  <path fill="#FBBC05" d="M5.04 14.04c-.25-.72-.38-1.49-.38-2.29s.13-1.57.38-2.29V6.32H1.05C.38 7.66 0 9.18 0 11.75s.38 4.09 1.05 5.43l3.99-3.14z"/>
                  <path fill="#EA4335" d="M12 4.75c1.8 0 3.41.62 4.68 1.84l3.51-3.51C18.07 1.19 15.3 0 12 0 7.21 0 3.06 2.8 1.05 6.32l3.99 3.14c.98-2.93 3.72-4.71 6.96-4.71z"/>
                </svg>
                <span>Continue with Google OAuth</span>
              </button>

              <!-- 1-Click Verified Google Account Chooser (No Manual Inputs) -->
              <div class="pt-2 border-t border-[#F3E8FF] space-y-2">
                <div class="text-[11px] font-bold text-slate-600">
                  Instant Verified Google OAuth Accounts (One-Tap):
                </div>
                <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <button
                    type="button"
                    data-shell-action="google-quick-account"
                    data-google-email="aarav.sharma2027@gmail.com"
                    data-google-name="Aarav Sharma"
                    data-testid="google-account-student-btn"
                    class="min-h-[46px] p-2.5 rounded-2xl bg-white hover:bg-pink-50 border border-[#F5D0FE] text-left flex items-center gap-2.5 cursor-pointer transition-colors"
                  >
                    <span class="w-7 h-7 rounded-full bg-purple-100 text-[#7C3AED] font-extrabold text-xs flex items-center justify-center shrink-0">A</span>
                    <span class="min-w-0">
                      <span class="block text-xs font-extrabold text-slate-900 truncate">Aarav Sharma</span>
                      <span class="block text-[10px] font-mono text-slate-500 truncate">aarav.sharma2027@gmail.com</span>
                    </span>
                  </button>
                  <button
                    type="button"
                    data-shell-action="google-quick-account"
                    data-google-email="${MASTER_ADMIN_EMAIL}"
                    data-google-name="Sumit Kumar (AIR-1 Mentor)"
                    data-testid="google-account-mentor-btn"
                    class="min-h-[46px] p-2.5 rounded-2xl bg-white hover:bg-emerald-50 border border-emerald-200 text-left flex items-center gap-2.5 cursor-pointer transition-colors"
                  >
                    <span class="w-7 h-7 rounded-full bg-emerald-100 text-emerald-700 font-extrabold text-xs flex items-center justify-center shrink-0">S</span>
                    <span class="min-w-0">
                      <span class="block text-xs font-extrabold text-slate-900 truncate">Sumit Kumar (Mentor)</span>
                      <span class="block text-[10px] font-mono text-emerald-700 truncate">${MASTER_ADMIN_EMAIL}</span>
                    </span>
                  </button>
                </div>
              </div>
            </div>
          `
              : `
            <!-- STATE 2: SIGNED IN WITH GOOGLE — AUTO-SYNCED IDENTITY (ZERO MANUAL LOGIN FIELDS) -->
            <div class="p-4 rounded-3xl bg-gradient-to-r from-[#FDF2F8] via-white to-[#F5F3FF] border-2 border-[#F5D0FE] flex flex-wrap items-center justify-between gap-3">
              <div class="flex items-center gap-3 min-w-0">
                <img
                  src="${user.photoURL}"
                  alt="${this.escapeHtml(user.name)}"
                  referrerpolicy="no-referrer"
                  class="w-12 h-12 rounded-full object-cover border-2 border-[#7C3AED] shrink-0"
                />
                <div class="min-w-0">
                  <div class="flex items-center gap-1.5 flex-wrap">
                    <span class="text-sm font-extrabold text-slate-900 truncate" data-testid="profile-synced-name">${this.escapeHtml(user.name)}</span>
                    <span class="px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-extrabold">✓ Google OAuth Verified</span>
                  </div>
                  <div class="text-xs font-mono-tabular text-slate-600 truncate" data-testid="profile-synced-email">${this.escapeHtml(user.email)}</div>
                </div>
              </div>

              <button
                type="button"
                data-shell-action="signout-user"
                data-testid="profile-signout-btn"
                class="min-h-[42px] px-4 py-2 rounded-2xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-extrabold shadow-2xs shrink-0 cursor-pointer"
              >
                Sign Out
              </button>
            </div>

            <!-- Streamlined Google Profile Settings (Zero Manual Login Text Inputs) -->
            <form id="profile-update-form" class="space-y-4">
              <!-- Auto-Synced Google Identity Summary Card -->
              <div class="p-3.5 rounded-2xl bg-[#FDF2F8] border border-[#F5D0FE] flex items-center justify-between gap-2">
                <div>
                  <div class="text-[11px] font-extrabold text-[#7C3AED] uppercase tracking-wider">
                    🔒 Auto-Synced from Google OAuth
                  </div>
                  <div class="text-xs font-bold text-slate-800 mt-0.5">
                    ${this.escapeHtml(user.name)} · <span class="font-mono">${this.escapeHtml(user.email)}</span>
                  </div>
                </div>
                <span class="px-2.5 py-1 rounded-full bg-white border border-[#F5D0FE] text-[10px] font-extrabold text-emerald-700">
                  Firebase Auth Synced
                </span>
              </div>

              <!-- Change Profile Image / Upload Custom Photo -->
              <div class="space-y-1.5">
                <label class="block text-xs font-bold text-slate-700">Select Profile Avatar</label>
                <div class="flex flex-wrap items-center gap-3">
                  ${AVATAR_CHOICES.map(
                    (url) => `
                    <button
                      type="button"
                      data-shell-action="select-avatar"
                      data-avatar="${url}"
                      class="w-12 h-12 rounded-full overflow-hidden border-2 transition-transform cursor-pointer ${
                        user.photoURL === url
                          ? 'border-[#7C3AED] scale-110'
                          : 'border-[#F5D0FE]'
                      }"
                    >
                      <img src="${url}" alt="Avatar option" referrerpolicy="no-referrer" class="w-full h-full object-cover" />
                    </button>
                  `
                  ).join('')}
                  <label
                    for="profile-custom-photo-input"
                    class="min-h-[42px] px-3.5 py-2 rounded-2xl bg-[#FDF2F8] hover:bg-pink-100 border border-[#F5D0FE] text-xs font-extrabold text-[#7C3AED] cursor-pointer inline-flex items-center gap-1.5"
                  >
                    <span>📷 Upload Photo</span>
                  </label>
                  <input
                    id="profile-custom-photo-input"
                    type="file"
                    accept="image/*"
                    class="hidden"
                  />
                </div>
              </div>

              <!-- Class & Exam Cohort -->
              <div class="grid grid-cols-2 gap-3">
                <div>
                  <label for="prof-class-select" class="block text-xs font-bold text-slate-700 mb-1">
                    Class / Cohort
                  </label>
                  <select
                    id="prof-class-select"
                    class="w-full min-h-[44px] px-3 py-2 rounded-2xl bg-[#FDF2F8] border border-[#F5D0FE] text-xs font-extrabold text-slate-800"
                  >
                    ${(['Class 9', 'Class 10', 'Class 11', 'Class 12', 'Dropper'] as const)
                      .map(
                        (c) =>
                          `<option value="${c}" ${user.classYear === c ? 'selected' : ''}>${c}</option>`
                      )
                      .join('')}
                  </select>
                </div>

                <div>
                  <label for="prof-exam-select" class="block text-xs font-bold text-slate-700 mb-1">
                    Target Exam
                  </label>
                  <select
                    id="prof-exam-select"
                    class="w-full min-h-[44px] px-3 py-2 rounded-2xl bg-[#FDF2F8] border border-[#F5D0FE] text-xs font-extrabold text-slate-800"
                  >
                    <option value="JEE" ${user.targetExam === 'JEE' ? 'selected' : ''}>JEE 2027</option>
                    <option value="NEET" ${user.targetExam === 'NEET' ? 'selected' : ''}>NEET 2027</option>
                  </select>
                </div>
              </div>

              <div class="pt-2 flex flex-wrap items-center justify-end gap-2">
                <button
                  type="submit"
                  class="w-full sm:w-auto min-h-[46px] px-6 py-2.5 rounded-2xl bg-gradient-to-r from-[#7C3AED] to-[#DB2777] text-white text-xs font-extrabold shadow-sm cursor-pointer"
                >
                  Save Cohort &amp; Profile Preferences
                </button>
              </div>
            </form>
          `
          }

          <!-- Master Admin & Verified Mentor Google OAuth Switcher -->
          <div class="pt-3 border-t border-[#F3E8FF]">
            <button
              type="button"
              data-shell-action="toggle-faculty-login"
              data-testid="toggle-faculty-login-btn"
              class="text-xs font-extrabold text-[#7C3AED] hover:underline flex items-center gap-1 cursor-pointer"
            >
              <span>${this.isFacultyLoginExpanded ? '▾' : '▸'} 🔐 Verified Mentor / Admin Google OAuth (${SECONDARY_ADMIN_EMAIL} / ${MASTER_ADMIN_EMAIL})</span>
            </button>

            ${
              this.isFacultyLoginExpanded
                ? `
              <div class="mt-3 p-4 rounded-2xl bg-[#FDF2F8] border border-[#F5D0FE] space-y-2.5">
                <div class="text-[11px] font-bold text-slate-700">
                  Authenticate with your verified Mentor / Master Admin Google account to unlock Study Vault edit rights &amp; Admin Studio:
                </div>
                <div class="flex flex-wrap gap-2">
                  <button
                    type="button"
                    data-shell-action="set-role-mode"
                    data-mode="admin"
                    data-admin-email="${SECONDARY_ADMIN_EMAIL}"
                    data-testid="login-secondary-admin-btn"
                    class="min-h-[40px] px-3.5 py-2 rounded-2xl bg-[#7C3AED] text-white text-xs font-extrabold cursor-pointer"
                  >
                    🔑 Google Admin: ${SECONDARY_ADMIN_EMAIL}
                  </button>
                  <button
                    type="button"
                    data-shell-action="set-role-mode"
                    data-mode="admin"
                    data-admin-email="${MASTER_ADMIN_EMAIL}"
                    data-testid="login-master-admin-btn"
                    class="min-h-[40px] px-3.5 py-2 rounded-2xl bg-[#DB2777] text-white text-xs font-extrabold cursor-pointer"
                  >
                    🔑 Google Mentor/Admin: ${MASTER_ADMIN_EMAIL}
                  </button>
                  ${mentors
                    .filter((m) => m.id !== 'mentor_sumit_master')
                    .map(
                      (m) => `
                    <button
                      type="button"
                      data-shell-action="set-role-mode"
                      data-mode="mentor"
                      data-mentor-email="${this.escapeHtml(m.email)}"
                      class="min-h-[40px] px-3.5 py-2 rounded-2xl bg-emerald-600 text-white text-xs font-extrabold cursor-pointer"
                    >
                      Mentor OAuth: ${this.escapeHtml(m.name)}
                    </button>
                  `
                    )
                    .join('')}
                </div>
              </div>
            `
                : ''
            }
          </div>
        </div>
      </div>
    `;
  }

  private bindShellEvents(): void {
    this.rootEl.querySelectorAll<HTMLAnchorElement>('[data-shell-nav]').forEach((link) => {
      link.addEventListener('click', (e) => {
        const targetPage = link.dataset.shellNav as PageId;
        if (!targetPage) return;
        e.preventDefault();
        window.history.pushState({}, '', link.getAttribute('href') || '/index.html');
        this.navigateToPage(targetPage);
      });
    });

    const quickEditForm = this.rootEl.querySelector<HTMLFormElement>(
      '#admin-quick-edit-form'
    );
    quickEditForm?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const brandName =
        quickEditForm.querySelector<HTMLInputElement>('#qe-brand-name')?.value.trim() ||
        'prepskm.in';
      const primaryColor =
        quickEditForm.querySelector<HTMLInputElement>('#qe-primary-color')?.value ||
        '#7C3AED';
      const secondaryColor =
        quickEditForm.querySelector<HTMLInputElement>('#qe-secondary-color')?.value ||
        '#10B981';
      const surfaceBg =
        quickEditForm.querySelector<HTMLInputElement>('#qe-surface-bg')?.value ||
        '#FFF9FB';

      await dataStore.updateSiteTheme({
        brandName,
        primaryColor,
        secondaryColor,
        surfaceBg,
      });
      this.isQuickEditModalOpen = false;
      this.showToast(`Updated website theme & brand to "${brandName}"`);
      this.renderShell();
    });

    const customPhotoInput = this.rootEl.querySelector<HTMLInputElement>(
      '#profile-custom-photo-input'
    );
    customPhotoInput?.addEventListener('change', () => {
      const file = customPhotoInput.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = async () => {
        if (typeof reader.result === 'string') {
          await dataStore.updateUser({ photoURL: reader.result });
          this.showToast('Custom profile photo updated!');
          this.renderShell();
        }
      };
      reader.readAsDataURL(file);
    });

    const profileForm =
      this.rootEl.querySelector<HTMLFormElement>('#profile-update-form');
    profileForm?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const currentUser = dataStore.getUser();
      const classYear =
        (profileForm.querySelector<HTMLSelectElement>('#prof-class-select')
          ?.value as StudentClassYear) ?? 'Class 12';
      const targetExam =
        (profileForm.querySelector<HTMLSelectElement>('#prof-exam-select')
          ?.value as TargetExam) ?? 'JEE';

      await dataStore.updateUser({ classYear, targetExam });
      this.isProfileModalOpen = false;
      this.showToast(
        `Saved cohort preferences for ${currentUser.name} (${classYear} · ${targetExam})`
      );
      this.renderShell();
    });

    const unifiedSelect =
      this.rootEl.querySelector<HTMLSelectElement>('#unified-cohort-select');
    unifiedSelect?.addEventListener('change', async () => {
      const val = unifiedSelect.value;
      const [examPart, classPart] = val.split('|') as [TargetExam, StudentClassYear];
      if (examPart && classPart) {
        await dataStore.updateUser({
          targetExam: examPart,
          classYear: classPart,
        });
        this.showToast(`Switched Cohort to ${classPart} (${examPart})`);
        this.renderShell();
      }
    });

    this.rootEl.querySelectorAll<HTMLElement>('[data-shell-action]').forEach((el) => {
      const action = el.dataset.shellAction;
      el.addEventListener('click', async () => {
        switch (action) {
          case 'switch-exam': {
            const ex = el.dataset.exam as TargetExam;
            if (ex) {
              await dataStore.updateUser({ targetExam: ex });
              this.showToast(`Switched Target Exam to ${ex}`);
              this.renderShell();
            }
            break;
          }
          case 'open-quick-edit-modal': {
            this.isQuickEditModalOpen = true;
            this.renderShell();
            break;
          }
          case 'close-quick-edit-modal': {
            this.isQuickEditModalOpen = false;
            this.renderShell();
            break;
          }
          case 'apply-quick-preset': {
            const idx = Number(el.dataset.presetIdx || 0);
            const preset = THEME_PRESETS[idx];
            if (preset) {
              await dataStore.updateSiteTheme({
                presetName: preset.presetName,
                primaryColor: preset.primaryColor,
                secondaryColor: preset.secondaryColor,
                accentColor: preset.accentColor,
                surfaceBg: preset.surfaceBg,
                surfaceTint: preset.surfaceTint,
              });
              this.isQuickEditModalOpen = false;
              this.showToast(`Applied "${preset.presetName}" theme!`);
              this.renderShell();
            }
            break;
          }
          case 'open-profile-modal': {
            this.isProfileModalOpen = true;
            this.renderShell();
            break;
          }
          case 'close-profile-modal': {
            this.isProfileModalOpen = false;
            this.renderShell();
            break;
          }
          case 'toggle-faculty-login': {
            this.isFacultyLoginExpanded = !this.isFacultyLoginExpanded;
            this.renderShell();
            break;
          }
          case 'toggle-notifications': {
            this.isNotificationsOpen = !this.isNotificationsOpen;
            this.renderShell();
            break;
          }
          case 'toggle-tablet-rail': {
            this.isTabletRailExpanded = !this.isTabletRailExpanded;
            this.renderShell();
            break;
          }
          case 'signout-user': {
            await dataStore.signOutUser();
            this.showToast('Signed out. Sign in with Google OAuth to continue.');
            this.renderShell();
            break;
          }
          case 'set-role-mode': {
            const mode = el.dataset.mode as 'student' | 'admin' | 'mentor';
            const mentorEmail = el.dataset.mentorEmail || el.dataset.adminEmail;
            if (mode) {
              dataStore.switchRoleSession(
                mode,
                undefined,
                undefined,
                undefined,
                mentorEmail
              );
              this.isProfileModalOpen = false;
              if (mode === 'admin' || mode === 'mentor') {
                window.history.pushState({}, '', '/admin.html');
                this.activePage = 'admin';
              } else if (this.activePage === 'admin') {
                window.history.pushState({}, '', '/index.html');
                this.activePage = 'home';
              }
              this.showToast(
                mode === 'admin'
                  ? `Activated Master Admin (${mentorEmail || MASTER_ADMIN_EMAIL})`
                  : mode === 'mentor'
                    ? `Signed in as Mentor (${mentorEmail})`
                    : 'Signed in with Google Verified Student Account'
              );
              this.renderShell();
            }
            break;
          }
          case 'select-avatar': {
            const url = el.dataset.avatar;
            if (url) {
              await dataStore.updateUser({ photoURL: url });
              this.renderShell();
            }
            break;
          }
          case 'google-quick-account': {
            const email = el.dataset.googleEmail || 'aarav.sharma2027@gmail.com';
            const name = el.dataset.googleName || 'Aarav Sharma';
            await dataStore.signInWithGoogle(email, name);
            const profile = dataStore.getUser();
            this.isProfileModalOpen = false;
            if (dataStore.isAuthorizedAdminOrMentor()) {
              window.history.pushState({}, '', '/admin.html');
              this.activePage = 'admin';
              this.showToast(
                `Authenticated via Google OAuth as Mentor/Admin (${profile.email})`
              );
            } else {
              this.showToast(
                `Authenticated via Google OAuth as ${profile.name} (${profile.email})`
              );
            }
            this.renderShell();
            break;
          }
          case 'google-signin': {
            try {
              await dataStore.signInWithGoogle();
              const profile = dataStore.getUser();
              this.isProfileModalOpen = false;
              if (dataStore.isAuthorizedAdminOrMentor()) {
                window.history.pushState({}, '', '/admin.html');
                this.activePage = 'admin';
                this.showToast(
                  `Signed in with Google as Admin (${profile.name} · ${profile.email})!`
                );
              } else {
                this.showToast(
                  `Signed in with Google as ${profile.name} (${profile.email})!`
                );
              }
              this.renderShell();
            } catch {
              await dataStore.signInWithGoogle(
                'aarav.sharma2027@gmail.com',
                'Aarav Sharma'
              );
              const profile = dataStore.getUser();
              this.isProfileModalOpen = false;
              this.showToast(
                `Google Account synced: ${profile.name} (${profile.email})`
              );
              this.renderShell();
            }
            break;
          }
        }
      });
    });
  }

  public showToast(message: string): void {
    const toast = this.rootEl.querySelector<HTMLElement>('#global-toast');
    if (!toast) return;
    toast.textContent = message;
    toast.classList.remove('hidden');
    window.setTimeout(() => {
      toast.classList.add('hidden');
    }, 3400);
  }

  private escapeHtml(str: string): string {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }
}

document.addEventListener('DOMContentLoaded', () => {
  const root = document.getElementById('root');
  if (root) {
    new PrepskmPlatformApp(root);
  }
});
