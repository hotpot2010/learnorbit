import { getDb } from '../src/db';

async function fixDatabaseSchema() {
  try {
    const db = await getDb();

    console.log('🔧 Checking database schema...');

    // 检查是否存在 is_creator 字段
    try {
      const userColumns = await db.execute(`
        SELECT column_name
        FROM information_schema.columns
        WHERE table_name = 'user' AND column_name = 'is_creator'
      `);

      if ((userColumns as any).length === 0) {
        console.log('➕ Adding is_creator column to user table...');
        await db.execute('ALTER TABLE "user" ADD COLUMN "is_creator" boolean DEFAULT false NOT NULL');
        console.log('✅ Added is_creator column');
      } else {
        console.log('✅ is_creator column already exists');
      }
    } catch (error) {
      console.error('❌ Error checking/adding is_creator column:', error);
    }

    // 检查是否存在 creator_courses 表
    try {
      const tables = await db.execute(`
        SELECT table_name
        FROM information_schema.tables
        WHERE table_name = 'creator_courses'
      `);

      if ((tables as any).length === 0) {
        console.log('➕ Creating creator_courses table...');
        await db.execute(`
          CREATE TABLE "creator_courses" (
            "id" text PRIMARY KEY NOT NULL,
            "slug" text NOT NULL,
            "course_id" text NOT NULL,
            "creator_id" text NOT NULL,
            "title" text NOT NULL,
            "description" text,
            "is_active" boolean DEFAULT true NOT NULL,
            "created_at" timestamp DEFAULT now() NOT NULL,
            "updated_at" timestamp DEFAULT now() NOT NULL
          )
        `);
        console.log('✅ Created creator_courses table');

        // 添加外键约束
        await db.execute(`
          ALTER TABLE "creator_courses"
          ADD CONSTRAINT "creator_courses_course_id_user_courses_id_fk"
          FOREIGN KEY ("course_id") REFERENCES "user_courses"("id") ON DELETE cascade ON UPDATE no action
        `);

        await db.execute(`
          ALTER TABLE "creator_courses"
          ADD CONSTRAINT "creator_courses_creator_id_user_id_fk"
          FOREIGN KEY ("creator_id") REFERENCES "user"("id") ON DELETE cascade ON UPDATE no action
        `);

        console.log('✅ Added foreign key constraints');

        // 添加唯一索引
        await db.execute('CREATE UNIQUE INDEX "creator_courses_slug_unique" ON "creator_courses" ("slug")');
        console.log('✅ Added unique index');

      } else {
        console.log('✅ creator_courses table already exists');

        // 检查索引是否存在
        try {
          const indexes = await db.execute(`
            SELECT indexname
            FROM pg_indexes
            WHERE tablename = 'creator_courses' AND indexname = 'creator_courses_slug_unique'
          `);

          if ((indexes as any).length === 0) {
            console.log('➕ Adding missing unique index...');
            await db.execute('CREATE UNIQUE INDEX "creator_courses_slug_unique" ON "creator_courses" ("slug")');
            console.log('✅ Added unique index');
          } else {
            console.log('✅ Unique index already exists');
          }
        } catch (indexError) {
          console.log('⚠️ Index might already exist or there was an error:', indexError);
        }
      }
    } catch (error) {
      console.error('❌ Error checking/creating creator_courses table:', error);
    }

    // 设置创作者账号
    try {
      console.log('👤 Setting up creator accounts...');
      const creatorEmails = ['zhouletao20@gmail.com', 'ritafeng1234@gmail.com'];

      for (const email of creatorEmails) {
        const result = await db.execute(`
          UPDATE "user" SET "is_creator" = true WHERE "email" = '${email}'
        `);
        console.log(`✅ Set ${email} as creator`);
      }
    } catch (error) {
      console.error('❌ Error setting up creators:', error);
    }

    console.log('🎉 Database schema fix completed!');

  } catch (error) {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  }
}

fixDatabaseSchema();
