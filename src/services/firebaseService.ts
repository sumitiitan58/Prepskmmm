import { getApp, getApps, initializeApp } from 'firebase/app';
import {
  GoogleAuthProvider,
  createUserWithEmailAndPassword,
  getAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  type User as FirebaseUser,
  type UserInfo,
} from 'firebase/auth';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocFromServer,
  getDocs,
  getFirestore,
  limit,
  onSnapshot,
  orderBy,
  query,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore';
import firebaseAppletConfig from '../../firebase-applet-config.json';
import {
  CBT_QUESTION_BANK,
  DEFAULT_SITE_THEME,
  DEFAULT_USER,
  DEFAULT_VAULT_SECTIONS,
  DEFAULT_VIDEO_SECTIONS,
  INITIAL_ADMIN_QUESTIONS,
  INITIAL_BROADCASTS,
  INITIAL_CHAPTERS,
  INITIAL_CLASSES,
  INITIAL_LEADERBOARD,
  INITIAL_MATERIALS,
  INITIAL_MENTORS,
  INITIAL_MENTORSHIP_SESSIONS,
  INITIAL_SCRATCHPAD_NOTES,
  INITIAL_SUBJECTS,
  INITIAL_TASKS,
  INITIAL_TEST_SUBMISSIONS,
  INITIAL_VIDEO_DOUBTS,
  INITIAL_VIDEOS,
  LIVE_POLL_BANK,
  MENTOR_AVATAR_PATH,
} from '../constants';
import type {
  AdminQuestionItem,
  AspirantUser,
  BroadcastMessageItem,
  CBTQuestion,
  ChapterEntity,
  ClassEntity,
  ElementStyleOverride,
  LeaderboardEntry,
  LectureProgress,
  LiveSession,
  MentorProfileItem,
  MentorshipSessionItem,
  ProficiencyLevel,
  SiteThemeSettings,
  StreakNotificationItem,
  StudentClassYear,
  StudyMaterialItem,
  StudyPlan,
  StudyTask,
  SubjectEntity,
  TargetExam,
  TaskPriority,
  TestSubmission,
  VideoDoubtItem,
  VideoRoadmapItem,
} from '../types';
import {
  calculateLeaderboardCompositePoints,
  evaluateStreakRiskStatus,
  generatePersonalizedStudyPlan,
  getSubjectsForExam,
  rankLeaderboardEntries,
} from '../utils/examLogic';

export const MASTER_ADMIN_EMAIL = 'Sumit586kumar@gmail.com';
export const SECONDARY_ADMIN_EMAIL = 'sumitiitair01@gmail.com';

const app = getApps().length > 0 ? getApp() : initializeApp(firebaseAppletConfig);
export const auth = getAuth(app);
export const db = getFirestore(app, firebaseAppletConfig.firestoreDatabaseId);

export function isMasterAdminEmail(email?: string | null): boolean {
  if (!email) return false;
  const normalized = String(email).trim().toLowerCase();
  return (
    normalized === MASTER_ADMIN_EMAIL.toLowerCase() ||
    normalized === SECONDARY_ADMIN_EMAIL.toLowerCase()
  );
}

export async function compressImageDataUrl(
  dataUrl: string,
  maxWidth = 720,
  quality = 0.74
): Promise<string> {
  if (!dataUrl || !dataUrl.startsWith('data:image/') || typeof document === 'undefined') {
    return dataUrl;
  }
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      try {
        const scale = img.width > maxWidth ? maxWidth / img.width : 1;
        const w = Math.max(1, Math.round(img.width * scale));
        const h = Math.max(1, Math.round(img.height * scale));
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(dataUrl);
          return;
        }
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, w, h);
        ctx.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL('image/jpeg', quality));
      } catch {
        resolve(dataUrl);
      }
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
}

export async function uploadDataUrlToStorage(
  _path: string,
  dataUrl: string
): Promise<string> {
  return compressImageDataUrl(dataUrl);
}

export async function uploadFileToStorage(
  _path: string,
  file: Blob | Uint8Array | ArrayBuffer,
  fallbackUrl = ''
): Promise<string> {
  try {
    if (file instanceof Blob) {
      if (file.size <= 450 * 1024 && typeof FileReader !== 'undefined') {
        return await new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : fallbackUrl);
          reader.onerror = () => resolve(fallbackUrl || URL.createObjectURL(file));
          reader.readAsDataURL(file);
        });
      }
      if (typeof URL !== 'undefined' && typeof URL.createObjectURL === 'function') {
        return URL.createObjectURL(file);
      }
    }
    return fallbackUrl;
  } catch {
    return fallbackUrl;
  }
}

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((provider: UserInfo) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

async function testConnection(): Promise<void> {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (
      error instanceof Error &&
      error.message.includes('the client is offline')
    ) {
      console.error('Please check your Firebase configuration.');
    }
  }
}

void testConnection();

const STORAGE_KEYS = {
  USER: 'prepskm_user_v3',
  TASKS: 'prepskm_tasks_v4',
  LECTURE_PROGRESS: 'prepskm_lecture_progress_v3',
  LIVE_SESSION: 'prepskm_live_session_v3',
  TEST_SUBMISSIONS: 'prepskm_test_submissions_v4',
  STUDY_PLAN: 'prepskm_study_plan_v3',
  LEADERBOARD: 'prepskm_leaderboard_v3',
  CLASSES: 'prepskm_classes_v3',
  SUBJECTS: 'prepskm_subjects_v3',
  CHAPTERS: 'prepskm_chapters_v3',
  MATERIALS: 'prepskm_materials_v3',
  VAULT_SECTIONS: 'prepskm_vault_sections_v3',
  VIDEO_SECTIONS: 'prepskm_video_sections_v3',
  VIDEOS: 'prepskm_videos_v3',
  VIDEO_DOUBTS: 'prepskm_video_doubts_v3',
  MENTORSHIP: 'prepskm_mentorship_v3',
  MENTORS: 'prepskm_mentors_v3',
  BROADCASTS: 'prepskm_broadcasts_v3',
  STREAK_NOTIFICATIONS: 'prepskm_streak_notifications_v3',
  SITE_THEME: 'prepskm_site_theme_v3',
  DAILY_GOAL_TARGET: 'prepskm_daily_goal_target_v3',
  ADMIN_QUESTIONS: 'prepskm_admin_questions_v3',
};

function sanitizeId(id: string): string {
  const cleaned = id.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 120);
  return cleaned || 'id_default';
}

export class PrepskmDataStore {
  private currentUser: AspirantUser;
  private tasks: StudyTask[];
  private lectureProgress: LectureProgress;
  private liveSession: LiveSession;
  private submissions: TestSubmission[];
  private studyPlan: StudyPlan;
  private leaderboard: LeaderboardEntry[];
  private classes: ClassEntity[];
  private subjects: SubjectEntity[];
  private chapters: ChapterEntity[];
  private materials: StudyMaterialItem[];
  private vaultSections: string[];
  private videoSections: string[];
  private videos: VideoRoadmapItem[];
  private videoDoubts: VideoDoubtItem[];
  private mentorshipSessions: MentorshipSessionItem[];
  private mentors: MentorProfileItem[];
  private broadcasts: BroadcastMessageItem[];
  private streakNotifications: StreakNotificationItem[];
  private siteTheme: SiteThemeSettings;
  private dailyGoalTarget: number;
  private adminQuestions: AdminQuestionItem[];
  private authListeners: ((user: AspirantUser, isCloudAuthenticated: boolean) => void)[] = [];
  private streakListeners: ((notifications: StreakNotificationItem[]) => void)[] = [];
  public isCloudAuthenticated = false;

