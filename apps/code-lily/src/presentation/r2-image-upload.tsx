'use client';
import { useState } from 'react';
import { Button, Input, useToast } from '@codelily/ui';
import { requestApi } from './client-api';
export function R2ImageUpload({ onInsert }: { onInsert: (url: string, alt: string) => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [alt, setAlt] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const toast = useToast();
  return (
    <fieldset className="space-y-3 rounded-xl border border-line p-4">
      <legend className="px-2 text-sm font-semibold">R2 이미지 업로드</legend>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="mb-2 block text-xs text-muted" htmlFor="upload-file">
            이미지 파일 (최대 10MB)
          </label>
          <Input
            id="upload-file"
            type="file"
            accept="image/png,image/jpeg,image/webp,image/avif"
            onChange={(event) => setFile(event.target.files?.[0] || null)}
          />
        </div>
        <div>
          <label htmlFor="image-alt" className="mb-2 block text-xs text-muted">
            이미지 설명 (필수)
          </label>
          <Input
            id="image-alt"
            value={alt}
            onChange={(event) => setAlt(event.target.value)}
            maxLength={300}
            placeholder="이미지가 전달하는 내용을 설명해주세요"
          />
        </div>
      </div>
      {error ? (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      ) : null}
      <Button
        variant="secondary"
        disabled={!file || !alt.trim() || busy}
        onClick={async () => {
          if (!file) return;
          setBusy(true);
          setError('');
          try {
            const reservation = await requestApi<{ id: string; url: string }>(
              '/api/uploads',
              'POST',
              { contentType: file.type, size: file.size, public: true },
            );
            const upload = await fetch(reservation.url, {
              method: 'PUT',
              headers: { 'Content-Type': file.type },
              body: file,
            });
            if (!upload.ok)
              throw new Error('파일 전송에 실패했습니다. R2 CORS 설정을 확인해주세요.');
            const result = await requestApi<{ url: string }>(
              `/api/uploads/${reservation.id}/complete`,
              'POST',
              {},
            );
            onInsert(result.url, alt.trim());
            setFile(null);
            toast('본문 끝에 이미지를 추가했습니다.');
          } catch (error) {
            setError((error as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        {busy ? '업로드·검증 중…' : '업로드 후 본문에 추가'}
      </Button>
    </fieldset>
  );
}
