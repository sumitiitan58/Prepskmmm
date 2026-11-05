import {
  DEFAULT_BRAND_LOGO_SVG,
  getCohortTheme,
  MENTOR_AVATAR_PATH,
  XP_PER_COMPLETED_TASK,
} from './constants';
import { AdminCommandModule } from './modules/adminCommandView';
import { CBTTestEngineModule } from './modules/cbtTestEngineView';
import { HomePageModule } from './modules/homePageView';
import { LiveClassroomModule } from './modules/liveView';
import { MentorshipHubModule } from './modules/mentorshipHubView';
import { PlannerModule } from './modules/plannerView';
import { PlayerModule } from './modules/playerView';
import { StudyVaultModule } from './modules/studyVaultView';
import { TestHistoryModule } from './modules/testHistoryView';
import {
  compressImageDataUrl,
  dataStore,
  isMasterAdminEmail,
  MASTER_ADMIN_EMAIL,
} from './services/firebaseService';
import type { PageId, StudentClassYear, TargetExam } from './types';

const AVATAR_CHOICES = [
  MENTOR_AVATAR_PATH,
  'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=160&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=160&auto=format&fit=crop&q=80',
];

interface PrepAiChatMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  timestamp: string;
}

class PrepskmPlatformApp {
  private rootEl: HTMLElement;
  private activePage: PageId;
  private isProfileModalOpen = false;
  private authModalReasonMessage = '';
  private isNotificationsOpen = false;
  private isMobile3DotMenuOpen = false;
  private isTabletRailExpanded = false;

  // Floating Prep AI + Whiteboard Studio State
  private isPrepAiModalOpen = false;
  private prepAiActiveTab: 'ai' | 'whiteboard' = 'ai';
  private prepAiMessages: PrepAiChatMessage[] = [
    {
      id: 'welcome_ai',
      role: 'assistant',
      text: 'Hi! I am Prep AI (powered by Gemini). Ask me any JEE Main, JEE Advanced, NEET, or Class 9–12 concept, formula shortcut, or study strategy—or switch to the Whiteboard tab to sketch diagrams and export your notes as a PDF!',
      timestamp: 'Just now',
    },
  ];
  private isPrepAiLoading = false;
  private whiteboardNotesTitle = 'My Revision & Formula Notes';
  private whiteboardNotesText = '';
  private whiteboardPenColor = '#4F46E5';
  private whiteboardPenSize = 3;
  private whiteboardEraser = false;
  private whiteboardDataUrl = '';

  // Floating Admin Pencil Live Website Customizer State (Master Admin Only)
  private isPencilModalOpen = false;
  private isPencilPickMode = false;
  private selectedElementSelector = '.brand-title-target';
  private selectedElementText = '';
  private selectedElementColor = '#0F172A';
  private selectedElementBgColor = '';

  private homeModule: HomePageModule;
  private plannerModule: PlannerModule;
  private studyModule: StudyVaultModule;
  private mentorshipModule: MentorshipHubModule;
  private testModule: CBTTestEngineModule;
  private testHistoryModule: TestHistoryModule;
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

