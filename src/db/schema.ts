import { relations } from 'drizzle-orm';
import {
  boolean,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  varchar,
  bigint,
} from 'drizzle-orm/pg-core';
import { LearningPlan } from '@/types/learning-plan';

// 扩展的课程计划类型，包含任务数据
export interface ExtendedCoursePlan {
  plan?: LearningPlan | any[];  // 兼容旧格式和新格式（可选，如果使用 planUrl）
  tasks?: Record<string, any>; // 生成的任务数据
  notes?: any[]; // 页面便签数据
  marks?: any[]; // 文本彩笔标记数据
  isPublic?: boolean; // 是否公开课程
  // 注意：planUrl 现在是独立的数据库列，不再存储在 coursePlan JSONB 中
}

export const userCourses = pgTable('user_courses', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => `course_${crypto.randomUUID()}`),
  userId: text('user_id')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  coursePlan: jsonb('course_plan').notNull().$type<ExtendedCoursePlan>(),
  planUrl: text('plan_url'), // CDN URL，存储课程计划的 JSON 文件（独立列）
  currentStep: integer('current_step').default(0).notNull(),
  status: text('status', { enum: ['in-progress', 'completed'] })
    .default('in-progress')
    .notNull(),
  tasksGenerated: boolean('tasks_generated').default(false).notNull(), // 新增：标记任务是否已生成
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at')
    .defaultNow()
    .notNull()
    .$onUpdate(() => new Date()),
});

export const user = pgTable("user", {
	id: text("id").primaryKey(),
	name: text('name').notNull(),
	email: text('email').notNull().unique(),
	emailVerified: boolean('email_verified').notNull(),
	image: text('image'),
	createdAt: timestamp('created_at').notNull(),
	updatedAt: timestamp('updated_at').notNull(),
	role: text('role'),
	customerId: text('customer_id'),
});

export const session = pgTable("session", {
	id: text("id").primaryKey(),
	expiresAt: timestamp('expires_at').notNull(),
	token: text('token').notNull().unique(),
	createdAt: timestamp('created_at').notNull(),
	updatedAt: timestamp('updated_at').notNull(),
	ipAddress: text('ip_address'),
	userAgent: text('user_agent'),
	userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
});

export const account = pgTable("account", {
	id: text("id").primaryKey(),
	accountId: text('account_id').notNull(),
	providerId: text('provider_id').notNull(),
	userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
	accessToken: text('access_token'),
	refreshToken: text('refresh_token'),
	idToken: text('id_token'),
	accessTokenExpiresAt: timestamp('access_token_expires_at'),
	refreshTokenExpiresAt: timestamp('refresh_token_expires_at'),
	scope: text('scope'),
	password: text('password'),
	createdAt: timestamp('created_at').notNull(),
	updatedAt: timestamp('updated_at').notNull()
});

export const verification = pgTable("verification", {
	id: text("id").primaryKey(),
	identifier: text('identifier').notNull(),
	value: text('value').notNull(),
	expiresAt: timestamp('expires_at').notNull(),
	createdAt: timestamp('created_at'),
	updatedAt: timestamp('updated_at')
});

export const payment = pgTable("payment", {
	id: text("id").primaryKey(),
	priceId: text('price_id').notNull(),
	type: text('type').notNull(),
	interval: text('interval'),
	userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
	customerId: text('customer_id').notNull(),
	subscriptionId: text('subscription_id'),
	status: text('status').notNull(),
	periodStart: timestamp('period_start'),
	periodEnd: timestamp('period_end'),
	cancelAtPeriodEnd: boolean('cancel_at_period_end'),
	trialStart: timestamp('trial_start'),
	trialEnd: timestamp('trial_end'),
	createdAt: timestamp('created_at').notNull().defaultNow(),
	updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

// 创作者课程表（用于创建简洁的公开课程链接）
export const creatorCourses = pgTable('creator_courses', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => `creator_course_${crypto.randomUUID()}`),
  slug: varchar('slug', { length: 200 }).notNull().unique(), // 简洁的URL标识符
  courseId: text('course_id')
    .notNull()
    .references(() => userCourses.id, { onDelete: 'cascade' }),
  creatorId: text('creator_id')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  title: varchar('title', { length: 200 }).notNull(), // 公开显示的标题
  description: text('description').default(''), // 公开显示的描述
  isActive: boolean('is_active').default(true).notNull(), // 是否激活
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at')
    .defaultNow()
    .notNull()
    .$onUpdate(() => new Date()),
});

