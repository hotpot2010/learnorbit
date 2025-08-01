import { type InferPageType, loader } from 'fumadocs-core/source';
import { createMDXSource } from 'fumadocs-mdx';
import * as LucideIcons from 'lucide-react';
import { createElement } from 'react';
import { author, blog, category, changelog, docs, pages } from '../../.source';
import { docsI18nConfig } from './docs/i18n';

/**
 * Turn a content source into a unified interface
 * .source folder is generated by `fumadocs-mdx`
 *
 * https://fumadocs.dev/docs/headless/source-api
 */
export const source = loader({
  baseUrl: '/docs',
  i18n: docsI18nConfig,
  source: docs.toFumadocsSource(),
  icon(iconName) {
    if (!iconName) {
      return undefined;
    }

    const IconComponent = (LucideIcons as Record<string, any>)[iconName];
    if (IconComponent) {
      return createElement(IconComponent);
    }

    console.warn(`Icon not found: ${iconName}`);
    return undefined;
  },
});

/**
 * Changelog source
 */
export const changelogSource = loader({
  baseUrl: '/changelog',
  i18n: docsI18nConfig,
  source: createMDXSource(changelog),
});

/**
 * Pages source
 *
 * TODO: how to set the baseUrl for pages?
 */
export const pagesSource = loader({
  baseUrl: '/pages',
  i18n: docsI18nConfig,
  source: createMDXSource(pages),
});

/**
 * Blog authors source
 */
export const authorSource = loader({
  baseUrl: '/author',
  i18n: docsI18nConfig,
  source: createMDXSource(author),
});

/**
 * Blog categories source
 */
export const categorySource = loader({
  baseUrl: '/category',
  i18n: docsI18nConfig,
  source: createMDXSource(category),
});

/**
 * Blog posts source
 */
export const blogSource = loader({
  baseUrl: '/blog',
  i18n: docsI18nConfig,
  source: createMDXSource(blog),
  transformers: [
    (page) => {
      // console.log('page', page);
      return page;
    },
  ],
});

export type ChangelogType = InferPageType<typeof changelogSource>;
export type PagesType = InferPageType<typeof pagesSource>;
export type AuthorType = InferPageType<typeof authorSource>;
export type CategoryType = InferPageType<typeof categorySource>;
export type BlogType = InferPageType<typeof blogSource>;
