'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button, Select, useToast } from '@codelily/ui';
import type { Member } from '../application/members.service';
import { requestApi } from '@/presentation/client-api';
function MemberRow({ member }: { member: Member }) {
  const [role, setRole] = useState(member.role);
  const [busy, setBusy] = useState(false);
  const toast = useToast();
  const router = useRouter();
  return (
    <tr>
      <td className="px-4 py-4">
        <p className="font-semibold">{member.name}</p>
        <p className="mt-1 text-xs text-muted">{member.email}</p>
      </td>
      <td className="px-4 py-4">
        {member.role === 'OWNER' ? (
          <span className="text-xs">OWNER</span>
        ) : (
          <Select
            aria-label={`${member.name} 권한`}
            value={role}
            onChange={(event) => setRole(event.target.value)}
          >
            <option value="MEMBER">MEMBER · 댓글</option>
            <option value="EDITOR">EDITOR · 글 작성</option>
          </Select>
        )}
      </td>
      <td className="px-4 py-4">
        {member.role !== 'OWNER' ? (
          <Button
            variant="secondary"
            disabled={busy || role === member.role}
            onClick={async () => {
              setBusy(true);
              try {
                await requestApi('/api/members', 'PATCH', { id: member.id, role });
                router.refresh();
                toast('회원 권한을 변경했습니다.');
              } catch (error) {
                toast((error as Error).message);
              } finally {
                setBusy(false);
              }
            }}
          >
            저장
          </Button>
        ) : null}
      </td>
    </tr>
  );
}
export function MembersManager({ members }: { members: Member[] }) {
  return (
    <section>
      <h2 className="mb-3 text-xl font-bold">회원 권한</h2>
      <p className="mb-6 text-sm leading-7 text-muted">
        Google로 가입한 회원에게 글 작성 권한을 부여할 수 있습니다. 관리자 권한은 서버의 검증된 최초
        관리자 정책으로만 설정합니다.
      </p>
      <div className="overflow-auto rounded-xl border border-line">
        <table className="w-full text-left text-sm">
          <caption className="sr-only">최근 가입 회원 100명</caption>
          <thead>
            <tr className="border-b border-line">
              <th scope="col" className="px-4 py-3">
                회원
              </th>
              <th scope="col" className="px-4 py-3">
                권한
              </th>
              <th scope="col" className="px-4 py-3">
                작업
              </th>
            </tr>
          </thead>
          <tbody>
            {members.map((member) => (
              <MemberRow key={member.id} member={member} />
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
