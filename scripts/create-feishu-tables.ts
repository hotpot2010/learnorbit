/**
 * 自动在飞书多维表格中创建表和字段
 * 
 * 使用方法:
 * npm run create-feishu-tables
 */

import 'dotenv/config';
import { getFeishuClient, FEISHU_FIELD_TYPES } from '../src/lib/feishu-client';

// 表结构定义
interface TableField {
  field_name: string;
  type: number;
  property?: any; // 字段属性（如选项、格式等）
}

interface TableDefinition {
  name: string;
  fields: TableField[];
}

// 所有表的定义
const TABLE_DEFINITIONS: TableDefinition[] = [
  {
    name: 'user',
    fields: [
      { field_name: 'id', type: FEISHU_FIELD_TYPES.TEXT },
      { field_name: 'name', type: FEISHU_FIELD_TYPES.TEXT },
      { field_name: 'email', type: FEISHU_FIELD_TYPES.TEXT },
      { field_name: 'email_verified', type: FEISHU_FIELD_TYPES.CHECKBOX },
      { field_name: 'image', type: FEISHU_FIELD_TYPES.TEXT },
      { field_name: 'created_at', type: FEISHU_FIELD_TYPES.CREATED_TIME },
      { field_name: 'updated_at', type: FEISHU_FIELD_TYPES.MODIFIED_TIME },
      { field_name: 'role', type: FEISHU_FIELD_TYPES.TEXT },
      { field_name: 'customer_id', type: FEISHU_FIELD_TYPES.TEXT },
      // 注意：banned, ban_reason, ban_expires, is_creator 字段已从数据库架构中删除
      // 判断是否为创作者现在通过 isCreatorEmail() 函数基于邮箱地址判断
    ],
  },
  {
    name: 'user_courses',
    fields: [
      { field_name: 'id', type: FEISHU_FIELD_TYPES.TEXT },
      { field_name: 'user_id', type: FEISHU_FIELD_TYPES.LINK, property: { table_id: 'user', multiple: false } },
      { field_name: 'course_plan', type: FEISHU_FIELD_TYPES.TEXT }, // JSON 存储为文本（用于小数据）
      { field_name: 'course_plan_file', type: FEISHU_FIELD_TYPES.ATTACHMENT }, // 附件字段（用于大数据）
      { field_name: 'current_step', type: FEISHU_FIELD_TYPES.NUMBER },
      { field_name: 'status', type: FEISHU_FIELD_TYPES.SINGLE_SELECT, property: { options: [
        { name: 'in-progress', color: 0 },
        { name: 'completed', color: 1 },
      ] } },
      { field_name: 'tasks_generated', type: FEISHU_FIELD_TYPES.CHECKBOX },
      { field_name: 'created_at', type: FEISHU_FIELD_TYPES.CREATED_TIME },
      { field_name: 'updated_at', type: FEISHU_FIELD_TYPES.MODIFIED_TIME },
    ],
  },
  {
    name: 'creator_courses',
    fields: [
      { field_name: 'id', type: FEISHU_FIELD_TYPES.TEXT },
      { field_name: 'slug', type: FEISHU_FIELD_TYPES.TEXT },
      { field_name: 'course_id', type: FEISHU_FIELD_TYPES.LINK, property: { table_id: 'user_courses', multiple: false } },
      { field_name: 'creator_id', type: FEISHU_FIELD_TYPES.LINK, property: { table_id: 'user', multiple: false } },
      { field_name: 'title', type: FEISHU_FIELD_TYPES.TEXT },
      { field_name: 'description', type: FEISHU_FIELD_TYPES.TEXT },
      { field_name: 'is_active', type: FEISHU_FIELD_TYPES.CHECKBOX },
      { field_name: 'created_at', type: FEISHU_FIELD_TYPES.CREATED_TIME },
      { field_name: 'updated_at', type: FEISHU_FIELD_TYPES.MODIFIED_TIME },
    ],
  },
  {
    name: 'key_actions',
    fields: [
      { field_name: 'id', type: FEISHU_FIELD_TYPES.TEXT },
      { field_name: 'event_name', type: FEISHU_FIELD_TYPES.TEXT },
      { field_name: 'timestamp', type: FEISHU_FIELD_TYPES.NUMBER },
      { field_name: 'server_timestamp', type: FEISHU_FIELD_TYPES.DATE },
      { field_name: 'session_id', type: FEISHU_FIELD_TYPES.TEXT },
      { field_name: 'user_id', type: FEISHU_FIELD_TYPES.LINK, property: { table_id: 'user', multiple: false } },
      { field_name: 'locale', type: FEISHU_FIELD_TYPES.TEXT },
      { field_name: 'device_type', type: FEISHU_FIELD_TYPES.TEXT },
      { field_name: 'user_agent', type: FEISHU_FIELD_TYPES.TEXT },
      { field_name: 'page_path', type: FEISHU_FIELD_TYPES.TEXT },
      { field_name: 'page_title', type: FEISHU_FIELD_TYPES.TEXT },
      { field_name: 'action_data', type: FEISHU_FIELD_TYPES.TEXT }, // JSON 存储为文本
      { field_name: 'created_at', type: FEISHU_FIELD_TYPES.CREATED_TIME },
    ],
  },
  {
    name: 'session',
    fields: [
      { field_name: 'id', type: FEISHU_FIELD_TYPES.TEXT },
      { field_name: 'expires_at', type: FEISHU_FIELD_TYPES.DATE },
      { field_name: 'token', type: FEISHU_FIELD_TYPES.TEXT },
      { field_name: 'created_at', type: FEISHU_FIELD_TYPES.CREATED_TIME },
      { field_name: 'updated_at', type: FEISHU_FIELD_TYPES.MODIFIED_TIME },
      { field_name: 'ip_address', type: FEISHU_FIELD_TYPES.TEXT },
      { field_name: 'user_agent', type: FEISHU_FIELD_TYPES.TEXT },
      { field_name: 'user_id', type: FEISHU_FIELD_TYPES.LINK, property: { table_id: 'user', multiple: false } },
    ],
  },
  {
    name: 'account',
    fields: [
      { field_name: 'id', type: FEISHU_FIELD_TYPES.TEXT },
      { field_name: 'account_id', type: FEISHU_FIELD_TYPES.TEXT },
      { field_name: 'provider_id', type: FEISHU_FIELD_TYPES.TEXT },
      { field_name: 'user_id', type: FEISHU_FIELD_TYPES.LINK, property: { table_id: 'user', multiple: false } },
      { field_name: 'access_token', type: FEISHU_FIELD_TYPES.TEXT },
      { field_name: 'refresh_token', type: FEISHU_FIELD_TYPES.TEXT },
      { field_name: 'id_token', type: FEISHU_FIELD_TYPES.TEXT },
      { field_name: 'access_token_expires_at', type: FEISHU_FIELD_TYPES.DATE },
      { field_name: 'refresh_token_expires_at', type: FEISHU_FIELD_TYPES.DATE },
      { field_name: 'scope', type: FEISHU_FIELD_TYPES.TEXT },
      { field_name: 'password', type: FEISHU_FIELD_TYPES.TEXT },
      { field_name: 'created_at', type: FEISHU_FIELD_TYPES.CREATED_TIME },
      { field_name: 'updated_at', type: FEISHU_FIELD_TYPES.MODIFIED_TIME },
    ],
  },
  {
    name: 'verification',
    fields: [
      { field_name: 'id', type: FEISHU_FIELD_TYPES.TEXT },
      { field_name: 'identifier', type: FEISHU_FIELD_TYPES.TEXT },
      { field_name: 'value', type: FEISHU_FIELD_TYPES.TEXT },
      { field_name: 'expires_at', type: FEISHU_FIELD_TYPES.DATE },
      { field_name: 'created_at', type: FEISHU_FIELD_TYPES.DATE },
      { field_name: 'updated_at', type: FEISHU_FIELD_TYPES.DATE },
    ],
  },
  {
    name: 'payment',
    fields: [
      { field_name: 'id', type: FEISHU_FIELD_TYPES.TEXT },
      { field_name: 'price_id', type: FEISHU_FIELD_TYPES.TEXT },
      { field_name: 'type', type: FEISHU_FIELD_TYPES.TEXT },
      { field_name: 'interval', type: FEISHU_FIELD_TYPES.TEXT },
      { field_name: 'user_id', type: FEISHU_FIELD_TYPES.LINK, property: { table_id: 'user', multiple: false } },
      { field_name: 'customer_id', type: FEISHU_FIELD_TYPES.TEXT },
      { field_name: 'subscription_id', type: FEISHU_FIELD_TYPES.TEXT },
      { field_name: 'status', type: FEISHU_FIELD_TYPES.TEXT },
      { field_name: 'period_start', type: FEISHU_FIELD_TYPES.DATE },
      { field_name: 'period_end', type: FEISHU_FIELD_TYPES.DATE },
      { field_name: 'cancel_at_period_end', type: FEISHU_FIELD_TYPES.CHECKBOX },
      { field_name: 'trial_start', type: FEISHU_FIELD_TYPES.DATE },
      { field_name: 'trial_end', type: FEISHU_FIELD_TYPES.DATE },
      { field_name: 'created_at', type: FEISHU_FIELD_TYPES.CREATED_TIME },
      { field_name: 'updated_at', type: FEISHU_FIELD_TYPES.MODIFIED_TIME },
    ],
  },
];

