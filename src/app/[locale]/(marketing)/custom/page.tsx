import { AIChatInterface } from '@/components/learning/ai-chat-interface';
import { CourseRecommendationGrid } from '@/components/learning/course-recommendation-grid';
import { CustomLearningPlan } from '@/components/learning/custom-learning-plan';
import { type CourseStep, mockCourseData } from '@/data/mockCourseData';
import type { Metadata } from 'next';
import type { Locale } from 'next-intl';
import { getTranslations } from 'next-intl/server';
import Link from 'next/link';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'LearningPlatform' });

  return {
    title: t('customizeLearning'),
    description: t('letsCustomize'),
  };
}

interface CustomPageProps {
  params: Promise<{ locale: Locale }>;
}

// 生成随机评分
const generateRating = (courseId: string) => {
  const ratings = [4.2, 4.5, 4.7, 4.8, 4.9, 4.3, 4.6, 4.4, 4.1];
  return ratings[
    Math.abs(courseId.split('').reduce((a, b) => a + b.charCodeAt(0), 0)) %
      ratings.length
  ];
};

// 星星组件
const StarRating = ({ rating }: { rating: number }) => {
  const fullStars = Math.floor(rating);
  const hasHalfStar = rating % 1 !== 0;

  return (
    <div className="flex items-center space-x-1">
      {[...Array(5)].map((_, i) => (
        <span key={i} className="text-yellow-400 text-sm">
          {i < fullStars ? '★' : i === fullStars && hasHalfStar ? '☆' : '☆'}
        </span>
      ))}
      <span className="text-sm text-slate-500 ml-1">{rating}</span>
    </div>
  );
};

export default async function CustomPage(props: CustomPageProps) {
  const params = await props.params;
  const { locale } = params;
  const t = await getTranslations('LearningPlatform');

  const recommendedCourses = [
    {
      id: 'reinforcement-learning',
      title: 'Reinforcement Learning & Q-Learning',
      description:
        'Learn Q-Learning algorithms and agent training, build AI systems that can learn autonomously in environments',
      coverImage: '/images/blog/post-1.png',
      estimatedTime: '6 hours',
      difficulty: 'intermediate' as const,
    },
    {
      id: 'python-basics',
      title: 'Python Programming Fundamentals',
      description:
        'Master Python syntax, data structures and object-oriented programming, laying the foundation for AI learning',
      coverImage: '/images/blog/post-2.png',
      estimatedTime: '4 hours',
      difficulty: 'beginner' as const,
    },
    {
      id: 'machine-learning',
      title: 'Machine Learning Basics',
      description:
        'From supervised to unsupervised learning, master core machine learning algorithms and practical applications',
      coverImage: '/images/blog/post-3.png',
      estimatedTime: '8 hours',
      difficulty: 'intermediate' as const,
    },
  ];

  return <CustomLearningPlan recommendedCourses={recommendedCourses} />;
}