    this.plannerModule = new PlannerModule({
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

    this.testHistoryModule = new TestHistoryModule({
      onNavigatePage: (p) => this.navigateToPage(p),
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

    window.addEventListener('prepskm:open-auth-modal', (ev: Event) => {
      const customEv = ev as CustomEvent<{ reason?: string }>;
      this.authModalReasonMessage =
        customEv.detail?.reason ||
        'Please Sign Up or Log In with your Gmail to unlock Mock Tests and save your progress!';
      this.isProfileModalOpen = true;
      this.renderShell();
    });

    window.addEventListener('prepskm:user-updated', () => {
      this.renderShell();
    });

    this.renderShell();
    this.setupGlobalPencilClickCatcher();
  }

  private detectInitialPage(): PageId {
    const bodyPage = document.body.dataset.page;
    const path = window.location.pathname.toLowerCase();
    if (bodyPage === 'planner' || path.includes('planner.html')) return 'planner';
    if (bodyPage === 'test-history' || path.includes('test-history.html')) {
      return 'test-history';
    }
    if (bodyPage === 'player' || path.includes('player.html')) return 'player';
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

  private setupGlobalPencilClickCatcher(): void {
    document.addEventListener(
      'click',
      (e) => {
        if (!this.isPencilPickMode) return;
        const target = e.target as HTMLElement | null;
        if (!target) return;
        if (
          target.closest('#admin-pencil-editor-modal') ||
          target.closest('[data-testid="admin-floating-pencil-btn"]')
        ) {
          return;
        }
        e.preventDefault();
        e.stopPropagation();

        const selector = this.buildUniqueSelectorForElement(target);
        this.selectedElementSelector = selector;
        this.selectedElementText = (target.textContent || '').trim().slice(0, 120);
        this.isPencilPickMode = false;
        this.isPencilModalOpen = true;
        this.renderShell();
      },
      true
    );
  }

  private buildUniqueSelectorForElement(el: HTMLElement): string {
    if (el.id) return `#${el.id}`;
    if (el.dataset.testid) return `[data-testid="${el.dataset.testid}"]`;
    const tag = el.tagName.toLowerCase();
    const classes = Array.from(el.classList)
      .filter((c) => !c.includes(':') && !c.includes('[') && !c.includes('/'))
      .slice(0, 2);
    if (classes.length > 0) {
      return `${tag}.${classes.join('.')}`;
    }
    return tag;
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
    this.isMobile3DotMenuOpen = false;
    this.renderShell();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  public renderShell(): void {
    dataStore.applySiteThemeToDocument();
    const user = dataStore.getUser();
    const cohortTheme = getCohortTheme(user.targetExam, user.classYear);
    const isMasterAdmin = dataStore.isMasterAdmin();
    const siteTheme = dataStore.getSiteTheme();
    const streakNotifications = dataStore.getStreakNotifications();
    const logoSrc = siteTheme.logoDataUrl || DEFAULT_BRAND_LOGO_SVG;
    const brandName = siteTheme.brandName || 'prepskm.in';
    const xpPoints = user.xpPoints ?? 0;

    const path = window.location.pathname.toLowerCase();
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
        label: 'Home & Syllabus',
        shortLabel: 'Home',
        href: '/index.html',
        svgIcon: `<svg class="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M3 10.5L12 3l9 7.5V21a1 1 0 01-1 1h-5v-6H9v6H4a1 1 0 01-1-1V10.5z"/></svg>`,
        accentDot: 'bg-indigo-500',
      },
      {
        id: 'planner',
        label: 'To-Do & Planner',
        shortLabel: 'Planner',
        href: '/planner.html',
        svgIcon: `<svg class="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"/></svg>`,
        accentDot: 'bg-violet-500',
      },
      {
        id: 'study',
        label: 'Study Material Vault',
        shortLabel: 'Study Vault',
        href: '/study.html',
        svgIcon: `<svg class="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"/></svg>`,
        accentDot: 'bg-emerald-500',
      },
      {
        id: 'test',
        label: 'CBT & Mock Engine',
        shortLabel: 'CBT Test',
        href: '/test.html',
        svgIcon: `<svg class="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>`,
        accentDot: 'bg-amber-500',
      },
      {
        id: 'test-history',
        label: 'Test Analytics',
        shortLabel: 'History',
        href: '/test-history.html',
        svgIcon: `<svg class="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z"/></svg>`,
        accentDot: 'bg-cyan-500',
      },
      {
        id: 'mentorship',
        label: 'PW Batches & Mentorship',
        shortLabel: 'Batches',
        href: '/mentorship.html',
        svgIcon: `<svg class="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"/></svg>`,
        accentDot: 'bg-rose-500',
      },
    ];

    const mobileBottomTabs = [
      navItems[0], // Home
      navItems[1], // Planner
      navItems[2], // Study
      navItems[3], // CBT Test
      navItems[5], // PW Batches & Mentorship
    ];

    const cohortOptions = [
      { value: 'JEE|Class 12', label: 'JEE · Class 12' },
      { value: 'JEE|Class 11', label: 'JEE · Class 11' },
      { value: 'JEE|Dropper', label: 'JEE · Dropper' },
      { value: 'NEET|Class 12', label: 'NEET · Class 12' },
      { value: 'NEET|Class 11', label: 'NEET · Class 11' },
      { value: 'NEET|Dropper', label: 'NEET · Dropper' },
      { value: 'JEE|Class 11 Foundation', label: 'Class 11 Foundation' },
      { value: 'JEE|Class 10 Foundation', label: 'Class 10 Foundation' },
      { value: 'JEE|Class 10', label: 'Class 10 · Board+NTSE' },
      { value: 'JEE|Class 9', label: 'Class 9 · Foundation' },
    ];

    const currentCohortKey =
      user.classYear === 'Class 10 Foundation'
        ? 'JEE|Class 10 Foundation'
        : user.classYear === 'Class 11 Foundation'
          ? 'JEE|Class 11 Foundation'
          : user.classYear === 'Class 10'
            ? 'JEE|Class 10'
            : user.classYear === 'Class 9'
              ? 'JEE|Class 9'
              : `${user.targetExam}|${user.classYear}`;

    this.rootEl.innerHTML = `
      <div
        class="min-h-screen flex flex-col lg:flex-row text-slate-900 transition-colors"
        style="background-color: ${this.escapeHtml(siteTheme.surfaceBg || cohortTheme.surfaceTint || '#F8FAFC')}"
        data-cohort-class="${this.escapeHtml(user.classYear)}"
      >
        ${
          this.isPencilPickMode && isMasterAdmin
            ? `
          <div class="fixed top-0 inset-x-0 z-50 bg-amber-500 text-slate-950 px-4 py-2 text-xs font-extrabold flex items-center justify-between shadow-lg">
            <span>✏️ LIVE ELEMENT PICKER ACTIVE: Click any heading, button, or card on the page to edit its text or colors!</span>
            <button
              type="button"
              data-shell-action="cancel-pencil-pick"
              class="px-3 py-1 rounded-lg bg-slate-900 text-white text-[11px] font-bold"
            >
              Cancel Picker ✕
            </button>
          </div>
        `
            : ''
        }

        <!-- 1. DESKTOP PERSISTENT LEFT SIDEBAR (> 1024px) -->
        <aside
          aria-label="Desktop Primary Sidebar"
          class="hidden lg:flex lg:flex-col lg:w-64 lg:fixed lg:inset-y-0 bg-white border-r border-[#E2E8F0] z-30 justify-between p-5 shadow-2xs"
        >
          <div class="space-y-5">
            <!-- Brand Logo & Target Badge -->
            <div class="flex items-center justify-between">
              <a href="/index.html" class="flex items-center gap-3 group">
                <img
                  src="${logoSrc}"
                  alt="${this.escapeHtml(brandName)} Logo"
                  class="w-10 h-10 rounded-xl object-contain shadow-sm shrink-0 group-hover:scale-105 transition-transform"
                />
                <div>
                  <div class="brand-title-target text-base font-extrabold tracking-tight text-slate-900 leading-none">
                    ${this.escapeHtml(brandName)}
                  </div>
                  <div class="text-[11px] font-bold mt-1" style="color: ${cohortTheme.accentHex || siteTheme.primaryColor}">
                    ${user.targetExam} 2027 · ${user.classYear}
                  </div>
                </div>
              </a>
            </div>

            <!-- Unique Per-Class Theme Status Card -->
            <div class="p-3 rounded-xl bg-gradient-to-r ${cohortTheme.gradientClass} text-white shadow-xs">
              <div class="text-[10px] font-extrabold uppercase tracking-wider text-white/80">
                ${this.escapeHtml(cohortTheme.badgeText)}
              </div>
              <div class="text-xs font-extrabold mt-0.5">
                ${this.escapeHtml(cohortTheme.label)}
              </div>
            </div>

            <!-- Primary Navigation Links -->
            <nav aria-label="Desktop Navigation" class="space-y-1">
              ${navItems
                .map((item) => {
                  const active = this.activePage === item.id;
                  return `
                  <a
                    href="${item.href}"
                    data-shell-nav="${item.id}"
                    class="min-h-[42px] px-3.5 py-2 rounded-xl flex items-center justify-between text-xs font-bold transition-all ${
                      active
                        ? 'bg-[#4F46E5] text-white shadow-sm'
                        : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                    }"
                  >
                    <span class="flex items-center gap-3">
                      ${item.svgIcon}
                      <span>${item.label}</span>
                    </span>
                    <span class="w-2 h-2 rounded-full ${active ? 'bg-white' : item.accentDot}"></span>
                  </a>
                `;
                })
                .join('')}

              <button
                type="button"
                data-shell-action="open-prep-ai-modal"
                class="w-full min-h-[42px] px-3.5 py-2 rounded-xl flex items-center justify-between text-xs font-bold bg-gradient-to-r from-indigo-50 to-violet-50 text-[#4F46E5] hover:from-indigo-100 hover:to-violet-100 border border-indigo-200 transition-all cursor-pointer"
              >
                <span class="flex items-center gap-3">
                  <span>✨</span>
                  <span>Prep AI & Whiteboard</span>
                </span>
                <span class="px-1.5 py-0.5 rounded text-[9px] font-extrabold bg-[#4F46E5] text-white">AI+PDF</span>
              </button>

              ${
                isMasterAdmin
                  ? `
                <a
                  href="/admin.html"
                  data-shell-nav="admin"
                  data-testid="sidebar-admin-studio-link"
                  class="min-h-[42px] px-3.5 py-2 rounded-xl flex items-center justify-between text-xs font-bold transition-all ${
                    this.activePage === 'admin'
                      ? 'bg-slate-900 text-white shadow-sm'
                      : 'bg-emerald-50 text-emerald-800 border border-emerald-200 hover:bg-emerald-100'
                  }"
                >
                  <span class="flex items-center gap-3">
                    <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/></svg>
                    <span>Owner Admin Panel</span>
                  </span>
                  <span class="px-1.5 py-0.5 rounded text-[10px] bg-[#10B981] text-white">
                    ADMIN
                  </span>
                </a>
              `
                  : ''
              }
            </nav>
          </div>

          <!-- Quick Stats & User Card at Bottom of Desktop Sidebar -->
          <div class="space-y-3 pt-4 border-t border-slate-100">
            <div class="p-3 rounded-xl bg-gradient-to-br from-indigo-50/70 via-white to-emerald-50/60 border border-[#E2E8F0] space-y-1.5">
              <div class="flex items-center justify-between text-xs">
                <span class="font-semibold text-slate-600">Active Streak</span>
                <span class="font-mono-tabular font-bold text-amber-600">🔥 ${user.currentStreak} Days</span>
              </div>
              <div class="flex items-center justify-between text-xs">
                <span class="font-semibold text-slate-600">XP / HP Earned</span>
                <span class="font-mono-tabular font-bold text-[#4F46E5]">⚡ ${xpPoints} XP</span>
              </div>
              <div class="flex items-center justify-between text-[11px]">
                <span class="font-medium text-slate-500">Task Reward</span>
                <span class="font-bold text-[#10B981]">+${XP_PER_COMPLETED_TASK} XP / task</span>
              </div>
            </div>

            <button
              type="button"
              data-shell-action="open-profile-modal"
              data-testid="sidebar-profile-btn"
              class="w-full p-2.5 rounded-xl bg-white hover:bg-slate-50 border border-[#E2E8F0] flex items-center gap-2.5 text-left transition-colors cursor-pointer"
            >
              <img
                src="${user.photoURL}"
                alt="${this.escapeHtml(user.name)}"
                referrerpolicy="no-referrer"
                class="w-9 h-9 rounded-full object-cover border border-[#E2E8F0] shrink-0"
              />
              <div class="min-w-0 flex-1">
                <div class="text-xs font-bold text-slate-900 truncate">
                  ${user.isGuest ? 'Sign Up / Log In' : this.escapeHtml(user.name)}
                </div>
                <div class="text-[10px] font-mono-tabular text-slate-500 truncate">
                  ${user.isGuest ? 'Click to create profile' : this.escapeHtml(user.email)}
                </div>
              </div>
            </button>
          </div>
        </aside>

        <!-- 2. TABLET SLIM VERTICAL ICON RAIL (768px – 1024px) -->
        <aside
          aria-label="Tablet Navigation Rail"
          class="hidden md:flex lg:hidden flex-col fixed inset-y-0 left-0 ${
            this.isTabletRailExpanded ? 'w-56' : 'w-20'
          } bg-white border-r border-[#E2E8F0] z-30 justify-between p-3 transition-all shadow-2xs"
        >
          <div class="space-y-4">
            <button
              type="button"
              data-shell-action="toggle-tablet-rail"
              class="w-full min-h-[44px] rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] text-slate-900 font-extrabold text-sm flex items-center justify-center gap-2 p-1.5"
              title="Expand or Collapse Navigation Rail"
            >
              <img src="${logoSrc}" alt="Logo" class="w-8 h-8 rounded-lg object-contain" />
              ${this.isTabletRailExpanded ? `<span class="text-xs font-extrabold">${this.escapeHtml(brandName)}</span>` : ''}
            </button>

            <nav class="space-y-1.5">
              ${navItems
                .map((item) => {
                  const active = this.activePage === item.id;
                  return `
                  <a
                    href="${item.href}"
                    data-shell-nav="${item.id}"
                    title="${item.label}"
                    class="min-h-[42px] px-3 py-2 rounded-xl flex items-center ${
                      this.isTabletRailExpanded ? 'justify-start gap-3' : 'justify-center'
                    } text-xs font-bold ${
                      active
                        ? 'bg-[#4F46E5] text-white shadow-sm'
                        : 'text-slate-600 hover:bg-slate-100'
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
                title="Profile & Settings"
                class="w-full min-h-[42px] px-3 py-2 rounded-xl flex items-center ${
                  this.isTabletRailExpanded ? 'justify-start gap-3' : 'justify-center'
                } text-xs font-bold text-slate-600 hover:bg-slate-100"
              >
                <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/></svg>
                ${this.isTabletRailExpanded ? `<span>Profile</span>` : ''}
              </button>
            </nav>
          </div>
        </aside>

        <!-- MAIN CONTENT WRAPPER -->
        <div class="flex-1 flex flex-col md:pl-20 lg:pl-64 pb-20 md:pb-8">
          <!-- Top App Header Bar with Streak & XP Badges -->
          <header class="sticky top-0 z-20 bg-white/95 backdrop-blur-md border-b border-[#E2E8F0] px-3 sm:px-6 lg:px-8 py-2">
            <div class="flex items-center justify-between gap-2 min-h-[44px]">
              <!-- Left: Mobile Logo + Desktop/Tablet Unified Cohort Selector -->
              <div class="flex items-center gap-2 sm:gap-3 min-w-0">
                <a href="/index.html" class="lg:hidden flex items-center gap-2 shrink-0">
                  <img
                    src="${logoSrc}"
                    alt="${this.escapeHtml(brandName)}"
                    class="w-7 h-7 rounded-lg object-contain shadow-2xs"
                  />
                  <span class="brand-title-target font-extrabold text-sm text-slate-900">${this.escapeHtml(brandName)}</span>
                </a>

                <div class="hidden md:flex items-center gap-1.5 bg-gradient-to-r from-indigo-50/90 via-white to-emerald-50/90 border border-indigo-200 hover:border-[#4F46E5] rounded-xl px-2.5 py-1 shadow-2xs transition-colors">
                  <span class="text-[10px] font-extrabold uppercase tracking-wider text-[#4F46E5]">Cohort:</span>
                  <select
                    id="unified-cohort-select"
                    aria-label="Select Class and Exam Track"
                    class="bg-transparent text-xs font-extrabold text-slate-900 focus:outline-none cursor-pointer pr-1"
                  >
                    ${cohortOptions
                      .map(
                        (opt) =>
                          `<option value="${opt.value}" ${currentCohortKey === opt.value ? 'selected' : ''}>${opt.label}</option>`
                      )
                      .join('')}
                  </select>
                </div>
              </div>

              <!-- Right: Top Streak + XP Badges + Notification Bell + Profile / Sign-Up CTA -->
              <div class="flex items-center gap-1.5 sm:gap-2 shrink-0 relative">
                <!-- Streak & XP / HP Counter Pills in Header -->
                <div
                  data-testid="header-streak-xp-bar"
                  class="flex items-center gap-1 sm:gap-1.5 px-2 sm:px-2.5 py-1 rounded-xl bg-gradient-to-r from-amber-50 via-white to-indigo-50 border border-amber-200/80 shadow-2xs"
                >
                  <span
                    data-testid="header-streak-badge"
                    class="text-[11px] font-mono-tabular font-extrabold text-amber-700 flex items-center gap-0.5"
                    title="Active Daily Study Streak"
                  >
                    🔥 ${user.currentStreak}d
                  </span>
                  <span class="text-slate-300">|</span>
                  <span
                    data-testid="header-xp-badge"
                    class="text-[11px] font-mono-tabular font-extrabold text-[#4F46E5] flex items-center gap-0.5"
                    title="Total XP (+75 XP per completed To-Do task)"
                  >
                    ⚡ ${xpPoints} XP
                  </span>
                </div>

                ${
                  isMasterAdmin
                    ? `
                  <a
                    href="/admin.html"
                    data-shell-nav="admin"
                    data-testid="header-admin-studio-btn"
                    class="hidden sm:inline-flex min-h-[34px] px-2.5 py-1 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-[11px] font-extrabold items-center gap-1 cursor-pointer"
                  >
                    <span>🛡️</span>
                    <span>Admin Panel</span>
                  </a>
                  <button
                    type="button"
                    data-shell-action="open-pencil-modal"
                    data-testid="header-pencil-edit-btn"
                    title="Edit Website Text, Colors & Theme (Master Admin Only)"
                    class="hidden md:flex min-h-[34px] px-2.5 py-1 rounded-xl bg-amber-50 hover:bg-amber-100 border border-amber-200 text-amber-900 text-[11px] font-extrabold items-center gap-1 cursor-pointer"
                  >
                    <span>✏️</span>
                    <span>Edit UI</span>
                  </button>
                `
                    : ''
                }

                <!-- Notifications Bell -->
                <div class="relative">
                  <button
                    type="button"
                    data-shell-action="toggle-notifications"
                    data-testid="header-notification-bell-btn"
                    aria-label="Notifications"
                    class="min-h-[36px] min-w-[36px] rounded-xl bg-[#F8FAFC] hover:bg-slate-100 border border-[#E2E8F0] flex items-center justify-center text-slate-700 relative cursor-pointer"
                  >
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"/></svg>
                    ${
                      streakNotifications.length > 0
                        ? `<span class="w-2 h-2 rounded-full bg-[#EF4444] absolute top-1.5 right-1.5"></span>`
                        : ''
                    }
                  </button>

                  ${
                    this.isNotificationsOpen
                      ? `
                    <div class="absolute right-0 mt-2 w-72 bg-white border border-[#E2E8F0] rounded-2xl shadow-xl p-4 space-y-2.5 z-50">
                      <div class="flex items-center justify-between">
                        <span class="text-xs font-bold text-slate-900">Study Reminders & Alerts</span>
                        <span class="text-[10px] font-mono-tabular px-2 py-0.5 rounded bg-indigo-50 text-[#4F46E5] font-bold">${streakNotifications.length}</span>
                      </div>
                      ${
                        streakNotifications.length === 0
                          ? `<p class="text-xs text-slate-500 py-2">No new alerts right now. Complete a To-Do task today to earn +${XP_PER_COMPLETED_TASK} XP!</p>`
                          : streakNotifications
                              .slice(0, 3)
                              .map(
                                (sn) => `
                            <div class="p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-950 space-y-0.5">
                              <div class="font-extrabold">🔥 ${this.escapeHtml(sn.title)}</div>
                              <p class="text-[11px] leading-snug">${this.escapeHtml(sn.message)}</p>
                            </div>
                          `
                              )
                              .join('')
                      }
                    </div>
                  `
                      : ''
                  }
                </div>

                <!-- Desktop/Tablet Profile OR Sign-Up Button -->
                <button
                  type="button"
                  data-shell-action="open-profile-modal"
                  data-testid="open-profile-modal-btn"
                  class="hidden md:flex min-h-[36px] pl-1.5 pr-3 py-1 rounded-xl ${
                    user.isGuest
                      ? 'bg-gradient-to-r from-[#4F46E5] to-violet-600 text-white'
                      : 'bg-[#4F46E5] hover:bg-indigo-700 text-white'
                  } text-xs font-bold items-center gap-1.5 shadow-2xs cursor-pointer"
                >
                  <img
                    src="${user.photoURL}"
                    alt="${this.escapeHtml(user.name)}"
                    referrerpolicy="no-referrer"
                    class="w-5 h-5 rounded-full object-cover border border-white/50"
                  />
                  <span>${user.isGuest ? 'Sign Up / Log In' : this.escapeHtml(user.name)}</span>
                </button>

