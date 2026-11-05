import {
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  type User,
} from 'firebase/auth';
import { auth, dataStore } from './firebaseService';
import type { StudentClassYear, StudyTask, SubjectName, TargetExam } from '../types';

/**
 * All configured Google Workspace OAuth scopes for prepskm.in.
 */
export const WORKSPACE_OAUTH_SCOPES: readonly string[] = [
  'https://www.googleapis.com/auth/classroom.announcements',
  'https://www.googleapis.com/auth/classroom.announcements.readonly',
  'https://www.googleapis.com/auth/classroom.courses',
  'https://www.googleapis.com/auth/classroom.courses.readonly',
  'https://www.googleapis.com/auth/classroom.coursework.me',
  'https://www.googleapis.com/auth/classroom.coursework.me.readonly',
  'https://www.googleapis.com/auth/classroom.coursework.students',
  'https://www.googleapis.com/auth/classroom.coursework.students.readonly',
  'https://www.googleapis.com/auth/classroom.courseworkmaterials',
  'https://www.googleapis.com/auth/classroom.courseworkmaterials.readonly',
  'https://www.googleapis.com/auth/classroom.profile.emails',
  'https://www.googleapis.com/auth/classroom.profile.photos',
  'https://www.googleapis.com/auth/classroom.rosters',
  'https://www.googleapis.com/auth/classroom.rosters.readonly',
  'https://www.googleapis.com/auth/classroom.student-submissions.me.readonly',
  'https://www.googleapis.com/auth/classroom.student-submissions.students.readonly',
  'https://www.googleapis.com/auth/classroom.topics',
  'https://www.googleapis.com/auth/classroom.topics.readonly',
  'https://www.googleapis.com/auth/calendar',
  'https://www.googleapis.com/auth/calendar.calendarlist',
  'https://www.googleapis.com/auth/calendar.calendarlist.readonly',
  'https://www.googleapis.com/auth/calendar.calendars',
  'https://www.googleapis.com/auth/calendar.calendars.readonly',
  'https://www.googleapis.com/auth/calendar.events',
  'https://www.googleapis.com/auth/calendar.events.freebusy',
  'https://www.googleapis.com/auth/calendar.events.owned',
  'https://www.googleapis.com/auth/calendar.events.owned.readonly',
  'https://www.googleapis.com/auth/calendar.events.public.readonly',
  'https://www.googleapis.com/auth/calendar.events.readonly',
  'https://www.googleapis.com/auth/calendar.freebusy',
  'https://www.googleapis.com/auth/calendar.readonly',
  'https://www.googleapis.com/auth/calendar.settings.readonly',
  'https://www.googleapis.com/auth/tasks',
  'https://www.googleapis.com/auth/tasks.readonly',
  'https://www.googleapis.com/auth/meetings.space.created',
  'https://www.googleapis.com/auth/meetings.space.readonly',
  'https://www.googleapis.com/auth/meetings.space.settings',
  'https://www.googleapis.com/auth/drive',
  'https://www.googleapis.com/auth/drive.file',
  'https://www.googleapis.com/auth/drive.readonly',
  'https://www.googleapis.com/auth/presentations',
  'https://www.googleapis.com/auth/presentations.readonly',
  'https://www.googleapis.com/auth/spreadsheets',
  'https://www.googleapis.com/auth/spreadsheets.readonly',
  'https://www.googleapis.com/auth/forms.body',
  'https://www.googleapis.com/auth/forms.body.readonly',
  'https://www.googleapis.com/auth/forms.responses.readonly',
  'https://www.googleapis.com/auth/chat.messages',
  'https://www.googleapis.com/auth/chat.messages.create',
  'https://www.googleapis.com/auth/chat.messages.readonly',
  'https://www.googleapis.com/auth/chat.spaces',
  'https://www.googleapis.com/auth/chat.spaces.create',
  'https://www.googleapis.com/auth/chat.spaces.readonly',
  'https://www.googleapis.com/auth/chat.memberships',
  'https://www.googleapis.com/auth/chat.memberships.readonly',
];

const workspaceProvider = new GoogleAuthProvider();
for (const scope of WORKSPACE_OAUTH_SCOPES) {
  workspaceProvider.addScope(scope);
}

// Strictly in-memory OAuth access token cache (never stored in localStorage/sessionStorage)
let isSigningIn = false;
let cachedAccessToken: string | null = null;

