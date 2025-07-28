import { createClient } from '@supabase/supabase-js';
import type { 
  UserCourse, 
  CourseStep, 
  StepContent, 
  UserQuizAttempt, 
  UserLearningActivity,
  CreateCourseRequest,
  UpdateProgressRequest,
  SubmitAnswersRequest
} from '@/types/user-course';

// 假设使用 Supabase 作为数据库
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export class UserCourseRepository {
  
  // 获取用户的所有课程
  async getUserCourses(userId: string): Promise<UserCourse[]> {
    const { data, error } = await supabase
      .from('user_courses')
      .select(`
        *,
        steps:course_steps(*)
      `)
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  }

  // 获取特定课程详情
  async getUserCourse(userId: string, courseId: string): Promise<UserCourse | null> {
    const { data, error } = await supabase
      .from('user_courses')
      .select(`
        *,
        steps:course_steps(
          *,
          content:step_content(*)
        )
      `)
      .eq('user_id', userId)
      .eq('course_id', courseId)
      .single();

    if (error && error.code !== 'PGRST116') throw error;
    return data;
  }

  // 创建新课程
  async createUserCourse(userId: string, courseData: CreateCourseRequest): Promise<UserCourse> {
    const courseId = `course-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    // 创建课程主记录
    const { data: course, error: courseError } = await supabase
      .from('user_courses')
      .insert({
        user_id: userId,
        course_id: courseId,
        title: courseData.title,
        description: courseData.description,
        difficulty: courseData.difficulty,
        estimated_time: courseData.estimatedTime,
        status: 'learning',
        overall_progress: 0
      })
      .select()
      .single();

    if (courseError) throw courseError;

    // 创建课程步骤
    const steps = courseData.steps.map((step, index) => ({
      user_course_id: course.id,
      step_index: index,
      step_id: `step-${index + 1}`,
      title: step.title,
      description: step.description,
      type: step.type,
      estimated_time: step.estimatedTime,
      status: index === 0 ? 'current' : 'pending',
      progress: 0
    }));

    const { data: createdSteps, error: stepsError } = await supabase
      .from('course_steps')
      .insert(steps)
      .select();

    if (stepsError) throw stepsError;

    // 创建步骤内容
    for (let i = 0; i < createdSteps.length; i++) {
      const step = createdSteps[i];
      const stepData = courseData.steps[i];
      
      if (stepData.content && stepData.content.length > 0) {
        const contentRecords = stepData.content.map(content => ({
          course_step_id: step.id,
          content_type: content.contentType,
          content_data: content.contentData
        }));

        const { error: contentError } = await supabase
          .from('step_content')
          .insert(contentRecords);

        if (contentError) throw contentError;
      }
    }

    // 记录学习活动
    await this.recordLearningActivity(userId, courseId, 'course_started');

    return course;
  }

  // 更新步骤进度
  async updateStepProgress(
    userId: string, 
    courseId: string, 
    progressData: UpdateProgressRequest
  ): Promise<void> {
    // 更新步骤进度
    const { error: stepError } = await supabase
      .from('course_steps')
      .update({
        progress: progressData.progress,
        status: progressData.status,
        updated_at: new Date().toISOString()
      })
      .eq('step_id', progressData.stepId)
      .eq('user_course_id', 
        supabase
          .from('user_courses')
          .select('id')
          .eq('user_id', userId)
          .eq('course_id', courseId)
          .single()
      );

    if (stepError) throw stepError;

    // 更新课程整体进度
    await this.updateCourseProgress(userId, courseId);

    // 记录学习活动
    if (progressData.status === 'completed') {
      await this.recordLearningActivity(userId, courseId, 'step_completed', {
        stepId: progressData.stepId,
        progress: progressData.progress
      });
    }
  }

  // 提交答题结果
  async submitQuizAnswers(
    userId: string,
    courseId: string,
    submissionData: SubmitAnswersRequest
  ): Promise<UserQuizAttempt> {
    // 获取步骤和测验内容
    const { data: stepData, error: stepError } = await supabase
      .from('course_steps')
      .select(`
        id,
        content:step_content!inner(*)
      `)
      .eq('step_id', submissionData.stepId)
      .eq('content.content_type', 'quiz')
      .single();

    if (stepError) throw stepError;

    const quizContent = stepData.content[0];
    const quizData = quizContent.content_data;
    
    // 计算得分
    let correctAnswers = 0;
    const totalQuestions = quizData.questions.length;
    
    quizData.questions.forEach((question: any, index: number) => {
      if (submissionData.answers[index] === question.answer) {
        correctAnswers++;
      }
    });

    const score = Math.round((correctAnswers / totalQuestions) * 100);
    const isPassed = score >= 60; // 60分及格

    // 保存答题记录
    const { data: attempt, error: attemptError } = await supabase
      .from('user_quiz_attempts')
      .insert({
        user_id: userId,
        course_step_id: stepData.id,
        quiz_data: quizData,
        user_answers: submissionData.answers,
        score: score,
        is_passed: isPassed
      })
      .select()
      .single();

    if (attemptError) throw attemptError;

    // 记录学习活动
    await this.recordLearningActivity(userId, courseId, 'quiz_attempted', {
      stepId: submissionData.stepId,
      score: score,
      isPassed: isPassed
    });

    // 如果通过测验，自动更新步骤进度
    if (isPassed) {
      await this.updateStepProgress(userId, courseId, {
        stepId: submissionData.stepId,
        progress: 100,
        status: 'completed'
      });
    }

    return attempt;
  }

  // 获取用户的答题记录
  async getUserQuizAttempts(userId: string, stepId?: string): Promise<UserQuizAttempt[]> {
    let query = supabase
      .from('user_quiz_attempts')
      .select('*')
      .eq('user_id', userId)
      .order('attempted_at', { ascending: false });

    if (stepId) {
      query = query.eq('course_step_id', stepId);
    }

    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  }

  // 删除用户课程
  async deleteUserCourse(userId: string, courseId: string): Promise<void> {
    const { error } = await supabase
      .from('user_courses')
      .delete()
      .eq('user_id', userId)
      .eq('course_id', courseId);

    if (error) throw error;
  }

  // 更新课程状态
  async updateCourseStatus(
    userId: string, 
    courseId: string, 
    status: 'learning' | 'published' | 'completed'
  ): Promise<void> {
    const { error } = await supabase
      .from('user_courses')
      .update({ 
        status: status,
        updated_at: new Date().toISOString()
      })
      .eq('user_id', userId)
      .eq('course_id', courseId);

    if (error) throw error;

    if (status === 'completed') {
      await this.recordLearningActivity(userId, courseId, 'course_completed');
    }
  }

  // 获取用户学习统计
  async getUserLearningStats(userId: string): Promise<{
    totalCourses: number;
    completedCourses: number;
    inProgressCourses: number;
    totalLearningTime: number;
    averageProgress: number;
  }> {
    const { data: courses, error } = await supabase
      .from('user_courses')
      .select('status, overall_progress, estimated_time')
      .eq('user_id', userId);

    if (error) throw error;

    const totalCourses = courses.length;
    const completedCourses = courses.filter(c => c.status === 'completed').length;
    const inProgressCourses = courses.filter(c => c.status === 'learning').length;
    const averageProgress = totalCourses > 0 
      ? courses.reduce((sum, c) => sum + c.overall_progress, 0) / totalCourses 
      : 0;

    return {
      totalCourses,
      completedCourses,
      inProgressCourses,
      totalLearningTime: 0, // 可以根据需要计算
      averageProgress: Math.round(averageProgress)
    };
  }

  // 私有方法：更新课程整体进度
  private async updateCourseProgress(userId: string, courseId: string): Promise<void> {
    // 获取课程的所有步骤
    const { data: steps, error } = await supabase
      .from('course_steps')
      .select('progress')
      .eq('user_course_id', 
        supabase
          .from('user_courses')
          .select('id')
          .eq('user_id', userId)
          .eq('course_id', courseId)
          .single()
      );

    if (error) throw error;

    // 计算平均进度
    const totalSteps = steps.length;
    const totalProgress = steps.reduce((sum, step) => sum + step.progress, 0);
    const overallProgress = totalSteps > 0 ? Math.round(totalProgress / totalSteps) : 0;

    // 更新课程进度
    const { error: updateError } = await supabase
      .from('user_courses')
      .update({ 
        overall_progress: overallProgress,
        updated_at: new Date().toISOString()
      })
      .eq('user_id', userId)
      .eq('course_id', courseId);

    if (updateError) throw updateError;

    // 如果完成了所有步骤，自动标记课程为完成
    if (overallProgress === 100) {
      await this.updateCourseStatus(userId, courseId, 'completed');
    }
  }

  // 私有方法：记录学习活动
  private async recordLearningActivity(
    userId: string,
    courseId: string,
    activityType: 'course_started' | 'step_completed' | 'quiz_attempted' | 'course_completed',
    activityData?: any
  ): Promise<void> {
    const { error } = await supabase
      .from('user_learning_activities')
      .insert({
        user_id: userId,
        course_id: courseId,
        activity_type: activityType,
        activity_data: activityData
      });

    if (error) throw error;
  }
} 