                <!-- MOBILE 3-DOT MENU BUTTON (⋮) -->
                <div class="md:hidden relative">
                  <button
                    type="button"
                    data-shell-action="toggle-mobile-3dot-menu"
                    data-testid="mobile-3dot-menu-btn"
                    aria-label="Open Mobile Menu"
                    class="min-h-[36px] min-w-[36px] rounded-xl bg-slate-900 text-white flex items-center justify-center font-extrabold text-base shadow-2xs cursor-pointer"
                  >
                    ⋮
                  </button>

                  ${
                    this.isMobile3DotMenuOpen
                      ? `
                    <div
                      data-testid="mobile-3dot-drawer"
                      class="absolute right-0 mt-2 w-72 bg-white border border-[#E2E8F0] rounded-2xl shadow-2xl p-4 space-y-3 z-50"
                    >
                      <div class="flex items-center justify-between gap-2 pb-2.5 border-b border-slate-100">
                        <div class="flex items-center gap-2.5 min-w-0">
                          <img
                            src="${user.photoURL}"
                            alt="${this.escapeHtml(user.name)}"
                            referrerpolicy="no-referrer"
                            class="w-9 h-9 rounded-full object-cover border border-[#E2E8F0] shrink-0"
                          />
                          <div class="min-w-0">
                            <div class="text-xs font-extrabold text-slate-900 truncate">
                              ${user.isGuest ? 'Guest Student' : this.escapeHtml(user.name)}
                            </div>
                            <div class="text-[10px] font-mono-tabular text-[#4F46E5] font-bold">
                              🔥 ${user.currentStreak}d Streak · ⚡ ${xpPoints} XP
                            </div>
                          </div>
                        </div>
                        <button
                          type="button"
                          data-shell-action="open-profile-modal"
                          class="px-2.5 py-1.5 rounded-xl bg-[#4F46E5] text-white text-[11px] font-extrabold shrink-0 cursor-pointer"
                        >
                          ${user.isGuest ? 'Sign Up' : 'Profile'}
                        </button>
                      </div>

                      <div class="space-y-1">
                        <label class="block text-[10px] font-extrabold uppercase tracking-wider text-slate-500">
                          Class / Foundation Cohort
                        </label>
                        <select
                          id="mobile-cohort-select"
                          aria-label="Mobile Select Class and Exam Track"
                          class="w-full min-h-[36px] px-2.5 py-1.5 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] text-xs font-extrabold text-slate-900"
                        >
                          ${cohortOptions
                            .map(
                              (opt) =>
                                `<option value="${opt.value}" ${currentCohortKey === opt.value ? 'selected' : ''}>${opt.label}</option>`
                            )
                            .join('')}
                        </select>
                      </div>

                      <div class="space-y-1 pt-1">
                        <button
                          type="button"
                          data-shell-action="open-prep-ai-modal"
                          class="w-full px-3 py-2 rounded-xl bg-indigo-50 text-xs font-extrabold text-[#4F46E5] flex items-center justify-between cursor-pointer"
                        >
                          <span>✨ Prep AI & Whiteboard</span>
                          <span>Open →</span>
                        </button>
                        <a
                          href="/planner.html"
                          data-shell-nav="planner"
                          class="w-full px-3 py-2 rounded-xl bg-slate-50 hover:bg-indigo-50 text-xs font-bold text-slate-800 flex items-center justify-between"
                        >
                          <span>⚡ To-Do & Study Planner</span>
                          <span class="text-[10px] text-[#4F46E5]">Open →</span>
                        </a>
                        <a
                          href="/test-history.html"
                          data-shell-nav="test-history"
                          class="w-full px-3 py-2 rounded-xl bg-slate-50 hover:bg-indigo-50 text-xs font-bold text-slate-800 flex items-center justify-between"
                        >
                          <span>📊 Test History & Solutions</span>
                          <span class="text-[10px] text-[#4F46E5]">Open →</span>
                        </a>
                        ${
                          isMasterAdmin
                            ? `
                          <a
                            href="/admin.html"
                            data-shell-nav="admin"
                            class="w-full px-3 py-2 rounded-xl bg-slate-900 text-white text-xs font-extrabold flex items-center justify-between"
                          >
                            <span>🛡️ Owner Admin Panel</span>
                            <span>Open</span>
                          </a>
                        `
                            : ''
                        }
                      </div>
                    </div>
                  `
                      : ''
                  }
                </div>
              </div>
            </div>
          </header>

