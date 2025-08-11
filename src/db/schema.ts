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
} from 'drizzle-orm/pg-core';
import { LearningPlan } from '@/types/learning-plan';

// 扩展的课程计划类型，包含任务数据
export interface ExtendedCoursePlan {
  plan: LearningPlan | any[];  // 兼容旧格式和新格式
  tasks?: Record<string, any>; // 生成的任务数据
  notes?: any[]; // 页面便签数据
}

export const userCourses = pgTable('user_courses', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => `course_${crypto.randomUUID()}`),
  userId: text('user_id')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  coursePlan: jsonb('course_plan').notNull().$type<ExtendedCoursePlan>(),
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

// 新增：存储课程任务内容
export const courseTasks = pgTable('course_tasks', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => `task_${crypto.randomUUID()}`),
  courseId: text('course_id')
    .notNull()
    .references(() => userCourses.id, { onDelete: 'cascade' }),
  stepNumber: integer('step_number').notNull(),
  taskContent: jsonb('task_content').notNull(), // 存储TaskContent对象
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at')
    .defaultNow()
    .notNull()
    .$onUpdate(() => new Date()),
}, (table) => ({
  courseStepUnique: uniqueIndex('course_step_unique').on(table.courseId, table.stepNumber),
}));

// 新增：存储聊天记录
export const courseChatHistory = pgTable('course_chat_history', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => `chat_${crypto.randomUUID()}`),
  courseId: text('course_id')
    .notNull()
    .references(() => userCourses.id, { onDelete: 'cascade' }),
  sessionId: text('session_id').notNull(),
  messages: jsonb('messages').notNull(), // 存储消息数组
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
	banned: boolean('banned'),
	banReason: text('ban_reason'),
	banExpires: timestamp('ban_expires'),
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
	impersonatedBy: text('impersonated_by')
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

// 定义关系
export const userCoursesRelations = relations(userCourses, ({ many }) => ({
  tasks: many(courseTasks),
  chatHistory: many(courseChatHistory),
}));

export const courseTasksRelations = relations(courseTasks, ({ one }) => ({
  course: one(userCourses, {
    fields: [courseTasks.courseId],
    references: [userCourses.id],
  }),
}));

export const courseChatHistoryRelations = relations(courseChatHistory, ({ one }) => ({
  course: one(userCourses, {
    fields: [courseChatHistory.courseId],
    references: [userCourses.id],
  }),
}));
