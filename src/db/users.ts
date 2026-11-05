import { eq } from 'drizzle-orm';
import { db } from './index.ts';
import { classroomResources, studyScheduleSyncs, users } from './schema.ts';

export async function getOrCreateUser(uid: string, email: string, name?: string) {
  try {
    const result = await db
      .insert(users)
      .values({
        uid,
        email,
        name: name || 'Aspirant Student',
      })
      .onConflictDoUpdate({
        target: users.uid,
        set: {
          email,
          ...(name ? { name } : {}),
        },
      })
      .returning();

    return result[0];
  } catch (error) {
    console.error('Database query failed in getOrCreateUser:', error);
    throw new Error('Database query failed. Please try again later.', { cause: error });
  }
}

export async function getUserClassroomResources(uid: string) {
  try {
    return await db
      .select({
        id: classroomResources.id,
        courseId: classroomResources.courseId,
        courseName: classroomResources.courseName,
        itemType: classroomResources.itemType,
        title: classroomResources.title,
        description: classroomResources.description,
        dueDateText: classroomResources.dueDateText,
        alternateLink: classroomResources.alternateLink,
        subjectTag: classroomResources.subjectTag,
      })
      .from(classroomResources)
      .innerJoin(users, eq(classroomResources.userId, users.id))
      .where(eq(users.uid, uid));
  } catch (error) {
    console.error('Database query failed in getUserClassroomResources:', error);
    throw new Error('Database query failed. Please try again later.', { cause: error });
  }
}

export async function getUserScheduleSyncs(uid: string) {
  try {
    return await db
      .select({
        id: studyScheduleSyncs.id,
        taskId: studyScheduleSyncs.taskId,
        title: studyScheduleSyncs.title,
        subject: studyScheduleSyncs.subject,
        scheduledDate: studyScheduleSyncs.scheduledDate,
        googleCalendarEventId: studyScheduleSyncs.googleCalendarEventId,
        googleTaskId: studyScheduleSyncs.googleTaskId,
        isCompleted: studyScheduleSyncs.isCompleted,
      })
      .from(studyScheduleSyncs)
      .innerJoin(users, eq(studyScheduleSyncs.userId, users.id))
      .where(eq(users.uid, uid));
  } catch (error) {
    console.error('Database query failed in getUserScheduleSyncs:', error);
    throw new Error('Database query failed. Please try again later.', { cause: error });
  }
}
