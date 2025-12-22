// Google Fonts 访问受限，暂时禁用
// import {
//   Bricolage_Grotesque,
//   Noto_Sans,
//   Noto_Sans_Mono,
//   Noto_Serif,
// } from 'next/font/google';

/**
 * 1. Fonts Documentation
 * https://mksaas.com/docs/fonts
 *
 * 2. This file shows how to customize the font by using local font or google font
 *
 * [1] use local font
 *
 * - Get font file from https://gwfh.mranftl.com/fonts
 * - Add font file to the assets/fonts folder
 * - Add font variable to the font object
 */
// https://gwfh.mranftl.com/fonts/bricolage-grotesque?subsets=latin
// export const fontBricolageGrotesque = localFont({
//   src: './Bricolage Grotesque-grotesque-v7-latin-regular.woff2',
//   variable: '--font-bricolage-grotesque',
// });

/**
 * [2] use google font
 *
 * - You can browser fonts at Google Fonts
 * https://fonts.google.com
 *
 * - CSS and font files are downloaded at build time and self-hosted with the rest of your static assets.
 * https://nextjs.org/docs/app/building-your-application/optimizing/fonts#google-fonts
 */

// 使用系统字体作为备选方案
export const fontNotoSans = {
  variable: '--font-noto-sans',
  className: '',
};

export const fontNotoSerif = {
  variable: '--font-noto-serif',
  className: '',
};

export const fontNotoSansMono = {
  variable: '--font-noto-sans-mono',
  className: '',
};

export const fontBricolageGrotesque = {
  variable: '--font-bricolage-grotesque',
  className: '',
};

// 如果需要恢复 Google Fonts，请配置代理或使用镜像
// https://fonts.google.com/noto/specimen/Noto+Sans
// export const fontNotoSans = Noto_Sans({
//   subsets: ['latin'],
//   display: 'swap',
//   variable: '--font-noto-sans',
//   weight: ['500', '600', '700'],
// });

// https://fonts.google.com/noto/specimen/Noto+Serif
// export const fontNotoSerif = Noto_Serif({
//   subsets: ['latin'],
//   display: 'swap',
//   variable: '--font-noto-serif',
//   weight: ['400'],
// });

// https://fonts.google.com/noto/specimen/Noto+Sans+Mono
// export const fontNotoSansMono = Noto_Sans_Mono({
//   subsets: ['latin'],
//   display: 'swap',
//   variable: '--font-noto-sans-mono',
//   weight: ['400'],
// });

// https://fonts.google.com/specimen/Bricolage+Grotesque
// export const fontBricolageGrotesque = Bricolage_Grotesque({
//   subsets: ['latin'],
//   display: 'swap',
//   variable: '--font-bricolage-grotesque',
//   weight: ['400', '500', '600', '700'],
// });