// 使用 FeishuClient 的方法

async function main() {
  console.log('🚀 开始在飞书多维表格中创建表和字段\n');

  // 检查环境变量
  const requiredEnvVars = ['FEISHU_APP_ID', 'FEISHU_APP_SECRET', 'FEISHU_BASE_TOKEN'];
  const missingVars = requiredEnvVars.filter((varName) => !process.env[varName]);

  if (missingVars.length > 0) {
    console.error('❌ 缺少必需的环境变量:');
    missingVars.forEach((varName) => console.error(`   - ${varName}`));
    process.exit(1);
  }

  try {
    const client = getFeishuClient();

    console.log('✅ 飞书客户端初始化成功\n');

    // 先列出所有现有的表
    const existingTables = await client.listTables();
    const existingTableNames = new Set(existingTables.map((t) => t.name));
    const tableIdMap = new Map<string, string>();
    
    // 将现有表的 ID 存入 map
    existingTables.forEach((table) => {
      tableIdMap.set(table.name, table.table_id);
    });

    console.log(`📋 现有表 (${existingTables.length} 个):`);
    existingTables.forEach((table) => {
      console.log(`   - ${table.name}`);
    });
    console.log('');

    // 创建缺失的表
    const tablesToCreate = TABLE_DEFINITIONS.filter((def) => !existingTableNames.has(def.name));

    if (tablesToCreate.length === 0) {
      console.log('✅ 所有表都已存在，无需创建');
    } else {
      console.log(`📊 需要创建 ${tablesToCreate.length} 个表:\n`);

      // 按依赖顺序创建表（先创建 user，因为其他表会关联它）
      const orderedTables = [
        TABLE_DEFINITIONS.find((t) => t.name === 'user')!,
        ...tablesToCreate.filter((t) => t.name !== 'user'),
      ].filter(Boolean);

      for (const tableDef of orderedTables) {
        if (existingTableNames.has(tableDef.name)) {
          console.log(`⏭️  跳过已存在的表: ${tableDef.name}`);
          continue;
        }

        console.log(`📝 创建表: ${tableDef.name}`);
        try {
          const tableId = await client.createTable(tableDef.name);
          tableIdMap.set(tableDef.name, tableId);
          console.log(`   ✅ 表创建成功，ID: ${tableId}`);

          // 创建字段
          console.log(`   📋 创建字段 (${tableDef.fields.length} 个)...`);
          for (const field of tableDef.fields) {
            try {
              // 如果是关联字段，需要先获取被关联表的 table_id
              let property = field.property;
              if (field.type === FEISHU_FIELD_TYPES.LINK && property?.table_id && tableIdMap) {
                const referencedTableId = tableIdMap.get(property.table_id);
                if (referencedTableId) {
                  property = {
                    ...property,
                    table_id: referencedTableId,
                  };
                } else {
                  console.warn(`      ⚠️  警告: 找不到关联表 ${property.table_id}，将 ${field.field_name} 改为文本字段`);
                  // 如果找不到关联表，将关联字段改为文本字段
                  const fieldId = await client.createField(tableId, field.field_name, FEISHU_FIELD_TYPES.TEXT);
                  console.log(`      ✅ ${field.field_name} (文本，原为关联字段)`);
                  await new Promise((resolve) => setTimeout(resolve, 200));
                  continue;
                }
              }

              const fieldId = await client.createField(tableId, field.field_name, field.type, property);
              console.log(`      ✅ ${field.field_name} (类型: ${field.type})`);
              // 添加延迟避免 API 限流
              await new Promise((resolve) => setTimeout(resolve, 200));
            } catch (error: any) {
              console.error(`      ❌ ${field.field_name}: ${error.message}`);
            }
          }

          console.log(`   ✅ 表 ${tableDef.name} 创建完成\n`);
          // 表之间添加延迟
          await new Promise((resolve) => setTimeout(resolve, 500));
        } catch (error: any) {
          console.error(`   ❌ 创建表失败: ${error.message}\n`);
        }
      }
    }

    // 检查并更新现有表的字段
    console.log('\n🔍 检查现有表的字段...');
    for (const tableDef of TABLE_DEFINITIONS) {
      if (!tableIdMap.has(tableDef.name)) {
        continue;
      }

      const tableId = tableIdMap.get(tableDef.name)!;
      console.log(`\n📋 检查表: ${tableDef.name}`);

      // 获取现有字段（需要调用 API 获取字段列表）
      try {
        // 这里可以添加获取字段列表的逻辑，然后对比缺失的字段
        // 由于飞书 API 的限制，暂时跳过字段检查
        console.log(`   ℹ️  字段检查功能待实现（需要先获取现有字段列表）`);
      } catch (error: any) {
        console.error(`   ⚠️  检查字段失败: ${error.message}`);
      }
    }

    console.log('\n✅ 表和字段创建完成！');
    console.log('\n💡 下一步: 运行迁移脚本导入数据');
    console.log('   npm run migrate-feishu');

  } catch (error: any) {
    console.error('\n❌ 创建失败:', error.message);
    if (error.stack) {
      console.error(error.stack);
    }
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

export { TABLE_DEFINITIONS };