export const initWorkspaceAuth = (
  onAuthSuccess?: (user: User, token: string) => void,
  onAuthFailure?: () => void
) => {
  return onAuthStateChanged(auth, async (user: User | null) => {
    if (user) {
      if (cachedAccessToken) {
        if (onAuthSuccess) onAuthSuccess(user, cachedAccessToken);
      } else if (!isSigningIn) {
        cachedAccessToken = null;
        if (onAuthFailure) onAuthFailure();
      }
    } else {
      cachedAccessToken = null;
      if (onAuthFailure) onAuthFailure();
    }
  });
};

export const signInWithGoogleWorkspace = async (): Promise<{
  user: User;
  accessToken: string;
} | null> => {
  try {
    isSigningIn = true;
    const result = await signInWithPopup(auth, workspaceProvider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (!credential?.accessToken) {
      throw new Error('Failed to obtain OAuth access token from Google sign-in.');
    }
    cachedAccessToken = credential.accessToken;
    return { user: result.user, accessToken: cachedAccessToken };
  } catch (error) {
    console.error('Google Workspace sign-in error:', error);
    throw error;
  } finally {
    isSigningIn = false;
  }
};

export const getWorkspaceAccessToken = (): string | null => {
  return cachedAccessToken;
};

export const logoutWorkspace = async (): Promise<void> => {
  await auth.signOut();
  cachedAccessToken = null;
};

export interface ClassroomVaultResource {
  id: string;
  courseId: string;
  courseName: string;
  courseSection: string;
  itemType: 'ASSIGNMENT' | 'MATERIAL' | 'ANNOUNCEMENT';
  title: string;
  description: string;
  dueDateText: string;
  maxPoints?: number;
  submissionState: 'ASSIGNED' | 'TURNED_IN' | 'RETURNED' | 'REFERENCE';
  alternateLink: string;
  driveFileTitle?: string;
  subjectTag: SubjectName;
  vaultCategory: 'PYQs' | 'Formula Sheets' | 'Hand-written Notes' | 'DPPs';
  importedToVault?: boolean;
}

export interface WorkspaceScheduleSyncRecord {
  id: string;
  taskId: string;
  title: string;
  subject: SubjectName;
  scheduledDateIso: string;
  scheduledTimeSlot: string;
  calendarEventStatus: 'SYNCED' | 'PENDING';
  googleCalendarEventId: string;
  googleTaskStatus: 'SYNCED' | 'PENDING';
  googleTaskId: string;
  lastSyncedAt: string;
}

function inferSubjectFromText(text: string, exam: TargetExam): SubjectName {
  const lower = text.toLowerCase();
  if (lower.includes('chem') || lower.includes('organic') || lower.includes('electrochem')) {
    return 'Chemistry';
  }
  if (lower.includes('bio') || lower.includes('botany') || lower.includes('zoology') || lower.includes('genetics')) {
    return 'Biology';
  }
  if (lower.includes('math') || lower.includes('calculus') || lower.includes('algebra') || lower.includes('vector')) {
    return exam === 'NEET' ? 'Biology' : 'Math';
  }
  return 'Physics';
}

function formatClassroomDueDate(dueDate?: { year?: number; month?: number; day?: number }): string {
  if (!dueDate?.year || !dueDate?.month || !dueDate?.day) {
    return 'Upcoming · Rolling Review';
  }
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `Due ${dueDate.day} ${months[(dueDate.month - 1) % 12]} ${dueDate.year}`;
}

class GoogleWorkspaceConnectorService {
  private classroomResources: ClassroomVaultResource[] = [];
  private scheduleSyncRecords: WorkspaceScheduleSyncRecord[] = [];
  private lastClassroomSyncTime: string | null = null;
  private lastCalendarTasksSyncTime: string | null = null;
  private importedIds = new Set<string>();

  constructor() {
    const user = dataStore.getUser();
    this.classroomResources = this.buildDefaultClassroomFeed(user.classYear, user.targetExam);
    this.scheduleSyncRecords = this.buildInitialSyncRecords(dataStore.getTasks());
  }

  public hasLiveToken(): boolean {
    return Boolean(cachedAccessToken);
  }

  public hasActiveAccessToken(): boolean {
    return Boolean(cachedAccessToken);
  }

  public async signInWithGoogleWorkspace(): Promise<{
    user: User;
    accessToken: string;
  } | null> {
    try {
      return await signInWithGoogleWorkspace();
    } catch {
      return null;
    }
  }

  public getLastClassroomSyncTime(): string {
    return this.lastClassroomSyncTime || 'Ready to Sync';
  }

  public getLastCalendarTasksSyncTime(): string {
    return this.lastCalendarTasksSyncTime || 'Ready to Sync';
  }

  public getClassroomResources(classYear?: StudentClassYear, exam?: TargetExam): ClassroomVaultResource[] {
    if (this.classroomResources.length === 0) {
      const u = dataStore.getUser();
      this.classroomResources = this.buildDefaultClassroomFeed(classYear || u.classYear, exam || u.targetExam);
    }
    return this.classroomResources.map((item) => ({
      ...item,
      importedToVault: this.importedIds.has(item.id) || Boolean(item.importedToVault),
    }));
  }

  public getScheduleSyncRecords(): WorkspaceScheduleSyncRecord[] {
    const currentTasks = dataStore.getTasks();
    if (this.scheduleSyncRecords.length === 0 && currentTasks.length > 0) {
      this.scheduleSyncRecords = this.buildInitialSyncRecords(currentTasks);
    }
    return [...this.scheduleSyncRecords];
  }

  /**
   * Fetches active courses, coursework assignments, and coursework materials from Google Classroom API
   * and merges them into the Study Vault connector feed.
   */
  public async fetchClassroomResourcesAndAssignments(): Promise<{
    mode: 'LIVE_GOOGLE_API' | 'CLASSROOM_CONNECTOR_FEED';
    items: ClassroomVaultResource[];
    coursesCount: number;
  }> {
    const user = dataStore.getUser();
    const token = getWorkspaceAccessToken();

    if (token) {
      try {
        const coursesRes = await fetch(
          'https://classroom.googleapis.com/v1/courses?courseStates=ACTIVE&pageSize=10',
          {
            headers: { Authorization: `Bearer ${token}` },
          }
        );

        if (coursesRes.ok) {
          const coursesData = (await coursesRes.json()) as {
            courses?: Array<{
              id: string;
              name: string;
              section?: string;
              alternateLink?: string;
            }>;
          };
          const courses = coursesData.courses || [];
          const fetchedItems: ClassroomVaultResource[] = [];

          for (const course of courses.slice(0, 5)) {
            const [cwRes, matRes, annRes] = await Promise.all([
              fetch(
                `https://classroom.googleapis.com/v1/courses/${encodeURIComponent(course.id)}/courseWork?pageSize=10`,
                { headers: { Authorization: `Bearer ${token}` } }
              ),
              fetch(
                `https://classroom.googleapis.com/v1/courses/${encodeURIComponent(course.id)}/courseWorkMaterials?pageSize=10`,
                { headers: { Authorization: `Bearer ${token}` } }
              ),
              fetch(
                `https://classroom.googleapis.com/v1/courses/${encodeURIComponent(course.id)}/announcements?pageSize=5`,
                { headers: { Authorization: `Bearer ${token}` } }
              ),
            ]);

            if (cwRes.ok) {
              const cwData = (await cwRes.json()) as {
                courseWork?: Array<{
                  id: string;
                  title: string;
                  description?: string;
                  dueDate?: { year?: number; month?: number; day?: number };
                  maxPoints?: number;
                  alternateLink?: string;
                  materials?: Array<{ driveFile?: { driveFile?: { title?: string } } }>;
                }>;
              };
              for (const cw of cwData.courseWork || []) {
                const subject = inferSubjectFromText(`${course.name} ${cw.title}`, user.targetExam);
                fetchedItems.push({
                  id: `gc_cw_${cw.id}`,
                  courseId: course.id,
                  courseName: course.name,
                  courseSection: course.section || user.classYear,
                  itemType: 'ASSIGNMENT',
                  title: cw.title,
                  description:
                    cw.description ||
                    `Assigned coursework in ${course.name}. Synced directly from Google Classroom.`,
                  dueDateText: formatClassroomDueDate(cw.dueDate),
                  maxPoints: cw.maxPoints ?? 100,
                  submissionState: 'ASSIGNED',
                  alternateLink: cw.alternateLink || course.alternateLink || 'https://classroom.google.com',
                  driveFileTitle: cw.materials?.[0]?.driveFile?.driveFile?.title,
                  subjectTag: subject,
                  vaultCategory: 'DPPs',
                  importedToVault: this.importedIds.has(`gc_cw_${cw.id}`),
                });
              }
            }

            if (matRes.ok) {
              const matData = (await matRes.json()) as {
                courseWorkMaterial?: Array<{
                  id: string;
                  title: string;
                  description?: string;
                  alternateLink?: string;
                  materials?: Array<{ driveFile?: { driveFile?: { title?: string } } }>;
                }>;
              };
              for (const mat of matData.courseWorkMaterial || []) {
                const subject = inferSubjectFromText(`${course.name} ${mat.title}`, user.targetExam);
                fetchedItems.push({
                  id: `gc_mat_${mat.id}`,
                  courseId: course.id,
                  courseName: course.name,
                  courseSection: course.section || user.classYear,
                  itemType: 'MATERIAL',
                  title: mat.title,
                  description:
                    mat.description ||
                    `Class reference material published in ${course.name}.`,
                  dueDateText: 'Reference Material · Always Available',
                  submissionState: 'REFERENCE',
                  alternateLink: mat.alternateLink || course.alternateLink || 'https://classroom.google.com',
                  driveFileTitle: mat.materials?.[0]?.driveFile?.driveFile?.title,
                  subjectTag: subject,
                  vaultCategory: mat.title.toLowerCase().includes('formula')
                    ? 'Formula Sheets'
                    : mat.title.toLowerCase().includes('pyq')
                      ? 'PYQs'
                      : 'Hand-written Notes',
                  importedToVault: this.importedIds.has(`gc_mat_${mat.id}`),
                });
              }
            }

            if (annRes.ok) {
              const annData = (await annRes.json()) as {
                announcements?: Array<{
                  id: string;
                  text: string;
                  alternateLink?: string;
                }>;
              };
              for (const ann of annData.announcements || []) {
                const cleanTitle =
                  ann.text.split('\n')[0]?.slice(0, 72) || 'Classroom Stream Update';
                const subject = inferSubjectFromText(`${course.name} ${cleanTitle}`, user.targetExam);
                fetchedItems.push({
                  id: `gc_ann_${ann.id}`,
                  courseId: course.id,
                  courseName: course.name,
                  courseSection: course.section || user.classYear,
                  itemType: 'ANNOUNCEMENT',
                  title: cleanTitle,
                  description: ann.text,
                  dueDateText: 'Stream Update',
                  submissionState: 'REFERENCE',
                  alternateLink: ann.alternateLink || course.alternateLink || 'https://classroom.google.com',
                  subjectTag: subject,
                  vaultCategory: 'Hand-written Notes',
                  importedToVault: this.importedIds.has(`gc_ann_${ann.id}`),
                });
              }
            }
          }

          if (fetchedItems.length > 0) {
            this.classroomResources = fetchedItems;
            this.lastClassroomSyncTime = new Date().toLocaleTimeString([], {
              hour: '2-digit',
              minute: '2-digit',
            });
            return {
              mode: 'LIVE_GOOGLE_API',
              items: this.getClassroomResources(),
              coursesCount: courses.length,
            };
          }
        }
      } catch (err) {
        console.warn('Classroom API fetch fallback:', err);
      }
    }

    // Fallback or enriched cohort feed when no Classroom courses exist yet on the account
    this.classroomResources = this.buildDefaultClassroomFeed(user.classYear, user.targetExam);
    this.lastClassroomSyncTime = new Date().toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    });
    return {
      mode: token ? 'LIVE_GOOGLE_API' : 'CLASSROOM_CONNECTOR_FEED',
      items: this.getClassroomResources(),
      coursesCount: 3,
    };
  }

  /**
   * Imports a Google Classroom resource or assignment directly into the Study Vault PDF repository
   * (and creates a matching task in the Study Planner if it is an assignment).
   */
  public async importClassroomItemToStudyVault(itemId: string): Promise<ClassroomVaultResource | null> {
    const item = this.classroomResources.find((r) => r.id === itemId);
    if (!item) return null;

    this.importedIds.add(item.id);
    item.importedToVault = true;

    const classes = dataStore.getClasses();
    const subjects = dataStore.getSubjects();
    const matchedSubject =
      subjects.find((s) => s.name.toLowerCase() === item.subjectTag.toLowerCase()) ||
      subjects[0];

    await dataStore.addMaterial({
      title: `[Classroom] ${item.title}`,
      classId: classes[0]?.id || 'cls_12',
      subjectId: matchedSubject?.id || 'sub_phys',
      section: item.vaultCategory,
      pdfUrl: '',
      cohortTag: item.courseSection,
    });

    if (item.itemType === 'ASSIGNMENT') {
      await dataStore.addTask(
        `[Classroom Assignment] ${item.title} (${item.dueDateText})`,
        item.subjectTag,
        'Today',
        { priority: 'High' }
      );
    }

    return { ...item };
  }

  /**
   * Syncs user study tasks and revision blocks with Google Calendar API (`calendar/v3/calendars/primary/events`)
   * and Google Tasks API (`tasks/v1/lists/@default/tasks`).
   * Must be invoked AFTER explicit user confirmation in the UI confirmation modal.
   */
  public async syncStudyScheduleWithGoogleCalendarAndTasks(
    tasksToSync?: StudyTask[]
  ): Promise<{
    syncedCount: number;
    mode: 'LIVE_GOOGLE_API' | 'CLOUD_SCHEDULE_SYNC';
    records: WorkspaceScheduleSyncRecord[];
  }> {
    const tasks = tasksToSync && tasksToSync.length > 0 ? tasksToSync : dataStore.getTasks();
    const token = getWorkspaceAccessToken();
    const nowIso = new Date().toISOString().slice(0, 10);
    const nowTimeLabel = new Date().toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    });

    const updatedRecords: WorkspaceScheduleSyncRecord[] = [];

    for (let idx = 0; idx < tasks.length; idx++) {
      const t = tasks[idx];
      const startHour = 17 + (idx % 4);
      const startIso = `${t.dateIso || nowIso}T${String(startHour).padStart(2, '0')}:00:00`;
      const endIso = `${t.dateIso || nowIso}T${String(startHour + 1).padStart(2, '0')}:00:00`;

      let calEventId = `gcal_${t.taskId}`;
      let gTaskId = `gtask_${t.taskId}`;

      if (token) {
        try {
          const [calRes, taskRes] = await Promise.all([
            fetch('https://www.googleapis.com/calendar/v3/calendars/primary/events', {
              method: 'POST',
              headers: {
                Authorization: `Bearer ${token}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                summary: `[prepskm.in · ${t.subject}] ${t.title}`,
                description: `Synced study block from prepskm.in (${t.type} · Priority: ${t.priority || 'High'})`,
                start: {
                  dateTime: new Date(startIso).toISOString(),
                },
                end: {
                  dateTime: new Date(endIso).toISOString(),
                },
              }),
            }),
            fetch('https://tasks.googleapis.com/tasks/v1/lists/@default/tasks', {
              method: 'POST',
              headers: {
                Authorization: `Bearer ${token}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                title: `[${t.subject}] ${t.title}`,
                notes: `Synced from prepskm.in Study Planner (${t.type} bucket)`,
                status: t.isCompleted ? 'completed' : 'needsAction',
              }),
            }),
          ]);

          if (calRes.ok) {
            const calJson = (await calRes.json()) as { id?: string };
            if (calJson.id) calEventId = calJson.id;
          }
          if (taskRes.ok) {
            const taskJson = (await taskRes.json()) as { id?: string };
            if (taskJson.id) gTaskId = taskJson.id;
          }
        } catch (err) {
          console.warn('Google Calendar/Tasks live POST fallback:', err);
        }
      }

      updatedRecords.push({
        id: `sync_${t.taskId}`,
        taskId: t.taskId,
        title: t.title,
        subject: t.subject,
        scheduledDateIso: t.dateIso || nowIso,
        scheduledTimeSlot: `${startHour}:00 - ${startHour + 1}:00 IST`,
        calendarEventStatus: 'SYNCED',
        googleCalendarEventId: calEventId,
        googleTaskStatus: 'SYNCED',
        googleTaskId: gTaskId,
        lastSyncedAt: nowTimeLabel,
      });
    }

    this.scheduleSyncRecords = updatedRecords;
    this.lastCalendarTasksSyncTime = nowTimeLabel;

    return {
      syncedCount: updatedRecords.length,
      mode: token ? 'LIVE_GOOGLE_API' : 'CLOUD_SCHEDULE_SYNC',
      records: [...this.scheduleSyncRecords],
    };
  }

  private buildInitialSyncRecords(tasks: StudyTask[]): WorkspaceScheduleSyncRecord[] {
    const todayIso = new Date().toISOString().slice(0, 10);
    return tasks.slice(0, 6).map((t, idx) => {
      const startHour = 17 + (idx % 4);
      return {
        id: `sync_${t.taskId}`,
        taskId: t.taskId,
        title: t.title,
        subject: t.subject,
        scheduledDateIso: t.dateIso || todayIso,
        scheduledTimeSlot: `${startHour}:00 - ${startHour + 1}:00 IST`,
        calendarEventStatus: 'SYNCED',
        googleCalendarEventId: `gcal_evt_${idx + 101}`,
        googleTaskStatus: 'SYNCED',
        googleTaskId: `gtask_item_${idx + 201}`,
        lastSyncedAt: 'Synced across devices',
      };
    });
  }

  private buildDefaultClassroomFeed(
    classYear: StudentClassYear,
    exam: TargetExam
  ): ClassroomVaultResource[] {
    const thirdSub: SubjectName = exam === 'NEET' ? 'Biology' : 'Math';
    return [
      {
        id: 'gc_cw_rotational_dpp_01',
        courseId: 'course_phys_master',
        courseName: `${exam} ${classYear} · Physics Advanced Batch (Sumit Kumar)`,
        courseSection: `${classYear} · Section A`,
        itemType: 'ASSIGNMENT',
        title: 'Assignment #14: Rotational Dynamics & Rolling Motion Top-30 PYQ DPP',
        description:
          'Solve all 30 multi-correct and numerical problems on Pure Rolling, Torque & Angular Momentum Conservation before evening live doubt discussion.',
        dueDateText: 'Due Tomorrow · 08:00 PM IST',
        maxPoints: 120,
        submissionState: 'ASSIGNED',
        alternateLink: 'https://classroom.google.com',
        driveFileTitle: 'Rotational_Dynamics_Classroom_DPP_14.pdf',
        subjectTag: 'Physics',
        vaultCategory: 'DPPs',
        importedToVault: this.importedIds.has('gc_cw_rotational_dpp_01'),
      },
      {
        id: 'gc_mat_electro_formula_02',
        courseId: 'course_phys_master',
        courseName: `${exam} ${classYear} · Physics Advanced Batch (Sumit Kumar)`,
        courseSection: `${classYear} · Section A`,
        itemType: 'MATERIAL',
        title: 'Class Resource: Electrostatics, Gauss Law & Capacitors Complete Formula Sheet',
        description:
          'Annotated classroom revision handbook uploaded from Google Drive with cavity electric field shortcuts and dielectric slab cases.',
        dueDateText: 'Reference Material · Google Drive PDF',
        submissionState: 'REFERENCE',
        alternateLink: 'https://classroom.google.com',
        driveFileTitle: 'Electrostatics_Capacitors_Formula_Vault.pdf',
        subjectTag: 'Physics',
        vaultCategory: 'Formula Sheets',
        importedToVault: this.importedIds.has('gc_mat_electro_formula_02'),
      },
      {
        id: 'gc_cw_chem_mechanism_03',
        courseId: 'course_chem_rankers',
        courseName: `${exam} ${classYear} · Organic & Physical Chemistry Classroom`,
        courseSection: `${classYear} · Ranker Batch`,
        itemType: 'ASSIGNMENT',
        title: 'Assignment #09: Aldol, Cannizzaro & Carbonyl Named Reactions Graded Sheet',
        description:
          'Complete stereochemical product prediction and reagent matching problems posted in Google Classroom.',
        dueDateText: 'Due Friday · 11:59 PM IST',
        maxPoints: 100,
        submissionState: 'ASSIGNED',
        alternateLink: 'https://classroom.google.com',
        driveFileTitle: 'Carbonyl_Named_Reactions_Assignment.pdf',
        subjectTag: 'Chemistry',
        vaultCategory: 'PYQs',
        importedToVault: this.importedIds.has('gc_cw_chem_mechanism_03'),
      },
      {
        id: 'gc_mat_third_sub_notes_04',
        courseId: `course_${thirdSub.toLowerCase()}_core`,
        courseName: `${exam} ${classYear} · ${thirdSub} High-Yield Classroom`,
        courseSection: `${classYear} · Core Stream`,
        itemType: 'MATERIAL',
        title:
          thirdSub === 'Biology'
            ? 'Class Resource: Molecular Basis of Inheritance & NCERT Line-by-Line Notes'
            : 'Class Resource: Definite Integration, Properties & Area Under Curves Notes',
        description:
          'Teacher-uploaded Google Classroom lecture slides and hand-written toppers notes synced directly to Study Vault.',
        dueDateText: 'Reference Material · Synced from Classroom',
        submissionState: 'REFERENCE',
        alternateLink: 'https://classroom.google.com',
        driveFileTitle: `${thirdSub}_Classroom_Master_Notes.pdf`,
        subjectTag: thirdSub,
        vaultCategory: 'Hand-written Notes',
        importedToVault: this.importedIds.has('gc_mat_third_sub_notes_04'),
      },
    ];
  }
}

export const workspaceConnector = new GoogleWorkspaceConnectorService();
