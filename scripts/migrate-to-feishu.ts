/**
 * Supabase 数据库迁移到飞书多维表格脚本
 * 
 * 使用方法:
 * 1. 在 .env 文件中设置环境变量: FEISHU_APP_ID, FEISHU_APP_SECRET, FEISHU_BASE_TOKEN, DATABASE_URL
 * 2. 运行: npm run migrate-feishu 或 npx tsx scripts/migrate-to-feishu.ts
 */

// 加载 .env 文件
import 'dotenv/config';

import { getDb } from '../src/db';
import { getFeishuClient } from '../src/lib/feishu-client';
import * as schema from '../src/db/schema';
import { eq } from 'drizzle-orm';

// 表名映射（Supabase 表名 -> 飞书多维表格表名）
const TABLE_MAPPING: Record<string, string> = {
  user: 'user',
  user_courses: 'user_courses',
  course_tasks: 'course_tasks',
  course_chat_history: 'course_chat_history',
  creator_courses: 'creator_courses',
  key_actions: 'key_actions',
  session: 'session',
  account: 'account',
  verification: 'verification',
  payment: 'payment',
};

// 记录ID映射：存储原始ID到飞书记录ID的映射
// Map<tableName, Map<originalId, feishuRecordId>>
const recordIdMaps: Map<string, Map<string, string>> = new Map();

// 飞书 TEXT 字段最大长度（约 50000 字符，但为了安全起见设为 49000）
const MAX_TEXT_LENGTH = 49000;
// 分段存储时每段的最大长度
const SEGMENT_LENGTH = 48000;

// 方案1：压缩 JSON（移除所有空格和换行）
function compressJson(obj: any): string {
  return JSON.stringify(obj);
}

// 方案2：分段存储 - 将长字符串拆分成多个字段
function splitLongText(text: string, maxLength: number = SEGMENT_LENGTH): string[] {
  const segments: string[] = [];
  for (let i = 0; i < text.length; i += maxLength) {
    segments.push(text.substring(i, i + maxLength));
  }
  return segments;
}

// 方案3：只迁移核心数据，移除不必要的大字段
function extractCoreCoursePlan(coursePlan: any): any {
  // 只保留 plan 部分，移除 tasks/notes/marks（这些数据可能很大）
  return {
    plan: coursePlan?.plan || coursePlan,
    // 可选：保留标题和描述
    title: coursePlan?.plan?.title || coursePlan?.title,
    description: coursePlan?.plan?.description || coursePlan?.description,
    introduction: coursePlan?.plan?.introduction || coursePlan?.introduction,
  };
}

// 辅助函数：安全地转换 JSON 字符串
// 策略：先压缩，如果还是太长，则分段存储或只保留核心数据
function safeJsonStringify(
  obj: any, 
  maxLength: number = MAX_TEXT_LENGTH,
  useSegments: boolean = false,
  extractCore: boolean = false
): string | Record<string, string> {
  // 如果启用核心数据提取，只保留必要字段
  const dataToSerialize = extractCore ? extractCoreCoursePlan(obj) : obj;
  
  // 压缩 JSON（移除空格）
  const jsonStr = compressJson(dataToSerialize);
  
  if (jsonStr.length <= maxLength) {
    return jsonStr;
  }
  
  // 如果超过长度限制
  if (useSegments) {
    // 方案：分段存储
    const segments = splitLongText(jsonStr, SEGMENT_LENGTH);
    console.warn(`⚠️  警告: JSON 字符串长度 ${jsonStr.length} 超过限制 ${maxLength}，将拆分为 ${segments.length} 段`);
    // 返回一个对象，包含多个字段
    const result: Record<string, string> = {};
    segments.forEach((segment, index) => {
      result[`part_${index + 1}`] = segment;
    });
    return result;
  } else {
    // 方案：只保留核心数据
    if (extractCore) {
      // 如果已经提取了核心数据还是太长，截断
      console.warn(`⚠️  警告: 核心数据 JSON 长度 ${jsonStr.length} 仍超过限制 ${maxLength}，将截断`);
      return jsonStr.substring(0, maxLength);
    } else {
      // 尝试提取核心数据
      console.warn(`⚠️  警告: JSON 字符串长度 ${jsonStr.length} 超过限制 ${maxLength}，尝试提取核心数据`);
      const coreData = extractCoreCoursePlan(obj);
      const coreJsonStr = compressJson(coreData);
      if (coreJsonStr.length <= maxLength) {
        return coreJsonStr;
      } else {
        console.warn(`⚠️  警告: 核心数据长度 ${coreJsonStr.length} 仍超过限制，将截断`);
        return coreJsonStr.substring(0, maxLength);
      }
    }
  }
}

