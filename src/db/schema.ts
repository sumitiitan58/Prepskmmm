import { relations } from 'drizzle-orm';
import { boolean, integer, pgTable, serial, text, timestamp } from 'drizzle-orm/pg-core';

// Define the 'users' table linked by Firebase Auth UID.
export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  uid: text('uid').notNull().unique(),
  email: text('email').notNull(),
  name: text('name').default('Aspirant Student').notNull(),
  classCohort: text('class_cohort').default('Class 12').notNull(),
  targetExam: text('target_exam').default('JEE').notNull(),
  totalFocusMinutes: integer('total_focus_minutes').default(210).notNull(),
  createdAt: timestamp('created_at').defaultNow(),
});

// Define the 'classroom_resources' table synced from Google Classroom into Study Vault.
export const classroomResources = pgTable('classroom_resources', {
  id: serial('id').primaryKey(),
  userId: integer('user_id')
    .references(() => users.id)
    .notNull(),
  courseId: text('course_id').notNull(),
  courseName: text('course_name').notNull(),
  itemType: text('item_type').notNull(), // 'ASSIGNMENT' | 'MATERIAL' | 'ANNOUNCEMENT'
  title: text('title').notNull(),
  description: text('description').default('').notNull(),
  dueDateText: text('due_date_text').default('').notNull(),
  alternateLink: text('alternate_link').default('').notNull(),
  subjectTag: text('subject_tag').default('Physics').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
});

// Define the 'study_schedule_syncs' table tracking Google Calendar & Google Tasks syncs.
export const studyScheduleSyncs = pgTable('study_schedule_syncs', {
  id: serial('id').primaryKey(),
  userId: integer('user_id')
    .references(() => users.id)
    .notNull(),
  taskId: text('task_id').notNull(),
  title: text('title').notNull(),
  subject: text('subject').notNull(),
  scheduledDate: text('scheduled_date').notNull(),
  googleCalendarEventId: text('google_calendar_event_id').default('').notNull(),
  googleTaskId: text('google_task_id').default('').notNull(),
  isCompleted: boolean('is_completed').default(false).notNull(),
  syncedAt: timestamp('synced_at').defaultNow(),
});

// Define relationships for the 'users' table.
export const usersRelations = relations(users, ({ many }) => ({
  classroomResources: many(classroomResources),
  studyScheduleSyncs: many(studyScheduleSyncs),
}));

export const classroomResourcesRelations = relations(classroomResources, ({ one }) => ({
  user: one(users, {
    fields: [classroomResources.userId],
    references: [users.id],
  }),
}));

export const studyScheduleSyncsRelations = relations(studyScheduleSyncs, ({ one }) => ({
  user: one(users, {
    fields: [studyScheduleSyncs.userId],
    references: [users.id],
  }),
}));
