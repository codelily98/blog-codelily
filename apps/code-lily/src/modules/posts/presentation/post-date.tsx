const dateFormatter = new Intl.DateTimeFormat('ko-KR', {
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  timeZone: 'Asia/Seoul',
});

export function PostDate({ value }: { value: string }) {
  const date = dateFormatter.formatToParts(new Date(value));
  const display = date.filter(({ type }) => type !== 'literal').map(({ value }) => value);
  return <time dateTime={value}>{display.join('-')}</time>;
}