// 字段类型转换函数
function convertToFeishuFields(
  record: any,
  tableName: string,
  recordIdMap?: Map<string, string>
): Record<string, any> {
  const fields: Record<string, any> = {};

  switch (tableName) {
    case 'user':
      fields.id = record.id;
      fields.name = record.name;
      fields.email = record.email;
      fields.email_verified = record.emailVerified || false;
      fields.image = record.image || '';
      // 注意：created_at 和 updated_at 如果是 CREATED_TIME/MODIFIED_TIME 类型，飞书会自动管理，不需要设置
      // 跳过这些字段，让飞书自动填充
      fields.role = record.role || '';
      fields.banned = record.banned || false;
      fields.ban_reason = record.banReason || '';
      // 日期字段：使用时间戳（毫秒），null 值不设置
      if (record.banExpires) {
        fields.ban_expires = new Date(record.banExpires).getTime();
      }
      fields.customer_id = record.customerId || '';
      fields.is_creator = record.isCreator || false;
      break;

    case 'user_courses':
      fields.id = record.id;
      // 关联字段：将 user_id 转换为飞书记录ID
      if (recordIdMap && record.userId) {
        const feishuUserId = recordIdMap.get(record.userId);
        if (feishuUserId) {
          fields.user_id = [feishuUserId]; // 飞书关联字段需要数组格式
        } else {
          console.warn(`⚠️  警告: 找不到 user_id ${record.userId} 对应的飞书记录，跳过该字段`);
          // 不设置字段，而不是设置为空数组
        }
      }
      // 如果没有映射或 userId 为空，不设置该字段
      // course_plan 字段：使用附件字段存储大数据
      // 策略：如果数据超过 TEXT 字段限制，则上传为附件文件
      const coursePlanJson = JSON.stringify(record.coursePlan);
      
      if (coursePlanJson.length <= MAX_TEXT_LENGTH) {
        // 数据较小，直接存储在 TEXT 字段
        fields.course_plan = coursePlanJson;
      } else {
        // 数据较大，上传为附件文件
        console.log(`📎 course_plan 数据较大 (${coursePlanJson.length} 字符)，将上传为附件文件`);
        // 注意：附件上传需要在创建记录后单独处理，这里先标记
        // 实际实现会在创建记录后调用 uploadCoursePlanFile
        fields.course_plan = `[文件大小: ${coursePlanJson.length} 字符，已上传为附件]`;
        // 存储原始数据供后续上传使用
        (fields as any)._coursePlanData = coursePlanJson;
      }
      fields.current_step = record.currentStep || 0;
      // status 字段：确保值在 SINGLE_SELECT 选项中
      const statusValue = record.status || 'in-progress';
      if (statusValue === 'in-progress' || statusValue === 'completed') {
        fields.status = statusValue;
      } else {
        console.warn(`⚠️  警告: status 值 "${statusValue}" 不在选项中，使用默认值 "in-progress"`);
        fields.status = 'in-progress';
      }
      fields.tasks_generated = record.tasksGenerated || false;
      // created_at 和 updated_at 如果是 CREATED_TIME/MODIFIED_TIME 类型，飞书会自动管理
      break;

    case 'course_tasks':
      fields.id = record.id;
      // 关联字段：将 course_id 转换为飞书记录ID
      const courseIdMap = recordIdMaps.get('user_courses');
      if (courseIdMap && record.courseId) {
        const feishuCourseId = courseIdMap.get(record.courseId);
        if (feishuCourseId) {
          fields.course_id = [feishuCourseId];
        } else {
          console.warn(`⚠️  警告: 找不到 course_id ${record.courseId} 对应的飞书记录，跳过该字段`);
        }
      }
      fields.step_number = record.stepNumber;
      fields.task_content = safeJsonStringify(record.taskContent);
      // created_at 和 updated_at 如果是 CREATED_TIME/MODIFIED_TIME 类型，飞书会自动管理
      break;

    case 'course_chat_history':
      fields.id = record.id;
      // 关联字段：将 course_id 转换为飞书记录ID
      const chatCourseIdMap = recordIdMaps.get('user_courses');
      if (chatCourseIdMap && record.courseId) {
        const feishuCourseId = chatCourseIdMap.get(record.courseId);
        if (feishuCourseId) {
          fields.course_id = [feishuCourseId];
        } else {
          console.warn(`⚠️  警告: 找不到 course_id ${record.courseId} 对应的飞书记录，跳过该字段`);
        }
      }
      fields.session_id = record.sessionId;
      fields.messages = safeJsonStringify(record.messages);
      // created_at 和 updated_at 如果是 CREATED_TIME/MODIFIED_TIME 类型，飞书会自动管理
      break;

    case 'creator_courses':
      fields.id = record.id;
      fields.slug = record.slug;
      // 关联字段：course_id
      const creatorCourseIdMap = recordIdMaps.get('user_courses');
      if (creatorCourseIdMap && record.courseId) {
        const feishuCourseId = creatorCourseIdMap.get(record.courseId);
        if (feishuCourseId) {
          fields.course_id = [feishuCourseId];
        }
      }
      // 关联字段：creator_id
      const creatorIdMap = recordIdMaps.get('user');
      if (creatorIdMap && record.creatorId) {
        const feishuCreatorId = creatorIdMap.get(record.creatorId);
        if (feishuCreatorId) {
          fields.creator_id = [feishuCreatorId];
        }
      }
      fields.title = record.title;
      fields.description = record.description || '';
      fields.is_active = record.isActive !== false;
      // created_at 和 updated_at 如果是 CREATED_TIME/MODIFIED_TIME 类型，飞书会自动管理
      break;

    case 'key_actions':
      fields.id = record.id;
      fields.event_name = record.eventName;
      fields.timestamp = record.timestamp;
      fields.server_timestamp = record.serverTimestamp ? new Date(record.serverTimestamp).getTime() : Date.now();
      fields.session_id = record.sessionId;
      // 关联字段：user_id
      const keyActionsUserIdMap = recordIdMaps.get('user');
      if (keyActionsUserIdMap && record.userId) {
        const feishuUserId = keyActionsUserIdMap.get(record.userId);
        if (feishuUserId) {
          fields.user_id = [feishuUserId];
        }
      }
      fields.locale = record.locale;
      fields.device_type = record.deviceType;
      fields.user_agent = record.userAgent || '';
      fields.page_path = record.pagePath;
      fields.page_title = record.pageTitle || '';
      fields.action_data = safeJsonStringify(record.actionData);
      // created_at 如果是 CREATED_TIME 类型，飞书会自动管理
      break;

    case 'session':
      fields.id = record.id;
      fields.expires_at = record.expiresAt ? new Date(record.expiresAt).getTime() : null;
      fields.token = record.token;
      // created_at 和 updated_at 如果是 CREATED_TIME/MODIFIED_TIME 类型，飞书会自动管理
      fields.ip_address = record.ipAddress || '';
      fields.user_agent = record.userAgent || '';
      // 关联字段：user_id
      const sessionUserIdMap = recordIdMaps.get('user');
      if (sessionUserIdMap && record.userId) {
        const feishuUserId = sessionUserIdMap.get(record.userId);
        if (feishuUserId) {
          fields.user_id = [feishuUserId];
        }
      }
      fields.impersonated_by = record.impersonatedBy || '';
      break;

    case 'account':
      fields.id = record.id;
      fields.account_id = record.accountId;
      fields.provider_id = record.providerId;
      // 关联字段：user_id
      const accountUserIdMap = recordIdMaps.get('user');
      if (accountUserIdMap && record.userId) {
        const feishuUserId = accountUserIdMap.get(record.userId);
        if (feishuUserId) {
          fields.user_id = [feishuUserId];
        }
      }
      fields.access_token = record.accessToken || '';
      fields.refresh_token = record.refreshToken || '';
      fields.id_token = record.idToken || '';
      fields.access_token_expires_at = record.accessTokenExpiresAt ? new Date(record.accessTokenExpiresAt).getTime() : null;
      fields.refresh_token_expires_at = record.refreshTokenExpiresAt ? new Date(record.refreshTokenExpiresAt).getTime() : null;
      fields.scope = record.scope || '';
      fields.password = record.password || '';
      // created_at 和 updated_at 如果是 CREATED_TIME/MODIFIED_TIME 类型，飞书会自动管理
      break;

    case 'verification':
      fields.id = record.id;
      fields.identifier = record.identifier;
      fields.value = record.value;
      fields.expires_at = record.expiresAt ? new Date(record.expiresAt).getTime() : null;
      // created_at 和 updated_at 如果是 CREATED_TIME/MODIFIED_TIME 类型，飞书会自动管理
      // 但如果字段类型是 DATE，则需要设置时间戳
      if (record.createdAt) {
        fields.created_at = new Date(record.createdAt).getTime();
      }
      if (record.updatedAt) {
        fields.updated_at = new Date(record.updatedAt).getTime();
      }
      break;

    case 'payment':
      fields.id = record.id;
      fields.price_id = record.priceId;
      fields.type = record.type;
      fields.interval = record.interval || '';
      // 关联字段：user_id
      const paymentUserIdMap = recordIdMaps.get('user');
      if (paymentUserIdMap && record.userId) {
        const feishuUserId = paymentUserIdMap.get(record.userId);
        if (feishuUserId) {
          fields.user_id = [feishuUserId];
        }
      }
      fields.customer_id = record.customerId;
      fields.subscription_id = record.subscriptionId || '';
      fields.status = record.status;
      fields.period_start = record.periodStart ? new Date(record.periodStart).getTime() : null;
      fields.period_end = record.periodEnd ? new Date(record.periodEnd).getTime() : null;
      fields.cancel_at_period_end = record.cancelAtPeriodEnd || false;
      fields.trial_start = record.trialStart ? new Date(record.trialStart).getTime() : null;
      fields.trial_end = record.trialEnd ? new Date(record.trialEnd).getTime() : null;
      // created_at 和 updated_at 如果是 CREATED_TIME/MODIFIED_TIME 类型，飞书会自动管理
      break;
  }

  return fields;
}