// 定义关系
export const userCoursesRelations = relations(userCourses, ({ one }) => ({
  user: one(user, {
    fields: [userCourses.userId],
    references: [user.id],
  }),
}));


// 关键用户行为表（专门用于核心转化行为追踪）
export const keyActions = pgTable('key_actions', {
  id: text('id').primaryKey().$defaultFn(() => `key_action_${crypto.randomUUID()}`),
  eventName: varchar('event_name', { length: 50 }).notNull(), // 'generate_course' | 'start_learning' | 'continue_learning' | 'start_video_learning' | 'video_search' | 'video_ask_question' | 'video_screenshot' | 'video_exercise'
  timestamp: bigint('timestamp', { mode: 'number' }).notNull(),
  serverTimestamp: timestamp('server_timestamp').defaultNow().notNull(),
  sessionId: varchar('session_id', { length: 200 }).notNull(),
  userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }), // 必填且级联删除
  locale: varchar('locale', { length: 10 }).notNull(),
  deviceType: varchar('device_type', { length: 20 }).notNull(),
  userAgent: varchar('user_agent', { length: 1000 }),
  pagePath: varchar('page_path', { length: 500 }).notNull(),
  pageTitle: varchar('page_title', { length: 200 }),
  actionData: jsonb('action_data').notNull(), // 业务相关的行为数据
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// 创建索引以优化查询性能
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

// ==================== 视频笔记相关表 ====================

// 视频笔记数据类型定义
export interface VideoNoteData {
  knowledgePointNotes: Array<{
    // 匹配原始知识点
    knowledgePointName: string;
    startTime: string;
    endTime: string;
    
    // 用户添加的内容
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
    
    // 用户修改的笔记
    customNote?: string;
  }>;
  
  // 全局设置
  customTitle?: string;
  customDescription?: string;
  tags?: string[];
}

// 用户视频笔记表
export const userVideoNotes = pgTable('user_video_notes', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => `note_${crypto.randomUUID()}`),
  userId: text('user_id')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  
  // 关联原始视频数据（通过 task_id 关联到后端 MySQL 的 offline_video_tasks）
  taskId: text('task_id').notNull(),
  videoUrl: text('video_url').notNull(),
  bvId: text('bv_id'),
  videoTitle: text('video_title'),
  videoPlatform: text('video_platform', { enum: ['bilibili', 'youtube', 'custom'] }).default('bilibili'),
  
  // 用户笔记数据
  userNotesData: jsonb('user_notes_data').notNull().$type<VideoNoteData>(),
  
  // 元数据
  title: text('title'), // 用户自定义标题
  description: text('description'),
  isFavorite: boolean('is_favorite').default(false),
  
  // 统计信息
  totalKnowledgePoints: integer('total_knowledge_points').default(0),
  totalQAs: integer('total_qas').default(0),
  totalExercises: integer('total_exercises').default(0),
  
  // 时间戳
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at')
    .defaultNow()
    .notNull()
    .$onUpdate(() => new Date()),
  lastViewedAt: timestamp('last_viewed_at'),
});

// 笔记标签表
export const videoNoteTags = pgTable('video_note_tags', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => `tag_${crypto.randomUUID()}`),
  userId: text('user_id')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  color: text('color'), // 标签颜色 hex
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// 笔记-标签关联表
export const videoNoteTagRelations = pgTable(
  'video_note_tag_relations',
  {
    noteId: text('note_id')
      .notNull()
      .references(() => userVideoNotes.id, { onDelete: 'cascade' }),
    tagId: text('tag_id')
      .notNull()
      .references(() => videoNoteTags.id, { onDelete: 'cascade' }),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.noteId, table.tagId] }),
  })
);

// 定义关系
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
