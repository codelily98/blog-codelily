import { transaction, type Database } from '../../../infrastructure/database';
import type { Member, MemberRepository } from '../application/members.service';
export class PostgresMembersRepository implements MemberRepository {
  constructor(private db: Database) {}
  async list() {
    return JSON.parse(
      JSON.stringify(
        (
          await this.db.query<Member>(
            'SELECT id,name,email,role,"createdAt" FROM "user" ORDER BY "createdAt" DESC LIMIT 100',
          )
        ).rows,
      ),
    );
  }
  async setRole(id: string, role: 'MEMBER' | 'EDITOR', actorId: string) {
    return transaction(this.db, async (connection) => {
      const result = await connection.query(
        'UPDATE "user" SET role=$1,"updatedAt"=now() WHERE id=$2 AND role<>\'OWNER\' RETURNING id',
        [role, id],
      );
      if (!result.rows.length) return false;
      await connection.query('INSERT INTO audit_logs(actor_id,action,entity_id) VALUES($1,$2,$3)', [
        actorId,
        `member.role.${role.toLowerCase()}`,
        id,
      ]);
      return true;
    });
  }
}