  constructor() {
    this.currentUser = this.loadLocal(STORAGE_KEYS.USER, { ...DEFAULT_USER });
    this.tasks = this.loadLocal(STORAGE_KEYS.TASKS, [...INITIAL_TASKS]);
    this.lectureProgress = this.loadLocal(STORAGE_KEYS.LECTURE_PROGRESS, {
      uid: this.currentUser.uid,
      lectureId: 'rotational_mechanics_01',
      lastPositionSeconds: 525,
      completed: false,
      notes: INITIAL_SCRATCHPAD_NOTES,
    });
    this.liveSession = this.loadLocal(STORAGE_KEYS.LIVE_SESSION, {
      sessionId: 'masterclass_rotational_01',
      mentor: 'Sumit',
      title: 'Rotational Mechanics: IAOR, Rolling & Angular Impulse PYQs',
      isLive: true,
      activePoll: {
        question: LIVE_POLL_BANK[0].question,
        options: [...LIVE_POLL_BANK[0].options],
        votes: { ...LIVE_POLL_BANK[0].votes },
      },
    });
    this.submissions = this.loadLocal(STORAGE_KEYS.TEST_SUBMISSIONS, [
      ...INITIAL_TEST_SUBMISSIONS,
    ]);

    const defaultPlan = generatePersonalizedStudyPlan({
      uid: this.currentUser.uid,
      targetExam: this.currentUser.targetExam,
      dailyHours: 6,
      proficiency: {
        Physics: 'Weak',
        Chemistry: 'Moderate',
        Math: 'Strong',
        Biology: 'Moderate',
      },
      planId: 'plan_active_default',
      now: 1793800000000,
    });
    this.studyPlan = this.loadLocal(STORAGE_KEYS.STUDY_PLAN, defaultPlan);
    this.leaderboard = this.loadLocal(STORAGE_KEYS.LEADERBOARD, [...INITIAL_LEADERBOARD]);
    this.classes = this.loadLocal(STORAGE_KEYS.CLASSES, [...INITIAL_CLASSES]);
    this.subjects = this.loadLocal(STORAGE_KEYS.SUBJECTS, [...INITIAL_SUBJECTS]);
    this.chapters = this.loadLocal(STORAGE_KEYS.CHAPTERS, [...INITIAL_CHAPTERS]);
    this.materials = this.loadLocal(STORAGE_KEYS.MATERIALS, [...INITIAL_MATERIALS]);
    this.vaultSections = this.loadLocal(STORAGE_KEYS.VAULT_SECTIONS, [...DEFAULT_VAULT_SECTIONS]);
    this.videoSections = this.loadLocal(STORAGE_KEYS.VIDEO_SECTIONS, [...DEFAULT_VIDEO_SECTIONS]);
    this.videos = this.loadLocal(STORAGE_KEYS.VIDEOS, [...INITIAL_VIDEOS]);
    this.videoDoubts = this.loadLocal(STORAGE_KEYS.VIDEO_DOUBTS, [...INITIAL_VIDEO_DOUBTS]);
    this.mentorshipSessions = this.loadLocal(STORAGE_KEYS.MENTORSHIP, [
      ...INITIAL_MENTORSHIP_SESSIONS,
    ]);
    this.mentors = this.loadLocal(STORAGE_KEYS.MENTORS, [...INITIAL_MENTORS]);
    this.broadcasts = this.loadLocal(STORAGE_KEYS.BROADCASTS, [...INITIAL_BROADCASTS]);

    const initialRisk = evaluateStreakRiskStatus({
      uid: this.currentUser.uid,
      studentName: this.currentUser.name,
      currentStreak: this.currentUser.currentStreak,
      lastActiveDate: this.currentUser.lastActiveDate,
      todayIso: '2026-11-04',
      completedTasksToday: this.tasks.filter((t) => t.dateIso === '2026-11-04' && t.isCompleted).length,
      currentHour24: 20,
    });
    this.streakNotifications = this.loadLocal(STORAGE_KEYS.STREAK_NOTIFICATIONS, [
      {
        id: 'streak_notif_initial_01',
        ...initialRisk.notificationPayload,
        isRead: false,
        createdAt: '2026-11-04T14:30:00Z',
      },
    ]);

    this.siteTheme = this.loadLocal(STORAGE_KEYS.SITE_THEME, { ...DEFAULT_SITE_THEME });
    this.dailyGoalTarget = this.loadLocal(STORAGE_KEYS.DAILY_GOAL_TARGET, 4);
    this.adminQuestions = this.loadLocal(STORAGE_KEYS.ADMIN_QUESTIONS, [
      ...INITIAL_ADMIN_QUESTIONS,
    ]);

    this.recalculateLocalUserLeaderboardEntry();
    this.applySiteThemeToDocument();
    void this.syncGlobalPlatformSettingsFromFirestore();

    onAuthStateChanged(auth, (fbUser) => {
      void this.onFirebaseUserChanged(fbUser);
    });
  }

