/**
 * MySQL 版本的数据库 Schema
 * 从 PostgreSQL (Supabase) 迁移到 MySQL
 */
import { relations } from 'drizzle-orm';
import {
  boolean,
  int,
  json,
  mysqlEnum,
  mysqlTable,
  primaryKey,
  text,
  timestamp,
  varchar,
  bigint,
} from 'drizzle-orm/mysql-core';
import { LearningPlan } from '@/types/learning-plan';

// 扩展的课程计划类型，包含任务数据
export interface ExtendedCoursePlan {
  plan?: LearningPlan | any[];  // 兼容旧格式和新格式（可选，如果使用 planUrl）
  tasks?: Record<string, any>; // 生成的任务数据
  notes?: any[]; // 页面便签数据
  marks?: any[]; // 文本彩笔标记数据
  isPublic?: boolean; // 是否公开课程
}

// ==================== 用户相关表 ====================
// 注意: 所有表名使用 learnorbit_ 前缀（避免与公司其他业务表冲突）

export const user = mysqlTable("learnorbit_user", {
  id: varchar("id", { length: 255 }).primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  emailVerified: boolean("email_verified").notNull().default(false),
  image: text("image"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow().onUpdateNow(),
  role: varchar("role", { length: 50 }),
  customerId: varchar("customer_id", { length: 255 }),
});

export const session = mysqlTable("learnorbit_session", {
  id: varchar("id", { length: 255 }).primaryKey(),
  expiresAt: timestamp("expires_at").notNull(),
  token: varchar("token", { length: 500 }).notNull().unique(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow().onUpdateNow(),
  ipAddress: varchar("ip_address", { length: 100 }),
  userAgent: text("user_agent"),
  userId: varchar("user_id", { length: 255 }).notNull().references(() => user.id, { onDelete: 'cascade' }),
});

export const account = mysqlTable("learnorbit_account", {
  id: varchar("id", { length: 255 }).primaryKey(),
  accountId: varchar("account_id", { length: 255 }).notNull(),
  providerId: varchar("provider_id", { length: 100 }).notNull(),
  userId: varchar("user_id", { length: 255 }).notNull().references(() => user.id, { onDelete: 'cascade' }),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  idToken: text("id_token"),
  accessTokenExpiresAt: timestamp("access_token_expires_at"),
  refreshTokenExpiresAt: timestamp("refresh_token_expires_at"),
  scope: text("scope"),
  password: varchar("password", { length: 255 }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow().onUpdateNow(),
});

export const verification = mysqlTable("learnorbit_verification", {
  id: varchar("id", { length: 255 }).primaryKey(),
  identifier: varchar("identifier", { length: 255 }).notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow(),
});

export const payment = mysqlTable("learnorbit_payment", {
  id: varchar("id", { length: 255 }).primaryKey(),
  priceId: varchar("price_id", { length: 255 }).notNull(),
  type: varchar("type", { length: 50 }).notNull(),
  interval: varchar("interval", { length: 50 }),
  userId: varchar("user_id", { length: 255 }).notNull().references(() => user.id, { onDelete: 'cascade' }),
  customerId: varchar("customer_id", { length: 255 }).notNull(),
  subscriptionId: varchar("subscription_id", { length: 255 }),
  status: varchar("status", { length: 50 }).notNull(),
  periodStart: timestamp("period_start"),
  periodEnd: timestamp("period_end"),
  cancelAtPeriodEnd: boolean("cancel_at_period_end").default(false),
  trialStart: timestamp("trial_start"),
  trialEnd: timestamp("trial_end"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow().onUpdateNow(),
});

// ==================== 课程相关表 ====================

export const userCourses = mysqlTable('learnorbit_user_courses', {
  id: varchar('id', { length: 255 })
    .primaryKey()
    .$defaultFn(() => `course_${crypto.randomUUID()}`),
  userId: varchar('user_id', { length: 255 })
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  coursePlan: json('course_plan').notNull().$type<ExtendedCoursePlan>(),
  planUrl: text('plan_url'), // CDN URL
  currentStep: int('current_step').default(0).notNull(),
  status: mysqlEnum('status', ['in-progress', 'completed'])
    .default('in-progress')
    .notNull(),
  tasksGenerated: boolean('tasks_generated').default(false).notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow().onUpdateNow(),
});

export const creatorCourses = mysqlTable('learnorbit_creator_courses', {
  id: varchar('id', { length: 255 })
    .primaryKey()
    .$defaultFn(() => `creator_course_${crypto.randomUUID()}`),
  slug: varchar('slug', { length: 200 }).notNull().unique(),
  courseId: varchar('course_id', { length: 255 })
    .notNull()
    .references(() => userCourses.id, { onDelete: 'cascade' }),
  creatorId: varchar('creator_id', { length: 255 })
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  title: varchar('title', { length: 200 }).notNull(),
  description: text('description').default(''),
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow().onUpdateNow(),
});

// ==================== 行为分析表 ====================

export const keyActions = mysqlTable('learnorbit_key_actions', {
  id: varchar('id', { length: 255 })
    .primaryKey()
    .$defaultFn(() => `key_action_${crypto.randomUUID()}`),
  eventName: varchar('event_name', { length: 50 }).notNull(),
  timestamp: bigint('timestamp', { mode: 'number' }).notNull(),
  serverTimestamp: timestamp('server_timestamp').defaultNow().notNull(),
  sessionId: varchar('session_id', { length: 200 }).notNull(),
  userId: varchar('user_id', { length: 255 }).notNull().references(() => user.id, { onDelete: 'cascade' }),
  locale: varchar('locale', { length: 10 }).notNull(),
  deviceType: varchar('device_type', { length: 20 }).notNull(),
  userAgent: varchar('user_agent', { length: 1000 }),
  pagePath: varchar('page_path', { length: 500 }).notNull(),
  pageTitle: varchar('page_title', { length: 200 }),
  actionData: json('action_data').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

// ==================== 视频笔记相关表 ====================

export interface VideoNoteData {
  knowledgePointNotes: Array<{
    knowledgePointName: string;
    startTime: string;
    endTime: string;
    qaList?: Array<{
      question: string;
      answer: string;
      timestamp: string;
    }>;
    screenshots?: string[];
    exercises?: Array<{
      type: string;
      question: string;
      choices?: any[];
      solution?: string;
      hints?: string[];
    }>;
    searchResults?: Array<{
      title: string;
      url: string;
      description: string;
    }>;
    customNote?: string;
  }>;
  customTitle?: string;
  customDescription?: string;
  tags?: string[];
}

export const userVideoNotes = mysqlTable('learnorbit_user_video_notes', {
  id: varchar('id', { length: 255 })
    .primaryKey()
    .$defaultFn(() => `note_${crypto.randomUUID()}`),
  userId: varchar('user_id', { length: 255 })
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  taskId: varchar('task_id', { length: 255 }).notNull(),
  videoUrl: text('video_url').notNull(),
  bvId: varchar('bv_id', { length: 50 }),
  videoTitle: text('video_title'),
  videoPlatform: mysqlEnum('video_platform', ['bilibili', 'youtube', 'custom']).default('bilibili'),
  userNotesData: json('user_notes_data').notNull().$type<VideoNoteData>(),
  title: text('title'),
  description: text('description'),
  isFavorite: boolean('is_favorite').default(false),
  totalKnowledgePoints: int('total_knowledge_points').default(0),
  totalQAs: int('total_qas').default(0),
  totalExercises: int('total_exercises').default(0),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow().onUpdateNow(),
  lastViewedAt: timestamp('last_viewed_at'),
});

export const videoNoteTags = mysqlTable('learnorbit_video_note_tags', {
  id: varchar('id', { length: 255 })
    .primaryKey()
    .$defaultFn(() => `tag_${crypto.randomUUID()}`),
  userId: varchar('user_id', { length: 255 })
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 100 }).notNull(),
  color: varchar('color', { length: 20 }),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

export const videoNoteTagRelations = mysqlTable(
  'learnorbit_video_note_tag_relations',
  {
    noteId: varchar('note_id', { length: 255 })
      .notNull()
      .references(() => userVideoNotes.id, { onDelete: 'cascade' }),
    tagId: varchar('tag_id', { length: 255 })
      .notNull()
      .references(() => videoNoteTags.id, { onDelete: 'cascade' }),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.noteId, table.tagId] }),
  })
);

// ==================== 关系定义 ====================

export const userCoursesRelations = relations(userCourses, ({ one }) => ({
  user: one(user, {
    fields: [userCourses.userId],
    references: [user.id],
  }),
}));

export const keyActionsRelations = relations(keyActions, ({ one }) => ({
  user: one(user, {
    fields: [keyActions.userId],
    references: [user.id],
  }),
}));

export const creatorCoursesRelations = relations(creatorCourses, ({ one }) => ({
  course: one(userCourses, {
    fields: [creatorCourses.courseId],
    references: [userCourses.id],
  }),
  creator: one(user, {
    fields: [creatorCourses.creatorId],
    references: [user.id],
  }),
}));

export const userVideoNotesRelations = relations(userVideoNotes, ({ one }) => ({
  user: one(user, {
    fields: [userVideoNotes.userId],
    references: [user.id],
  }),
}));

export const videoNoteTagsRelations = relations(videoNoteTags, ({ one }) => ({
  user: one(user, {
    fields: [videoNoteTags.userId],
    references: [user.id],
  }),
}));