// 迁移单个表
async function migrateTable(db: any, feishuClient: any, tableName: string) {
  console.log(`\n📊 开始迁移表: ${tableName}`);

  try {
    // 从 Supabase 读取数据
    let records: any[] = [];
    
    switch (tableName) {
      case 'user':
        records = await db.select().from(schema.user);
        break;
      case 'user_courses':
        records = await db.select().from(schema.userCourses);
        break;
      case 'course_tasks':
        records = await db.select().from(schema.courseTasks);
        break;
      case 'course_chat_history':
        records = await db.select().from(schema.courseChatHistory);
        break;
      case 'creator_courses':
        records = await db.select().from(schema.creatorCourses);
        break;
      case 'key_actions':
        records = await db.select().from(schema.keyActions);
        break;
      case 'session':
        records = await db.select().from(schema.session);
        break;
      case 'account':
        records = await db.select().from(schema.account);
        break;
      case 'verification':
        records = await db.select().from(schema.verification);
        break;
      case 'payment':
        records = await db.select().from(schema.payment);
        break;
      default:
        console.log(`⚠️  未知表名: ${tableName}`);
        return;
    }

    console.log(`  📥 从 Supabase 读取了 ${records.length} 条记录`);

    if (records.length === 0) {
      console.log(`  ⚠️  表 ${tableName} 为空，跳过`);
      return;
    }

    // 获取关联表的记录ID映射
    let relatedRecordIdMap: Map<string, string> | undefined;
    if (tableName === 'user_courses' || tableName === 'course_tasks' || 
        tableName === 'course_chat_history' || tableName === 'creator_courses' ||
        tableName === 'key_actions' || tableName === 'session' || 
        tableName === 'account' || tableName === 'payment') {
      relatedRecordIdMap = recordIdMaps.get('user');
    }

    // 转换为飞书格式，并记录需要上传附件的记录索引
    const feishuRecords: Array<{ fields: Record<string, any>; _needsAttachment?: boolean; _attachmentData?: string }> = [];
    const attachmentIndices: number[] = [];
    
    records.forEach((record, index) => {
      const fields = convertToFeishuFields(record, tableName, relatedRecordIdMap);
      const needsAttachment = !!(fields as any)._coursePlanData;
      feishuRecords.push({ fields, _needsAttachment: needsAttachment, _attachmentData: (fields as any)._coursePlanData });
      if (needsAttachment) {
        attachmentIndices.push(index);
        // 移除临时字段
        delete (fields as any)._coursePlanData;
      }
    });

    // 批量导入到飞书
    const feishuTableName = TABLE_MAPPING[tableName];
    const result = await feishuClient.createRecords(feishuTableName, feishuRecords.map(r => ({ fields: r.fields })));

    // 建立记录ID映射：原始ID -> 飞书记录ID
    const idMap = new Map<string, string>();
    records.forEach((record, index) => {
      if (result.record_ids[index]) {
        idMap.set(record.id, result.record_ids[index]);
      }
    });
    recordIdMaps.set(tableName, idMap);

    // 处理需要上传附件的记录
    if (attachmentIndices.length > 0 && tableName === 'user_courses') {
      console.log(`  📎 开始上传 ${attachmentIndices.length} 个附件文件...`);
      const updateRecords: Array<{ record_id: string; fields: Record<string, any> }> = [];
      
      for (const index of attachmentIndices) {
        const feishuRecordId = result.record_ids[index];
        const attachmentData = feishuRecords[index]._attachmentData;
        
        if (attachmentData && feishuRecordId) {
          try {
            const fileName = `course_plan_${records[index].id}.json`;
            console.log(`    📤 上传附件: ${fileName} (${attachmentData.length} 字符)`);
            const fileToken = await feishuClient.uploadTextAsFile(attachmentData, fileName, 'user_courses');
            
            // 附件字段格式：根据飞书 API 文档，只需要 file_token，不需要 name
            // 格式: [{ file_token: "..." }]
            updateRecords.push({
              record_id: feishuRecordId,
              fields: {
                course_plan_file: [{
                  file_token: fileToken,
                }],
              },
            });
            
            // 避免 API 限流
            await new Promise((resolve) => setTimeout(resolve, 500));
          } catch (error: any) {
            console.error(`    ❌ 上传附件失败 (记录 ${index}):`, error.message);
          }
        }
      }
      
      // 批量更新记录，添加附件
      if (updateRecords.length > 0) {
        try {
          await feishuClient.updateRecords(feishuTableName, updateRecords);
          console.log(`  ✅ 成功上传 ${updateRecords.length} 个附件`);
        } catch (error: any) {
          console.error(`  ❌ 批量更新附件失败:`, error.message);
        }
      }
    }

    console.log(`  ✅ 成功导入 ${result.record_ids.length} 条记录到飞书多维表格`);

  } catch (error) {
    console.error(`  ❌ 迁移表 ${tableName} 失败:`, error);
    throw error;
  }
}

