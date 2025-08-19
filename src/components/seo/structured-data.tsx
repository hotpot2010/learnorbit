import { websiteConfig } from '@/config/website';
import { getBaseUrl } from '@/lib/urls/urls';

interface OrganizationData {
  name: string;
  url: string;
  logo: string;
  description: string;
  sameAs?: string[];
}

interface WebsiteData {
  name: string;
  url: string;
  description: string;
  inLanguage: string[];
}

interface CourseData {
  name: string;
  description: string;
  provider: OrganizationData;
  educationalLevel?: string;
  teaches?: string[];
}

interface BlogPostData {
  title: string;
  description: string;
  datePublished: string;
  dateModified?: string;
  author: {
    name: string;
    url?: string;
  };
  url: string;
  image?: string;
}

/**
 * 生成组织结构化数据
 */
export function OrganizationStructuredData({ data }: { data: OrganizationData }) {
  const structuredData = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: data.name,
    url: data.url,
    logo: {
      '@type': 'ImageObject',
      url: data.logo,
    },
    description: data.description,
    ...(data.sameAs && { sameAs: data.sameAs }),
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
    />
  );
}

/**
 * 生成网站结构化数据
 */
export function WebsiteStructuredData({ data }: { data: WebsiteData }) {
  const structuredData = {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: data.name,
    url: data.url,
    description: data.description,
    inLanguage: data.inLanguage,
    potentialAction: {
      '@type': 'SearchAction',
      target: {
        '@type': 'EntryPoint',
        urlTemplate: `${data.url}/search?q={search_term_string}`,
      },
      'query-input': 'required name=search_term_string',
    },
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
    />
  );
}

/**
 * 生成教育课程结构化数据
 */
export function CourseStructuredData({ data }: { data: CourseData }) {
  const structuredData = {
    '@context': 'https://schema.org',
    '@type': 'Course',
    name: data.name,
    description: data.description,
    provider: {
      '@type': 'Organization',
      name: data.provider.name,
      url: data.provider.url,
    },
    ...(data.educationalLevel && { educationalLevel: data.educationalLevel }),
    ...(data.teaches && { teaches: data.teaches }),
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
    />
  );
}

/**
 * 生成博客文章结构化数据
 */
export function BlogPostStructuredData({ data }: { data: BlogPostData }) {
  const structuredData = {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    headline: data.title,
    description: data.description,
    datePublished: data.datePublished,
    ...(data.dateModified && { dateModified: data.dateModified }),
    author: {
      '@type': 'Person',
      name: data.author.name,
      ...(data.author.url && { url: data.author.url }),
    },
    url: data.url,
    ...(data.image && {
      image: {
        '@type': 'ImageObject',
        url: data.image,
      },
    }),
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
    />
  );
}

/**
 * 生成FAQ结构化数据
 */
export function FAQStructuredData({ 
  faqs 
}: { 
  faqs: Array<{ question: string; answer: string }> 
}) {
  const structuredData = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqs.map((faq) => ({
      '@type': 'Question',
      name: faq.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: faq.answer,
      },
    })),
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
    />
  );
}

/**
 * 默认的Aitutorly组织数据
 */
export function DefaultOrganizationData() {
  const baseUrl = getBaseUrl();
  const organizationData: OrganizationData = {
    name: 'Aitutorly',
    url: baseUrl,
    logo: `${baseUrl}/logo.png`,
    description: 'AI驱动的个性化学习平台，为每位学习者提供智能化的学习体验',
    sameAs: Object.values(websiteConfig.metadata.social).filter(Boolean),
  };

  return <OrganizationStructuredData data={organizationData} />;
}

/**
 * 默认的网站数据
 */
export function DefaultWebsiteData() {
  const baseUrl = getBaseUrl();
  const websiteData: WebsiteData = {
    name: 'Aitutorly',
    url: baseUrl,
    description: 'AI驱动的个性化学习平台，利用人工智能技术为每位学习者提供个性化的学习体验',
    inLanguage: ['zh-CN', 'en-US'],
  };

  return <WebsiteStructuredData data={websiteData} />;
}