  private loadLocal<T>(key: string, fallback: T): T {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) {
        localStorage.setItem(key, JSON.stringify(fallback));
        return fallback;
      }
      return JSON.parse(raw) as T;
    } catch {
      return fallback;
    }
  }

  private saveLocal<T>(key: string, data: T): void {
    try {
      localStorage.setItem(key, JSON.stringify(data));
    } catch {
      // Ignore storage quota warnings
    }
  }

  public onAuthChange(
    cb: (user: AspirantUser, isCloudAuthenticated: boolean) => void
  ): void {
    this.authListeners.push(cb);
    cb(this.currentUser, this.isCloudAuthenticated);
  }

  private notifyAuthListeners(): void {
    for (const cb of this.authListeners) {
      cb(this.currentUser, this.isCloudAuthenticated);
    }
  }

  public isMasterAdmin(): boolean {
    return isMasterAdminEmail(this.currentUser.email);
  }

  public getMentorByEmail(email?: string | null): MentorProfileItem | undefined {
    if (!email) return undefined;
    const normalized = email.trim().toLowerCase();
    return this.mentors.find((m) => m.email.trim().toLowerCase() === normalized);
  }

  public isAuthorizedAdminOrMentor(): boolean {
    if (this.isMasterAdmin()) return true;
    return Boolean(this.getMentorByEmail(this.currentUser.email));
  }

  private async syncGlobalPlatformSettingsFromFirestore(): Promise<void> {
    try {
      const themeSnap = await getDoc(doc(db, 'site_settings', 'global'));
      if (themeSnap.exists()) {
        this.siteTheme = {
          ...DEFAULT_SITE_THEME,
          ...(themeSnap.data() as Partial<SiteThemeSettings>),
        };
        this.saveLocal(STORAGE_KEYS.SITE_THEME, this.siteTheme);
        this.applySiteThemeToDocument();
      }
    } catch {
      // Offline fallback uses local siteTheme
    }

    try {
      onSnapshot(
        collection(db, 'materials'),
        (snap) => {
          if (!snap.empty) {
            const remote = snap.docs.map((d) => d.data() as StudyMaterialItem);
            const merged = new Map<string, StudyMaterialItem>();
            for (const item of remote) merged.set(item.id, item);
            for (const item of this.materials) {
              if (!merged.has(item.id)) merged.set(item.id, item);
            }
            this.materials = Array.from(merged.values());
            this.saveLocal(STORAGE_KEYS.MATERIALS, this.materials);
          }
        },
        () => {}
      );

      onSnapshot(
        collection(db, 'questions'),
        (snap) => {
          if (!snap.empty) {
            const remote = snap.docs.map((d) => d.data() as AdminQuestionItem);
            const merged = new Map<string, AdminQuestionItem>();
            for (const q of remote) merged.set(q.id, q);
            for (const q of this.adminQuestions) {
              if (!merged.has(q.id)) merged.set(q.id, q);
            }
            this.adminQuestions = Array.from(merged.values());
            this.saveLocal(STORAGE_KEYS.ADMIN_QUESTIONS, this.adminQuestions);
          }
        },
        () => {}
      );

      onSnapshot(
        collection(db, 'videos'),
        (snap) => {
          if (!snap.empty) {
            const remote = snap.docs.map((d) => d.data() as VideoRoadmapItem);
            const merged = new Map<string, VideoRoadmapItem>();
            for (const v of remote) merged.set(v.id, v);
            for (const v of this.videos) {
              if (!merged.has(v.id)) merged.set(v.id, v);
            }
            this.videos = Array.from(merged.values());
            this.saveLocal(STORAGE_KEYS.VIDEOS, this.videos);
          }
        },
        () => {}
      );

      onSnapshot(
        collection(db, 'broadcasts'),
        (snap) => {
          if (!snap.empty) {
            const remote = snap.docs.map((d) => d.data() as BroadcastMessageItem);
            remote.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
            this.broadcasts = remote;
            this.saveLocal(STORAGE_KEYS.BROADCASTS, this.broadcasts);
          }
        },
        () => {}
      );

      onSnapshot(
        collection(db, 'mentors'),
        (snap) => {
          if (!snap.empty) {
            const remoteMentors = snap.docs.map((d) => d.data() as MentorProfileItem);
            const merged = new Map<string, MentorProfileItem>();
            for (const m of this.mentors) merged.set(m.id, m);
            for (const m of remoteMentors) merged.set(m.id, m);
            this.mentors = Array.from(merged.values());
            this.saveLocal(STORAGE_KEYS.MENTORS, this.mentors);
          }
        },
        () => {}
      );

      onSnapshot(
        doc(db, 'site_settings', 'global'),
        (snap) => {
          if (snap.exists()) {
            this.siteTheme = {
              ...DEFAULT_SITE_THEME,
              ...(snap.data() as Partial<SiteThemeSettings>),
            };
            this.saveLocal(STORAGE_KEYS.SITE_THEME, this.siteTheme);
            this.applySiteThemeToDocument();
          }
        },
        () => {}
      );

      onSnapshot(
        collection(db, 'streak_notifications'),
        (snap) => {
          if (!snap.empty) {
            const remote = snap.docs.map((d) => d.data() as StreakNotificationItem);
            const merged = new Map<string, StreakNotificationItem>();
            for (const item of remote) merged.set(item.id, item);
            for (const item of this.streakNotifications) {
              if (!merged.has(item.id)) merged.set(item.id, item);
            }
            this.streakNotifications = Array.from(merged.values()).sort((a, b) =>
              b.createdAt.localeCompare(a.createdAt)
            );
            this.saveLocal(STORAGE_KEYS.STREAK_NOTIFICATIONS, this.streakNotifications);
            this.notifyStreakListeners();
          }
        },
        () => {}
      );

      onSnapshot(
        collection(db, 'test_submissions'),
        (snap) => {
          if (!snap.empty) {
            const remote = snap.docs.map((d) => d.data() as TestSubmission);
            const merged = new Map<string, TestSubmission>();
            for (const s of remote) merged.set(s.testId, s);
            for (const s of this.submissions) {
              if (!merged.has(s.testId)) merged.set(s.testId, s);
            }
            this.submissions = Array.from(merged.values()).sort((a, b) =>
              (b.timestamp || '').localeCompare(a.timestamp || '')
            );
            this.saveLocal(STORAGE_KEYS.TEST_SUBMISSIONS, this.submissions);
          }
        },
        () => {}
      );
    } catch {
      // Offline fallback
    }
  }

  private async onFirebaseUserChanged(fbUser: FirebaseUser | null): Promise<void> {
    if (!fbUser) {
      this.isCloudAuthenticated = false;
      this.notifyAuthListeners();
      return;
    }

    this.isCloudAuthenticated = true;
    const uid = sanitizeId(fbUser.uid);
    const userPath = `users/${uid}`;

    try {
      const snap = await getDoc(doc(db, 'users', uid));
      if (snap.exists()) {
        const remoteUser = snap.data() as Partial<AspirantUser>;
        this.currentUser = {
          uid: remoteUser.uid ?? uid,
          email: fbUser.email || remoteUser.email || this.currentUser.email,
          name: remoteUser.name ?? (fbUser.displayName || 'Aspirant'),
          classYear: remoteUser.classYear ?? 'Class 12',
          targetExam: remoteUser.targetExam ?? 'JEE',
          photoURL: remoteUser.photoURL || fbUser.photoURL || MENTOR_AVATAR_PATH,
          isGuest: false,
          currentStreak: remoteUser.currentStreak ?? 4,
          lastActiveDate: remoteUser.lastActiveDate ?? '2026-11-04',
          createdAt: remoteUser.createdAt ?? new Date().toISOString(),
        };
      } else {
        const newProfile: AspirantUser = {
          uid,
          email: fbUser.email || this.currentUser.email,
          name: (fbUser.displayName || 'Aspirant').slice(0, 90),
          classYear: this.currentUser.classYear || 'Class 12',
          targetExam: this.currentUser.targetExam,
          photoURL: fbUser.photoURL || MENTOR_AVATAR_PATH,
          isGuest: false,
          currentStreak: this.currentUser.currentStreak,
          lastActiveDate: this.currentUser.lastActiveDate,
          createdAt: new Date().toISOString(),
        };
        this.currentUser = newProfile;
        if (fbUser.emailVerified) {
          try {
            await setDoc(doc(db, 'users', uid), newProfile);
          } catch (error) {
            handleFirestoreError(error, OperationType.CREATE, userPath);
          }
        }
      }
      this.saveLocal(STORAGE_KEYS.USER, this.currentUser);
      await this.syncTasksFromFirestore(uid);
      await this.syncLectureProgressFromFirestore(uid);
      await this.syncStudyPlanFromFirestore(uid);
      await this.syncLeaderboardWithFirestore(uid);
    } catch (error) {
      handleFirestoreError(error, OperationType.GET, userPath);
    }

    this.notifyAuthListeners();
  }

  private async syncTasksFromFirestore(uid: string): Promise<void> {
    const path = 'tasks';
    try {
      const q = query(collection(db, 'tasks'), where('uid', '==', uid));
      const snap = await getDocs(q);
      if (!snap.empty) {
        this.tasks = snap.docs.map((d) => d.data() as StudyTask);
        this.tasks.sort((a, b) => b.timestamp - a.timestamp);
        this.saveLocal(STORAGE_KEYS.TASKS, this.tasks);
      } else if (auth.currentUser?.emailVerified) {
        const seeded = this.tasks.map((t) => ({
          ...t,
          taskId: sanitizeId(`${uid}_${t.taskId}`),
          uid,
        }));
        this.tasks = seeded;
        this.saveLocal(STORAGE_KEYS.TASKS, this.tasks);
        for (const t of seeded) {
          await setDoc(doc(db, 'tasks', t.taskId), t);
        }
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, path);
    }
  }

  private async syncLectureProgressFromFirestore(uid: string): Promise<void> {
    const docId = sanitizeId(`${uid}_rotational_mechanics_01`);
    const path = `lecture_progress/${docId}`;
    try {
      const snap = await getDoc(doc(db, 'lecture_progress', docId));
      if (snap.exists()) {
        this.lectureProgress = snap.data() as LectureProgress;
        this.saveLocal(STORAGE_KEYS.LECTURE_PROGRESS, this.lectureProgress);
      } else if (auth.currentUser?.emailVerified) {
        this.lectureProgress = {
          ...this.lectureProgress,
          uid,
        };
        await setDoc(doc(db, 'lecture_progress', docId), this.lectureProgress);
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.GET, path);
    }
  }

  private async syncStudyPlanFromFirestore(uid: string): Promise<void> {
    const planId = 'plan_active_default';
    const path = `users/${uid}/study_plans/${planId}`;
    try {
      const snap = await getDoc(doc(db, 'users', uid, 'study_plans', planId));
      if (snap.exists()) {
        this.studyPlan = snap.data() as StudyPlan;
        this.saveLocal(STORAGE_KEYS.STUDY_PLAN, this.studyPlan);
      } else if (auth.currentUser?.emailVerified) {
        this.studyPlan = {
          ...this.studyPlan,
          planId,
          uid,
        };
        await setDoc(doc(db, 'users', uid, 'study_plans', planId), this.studyPlan);
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.GET, path);
    }
  }

  private async syncLeaderboardWithFirestore(uid: string): Promise<void> {
    this.recalculateLocalUserLeaderboardEntry();
    const myEntry = this.leaderboard.find(
      (e) => e.uid === uid || e.uid === 'local_aspirant_01'
    );
    if (myEntry && auth.currentUser?.emailVerified) {
      const syncedEntry: LeaderboardEntry = {
        ...myEntry,
        uid,
        name: this.currentUser.name,
        targetExam: this.currentUser.targetExam,
      };
      const entryPath = `leaderboard/${uid}`;
      try {
        await setDoc(doc(db, 'leaderboard', uid), syncedEntry);
      } catch (error) {
        handleFirestoreError(error, OperationType.WRITE, entryPath);
      }
    }

    const listPath = 'leaderboard';
    try {
      const q = query(
        collection(db, 'leaderboard'),
        where('compositePoints', '>=', 0),
        orderBy('compositePoints', 'desc'),
        limit(15)
      );
      const snap = await getDocs(q);
      if (!snap.empty) {
        const remoteEntries = snap.docs.map((d) => d.data() as LeaderboardEntry);
        const mergedMap = new Map<string, LeaderboardEntry>();
        for (const item of this.leaderboard) {
          mergedMap.set(item.uid, item);
        }
        for (const item of remoteEntries) {
          mergedMap.set(item.uid, item);
        }
        this.leaderboard = Array.from(mergedMap.values());
        this.saveLocal(STORAGE_KEYS.LEADERBOARD, this.leaderboard);
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, listPath);
    }
  }

  private recalculateLocalUserLeaderboardEntry(): LeaderboardEntry {
    const user = this.currentUser;
    const examSubjects = getSubjectsForExam(user.targetExam);
    const relevantTasks = this.tasks.filter((t) => examSubjects.includes(t.subject));
    const completedCount = relevantTasks.filter((t) => t.isCompleted).length;
    const taskCompletionRate =
      relevantTasks.length > 0
        ? Math.round((completedCount / relevantTasks.length) * 100)
        : 75;

    const bestSubmissionScore =
      this.submissions.length > 0
        ? Math.max(...this.submissions.map((s) => s.score))
        : 42;

    const compositePoints = calculateLeaderboardCompositePoints(
      taskCompletionRate,
      bestSubmissionScore,
      user.currentStreak
    );

    const updatedEntry: LeaderboardEntry = {
      uid: user.uid,
      name: user.name,
      targetExam: user.targetExam,
      taskCompletionRate,
      bestMockScore: bestSubmissionScore,
      currentStreak: user.currentStreak,
      compositePoints,
    };

    const existingIndex = this.leaderboard.findIndex(
      (e) =>
        e.uid === user.uid ||
        (user.uid !== 'local_aspirant_01' && e.uid === 'local_aspirant_01')
    );
    if (existingIndex >= 0) {
      this.leaderboard[existingIndex] = updatedEntry;
    } else {
      this.leaderboard.push(updatedEntry);
    }
    this.saveLocal(STORAGE_KEYS.LEADERBOARD, this.leaderboard);
    return updatedEntry;
  }

  private async pushCurrentUserLeaderboardToCloud(): Promise<void> {
    const entry = this.recalculateLocalUserLeaderboardEntry();
    if (this.isCloudAuthenticated && auth.currentUser?.emailVerified) {
      const uid = sanitizeId(auth.currentUser.uid);
      const path = `leaderboard/${uid}`;
      try {
        await setDoc(doc(db, 'leaderboard', uid), {
          ...entry,
          uid,
        });
      } catch (error) {
        handleFirestoreError(error, OperationType.WRITE, path);
      }
    }
  }

  public getLeaderboardStandings() {
    this.recalculateLocalUserLeaderboardEntry();
    return rankLeaderboardEntries(this.leaderboard, this.currentUser.uid);
  }

  public getDailyGoalTarget(): number {
    return this.dailyGoalTarget;
  }

  public updateDailyGoalTarget(target: number): number {
    this.dailyGoalTarget = Math.max(1, Math.min(20, Math.round(target)));
    this.saveLocal(STORAGE_KEYS.DAILY_GOAL_TARGET, this.dailyGoalTarget);
    return this.dailyGoalTarget;
  }

  public getStudyPlan(): StudyPlan {
    return JSON.parse(JSON.stringify(this.studyPlan)) as StudyPlan;
  }

  public async generateAndSaveStudyPlan(params: {
    targetExam: 'JEE' | 'NEET';
    dailyHours: number;
    proficiency: Record<string, ProficiencyLevel>;
  }): Promise<StudyPlan> {
    const uid =
      this.isCloudAuthenticated && auth.currentUser
        ? sanitizeId(auth.currentUser.uid)
        : this.currentUser.uid;
    const planId = 'plan_active_default';
    const plan = generatePersonalizedStudyPlan({
      uid,
      targetExam: params.targetExam,
      dailyHours: params.dailyHours,
      proficiency: params.proficiency,
      planId,
    });

    this.studyPlan = plan;
    this.saveLocal(STORAGE_KEYS.STUDY_PLAN, this.studyPlan);

    if (params.targetExam !== this.currentUser.targetExam) {
      await this.updateUser({ targetExam: params.targetExam });
    }

    if (this.isCloudAuthenticated && auth.currentUser?.emailVerified) {
      const path = `users/${uid}/study_plans/${planId}`;
      try {
        await setDoc(doc(db, 'users', uid, 'study_plans', planId), plan);
      } catch (error) {
        handleFirestoreError(error, OperationType.WRITE, path);
      }
    }
    return plan;
  }

  public async signInWithGoogle(): Promise<void> {
    const provider = new GoogleAuthProvider();
    await signInWithPopup(auth, provider);
  }

  public async signInWithEmail(email: string, password: string): Promise<void> {
    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch {
      await createUserWithEmailAndPassword(auth, email, password);
    }
  }

  public async signOutUser(): Promise<void> {
    try {
      await signOut(auth);
    } catch {
      // Ignore offline signout
    }
    this.switchRoleSession('guest');
  }

  /**
   * Switches session role for Guest Mode, Registered Student, Co-Admin/Mentor, or Master Admin.
   */
  public switchRoleSession(
    mode: 'student' | 'guest' | 'admin' | 'mentor',
    customName?: string,
    customClass?: StudentClassYear,
    customExam?: TargetExam,
    mentorEmail?: string
  ): AspirantUser {
    if (mode === 'admin') {
      this.currentUser = {
        ...this.currentUser,
        uid: 'admin_sumit_master',
        email: MASTER_ADMIN_EMAIL,
        name: 'Sumit Kumar (Master Admin)',
        classYear: 'Dropper',
        targetExam: customExam ?? this.currentUser.targetExam,
        photoURL: MENTOR_AVATAR_PATH,
        isGuest: false,
      };
    } else if (mode === 'mentor') {
      const targetMentor =
        this.getMentorByEmail(mentorEmail) ?? this.mentors[1] ?? this.mentors[0];
      this.currentUser = {
        ...this.currentUser,
        uid: targetMentor.id,
        email: targetMentor.email,
        name: `${targetMentor.name} (${targetMentor.role})`,
        classYear: 'Dropper',
        targetExam: customExam ?? this.currentUser.targetExam,
        photoURL: targetMentor.avatarUrl || MENTOR_AVATAR_PATH,
        isGuest: false,
      };
    } else if (mode === 'guest') {
      this.currentUser = {
        ...this.currentUser,
        uid: `guest_${Date.now()}`,
        email: 'guest@prepskm.in (Unregistered Guest)',
        name: customName?.trim() || 'Guest Aspirant',
        classYear: customClass ?? 'Class 12',
        targetExam: customExam ?? this.currentUser.targetExam,
        isGuest: true,
      };
    } else {
      this.currentUser = {
        ...this.currentUser,
        uid: 'local_aspirant_01',
        email: 'aarav.sharma2027@gmail.com',
        name: customName?.trim() || 'Aarav Sharma',
        classYear: customClass ?? 'Class 12',
        targetExam: customExam ?? this.currentUser.targetExam,
        isGuest: false,
      };
    }
    this.saveLocal(STORAGE_KEYS.USER, this.currentUser);
    this.notifyAuthListeners();
    return this.getUser();
  }

  public getUser(): AspirantUser {
    return { ...this.currentUser };
  }

  public async updateUser(
    partial: Partial<
      Pick<
        AspirantUser,
        'name' | 'classYear' | 'targetExam' | 'photoURL' | 'currentStreak' | 'lastActiveDate' | 'isGuest'
      >
    >
  ): Promise<AspirantUser> {
    this.currentUser = {
      ...this.currentUser,
      ...partial,
      name: (partial.name ?? this.currentUser.name).slice(0, 100),
    };
    this.saveLocal(STORAGE_KEYS.USER, this.currentUser);
    await this.pushCurrentUserLeaderboardToCloud();
    this.notifyAuthListeners();

    if (this.isCloudAuthenticated && auth.currentUser?.emailVerified) {
      const uid = sanitizeId(auth.currentUser.uid);
      const path = `users/${uid}`;
      try {
        await updateDoc(doc(db, 'users', uid), {
          name: this.currentUser.name,
          classYear: this.currentUser.classYear,
          targetExam: this.currentUser.targetExam,
          photoURL: this.currentUser.photoURL,
          currentStreak: this.currentUser.currentStreak,
          lastActiveDate: this.currentUser.lastActiveDate,
        });
      } catch (error) {
        handleFirestoreError(error, OperationType.UPDATE, path);
      }
    }
    return this.getUser();
  }

  public getTasks(): StudyTask[] {
    return [...this.tasks];
  }

  public async addTask(
    title: string,
    subject: StudyTask['subject'],
    type: StudyTask['type'],
    options?: {
      priority?: TaskPriority;
      examFocus?: TargetExam;
      dayOfWeek?: string;
      dateIso?: string;
      dailyQuotaHours?: number;
    }
  ): Promise<StudyTask> {
    const cleanTitle = title.trim().slice(0, 240);
    const uid =
      this.isCloudAuthenticated && auth.currentUser
        ? sanitizeId(auth.currentUser.uid)
        : this.currentUser.uid;
    const taskId = sanitizeId(`task_${Date.now()}_${Math.floor(Math.random() * 1000)}`);
    const newTask: StudyTask = {
      taskId,
      uid,
      title: cleanTitle,
      subject,
      type,
      priority: options?.priority ?? 'High',
      examFocus: options?.examFocus ?? this.currentUser.targetExam,
      dayOfWeek: options?.dayOfWeek ?? 'Mon',
      dateIso: options?.dateIso ?? '2026-11-04',
      dailyQuotaHours: options?.dailyQuotaHours,
      isCompleted: false,
      timestamp: Date.now(),
    };

    this.tasks = [newTask, ...this.tasks];
    this.saveLocal(STORAGE_KEYS.TASKS, this.tasks);
    await this.pushCurrentUserLeaderboardToCloud();

    try {
      await setDoc(doc(db, 'tasks', taskId), newTask);
    } catch {
      // Offline local fallback already saved
    }
    return newTask;
  }

  public async addBatchTasks(newTasks: StudyTask[]): Promise<void> {
    this.tasks = [...newTasks, ...this.tasks];
    this.saveLocal(STORAGE_KEYS.TASKS, this.tasks);
    await this.pushCurrentUserLeaderboardToCloud();

    for (const t of newTasks) {
      try {
        await setDoc(doc(db, 'tasks', t.taskId), t);
      } catch {
        // Ignore individual offline errors
      }
    }
  }

  public async toggleTaskCompletion(taskId: string): Promise<StudyTask | undefined> {
    const target = this.tasks.find((t) => t.taskId === taskId);
    if (!target) return undefined;

    target.isCompleted = !target.isCompleted;
    this.saveLocal(STORAGE_KEYS.TASKS, this.tasks);
    await this.pushCurrentUserLeaderboardToCloud();

    try {
      await setDoc(doc(db, 'tasks', taskId), target);
    } catch {
      // Offline fallback saved locally
    }
    return { ...target };
  }

  public async deleteTask(taskId: string): Promise<void> {
    this.tasks = this.tasks.filter((t) => t.taskId !== taskId);
    this.saveLocal(STORAGE_KEYS.TASKS, this.tasks);
    await this.pushCurrentUserLeaderboardToCloud();

    try {
      await deleteDoc(doc(db, 'tasks', taskId));
    } catch {
      // Offline fallback saved locally
    }
  }

  // --- Academic Structure Manager (Classes, Subjects, Chapters) ---
  public getClasses(): ClassEntity[] {
    return [...this.classes].sort((a, b) => a.order - b.order);
  }

  public async addClass(name: string): Promise<ClassEntity> {
    const item: ClassEntity = {
      id: sanitizeId(`cls_${Date.now()}`),
      name: name.trim(),
      order: this.classes.length + 1,
    };
    this.classes.push(item);
    this.saveLocal(STORAGE_KEYS.CLASSES, this.classes);
    if (this.isCloudAuthenticated && this.isMasterAdmin()) {
      try {
        await setDoc(doc(db, 'classes', item.id), item);
      } catch {
        // Fallback saved locally
      }
    }
    return item;
  }

  public async deleteClass(classId: string): Promise<void> {
    this.classes = this.classes.filter((c) => c.id !== classId);
    this.saveLocal(STORAGE_KEYS.CLASSES, this.classes);
  }

  public getSubjects(classId?: string): SubjectEntity[] {
    if (!classId || classId === 'ALL') return [...this.subjects];
    return this.subjects.filter((s) => s.classId === classId);
  }

  public async addSubject(classId: string, name: string): Promise<SubjectEntity> {
    const item: SubjectEntity = {
      id: sanitizeId(`sub_${Date.now()}`),
      classId,
      name: name.trim(),
    };
    this.subjects.push(item);
    this.saveLocal(STORAGE_KEYS.SUBJECTS, this.subjects);
    if (this.isCloudAuthenticated && this.isMasterAdmin()) {
      try {
        await setDoc(doc(db, 'subjects', item.id), item);
      } catch {
        // Fallback saved locally
      }
    }
    return item;
  }

  public async deleteSubject(subjectId: string): Promise<void> {
    this.subjects = this.subjects.filter((s) => s.id !== subjectId);
    this.saveLocal(STORAGE_KEYS.SUBJECTS, this.subjects);
  }

  public getChapters(classId?: string, subjectId?: string): ChapterEntity[] {
    return this.chapters.filter((ch) => {
      if (classId && classId !== 'ALL' && ch.classId !== classId) return false;
      if (subjectId && subjectId !== 'ALL' && ch.subjectId !== subjectId) return false;
      return true;
    });
  }

  public async addChapter(
    classId: string,
    subjectId: string,
    name: string
  ): Promise<ChapterEntity> {
    const item: ChapterEntity = {
      id: sanitizeId(`ch_${Date.now()}`),
      classId,
      subjectId,
      name: name.trim(),
    };
    this.chapters.push(item);
    this.saveLocal(STORAGE_KEYS.CHAPTERS, this.chapters);
    if (this.isCloudAuthenticated && this.isMasterAdmin()) {
      try {
        await setDoc(doc(db, 'chapters', item.id), item);
      } catch {
        // Fallback saved locally
      }
    }
    return item;
  }

  public async deleteChapter(chapterId: string): Promise<void> {
    this.chapters = this.chapters.filter((c) => c.id !== chapterId);
    this.saveLocal(STORAGE_KEYS.CHAPTERS, this.chapters);
  }

  // --- Study Material Vault & Admin Custom Categories ---
  public getVaultSections(): string[] {
    return [...this.vaultSections];
  }

  public addCustomVaultSection(sectionName: string): string[] {
    const clean = sectionName.trim();
    if (clean && !this.vaultSections.includes(clean)) {
      this.vaultSections.push(clean);
      this.saveLocal(STORAGE_KEYS.VAULT_SECTIONS, this.vaultSections);
    }
    return [...this.vaultSections];
  }

  public getMaterials(): StudyMaterialItem[] {
    return [...this.materials];
  }

  public async addMaterial(params: {
    title: string;
    section: string;
    classId: string;
    subjectId: string;
    cohortTag?: string;
    pdfUrl: string;
    thumbnailUrl?: string;
    summaryPages?: string[];
  }): Promise<StudyMaterialItem> {
    const clsObj = this.classes.find((c) => c.id === params.classId);
    const item: StudyMaterialItem = {
      id: sanitizeId(`mat_${Date.now()}`),
      title: params.title.trim(),
      section: params.section.trim(),
      classId: params.classId,
      subjectId: params.subjectId,
      cohortTag: params.cohortTag || clsObj?.name || 'JEE',
      pdfUrl: params.pdfUrl || '/materials/custom_upload.pdf',
      thumbnailUrl:
        params.thumbnailUrl ||
        '/src/assets/images/lecture_rotational_mechanics_cover_1793804167049.jpg',
      downloads: 1,
      pagesCount: params.summaryPages?.length || 2,
      summaryPages: params.summaryPages ?? [
        `PAGE 1 — ${params.title.toUpperCase()}\n\nCurated by ${this.currentUser.name} for prepskm.in Study Material Vault.\nSection: ${params.section}\n\n• High-yield definitions, dimensional verification, and direct formula application.\n• Complete all solved illustrations before attempting the timed CBT engine.`,
        `PAGE 2 — REVISION CHECKLIST & PYQ MAPPING\n\n• Verify boundary conditions and sign conventions.\n• Mark tricky steps in your Error Log notebook for final 7-day revision.`,
      ],
      createdAt: new Date().toISOString(),
    };
    this.materials = [item, ...this.materials];
    this.saveLocal(STORAGE_KEYS.MATERIALS, this.materials);
    try {
      await setDoc(doc(db, 'materials', item.id), item);
    } catch {
      // Saved locally
    }
    return item;
  }

  public async updateMaterial(
    materialId: string,
    partial: Partial<
      Pick<
        StudyMaterialItem,
        'title' | 'section' | 'classId' | 'subjectId' | 'cohortTag' | 'pdfUrl' | 'summaryPages'
      >
    >
  ): Promise<StudyMaterialItem | undefined> {
    const idx = this.materials.findIndex((m) => m.id === materialId);
    if (idx < 0) return undefined;
    const existing = this.materials[idx];
    const updated: StudyMaterialItem = {
      ...existing,
      ...partial,
      title: (partial.title ?? existing.title).trim(),
      section: (partial.section ?? existing.section).trim(),
      pagesCount: partial.summaryPages ? partial.summaryPages.length : existing.pagesCount,
    };
    this.materials[idx] = updated;
    this.saveLocal(STORAGE_KEYS.MATERIALS, this.materials);
    try {
      await setDoc(doc(db, 'materials', updated.id), updated);
    } catch {
      // Saved locally
    }
    return updated;
  }

  public async deleteMaterial(materialId: string): Promise<void> {
    this.materials = this.materials.filter((m) => m.id !== materialId);
    this.saveLocal(STORAGE_KEYS.MATERIALS, this.materials);
    try {
      await deleteDoc(doc(db, 'materials', materialId));
    } catch {
      // Ignore
    }
  }

  public async incrementMaterialDownload(materialId: string): Promise<void> {
    const mat = this.materials.find((m) => m.id === materialId);
    if (mat) {
      mat.downloads += 1;
      this.saveLocal(STORAGE_KEYS.MATERIALS, this.materials);
    }
  }

  // --- Video Lectures, Sections, Real File Uploads & Timestamped Doubts ---
  public getVideoSections(): string[] {
    const dynamicFromVideos = this.videos
      .map((v) => v.section?.trim())
      .filter((s): s is string => Boolean(s));
    const merged = Array.from(new Set([...this.videoSections, ...dynamicFromVideos]));
    return merged;
  }

  public addCustomVideoSection(sectionName: string): string[] {
    const clean = sectionName.trim();
    if (clean && !this.videoSections.includes(clean)) {
      this.videoSections.push(clean);
      this.saveLocal(STORAGE_KEYS.VIDEO_SECTIONS, this.videoSections);
    }
    return this.getVideoSections();
  }

  public getVideos(): VideoRoadmapItem[] {
    return [...this.videos];
  }

  public getVideoById(videoId?: string | null): VideoRoadmapItem {
    if (videoId) {
      const found = this.videos.find((v) => v.id === videoId);
      if (found) return found;
    }
    return this.getLatestRoadmapAnnouncement();
  }

  public getLatestRoadmapAnnouncement(): VideoRoadmapItem {
    return this.videos.find((v) => v.isNewRoadmap) ?? this.videos[0];
  }

  public async addVideoLecture(params: {
    title: string;
    description: string;
    duration: string;
    topicTag: string;
    section: string;
    classCohort?: string;
    thumbnailUrl: string;
    videoUrl: string;
    mentorId: string;
  }): Promise<VideoRoadmapItem> {
    const mentor =
      this.mentors.find((m) => m.id === params.mentorId) ?? this.mentors[0];
    const cleanSection = params.section.trim() || 'Master Roadmaps';
    this.addCustomVideoSection(cleanSection);
    const item: VideoRoadmapItem = {
      id: sanitizeId(`vid_${Date.now()}`),
      title: params.title.trim(),
      description: params.description.trim() || 'High-yield strategy & PYQ masterclass lecture.',
      duration: params.duration.trim() || '25:00',
      topicTag: params.topicTag.trim() || `${cleanSection} · ${mentor.subjectSpecialty}`,
      section: cleanSection,
      classCohort: params.classCohort || 'Class 12',
      thumbnailUrl: params.thumbnailUrl,
      videoUrl: params.videoUrl,
      isNewRoadmap: true,
      mentorId: mentor.id,
      mentorName: mentor.name,
      mentorEmail: mentor.email,
      mentorRole: `${mentor.role} · ${mentor.subjectSpecialty}`,
      mentorAvatar: mentor.avatarUrl,
      createdAt: new Date().toISOString(),
    };
    this.videos = [item, ...this.videos];
    this.saveLocal(STORAGE_KEYS.VIDEOS, this.videos);
    try {
      await setDoc(doc(db, 'videos', item.id), item);
    } catch {
      // Saved locally
    }
    return item;
  }

  public async updateVideoLecture(
    videoId: string,
    partial: Partial<Pick<VideoRoadmapItem, 'title' | 'description' | 'section' | 'duration' | 'videoUrl' | 'classCohort'>>
  ): Promise<VideoRoadmapItem | undefined> {
    const idx = this.videos.findIndex((v) => v.id === videoId);
    if (idx < 0) return undefined;
    if (partial.section) this.addCustomVideoSection(partial.section);
    const updated: VideoRoadmapItem = {
      ...this.videos[idx],
      ...partial,
    };
    this.videos[idx] = updated;
    this.saveLocal(STORAGE_KEYS.VIDEOS, this.videos);
    try {
      await setDoc(doc(db, 'videos', updated.id), updated);
    } catch {
      // Saved locally
    }
    return updated;
  }

  public async deleteVideoLecture(videoId: string): Promise<void> {
    if (this.videos.length <= 1) return;
    this.videos = this.videos.filter((v) => v.id !== videoId);
    this.saveLocal(STORAGE_KEYS.VIDEOS, this.videos);
    try {
      await deleteDoc(doc(db, 'videos', videoId));
    } catch {
      // Ignore
    }
  }

  public getVideoDoubts(videoId?: string): VideoDoubtItem[] {
    if (!videoId) return [...this.videoDoubts];
    return this.videoDoubts.filter((d) => d.videoId === videoId);
  }

  public async addVideoDoubt(params: {
    videoId: string;
    videoTitle: string;
    timestampSec: number;
    timestampFormatted: string;
    doubtText: string;
    attachmentDataUrl?: string;
    mentorId?: string;
    mentorName?: string;
  }): Promise<VideoDoubtItem> {
    const user = this.currentUser;
    const cleanDoubt = params.doubtText.trim().slice(0, 1500);
    const roundedSec = Math.max(0, Math.round(params.timestampSec));
    const item: VideoDoubtItem = {
      id: sanitizeId(`doubt_${Date.now()}`),
      videoId: params.videoId,
      videoTitle: params.videoTitle,
      studentId: user.uid,
      studentName: user.name,
      timestampSeconds: roundedSec,
      timestampSec: roundedSec,
      timestampFormatted: params.timestampFormatted,
      questionText: cleanDoubt,
      doubtText: cleanDoubt,
      attachmentDataUrl: params.attachmentDataUrl,
      mentorId: params.mentorId,
      mentorName: params.mentorName,
      createdAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };
    this.videoDoubts = [item, ...this.videoDoubts];
    this.saveLocal(STORAGE_KEYS.VIDEO_DOUBTS, this.videoDoubts);

    if (this.isCloudAuthenticated) {
      try {
        await setDoc(doc(db, 'video_doubts', item.id), item);
      } catch {
        // Saved locally
      }
    }
    return item;
  }

  public async replyToVideoDoubt(doubtId: string, replyText: string): Promise<void> {
    const found = this.videoDoubts.find((d) => d.id === doubtId);
    if (!found) return;
    found.mentorReply = replyText.trim();
    this.saveLocal(STORAGE_KEYS.VIDEO_DOUBTS, this.videoDoubts);
    if (this.isCloudAuthenticated) {
      try {
        await setDoc(doc(db, 'video_doubts', found.id), found);
      } catch {
        // Saved locally
      }
    }
  }

  // --- Mentors / Co-Admins Directory ---
  public getMentors(): MentorProfileItem[] {
    return [...this.mentors];
  }

  public async addMentor(params: {
    name: string;
    email: string;
    role: 'Master Admin' | 'Co-Admin & Mentor' | 'Video Mentor';
    subjectSpecialty: string;
    qualification: string;
    avatarUrl?: string;
  }): Promise<MentorProfileItem> {
    const cleanEmail = params.email.trim();
    const cleanName = params.name.trim();
    const id = sanitizeId(`mentor_${cleanName.toLowerCase()}_${Date.now()}`);
    const jitsiSlug = sanitizeId(`prepskm_${cleanName.toLowerCase()}`);
    const item: MentorProfileItem = {
      id,
      name: cleanName,
      email: cleanEmail,
      roleTitle: `${params.role} (${params.qualification.trim() || 'Subject Expert'})`,
      role: params.role,
      subjectSpecialty: params.subjectSpecialty.trim() || 'Physics & Strategy',
      qualification: params.qualification.trim() || 'Subject Expert',
      avatarUrl: params.avatarUrl?.trim() || MENTOR_AVATAR_PATH,
      isOnline: true,
      jitsiRoomSlug: jitsiSlug,
      jitsiRoomPrefix: jitsiSlug,
      createdAt: new Date().toISOString(),
    };
    this.mentors.push(item);
    this.saveLocal(STORAGE_KEYS.MENTORS, this.mentors);

    try {
      await setDoc(doc(db, 'mentors', item.id), item);
    } catch {
      // Saved locally
    }
    return item;
  }

  public async toggleMentorOnlineStatus(
    mentorId: string,
    isOnline?: boolean
  ): Promise<MentorProfileItem | undefined> {
    const mentor = this.mentors.find((m) => m.id === mentorId);
    if (!mentor) return undefined;
    mentor.isOnline = isOnline !== undefined ? isOnline : !mentor.isOnline;
    this.saveLocal(STORAGE_KEYS.MENTORS, this.mentors);
    try {
      await setDoc(doc(db, 'mentors', mentor.id), mentor);
    } catch {
      // Saved locally
    }
    return { ...mentor };
  }

  public async deleteMentor(mentorId: string): Promise<void> {
    // Prevent deleting Master Admin Sumit
    if (mentorId === 'mentor_sumit_master') return;
    this.mentors = this.mentors.filter((m) => m.id !== mentorId);
    this.saveLocal(STORAGE_KEYS.MENTORS, this.mentors);
    try {
      await deleteDoc(doc(db, 'mentors', mentorId));
    } catch {
      // Ignore
    }
  }

  // --- Real-Time Firebase Streak-At-Risk Notifications ---
  public onStreakNotificationChange(
    cb: (notifications: StreakNotificationItem[]) => void
  ): () => void {
    this.streakListeners.push(cb);
    cb(this.getStreakNotifications());
    return () => {
      this.streakListeners = this.streakListeners.filter((fn) => fn !== cb);
    };
  }

  private notifyStreakListeners(): void {
    const list = this.getStreakNotifications();
    for (const cb of this.streakListeners) {
      cb(list);
    }
  }

  public getStreakNotifications(): StreakNotificationItem[] {
    return [...this.streakNotifications];
  }

  public evaluateCurrentStreakRisk() {
    const todayIso = '2026-11-04';
    const completedTasksToday = this.tasks.filter(
      (t) => (t.dateIso === todayIso || t.type === 'Today') && t.isCompleted
    ).length;
    return evaluateStreakRiskStatus({
      uid: this.currentUser.uid,
      studentName: this.currentUser.name,
      currentStreak: this.currentUser.currentStreak,
      lastActiveDate: this.currentUser.lastActiveDate,
      todayIso,
      completedTasksToday,
      currentHour24: 20,
    });
  }

  public async triggerStreakRiskNotification(
    customNote?: string
  ): Promise<StreakNotificationItem> {
    const risk = this.evaluateCurrentStreakRisk();
    const item: StreakNotificationItem = {
      id: sanitizeId(`streak_notif_${Date.now()}`),
      ...risk.notificationPayload,
      message: customNote?.trim() || risk.notificationPayload.message,
      isRead: false,
      createdAt: new Date().toISOString(),
    };
    this.streakNotifications = [item, ...this.streakNotifications.slice(0, 14)];
    this.saveLocal(STORAGE_KEYS.STREAK_NOTIFICATIONS, this.streakNotifications);
    this.notifyStreakListeners();

    if (
      typeof window !== 'undefined' &&
      'Notification' in window &&
      Notification.permission === 'granted'
    ) {
      try {
        new Notification(item.title, { body: item.message });
      } catch {
        // Ignore browser notification errors in headless/iframe
      }
    }

    try {
      await setDoc(doc(db, 'streak_notifications', item.id), item);
    } catch {
      // Saved locally
    }
    return item;
  }

  public markStreakNotificationRead(id: string): void {
    const found = this.streakNotifications.find((n) => n.id === id);
    if (found) {
      found.isRead = true;
      this.saveLocal(STORAGE_KEYS.STREAK_NOTIFICATIONS, this.streakNotifications);
      this.notifyStreakListeners();
    }
  }

  // --- Global Broadcast Messages to All Students ---
  public getBroadcasts(): BroadcastMessageItem[] {
    return [...this.broadcasts];
  }

  public async sendBroadcast(params: {
    title: string;
    message: string;
    targetCohort: string;
    badgeType: 'ANNOUNCEMENT' | 'URGENT' | 'LIVE_CLASS' | 'TEST_ALERT';
    actionLink?: string;
  }): Promise<BroadcastMessageItem> {
    const item: BroadcastMessageItem = {
      id: sanitizeId(`bcast_${Date.now()}`),
      title: params.title.trim().slice(0, 180),
      message: params.message.trim().slice(0, 1200),
      senderName: this.currentUser.name,
      senderEmail: this.currentUser.email,
      targetCohort: params.targetCohort || 'ALL',
      badge: params.badgeType,
      badgeType: params.badgeType,
      actionLink: params.actionLink?.trim() || '/mentorship.html',
      ctaLabel: 'Open',
      ctaHref: params.actionLink?.trim() || '/mentorship.html',
      createdAt: new Date().toISOString(),
    };
    this.broadcasts = [item, ...this.broadcasts];
    this.saveLocal(STORAGE_KEYS.BROADCASTS, this.broadcasts);

    try {
      await setDoc(doc(db, 'broadcasts', item.id), item);
    } catch {
      // Saved locally
    }
    return item;
  }

  public async deleteBroadcast(broadcastId: string): Promise<void> {
    this.broadcasts = this.broadcasts.filter((b) => b.id !== broadcastId);
    this.saveLocal(STORAGE_KEYS.BROADCASTS, this.broadcasts);
    try {
      await deleteDoc(doc(db, 'broadcasts', broadcastId));
    } catch {
      // Ignore
    }
  }

  // --- Whole-Website Theme, Custom Logo/Icon & Inline Pencil Visual Editor ---
  public getSiteTheme(): SiteThemeSettings {
    return { ...this.siteTheme };
  }

  public async updateSiteTheme(
    partial: Partial<Omit<SiteThemeSettings, 'updatedAt'>>
  ): Promise<SiteThemeSettings> {
    this.siteTheme = {
      ...this.siteTheme,
      ...partial,
      updatedAt: new Date().toISOString(),
    };
    this.saveLocal(STORAGE_KEYS.SITE_THEME, this.siteTheme);
    this.applySiteThemeToDocument();

    try {
      await setDoc(doc(db, 'site_settings', 'global'), this.siteTheme);
    } catch {
      // Saved locally
    }
    return this.getSiteTheme();
  }

  public async saveElementStyleOverride(
    selectorKey: string,
    override: Omit<ElementStyleOverride, 'selectorKey'>
  ): Promise<SiteThemeSettings> {
    const existingOverrides = { ...(this.siteTheme.elementOverrides || {}) };
    existingOverrides[selectorKey] = {
      ...(existingOverrides[selectorKey] || {}),
      ...override,
      selectorKey,
    };
    return this.updateSiteTheme({ elementOverrides: existingOverrides });
  }

  public async clearElementStyleOverrides(): Promise<SiteThemeSettings> {
    return this.updateSiteTheme({ elementOverrides: {} });
  }

  public applySiteThemeToDocument(): void {
    if (typeof document === 'undefined') return;
    const root = document.documentElement;
    root.style.setProperty('--brand-primary', this.siteTheme.primaryColor);
    root.style.setProperty('--brand-secondary', this.siteTheme.secondaryColor);
    root.style.setProperty('--brand-accent', this.siteTheme.accentColor);
    root.style.setProperty('--surface-bg', this.siteTheme.surfaceBg);

    let dynamicStyle = document.getElementById('prepskm-dynamic-theme-style');
    if (!dynamicStyle) {
      dynamicStyle = document.createElement('style');
      dynamicStyle.id = 'prepskm-dynamic-theme-style';
      document.head.appendChild(dynamicStyle);
    }
    dynamicStyle.textContent = `
      :root {
        --brand-primary: ${this.siteTheme.primaryColor};
        --brand-secondary: ${this.siteTheme.secondaryColor};
        --brand-accent: ${this.siteTheme.accentColor};
        --surface-bg: ${this.siteTheme.surfaceBg};
      }
      .bg-\\[\\#4F46E5\\] { background-color: ${this.siteTheme.primaryColor} !important; }
      .text-\\[\\#4F46E5\\] { color: ${this.siteTheme.primaryColor} !important; }
      .border-\\[\\#4F46E5\\] { border-color: ${this.siteTheme.primaryColor} !important; }
      .bg-\\[\\#10B981\\] { background-color: ${this.siteTheme.secondaryColor} !important; }
      .text-\\[\\#10B981\\] { color: ${this.siteTheme.secondaryColor} !important; }
      .border-\\[\\#10B981\\] { border-color: ${this.siteTheme.secondaryColor} !important; }
      .bg-\\[\\#F59E0B\\] { background-color: ${this.siteTheme.accentColor} !important; }
      .text-\\[\\#F59E0B\\] { color: ${this.siteTheme.accentColor} !important; }
    `;

    // Apply inline element overrides saved via the Admin Floating Pencil Editor
    const overrides = this.siteTheme.elementOverrides;
    if (overrides && typeof document !== 'undefined') {
      window.requestAnimationFrame(() => {
        for (const key of Object.keys(overrides)) {
          const item = overrides[key];
          if (!item) continue;
          const elements = document.querySelectorAll<HTMLElement>(
            `[data-edit-key="${key}"], ${key.startsWith('#') || key.startsWith('.') ? key : `[data-edit-key="${key}"]`}`
          );
          elements.forEach((el) => {
            if (item.text !== undefined && item.text.trim() !== '') {
              el.textContent = item.text;
            }
            if (item.color) {
              el.style.color = item.color;
            }
            if (item.bgColor) {
              el.style.backgroundColor = item.bgColor;
            }
          });
        }
      });
    }
  }

  // --- 1:1 Mentorship Hub & Admin Mentorship Desk ---
  public getMentorshipSessions(): MentorshipSessionItem[] {
    return [...this.mentorshipSessions];
  }

  public async createMentorshipRequest(params: {
    requestType: 'CHAT' | 'AUDIO' | 'VIDEO';
    initialMessage: string;
    mentorId?: string;
    mentorName?: string;
  }): Promise<MentorshipSessionItem> {
    const user = this.currentUser;
    const mentor =
      this.mentors.find((m) => m.id === params.mentorId) ?? this.mentors[0];
    const nowTime = new Date().toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    });

    const jitsiRoom = `${mentor.jitsiRoomPrefix}_${sanitizeId(user.uid).slice(0, 18)}`;

    const newSession: MentorshipSessionItem = {
      id: sanitizeId(`ment_${Date.now()}`),
      studentId: user.uid,
      studentName: user.name,
      studentClass: `${user.classYear} · ${user.targetExam}`,
      mentorId: mentor.id,
      mentorName: mentor.name,
      jitsiRoom,
      requestType: params.requestType,
      status: 'PENDING',
      messages: [
        {
          id: `msg_${Date.now()}`,
          senderName: user.name,
          senderRole: 'student',
          text:
            params.initialMessage.trim() ||
            `Requested a 1:1 ${params.requestType} mentorship session with ${mentor.name}.`,
          timestamp: nowTime,
        },
      ],
      updatedAt: new Date().toISOString(),
    };

    this.mentorshipSessions = [newSession, ...this.mentorshipSessions];
    this.saveLocal(STORAGE_KEYS.MENTORSHIP, this.mentorshipSessions);

    if (this.isCloudAuthenticated) {
      try {
        await setDoc(doc(db, 'mentorship', newSession.id), newSession);
      } catch {
        // Saved locally
      }
    }
    return newSession;
  }

  public async sendMentorshipMessage(
    sessionId: string,
    text: string,
    senderRole: 'student' | 'admin',
    customSenderName?: string
  ): Promise<MentorshipSessionItem | undefined> {
    const session = this.mentorshipSessions.find((s) => s.id === sessionId);
    if (!session) return undefined;

    const nowTime = new Date().toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    });
    session.messages.push({
      id: `msg_${Date.now()}`,
      senderName:
        customSenderName ||
        (senderRole === 'admin'
          ? session.mentorName || 'Sumit Kumar (Mentor)'
          : this.currentUser.name),
      senderRole,
      text: text.trim(),
      timestamp: nowTime,
    });
    if (senderRole === 'admin' && session.status === 'PENDING') {
      session.status = 'ACTIVE';
    }
    session.updatedAt = new Date().toISOString();
    this.saveLocal(STORAGE_KEYS.MENTORSHIP, this.mentorshipSessions);

    if (this.isCloudAuthenticated) {
      try {
        await setDoc(doc(db, 'mentorship', session.id), session);
      } catch {
        // Saved locally
      }
    }
    return { ...session };
  }

  public async updateMentorshipStatus(
    sessionId: string,
    status: 'PENDING' | 'ACTIVE' | 'COMPLETED'
  ): Promise<void> {
    const session = this.mentorshipSessions.find((s) => s.id === sessionId);
    if (!session) return;
    session.status = status;
    session.updatedAt = new Date().toISOString();
    this.saveLocal(STORAGE_KEYS.MENTORSHIP, this.mentorshipSessions);
  }

  // --- Dual-Crop Admin Question Workbench & Merged Question Pool ---
  public getAdminQuestions(): AdminQuestionItem[] {
    return [...this.adminQuestions];
  }

  public async addAdminQuestion(
    item: Omit<AdminQuestionItem, 'id' | 'createdAt'>
  ): Promise<AdminQuestionItem> {
    const compressedQ = await compressImageDataUrl(item.questionImg);
    const compressedS = await compressImageDataUrl(item.solutionImg);
    const record: AdminQuestionItem = {
      ...item,
      chapterId: item.chapterId || 'ch_general',
      chapterName: item.chapterName || item.prompt.slice(0, 60) || item.subjectName,
      questionImg: compressedQ,
      solutionImg: compressedS,
      id: sanitizeId(`q_admin_${Date.now()}`),
      createdAt: new Date().toISOString(),
    };
    this.adminQuestions = [record, ...this.adminQuestions];
    this.saveLocal(STORAGE_KEYS.ADMIN_QUESTIONS, this.adminQuestions);

    try {
      await setDoc(doc(db, 'questions', record.id), record);
    } catch {
      // Saved locally
    }
    return record;
  }

  public async deleteAdminQuestion(questionId: string): Promise<void> {
    this.adminQuestions = this.adminQuestions.filter((q) => q.id !== questionId);
    this.saveLocal(STORAGE_KEYS.ADMIN_QUESTIONS, this.adminQuestions);
    try {
      await deleteDoc(doc(db, 'questions', questionId));
    } catch {
      // Ignore
    }
  }

  public getMergedQuestionBank(): CBTQuestion[] {
    const convertedAdmin: CBTQuestion[] = this.adminQuestions.map((aq, idx) => ({
      id: aq.id,
      number: idx + 1,
      subject: aq.subjectName,
      type: aq.type === 'NUMERICAL' ? 'NAT' : 'MCQ',
      topic: aq.chapterName || aq.prompt.slice(0, 50) || aq.subjectName,
      classId: aq.classId,
      chapterId: aq.chapterId || 'ch_rotational',
      prompt: aq.prompt,
      questionImg: aq.questionImg,
      solutionImg: aq.solutionImg,
      options: aq.options ?? ['Option A', 'Option B', 'Option C', 'Option D'],
      correctAnswer: aq.correctVal,
      solution: aq.solutionText || 'See cropped step-by-step solution diagram.',
    }));
    return [...convertedAdmin, ...CBT_QUESTION_BANK];
  }

  public getLectureProgress(): LectureProgress {
    return { ...this.lectureProgress };
  }

  public async saveLectureProgress(
    partial: Partial<Pick<LectureProgress, 'lastPositionSeconds' | 'completed' | 'notes'>>
  ): Promise<LectureProgress> {
    const uid =
      this.isCloudAuthenticated && auth.currentUser
        ? sanitizeId(auth.currentUser.uid)
        : this.currentUser.uid;
    this.lectureProgress = {
      ...this.lectureProgress,
      ...partial,
      uid,
      lastPositionSeconds: Math.max(
        0,
        Math.min(
          86400,
          Math.floor(partial.lastPositionSeconds ?? this.lectureProgress.lectureId ? (partial.lastPositionSeconds ?? this.lectureProgress.lastPositionSeconds) : 0)
        )
      ),
      notes: (partial.notes ?? this.lectureProgress.notes).slice(0, 10000),
    };
    this.saveLocal(STORAGE_KEYS.LECTURE_PROGRESS, this.lectureProgress);

    if (this.isCloudAuthenticated && auth.currentUser?.emailVerified) {
      const docId = sanitizeId(`${uid}_${this.lectureProgress.lectureId}`);
      const path = `lecture_progress/${docId}`;
      try {
        await setDoc(doc(db, 'lecture_progress', docId), this.lectureProgress);
      } catch (error) {
        handleFirestoreError(error, OperationType.WRITE, path);
      }
    }
    return this.getLectureProgress();
  }

  public getLiveSession(): LiveSession {
    return JSON.parse(JSON.stringify(this.liveSession)) as LiveSession;
  }

  public async saveLiveSession(session: LiveSession): Promise<void> {
    this.liveSession = JSON.parse(JSON.stringify(session)) as LiveSession;
    this.saveLocal(STORAGE_KEYS.LIVE_SESSION, this.liveSession);

    if (this.isCloudAuthenticated && auth.currentUser?.emailVerified) {
      const path = `live_sessions/${session.sessionId}`;
      try {
        await setDoc(doc(db, 'live_sessions', session.sessionId), this.liveSession);
      } catch (error) {
        handleFirestoreError(error, OperationType.WRITE, path);
      }
    }
  }

  public getTestSubmissions(): TestSubmission[] {
    return [...this.submissions];
  }

  public async saveTestSubmission(submission: TestSubmission): Promise<void> {
    const uid =
      this.isCloudAuthenticated && auth.currentUser
        ? sanitizeId(auth.currentUser.uid)
        : this.currentUser.uid;
    const subId = sanitizeId(`sub_${uid}_${Date.now()}`);
    const record: TestSubmission = {
      ...submission,
      uid,
      testId: sanitizeId(submission.testId || subId),
      timestamp: submission.timestamp || new Date().toISOString(),
    };
    this.submissions = [record, ...this.submissions];
    this.saveLocal(STORAGE_KEYS.TEST_SUBMISSIONS, this.submissions);
    await this.pushCurrentUserLeaderboardToCloud();

    try {
      await setDoc(doc(db, 'test_submissions', subId), record);
      await setDoc(doc(db, 'tests', subId), {
        userId: uid,
        examType: record.examType ?? this.currentUser.targetExam,
        totalQuestions: record.totalQuestions ?? 15,
        score: record.score,
        accuracy: record.accuracyPercent ?? 0,
        timestamp: record.timestamp,
      });
    } catch {
      // Saved locally
    }
  }
}

export const dataStore = new PrepskmDataStore();