          <!-- Page Viewport Container -->
          <main id="page-viewport" class="flex-1 max-w-7xl w-full mx-auto px-3 sm:px-6 lg:px-8 py-3 sm:py-5"></main>
        </div>

        <!-- 3. MOBILE SLEEK LIGHTWEIGHT BOTTOM BAR (< 768px) -->
        <nav
          aria-label="Mobile Bottom Navigation Bar"
          class="md:hidden fixed bottom-0 inset-x-0 z-40 bg-white/95 backdrop-blur-md border-t border-[#E2E8F0] px-1.5 py-1 grid grid-cols-5 gap-1 shadow-lg"
        >
          ${mobileBottomTabs
            .map((item) => {
              const active = this.activePage === item.id;
              return `
              <a
                href="${item.href}"
                data-shell-nav="${item.id}"
                class="min-h-[42px] rounded-xl flex flex-col items-center justify-center gap-0.5 text-[10px] font-bold transition-all ${
                  active
                    ? 'text-white bg-[#4F46E5] shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }"
              >
                ${item.svgIcon}
                <span>${item.shortLabel}</span>
              </a>
            `;
            })
            .join('')}
        </nav>

        <!-- FLOATING PREP AI & INTERACTIVE WHITEBOARD STUDIO BUTTON (Visible to All Students) -->
        <button
          type="button"
          data-shell-action="open-prep-ai-modal"
          data-testid="floating-prep-ai-btn"
          title="Open Floating Prep AI (Gemini) & Interactive Whiteboard (Export Notes as PDF)"
          class="fixed bottom-16 md:bottom-6 right-4 z-40 px-4 py-2.5 rounded-2xl bg-gradient-to-r from-[#4F46E5] via-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 text-white shadow-xl border-2 border-white flex items-center gap-2 text-xs font-extrabold cursor-pointer transition-transform hover:scale-105"
        >
          <span class="text-base">✨</span>
          <span>Prep AI & Whiteboard</span>
        </button>

        ${
          isMasterAdmin
            ? `
          <!-- FLOATING ADMIN PENCIL QUICK-EDIT BUTTON (STRICTLY ONLY FOR sumit586kumar@gmail.com) -->
          <button
            type="button"
            data-shell-action="open-pencil-modal"
            data-testid="admin-floating-pencil-btn"
            title="Admin Pencil Editor: Edit any website text, color, or theme live"
            class="fixed bottom-16 md:bottom-6 left-4 z-40 w-11 h-11 rounded-2xl bg-slate-900 hover:bg-[#4F46E5] text-white shadow-xl border-2 border-white flex items-center justify-center text-base cursor-pointer transition-transform hover:scale-105"
          >
            ✏️
          </button>
        `
            : ''
        }

        <!-- Student Sign-Up / Profile Modal -->
        ${this.renderProfileAndAuthModal()}

        <!-- Floating Prep AI (Gemini) + Whiteboard PDF Studio Modal -->
        ${this.renderPrepAiAndWhiteboardModal()}

        <!-- Floating Admin Pencil Live Customizer Modal (Master Admin Only) -->
        ${isMasterAdmin ? this.renderAdminPencilModal() : ''}

        <!-- Global Toast Notification -->
        <div
          id="global-toast"
          role="status"
          aria-live="polite"
          class="fixed bottom-28 md:bottom-20 right-4 z-50 hidden px-4 py-3 rounded-xl bg-slate-900 text-white text-xs font-semibold shadow-xl border border-slate-700"
        ></div>
      </div>
    `;

    const viewport = this.rootEl.querySelector<HTMLElement>('#page-viewport');
    if (viewport) {
      if (this.activePage === 'player') {
        this.playerModule.mount(viewport);
      } else if (isLegacyLive) {
        this.liveModule.mount(viewport);
      } else if (this.activePage === 'planner') {
        this.plannerModule.mount(viewport);
      } else if (this.activePage === 'test-history') {
        this.testHistoryModule.mount(viewport);
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

    dataStore.applySiteThemeToDocument();
    this.bindShellEvents();
    if (this.isPrepAiModalOpen && this.prepAiActiveTab === 'whiteboard') {
      this.initWhiteboardCanvas();
    }
  }

  private renderPrepAiAndWhiteboardModal(): string {
    if (!this.isPrepAiModalOpen) return '';
    const user = dataStore.getUser();

    return `
      <div
        id="prep-ai-whiteboard-modal"
        data-testid="prep-ai-whiteboard-modal"
        role="dialog"
        aria-modal="true"
        aria-label="Floating Prep AI and Whiteboard Studio"
        class="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4"
      >
        <div class="bg-white border border-[#E2E8F0] rounded-2xl max-w-3xl w-full p-4 sm:p-6 shadow-2xl space-y-4 max-h-[92vh] flex flex-col overflow-hidden">
          <!-- Header & 2-Tab Switcher -->
          <div class="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-100 shrink-0">
            <div class="flex items-center gap-2.5">
              <div class="w-9 h-9 rounded-xl bg-gradient-to-br from-[#4F46E5] to-violet-600 text-white flex items-center justify-center font-extrabold text-base shadow-sm">
                ✨
              </div>
              <div>
                <h2 class="text-sm sm:text-base font-extrabold text-slate-900">
                  Prep AI Doubt Solver & Smart Whiteboard
                </h2>
                <p class="text-[11px] text-slate-500">
                  Ask Gemini AI any JEE/NEET concept or sketch notes & export directly to PDF
                </p>
              </div>
            </div>

            <div class="flex items-center gap-2">
              <div class="inline-flex p-1 rounded-xl bg-slate-100 border border-slate-200">
                <button
                  type="button"
                  data-shell-action="switch-prep-ai-tab"
                  data-tab="ai"
                  data-testid="tab-prep-ai-btn"
                  class="px-3 py-1.5 rounded-lg text-xs font-extrabold transition-all cursor-pointer ${
                    this.prepAiActiveTab === 'ai'
                      ? 'bg-[#4F46E5] text-white shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }"
                >
                  🤖 Prep AI
                </button>
                <button
                  type="button"
                  data-shell-action="switch-prep-ai-tab"
                  data-tab="whiteboard"
                  data-testid="tab-whiteboard-btn"
                  class="px-3 py-1.5 rounded-lg text-xs font-extrabold transition-all cursor-pointer ${
                    this.prepAiActiveTab === 'whiteboard'
                      ? 'bg-[#4F46E5] text-white shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }"
                >
                  🎨 Whiteboard & PDF
                </button>
              </div>
              <button
                type="button"
                data-shell-action="close-prep-ai-modal"
                class="min-h-[34px] px-3 py-1 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>
          </div>

