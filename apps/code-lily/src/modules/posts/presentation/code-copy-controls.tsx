'use client';

import { useEffect, useState } from 'react';

export function CodeCopyControls({ contentId }: { contentId: string }) {
  const [feedback, setFeedback] = useState('');

  useEffect(() => {
    const content = document.getElementById(contentId);
    if (!content) return;
    const controls = [...content.querySelectorAll('pre')].map((block, index) => {
      const toolbar = document.createElement('div');
      toolbar.className = 'mt-5 flex justify-end';
      const button = document.createElement('button');
      button.type = 'button';
      button.className =
        'min-h-11 rounded-md border border-line bg-surface px-3 text-sm font-semibold text-ink hover:bg-raised';
      button.textContent = '코드 복사';
      button.setAttribute('aria-label', `${index + 1}번째 코드 블록 복사`);
      let reset: number | undefined;
      const copy = async () => {
        try {
          await navigator.clipboard.writeText(block.textContent ?? '');
          button.textContent = '복사됨';
          setFeedback(`${index + 1}번째 코드 블록을 복사했습니다.`);
        } catch {
          button.textContent = '복사 실패';
          setFeedback('코드를 복사하지 못했습니다. 코드를 선택해 복사해주세요.');
        }
        window.clearTimeout(reset);
        reset = window.setTimeout(() => {
          button.textContent = '코드 복사';
        }, 2000);
      };
      button.addEventListener('click', copy);
      toolbar.append(button);
      block.classList.add('with-copy-control');
      block.before(toolbar);
      return () => {
        window.clearTimeout(reset);
        button.removeEventListener('click', copy);
        block.classList.remove('with-copy-control');
        toolbar.remove();
      };
    });
    return () => controls.forEach((cleanup) => cleanup());
  }, [contentId]);

  return (
    <p role="status" className="sr-only">
      {feedback}
    </p>
  );
}
