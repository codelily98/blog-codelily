export const publicationName = 'code-lily';
export const publicationDescription = '웹 개발과 시스템 설계, 운영에서 배운 것을 기록합니다.';
export const feedPath = '/feed.xml';

export function publicationUrl() {
  return new URL(process.env.APP_URL || 'https://blog.codelily.kr').origin;
}