// 主函数
async function main() {
  console.log('🚀 开始迁移 Supabase 数据到飞书多维表格\n');

  // 检查环境变量
  const requiredEnvVars = ['FEISHU_APP_ID', 'FEISHU_APP_SECRET', 'FEISHU_BASE_TOKEN', 'DATABASE_URL'];
  const missingVars = requiredEnvVars.filter((varName) => !process.env[varName]);

  if (missingVars.length > 0) {
    console.error('❌ 缺少必需的环境变量:');
    missingVars.forEach((varName) => console.error(`   - ${varName}`));
    process.exit(1);
  }

  try {
    // 初始化数据库连接
    const db = await getDb();
    console.log('✅ 数据库连接成功');

    // 初始化飞书客户端
    const feishuClient = getFeishuClient();
    console.log('✅ 飞书客户端初始化成功');

    // 列出飞书多维表格中的所有表
    console.log('\n📋 检查飞书多维表格中的表...');
    const feishuTables = await feishuClient.listTables();
    console.log(`✅ 飞书多维表格中共有 ${feishuTables.length} 个表:`);
    feishuTables.forEach((table) => {
      console.log(`   - ${table.name} (ID: ${table.table_id})`);
    });

    // 迁移所有表（按依赖顺序）
    // 先迁移被关联的表，再迁移依赖它们的表
    const migrationOrder = [
      'user',              // 基础表，其他表会关联它
      'user_courses',      // 依赖 user
      'course_tasks',      // 依赖 user_courses
      'course_chat_history', // 依赖 user_courses
      'creator_courses',   // 依赖 user 和 user_courses
      'key_actions',       // 依赖 user
      'session',           // 依赖 user
      'account',           // 依赖 user
      'verification',      // 无依赖
      'payment',           // 依赖 user
    ];

    // 检查哪些表在飞书中不存在
    const missingTables = migrationOrder.filter(
      (tableName) => !feishuTables.some((t) => t.name === tableName)
    );
    
    if (missingTables.length > 0) {
      console.log(`\n⚠️  以下表在飞书多维表格中不存在:`);
      missingTables.forEach((tableName) => {
        console.log(`   - ${tableName}`);
      });
      console.log(`\n💡 请先在飞书多维表格中创建这些表，然后重新运行迁移脚本。`);
      console.log(`   运行: npm run create-feishu-tables`);
      process.exit(1);
    }
    
    // 按顺序迁移表
    for (const tableName of migrationOrder) {
      await migrateTable(db, feishuClient, tableName);
      // 添加延迟避免 API 限流
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }

    console.log('\n✅ 所有表迁移完成！');

  } catch (error) {
    console.error('\n❌ 迁移失败:', error);
    process.exit(1);
  }
}

// 运行迁移
if (require.main === module) {
  main();
}

export { migrateTable, convertToFeishuFields };