          ${
            this.prepAiActiveTab === 'ai'
              ? `
            <!-- TAB 1: PREP AI (GEMINI) -->
            <div class="flex-1 flex flex-col min-h-0 space-y-3 overflow-hidden">
              <!-- Quick Prompt Chips -->
              <div class="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1 shrink-0">
                ${[
                  'Explain Rotational Rolling Motion & IAOR shortcuts',
                  'Important Organic Chemistry Named Reactions for JEE/NEET',
                  'How to increase Mock Test score from 120 to 200+?',
                  'Electrostatics Gauss Law & Capacitor formula summary',
                ]
                  .map(
                    (chip) => `
                  <button
                    type="button"
                    data-shell-action="prep-ai-quick-prompt"
                    data-prompt="${this.escapeHtml(chip)}"
                    class="px-2.5 py-1 rounded-full bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 text-[#4F46E5] text-[11px] font-bold whitespace-nowrap cursor-pointer shrink-0"
                  >
                    ✦ ${this.escapeHtml(chip)}
                  </button>
                `
                  )
                  .join('')}
              </div>

              <!-- Chat History Scroll Box -->
              <div
                id="prep-ai-chat-scroll"
                data-testid="prep-ai-chat-messages"
                class="flex-1 overflow-y-auto p-3.5 rounded-2xl bg-[#F8FAFC] border border-[#E2E8F0] space-y-3 min-h-[260px] max-h-[360px]"
              >
                ${this.prepAiMessages
                  .map(
                    (msg) => `
                  <div class="flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}">
                    <div class="max-w-[85%] rounded-2xl px-3.5 py-2.5 text-xs leading-relaxed ${
                      msg.role === 'user'
                        ? 'bg-[#4F46E5] text-white font-semibold'
                        : 'bg-white border border-[#E2E8F0] text-slate-800 shadow-2xs whitespace-pre-line'
                    }">
                      <div class="flex items-center justify-between gap-3 mb-1 text-[10px] ${
                        msg.role === 'user' ? 'text-indigo-100' : 'text-[#4F46E5] font-extrabold'
                      }">
                        <span>${msg.role === 'user' ? this.escapeHtml(user.name) : '✨ Prep AI · Gemini'}</span>
                        <span>${this.escapeHtml(msg.timestamp)}</span>
                      </div>
                      <div>${this.escapeHtml(msg.text)}</div>
                    </div>
                  </div>
                `
                  )
                  .join('')}
                ${
                  this.isPrepAiLoading
                    ? `
                  <div class="flex justify-start">
                    <div class="rounded-2xl px-4 py-2.5 bg-white border border-indigo-200 text-xs font-bold text-[#4F46E5] animate-pulse">
                      ✨ Prep AI is solving your doubt...
                    </div>
                  </div>
                `
                    : ''
                }
              </div>

              <!-- Prompt Input Form -->
              <form id="prep-ai-form" class="flex items-center gap-2 shrink-0">
                <input
                  id="prep-ai-input"
                  data-testid="prep-ai-input"
                  type="text"
                  required
                  placeholder="Ask any Physics, Chemistry, Math, or Biology doubt..."
                  class="flex-1 min-h-[42px] px-3.5 py-2 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] text-xs sm:text-sm text-slate-900 focus:outline-none focus:border-[#4F46E5]"
                />
                <button
                  type="submit"
                  data-testid="prep-ai-send-btn"
                  ${this.isPrepAiLoading ? 'disabled' : ''}
                  class="min-h-[42px] px-5 py-2 rounded-xl bg-[#4F46E5] hover:bg-indigo-700 disabled:opacity-50 text-white text-xs font-extrabold shadow-sm cursor-pointer shrink-0"
                >
                  ${this.isPrepAiLoading ? 'Thinking...' : 'Ask Prep AI →'}
                </button>
              </form>
            </div>
          `
              : `
            <!-- TAB 2: INTERACTIVE WHITEBOARD & EXPORT NOTES AS PDF -->
            <div class="flex-1 flex flex-col min-h-0 space-y-3 overflow-y-auto">
              <!-- Whiteboard Toolbar -->
              <div class="flex flex-wrap items-center justify-between gap-2 p-2.5 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0]">
                <div class="flex items-center gap-1.5">
                  <span class="text-[11px] font-bold text-slate-600 mr-1">Pen:</span>
                  ${[
                    { color: '#4F46E5', label: 'Indigo' },
                    { color: '#0F172A', label: 'Black' },
                    { color: '#EF4444', label: 'Red' },
                    { color: '#10B981', label: 'Green' },
                    { color: '#F59E0B', label: 'Amber' },
                  ]
                    .map(
                      (sw) => `
                    <button
                      type="button"
                      data-shell-action="set-wb-color"
                      data-color="${sw.color}"
                      title="${sw.label}"
                      class="w-6 h-6 rounded-full border-2 cursor-pointer ${
                        !this.whiteboardEraser && this.whiteboardPenColor === sw.color
                          ? 'border-slate-900 scale-110'
                          : 'border-white shadow-2xs'
                      }"
                      style="background-color: ${sw.color}"
                    ></button>
                  `
                    )
                    .join('')}
                  <button
                    type="button"
                    data-shell-action="toggle-wb-eraser"
                    class="px-2.5 py-1 rounded-lg text-[11px] font-bold border cursor-pointer ${
                      this.whiteboardEraser
                        ? 'bg-slate-900 text-white border-slate-900'
                        : 'bg-white text-slate-700 border-slate-200'
                    }"
                  >
                    🧹 Eraser
                  </button>
                  <button
                    type="button"
                    data-shell-action="clear-wb-canvas"
                    class="px-2.5 py-1 rounded-lg bg-white hover:bg-red-50 text-red-600 border border-red-200 text-[11px] font-bold cursor-pointer"
                  >
                    🗑️ Clear Board
                  </button>
                </div>

                <button
                  type="button"
                  data-shell-action="export-whiteboard-pdf"
                  data-testid="export-whiteboard-pdf-btn"
                  class="px-3.5 py-1.5 rounded-xl bg-[#10B981] hover:bg-emerald-600 text-white text-xs font-extrabold shadow-2xs flex items-center gap-1.5 cursor-pointer"
                >
                  <span>⬇ Save & Download Notes as PDF</span>
                </button>
              </div>

              <!-- Whiteboard Canvas + Text Notes Split -->
              <div class="grid grid-cols-1 lg:grid-cols-12 gap-3">
                <div class="lg:col-span-7 flex flex-col space-y-1.5">
                  <div class="text-[11px] font-bold text-slate-600 flex items-center justify-between">
                    <span>✏️ Freehand Diagram & Formula Whiteboard</span>
                    <span class="text-[10px] text-slate-400">Draw with mouse or touch</span>
                  </div>
                  <div class="rounded-xl border-2 border-indigo-200 bg-white overflow-hidden shadow-inner">
                    <canvas
                      id="prep-whiteboard-canvas"
                      data-testid="prep-whiteboard-canvas"
                      width="520"
                      height="260"
                      class="w-full h-[230px] bg-white cursor-crosshair touch-none"
                    ></canvas>
                  </div>
                </div>

                <div class="lg:col-span-5 flex flex-col space-y-2">
                  <div>
                    <label class="block text-[11px] font-bold text-slate-700 mb-1">Note Title</label>
                    <input
                      id="wb-notes-title"
                      type="text"
                      value="${this.escapeHtml(this.whiteboardNotesTitle)}"
                      placeholder="e.g., Rotational Mechanics Formula Sheet"
                      class="w-full min-h-[36px] px-3 py-1.5 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] text-xs font-bold text-slate-900"
                    />
                  </div>
                  <div class="flex-1 flex flex-col">
                    <label class="block text-[11px] font-bold text-slate-700 mb-1">Written Notes & Key Formulas</label>
                    <textarea
                      id="wb-notes-textarea"
                      data-testid="wb-notes-textarea"
                      rows="7"
                      placeholder="Write your lecture notes, derivations, or key points here. Click 'Save & Download Notes as PDF' to export both your whiteboard drawing and written notes!"
                      class="w-full flex-1 p-3 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] text-xs text-slate-900 leading-relaxed focus:outline-none focus:border-[#4F46E5]"
                    >${this.escapeHtml(this.whiteboardNotesText)}</textarea>
                  </div>
                </div>
              </div>
            </div>
          `
          }
        </div>
      </div>
    `;
  }

  private initWhiteboardCanvas(): void {
    const canvas = this.rootEl.querySelector<HTMLCanvasElement>('#prep-whiteboard-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    if (this.whiteboardDataUrl) {
      const img = new Image();
      img.onload = () => {
        ctx.drawImage(img, 0, 0);
      };
      img.src = this.whiteboardDataUrl;
    }

    let drawing = false;
    const getPos = (e: MouseEvent | TouchEvent) => {
      const rect = canvas.getBoundingClientRect();
      const clientX = 'touches' in e ? e.touches[0]?.clientX ?? 0 : e.clientX;
      const clientY = 'touches' in e ? e.touches[0]?.clientY ?? 0 : e.clientY;
      return {
        x: ((clientX - rect.left) / rect.width) * canvas.width,
        y: ((clientY - rect.top) / rect.height) * canvas.height,
      };
    };

    const startDraw = (e: MouseEvent | TouchEvent) => {
      drawing = true;
      const pos = getPos(e);
      ctx.beginPath();
      ctx.moveTo(pos.x, pos.y);
    };

    const moveDraw = (e: MouseEvent | TouchEvent) => {
      if (!drawing) return;
      if ('touches' in e) e.preventDefault();
      const pos = getPos(e);
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.strokeStyle = this.whiteboardEraser ? '#FFFFFF' : this.whiteboardPenColor;
      ctx.lineWidth = this.whiteboardEraser ? 18 : this.whiteboardPenSize;
      ctx.lineTo(pos.x, pos.y);
      ctx.stroke();
    };

    const endDraw = () => {
      if (!drawing) return;
      drawing = false;
      ctx.closePath();
      this.whiteboardDataUrl = canvas.toDataURL('image/png');
    };

    canvas.addEventListener('mousedown', startDraw);
    canvas.addEventListener('mousemove', moveDraw);
    window.addEventListener('mouseup', endDraw);
    canvas.addEventListener('touchstart', startDraw, { passive: false });
    canvas.addEventListener('touchmove', moveDraw, { passive: false });
    canvas.addEventListener('touchend', endDraw);
  }

  private exportWhiteboardAndNotesAsPdf(): void {
    const canvas = this.rootEl.querySelector<HTMLCanvasElement>('#prep-whiteboard-canvas');
    if (canvas) {
      this.whiteboardDataUrl = canvas.toDataURL('image/png');
    }
    const titleInput = this.rootEl.querySelector<HTMLInputElement>('#wb-notes-title');
    const notesInput = this.rootEl.querySelector<HTMLTextAreaElement>('#wb-notes-textarea');
    if (titleInput) this.whiteboardNotesTitle = titleInput.value.trim() || 'My Study Notes';
    if (notesInput) this.whiteboardNotesText = notesInput.value;

    const user = dataStore.getUser();
    const safeTitle = this.whiteboardNotesTitle.replace(/[^a-zA-Z0-9_-]/g, '_');

    // Generate a real minimalist PDF 1.4 binary containing the note title, student details, and written notes
    const lines = [
      `prepskm.in — Smart Whiteboard & Study Notes PDF`,
      `Title: ${this.whiteboardNotesTitle}`,
      `Student: ${user.name} (${user.classYear} - ${user.targetExam})`,
      `Date: ${new Date().toLocaleDateString()}`,
      `------------------------------------------------------------`,
      ...(this.whiteboardNotesText || 'Whiteboard diagram & formula summary attached.')
        .split('\n')
        .map((l) => l.slice(0, 85)),
    ];

    const escapedLines = lines.map((line) =>
      line.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)')
    );
    const textOps = escapedLines
      .map((line, idx) => `1 0 0 1 45 ${760 - idx * 18} Tm (${line}) Tj`)
      .join('\n');

    const streamContent = `BT\n/F1 11 Tf\n${textOps}\nET`;
    const pdfContent = [
      '%PDF-1.4',
      '1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj',
      '2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj',
      '3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >> endobj',
      `4 0 obj << /Length ${streamContent.length} >> stream\n${streamContent}\nendstream endobj`,
      '5 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj',
      'xref',
      '0 6',
      '0000000000 65535 f ',
      'trailer << /Size 6 /Root 1 0 R >>',
      'startxref',
      '0',
      '%%EOF',
    ].join('\n');

    const blob = new Blob([pdfContent], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${safeTitle}.pdf`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 5000);

    this.showToast(`Downloaded "${this.whiteboardNotesTitle}.pdf" to your device!`);
  }

  private renderAdminPencilModal(): string {
    if (!this.isPencilModalOpen || !dataStore.isMasterAdmin()) return '';
    const siteTheme = dataStore.getSiteTheme();
    const overrides = siteTheme.elementOverrides || {};
    const overrideCount = Object.keys(overrides).length;

    return `
      <div
        id="admin-pencil-editor-modal"
        data-testid="admin-pencil-editor-modal"
        role="dialog"
        aria-modal="true"
        aria-label="Admin Live Pencil Website Customizer"
        class="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4"
      >
        <div class="bg-white border border-[#E2E8F0] rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
          <div class="flex items-center justify-between pb-3 border-b border-slate-100">
            <div>
              <span class="text-[11px] font-extrabold uppercase tracking-wider text-amber-600">
                ✏️ Master Admin Live Pencil Editor (${MASTER_ADMIN_EMAIL})
              </span>
              <h2 class="text-base sm:text-lg font-extrabold text-slate-900">
                Edit Any Website Text, Name, or Color Live
              </h2>
            </div>
            <button
              type="button"
              data-shell-action="close-pencil-modal"
              class="min-h-[34px] px-3 py-1 rounded-xl bg-slate-100 text-slate-700 text-xs font-bold"
            >
              Close ✕
            </button>
          </div>

          <div class="p-3 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-between gap-3">
            <div class="text-xs text-amber-950">
              <strong>Interactive Element Picker:</strong> Click the button to pick any heading, card, or button on the page and edit its name or color.
            </div>
            <button
              type="button"
              data-shell-action="start-pencil-pick"
              data-testid="start-pencil-pick-btn"
              class="shrink-0 min-h-[36px] px-3 py-1.5 rounded-xl bg-slate-900 text-white text-xs font-extrabold cursor-pointer"
            >
              🎯 Pick Element on Page
            </button>
          </div>

          <form id="admin-pencil-save-form" class="space-y-4">
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label class="block text-xs font-bold text-slate-700 mb-1">Website Brand Name</label>
                <input
                  id="pencil-brand-name"
                  type="text"
                  value="${this.escapeHtml(siteTheme.brandName)}"
                  class="w-full min-h-[38px] px-3 py-1.5 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] text-xs font-bold text-slate-900"
                />
              </div>
              <div>
                <label class="block text-xs font-bold text-slate-700 mb-1">Target Element Selector</label>
                <input
                  id="pencil-selector-input"
                  type="text"
                  value="${this.escapeHtml(this.selectedElementSelector)}"
                  placeholder="e.g., h1, .brand-title-target"
                  class="w-full min-h-[38px] px-3 py-1.5 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] font-mono text-xs text-slate-800"
                />
              </div>
            </div>

            <div>
              <label class="block text-xs font-bold text-slate-700 mb-1">
                Custom Text / Rename Selected Element (Optional)
              </label>
              <input
                id="pencil-custom-text"
                type="text"
                value="${this.escapeHtml(this.selectedElementText)}"
                placeholder="Leave blank to keep current text, or type new label/title"
                class="w-full min-h-[38px] px-3 py-1.5 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] text-xs text-slate-900"
              />
            </div>

            <div class="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div class="p-2.5 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] space-y-1">
                <label class="block text-[11px] font-bold text-slate-700">Primary Theme</label>
                <input
                  id="pencil-primary-color"
                  type="color"
                  value="${this.escapeHtml(siteTheme.primaryColor)}"
                  class="w-full h-8 rounded cursor-pointer"
                />
              </div>
              <div class="p-2.5 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] space-y-1">
                <label class="block text-[11px] font-bold text-slate-700">Surface Bg</label>
                <input
                  id="pencil-surface-color"
                  type="color"
                  value="${this.escapeHtml(siteTheme.surfaceBg)}"
                  class="w-full h-8 rounded cursor-pointer"
                />
              </div>
              <div class="p-2.5 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] space-y-1">
                <label class="block text-[11px] font-bold text-slate-700">Element Text</label>
                <input
                  id="pencil-el-text-color"
                  type="color"
                  value="${this.escapeHtml(this.selectedElementColor || '#0F172A')}"
                  class="w-full h-8 rounded cursor-pointer"
                />
              </div>
              <div class="p-2.5 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] space-y-1">
                <label class="block text-[11px] font-bold text-slate-700">Element Bg</label>
                <input
                  id="pencil-el-bg-color"
                  type="color"
                  value="${this.escapeHtml(this.selectedElementBgColor || '#FFFFFF')}"
                  class="w-full h-8 rounded cursor-pointer"
                />
              </div>
            </div>

            <div class="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                data-shell-action="clear-pencil-overrides"
                class="min-h-[38px] px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold"
              >
                Reset Overrides (${overrideCount})
              </button>
              <button
                type="submit"
                data-testid="save-pencil-changes-btn"
                class="min-h-[40px] px-5 py-2 rounded-xl bg-[#4F46E5] hover:bg-indigo-700 text-white text-xs font-extrabold shadow-sm cursor-pointer"
              >
                💾 Apply & Save Changes
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
    const cohortTheme = getCohortTheme(user.targetExam, user.classYear);

    return `
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Student Sign Up and Profile Settings"
        data-testid="student-profile-modal"
        class="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4"
      >
        <div class="bg-white border border-[#E2E8F0] rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-5 max-h-[90vh] overflow-y-auto">
          <div class="flex items-center justify-between pb-3 border-b border-slate-100">
            <div>
              <span class="text-xs font-bold uppercase tracking-wider text-[#4F46E5]">
                ${user.isGuest ? 'Create Your Student Account' : 'Verified Student Profile'}
              </span>
              <h2 class="text-lg font-extrabold text-slate-900">
                ${user.isGuest ? 'Sign Up / Log In to Save Your Progress' : `Welcome, ${this.escapeHtml(user.name)}`}
              </h2>
            </div>
            <button
              type="button"
              data-shell-action="close-profile-modal"
              class="min-h-[36px] px-3 py-1 rounded-xl bg-slate-100 text-slate-700 text-xs font-bold cursor-pointer"
            >
              Close ✕
            </button>
          </div>

          ${
            this.authModalReasonMessage
              ? `
            <div
              data-testid="auth-modal-reason-banner"
              class="p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-xs font-bold text-amber-950 flex items-start gap-2.5"
            >
              <span class="text-base">🔒</span>
              <span>${this.escapeHtml(this.authModalReasonMessage)}</span>
            </div>
          `
              : ''
          }

          <!-- Account Status & Google Sign-In Card -->
          <div class="p-4 rounded-2xl bg-gradient-to-r ${cohortTheme.gradientClass} text-white space-y-3 shadow-sm">
            <div class="flex flex-wrap items-center justify-between gap-2">
              <div class="flex items-center gap-3">
                <img
                  src="${user.photoURL}"
                  alt="${this.escapeHtml(user.name)}"
                  referrerpolicy="no-referrer"
                  class="w-14 h-14 rounded-full object-cover border-2 border-white shadow-md"
                />
                <div>
                  <div class="flex items-center gap-1.5">
                    <span class="text-sm font-extrabold">${this.escapeHtml(user.name)}</span>
                    <span class="px-2 py-0.5 rounded-full bg-white/20 text-white text-[10px] font-extrabold">
                      ${!user.isGuest ? (dataStore.isMasterAdmin() ? '👑 Owner Admin' : '✓ Signed In') : 'Guest'}
                    </span>
                  </div>
                  <div class="text-xs font-mono-tabular text-white/85">
                    ${user.isGuest ? 'Sign up below with your Gmail' : this.escapeHtml(user.email)}
                  </div>
                  <div class="text-[11px] font-bold text-white/90 mt-0.5">
                    🔥 ${user.currentStreak}d Streak · ⚡ ${user.xpPoints ?? 0} XP
                  </div>
                </div>
              </div>

              ${
                !user.isGuest
                  ? `
                <button
                  type="button"
                  data-shell-action="signout-user"
                  class="min-h-[34px] px-3 py-1.5 rounded-xl bg-white/20 hover:bg-white/30 text-white text-xs font-bold cursor-pointer"
                >
                  Sign Out
                </button>
              `
                  : ''
              }
            </div>

            <button
              type="button"
              data-shell-action="google-signin"
              data-testid="google-signin-btn"
              class="w-full min-h-[40px] px-4 py-2 rounded-xl bg-white text-slate-900 hover:bg-slate-50 shadow-2xs flex items-center justify-center gap-2.5 text-xs font-extrabold transition-all cursor-pointer"
            >
              <span>${user.isGuest ? 'Continue with Google Account' : 'Switch / Reconnect Google Account'}</span>
            </button>
          </div>

          <!-- Sign-Up & Profile Update Form -->
          <form id="profile-update-form" class="space-y-4">
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label for="prof-name-input" class="block text-xs font-bold text-slate-700 mb-1">
                  Your Full Name (As on Gmail)
                </label>
                <input
                  id="prof-name-input"
                  data-testid="prof-name-input"
                  type="text"
                  required
                  placeholder="e.g., Rahul Verma"
                  value="${user.isGuest ? '' : this.escapeHtml(user.name)}"
                  class="w-full min-h-[42px] px-3.5 py-2 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] text-xs sm:text-sm font-bold text-slate-900"
                />
              </div>

              <div>
                <label for="prof-email-input" class="block text-xs font-bold text-slate-700 mb-1">
                  Gmail / Email Address
                </label>
                <input
                  id="prof-email-input"
                  data-testid="prof-email-input"
                  type="email"
                  required
                  placeholder="yourname@gmail.com"
                  value="${user.isGuest ? '' : this.escapeHtml(user.email)}"
                  class="w-full min-h-[42px] px-3.5 py-2 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] text-xs sm:text-sm font-bold text-slate-900"
                />
              </div>
            </div>

            <!-- Class Cohort & Exam -->
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label for="prof-class-select" class="block text-xs font-bold text-slate-700 mb-1">
                  Class / Batch Cohort
                </label>
                <select
                  id="prof-class-select"
                  class="w-full min-h-[42px] px-3 py-2 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] text-xs font-semibold text-slate-800"
                >
                  ${(
                    [
                      'Class 12',
                      'Class 11',
                      'Dropper',
                      'Class 11 Foundation',
                      'Class 10 Foundation',
                      'Class 10',
                      'Class 9',
                    ] as const
                  )
                    .map(
                      (c) =>
                        `<option value="${c}" ${user.classYear === c ? 'selected' : ''}>${c}</option>`
                    )
                    .join('')}
                </select>
              </div>

              <div>
                <label for="prof-exam-select" class="block text-xs font-bold text-slate-700 mb-1">
                  Target Exam (JEE / NEET)
                </label>
                <select
                  id="prof-exam-select"
                  class="w-full min-h-[42px] px-3 py-2 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] text-xs font-semibold text-slate-800"
                >
                  <option value="JEE" ${user.targetExam === 'JEE' ? 'selected' : ''}>JEE 2027</option>
                  <option value="NEET" ${user.targetExam === 'NEET' ? 'selected' : ''}>NEET 2027</option>
                </select>
              </div>
            </div>

            <!-- Custom Personal Photo Upload + Preset Avatars -->
            <div class="p-3.5 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] space-y-2.5">
              <div class="flex items-center justify-between">
                <label for="prof-custom-photo-input" class="text-xs font-extrabold text-slate-800">
                  📸 Profile Photo (Optional)
                </label>
              </div>
              <input
                id="prof-custom-photo-input"
                data-testid="upload-profile-photo-input"
                type="file"
                accept="image/*"
                class="w-full text-xs text-slate-600 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-extrabold file:bg-[#4F46E5] file:text-white cursor-pointer"
              />
              <div class="flex items-center gap-2.5 pt-1">
                <span class="text-[11px] text-slate-500 font-semibold">Or pick avatar:</span>
                ${AVATAR_CHOICES.map(
                  (url) => `
                  <button
                    type="button"
                    data-shell-action="select-avatar"
                    data-avatar="${url}"
                    class="w-9 h-9 rounded-full overflow-hidden border-2 transition-transform cursor-pointer ${
                      user.photoURL === url
                        ? 'border-[#4F46E5] scale-110'
                        : 'border-[#E2E8F0]'
                    }"
                  >
                    <img src="${url}" alt="Avatar option" referrerpolicy="no-referrer" class="w-full h-full object-cover" />
                  </button>
                `
                ).join('')}
              </div>
            </div>

            <div class="pt-2 flex flex-wrap items-center justify-end gap-2">
              <button
                type="submit"
                data-testid="save-signup-profile-btn"
                class="w-full min-h-[44px] px-6 py-2.5 rounded-xl bg-[#4F46E5] hover:bg-indigo-700 text-white text-xs sm:text-sm font-extrabold shadow-sm cursor-pointer"
              >
                ${user.isGuest ? 'Complete Sign Up & Save Profile →' : 'Update Profile →'}
              </button>
            </div>
          </form>
        </div>
      </div>
    `;
  }

  private async submitPrepAiPrompt(promptText: string): Promise<void> {
    const clean = promptText.trim();
    if (!clean || this.isPrepAiLoading) return;

    const user = dataStore.getUser();
    const nowTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    this.prepAiMessages.push({
      id: `user_${Date.now()}`,
      role: 'user',
      text: clean,
      timestamp: nowTime,
    });
    this.isPrepAiLoading = true;
    this.renderShell();

    try {
      const res = await fetch('/api/gemini/prep-ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: clean,
          targetExam: user.targetExam,
          classYear: user.classYear,
        }),
      });
      const data = (await res.json()) as { answer?: string };
      this.prepAiMessages.push({
        id: `ai_${Date.now()}`,
        role: 'assistant',
        text:
          data.answer ||
          'Break this chapter into NCERT/core theory first, then solve 25 past-year questions with a strict timer.',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      });
    } catch {
      this.prepAiMessages.push({
        id: `ai_${Date.now()}`,
        role: 'assistant',
        text: `Here is your structured ${user.targetExam} solution strategy:\n1. Identify the conservation law or core formula first.\n2. Write dimensional units and boundary conditions.\n3. Solve 15 PYQs from this topic in the CBT Engine.`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      });
    } finally {
      this.isPrepAiLoading = false;
      this.renderShell();
      const scrollBox = this.rootEl.querySelector<HTMLElement>('#prep-ai-chat-scroll');
      if (scrollBox) {
        scrollBox.scrollTop = scrollBox.scrollHeight;
      }
    }
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

    // Prep AI Chat Form
    const prepAiForm = this.rootEl.querySelector<HTMLFormElement>('#prep-ai-form');
    prepAiForm?.addEventListener('submit', (e) => {
      e.preventDefault();
      const input = prepAiForm.querySelector<HTMLInputElement>('#prep-ai-input');
      const val = input?.value || '';
      if (input) input.value = '';
      void this.submitPrepAiPrompt(val);
    });

    // Preserve Whiteboard Notes Input Changes
    const wbTitleInput = this.rootEl.querySelector<HTMLInputElement>('#wb-notes-title');
    wbTitleInput?.addEventListener('input', () => {
      this.whiteboardNotesTitle = wbTitleInput.value;
    });
    const wbNotesTextarea = this.rootEl.querySelector<HTMLTextAreaElement>('#wb-notes-textarea');
    wbNotesTextarea?.addEventListener('input', () => {
      this.whiteboardNotesText = wbNotesTextarea.value;
    });

    // Custom Personal Profile Photo File Upload
    const customPhotoInput = this.rootEl.querySelector<HTMLInputElement>(
      '#prof-custom-photo-input'
    );
    customPhotoInput?.addEventListener('change', () => {
      const file = customPhotoInput.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = async () => {
        if (typeof reader.result === 'string') {
          const compressed = await compressImageDataUrl(reader.result, 320, 0.84);
          await dataStore.updateUser({ photoURL: compressed });
          this.showToast('Profile photo updated!');
          this.renderShell();
        }
      };
      reader.readAsDataURL(file);
    });

    // Sign-Up & Profile Update Form
    const profileForm =
      this.rootEl.querySelector<HTMLFormElement>('#profile-update-form');
    profileForm?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const name =
        profileForm.querySelector<HTMLInputElement>('#prof-name-input')?.value.trim() || '';
      const email =
        profileForm.querySelector<HTMLInputElement>('#prof-email-input')?.value.trim() || '';
      const classYear =
        (profileForm.querySelector<HTMLSelectElement>('#prof-class-select')
          ?.value as StudentClassYear) ?? 'Class 12';
      const targetExam =
        (profileForm.querySelector<HTMLSelectElement>('#prof-exam-select')
          ?.value as TargetExam) ?? 'JEE';

      if (!email) {
        this.showToast('Please enter your Gmail / Email address.');
        return;
      }

      const signedInUser = await dataStore.signUpOrLoginProfile({
        name,
        email,
        classYear,
        targetExam,
      });

      this.isProfileModalOpen = false;
      this.authModalReasonMessage = '';

      if (isMasterAdminEmail(signedInUser.email)) {
        this.showToast(
          `Welcome Owner & Master Admin (${signedInUser.name})! Admin Panel unlocked.`
        );
      } else {
        this.showToast(
          `Welcome ${signedInUser.name}! Your profile (${classYear} · ${targetExam}) is now active.`
        );
      }
      this.renderShell();
    });

    // Admin Pencil Live Website Customizer Form
    const pencilForm = this.rootEl.querySelector<HTMLFormElement>(
      '#admin-pencil-save-form'
    );
    pencilForm?.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (!dataStore.isMasterAdmin()) return;
      const brandName =
        pencilForm
          .querySelector<HTMLInputElement>('#pencil-brand-name')
          ?.value.trim() || 'prepskm.in';
      const primaryColor =
        pencilForm.querySelector<HTMLInputElement>('#pencil-primary-color')
          ?.value || '#4F46E5';
      const surfaceBg =
        pencilForm.querySelector<HTMLInputElement>('#pencil-surface-color')
          ?.value || '#F8FAFC';
      const selector =
        pencilForm
          .querySelector<HTMLInputElement>('#pencil-selector-input')
          ?.value.trim() || '';
      const customText =
        pencilForm
          .querySelector<HTMLInputElement>('#pencil-custom-text')
          ?.value.trim() || '';
      const textColor =
        pencilForm.querySelector<HTMLInputElement>('#pencil-el-text-color')
          ?.value || '';

      await dataStore.updateSiteTheme({
        brandName,
        primaryColor,
        surfaceBg,
      });

      if (selector && (customText || textColor)) {
        await dataStore.saveElementStyleOverride(selector, {
          ...(customText ? { text: customText } : {}),
          ...(textColor ? { color: textColor } : {}),
        });
      }

      this.isPencilModalOpen = false;
      this.showToast('Saved live UI customizations!');
      this.renderShell();
    });

    const handleCohortSelectChange = async (selectEl: HTMLSelectElement) => {
      const val = selectEl.value;
      const [examPart, classPart] = val.split('|') as [TargetExam, StudentClassYear];
      if (examPart && classPart) {
        await dataStore.updateUser({
          targetExam: examPart,
          classYear: classPart,
        });
        this.isMobile3DotMenuOpen = false;
        this.showToast(`Switched Cohort to ${classPart} (${examPart})`);
        this.renderShell();
      }
    };

    const unifiedSelect =
      this.rootEl.querySelector<HTMLSelectElement>('#unified-cohort-select');
    unifiedSelect?.addEventListener('change', () =>
      handleCohortSelectChange(unifiedSelect)
    );

    const mobileCohortSelect =
      this.rootEl.querySelector<HTMLSelectElement>('#mobile-cohort-select');
    mobileCohortSelect?.addEventListener('change', () =>
      handleCohortSelectChange(mobileCohortSelect)
    );

    this.rootEl.querySelectorAll<HTMLElement>('[data-shell-action]').forEach((el) => {
      const action = el.dataset.shellAction;
      el.addEventListener('click', async () => {
        switch (action) {
          case 'open-prep-ai-modal': {
            this.isMobile3DotMenuOpen = false;
            this.isPrepAiModalOpen = true;
            this.renderShell();
            break;
          }
          case 'close-prep-ai-modal': {
            const canvas = this.rootEl.querySelector<HTMLCanvasElement>('#prep-whiteboard-canvas');
            if (canvas) {
              this.whiteboardDataUrl = canvas.toDataURL('image/png');
            }
            this.isPrepAiModalOpen = false;
            this.renderShell();
            break;
          }
          case 'switch-prep-ai-tab': {
            const canvas = this.rootEl.querySelector<HTMLCanvasElement>('#prep-whiteboard-canvas');
            if (canvas) {
              this.whiteboardDataUrl = canvas.toDataURL('image/png');
            }
            const tab = el.dataset.tab as 'ai' | 'whiteboard';
            if (tab) {
              this.prepAiActiveTab = tab;
              this.renderShell();
            }
            break;
          }
          case 'prep-ai-quick-prompt': {
            const prompt = el.dataset.prompt || '';
            if (prompt) {
              void this.submitPrepAiPrompt(prompt);
            }
            break;
          }
          case 'set-wb-color': {
            const color = el.dataset.color || '#4F46E5';
            this.whiteboardPenColor = color;
            this.whiteboardEraser = false;
            this.renderShell();
            break;
          }
          case 'toggle-wb-eraser': {
            this.whiteboardEraser = !this.whiteboardEraser;
            this.renderShell();
            break;
          }
          case 'clear-wb-canvas': {
            this.whiteboardDataUrl = '';
            this.renderShell();
            break;
          }
          case 'export-whiteboard-pdf': {
            this.exportWhiteboardAndNotesAsPdf();
            break;
          }
          case 'open-pencil-modal': {
            if (!dataStore.isMasterAdmin()) {
              this.showToast(`Only Master Admin (${MASTER_ADMIN_EMAIL}) can edit website UI.`);
              return;
            }
            this.isMobile3DotMenuOpen = false;
            this.isPencilModalOpen = true;
            this.renderShell();
            break;
          }
          case 'close-pencil-modal': {
            this.isPencilModalOpen = false;
            this.renderShell();
            break;
          }
          case 'start-pencil-pick': {
            if (!dataStore.isMasterAdmin()) return;
            this.isPencilModalOpen = false;
            this.isPencilPickMode = true;
            this.renderShell();
            break;
          }
          case 'cancel-pencil-pick': {
            this.isPencilPickMode = false;
            this.renderShell();
            break;
          }
          case 'clear-pencil-overrides': {
            await dataStore.clearElementStyleOverrides();
            this.isPencilModalOpen = false;
            this.showToast('Cleared custom element overrides.');
            this.renderShell();
            break;
          }
          case 'open-profile-modal': {
            this.isMobile3DotMenuOpen = false;
            this.authModalReasonMessage = '';
            this.isProfileModalOpen = true;
            this.renderShell();
            break;
          }
          case 'close-profile-modal': {
            this.isProfileModalOpen = false;
            this.authModalReasonMessage = '';
            this.renderShell();
            break;
          }
          case 'toggle-notifications': {
            this.isMobile3DotMenuOpen = false;
            this.isNotificationsOpen = !this.isNotificationsOpen;
            this.renderShell();
            break;
          }
          case 'toggle-mobile-3dot-menu': {
            this.isNotificationsOpen = false;
            this.isMobile3DotMenuOpen = !this.isMobile3DotMenuOpen;
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
            this.isProfileModalOpen = false;
            if (this.activePage === 'admin') {
              window.history.pushState({}, '', '/index.html');
              this.activePage = 'home';
            }
            this.showToast('Signed out.');
            this.renderShell();
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
          case 'google-signin': {
            try {
              await dataStore.signInWithGoogle();
              this.isProfileModalOpen = false;
              this.authModalReasonMessage = '';
              this.showToast('Signed in with Google!');
              this.renderShell();
            } catch {
              const nameInput =
                this.rootEl.querySelector<HTMLInputElement>('#prof-name-input')?.value.trim() ||
                'Student';
              const emailInput =
                this.rootEl.querySelector<HTMLInputElement>('#prof-email-input')?.value.trim() ||
                `${nameInput.toLowerCase().replace(/[^a-z0-9]/g, '') || 'student'}@gmail.com`;
              await dataStore.signUpOrLoginProfile({
                name: nameInput,
                email: emailInput,
              });
              this.isProfileModalOpen = false;
              this.authModalReasonMessage = '';
              this.showToast(`Signed in as ${dataStore.getUser().name}!`);
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

  private escapeHtml(str?: string | null): string {
    return String(str ?? '')
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
