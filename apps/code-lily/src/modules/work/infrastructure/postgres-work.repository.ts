import { transaction, type Connection, type Database } from '../../../infrastructure/database';
import { AppError } from '../../identity/domain/policy';
import type {
  CreateWorkNode,
  WorkChange,
  WorkDocument,
  WorkNode,
  WorkRepository,
} from '../domain/models';

const columns = `id,parent_id AS "parentId",node_type AS "nodeType",name,
  sort_order AS "sortOrder",is_public AS "isPublic",updated_at AS "updatedAt",
  deleted_at AS "deletedAt",delete_batch AS "deleteBatch"`;
const visible = `WITH RECURSIVE visible AS (
  SELECT n.* FROM work_node n WHERE parent_id IS NULL AND deleted_at IS NULL AND ($1 OR is_public)
  UNION ALL
  SELECT n.* FROM work_node n JOIN visible p ON n.parent_id=p.id
  WHERE n.deleted_at IS NULL AND ($1 OR n.is_public)
)`;
const serialize = <T>(value: T): T => JSON.parse(JSON.stringify(value));
const missing = () => new AppError(404, '항목을 찾을 수 없습니다.');
const conflict = () =>
  new AppError(
    409,
    '다른 창에서 변경되었습니다. 새로 불러온 뒤 다시 시도해 주세요.',
    'WORK_CONFLICT',
  );

export class PostgresWorkRepository implements WorkRepository {
  constructor(private db: Database) {}

  async tree(manage: boolean) {
    // One snapshot prevents a tree from being paired with a newer revision.
    const result = await this.db.query<{ nodes: WorkNode[]; version: number }>(
      `${visible}
      SELECT s.version,coalesce((SELECT json_agg(t) FROM (
        SELECT ${columns} FROM visible ORDER BY sort_order,id
      ) t),'[]'::json) AS nodes FROM work_space s WHERE s.id=1`,
      [manage],
    );
    return serialize(result.rows[0]);
  }

  async read(id: string, manage: boolean) {
    const result = await this.db.query<Omit<WorkDocument, 'renderedHtml'>>(
      `${visible}
      SELECT n.id,n.name,d.content,d.version,d.updated_at AS "updatedAt"
      FROM visible n JOIN work_document d ON d.node_id=n.id WHERE n.id=$2`,
      [manage, id],
    );
    return serialize(result.rows[0] ?? null);
  }

  private async mutate<T>(
    actorId: string,
    expected: number | undefined,
    action: string,
    work: (connection: Connection, nodes: WorkNode[]) => Promise<T>,
  ) {
    return transaction(this.db, async (connection) => {
      // Shared lock order for create, move, publish, save, delete, restore and expiry.
      const space = await connection.query<{ version: number }>(
        'SELECT version FROM work_space WHERE id=1 FOR UPDATE',
      );
      if (expected !== undefined && space.rows[0].version !== expected) throw conflict();
      const nodes = (
        await connection.query<WorkNode>(`SELECT ${columns} FROM work_node ORDER BY sort_order,id`)
      ).rows;
      const result = await work(connection, nodes);
      if (action !== 'saved')
        await connection.query('UPDATE work_space SET version=version+1 WHERE id=1');
      if (action !== 'saved')
        await connection.query(
          'INSERT INTO audit_logs(actor_id,action,entity_id) VALUES($1,$2,$3)',
          [actorId, `work.${action}`, 'work'],
        );
      return result === undefined ? result : serialize(result);
    });
  }

  private parent(nodes: WorkNode[], id: string | null) {
    if (id === null) return null;
    const parent = nodes.find((node) => node.id === id && node.deletedAt === null);
    if (!parent || parent.nodeType !== 'FOLDER')
      throw new AppError(400, '이동할 폴더를 확인해 주세요.');
    return parent;
  }

  private depth(nodes: WorkNode[], parentId: string | null) {
    let depth = 1;
    let current = parentId;
    const seen = new Set<string>();
    while (current) {
      if (seen.has(current)) throw new AppError(400, '하위 폴더로 이동할 수 없습니다.');
      seen.add(current);
      depth++;
      current = nodes.find((node) => node.id === current)?.parentId ?? null;
    }
    return depth;
  }

  private checkCapacity(nodes: WorkNode[], count = 1) {
    if (nodes.length + count > 2000)
      throw new AppError(409, '휴지통을 포함해 최대 2,000개 항목을 보관할 수 있습니다.');
  }

  private async insert(
    connection: Connection,
    input: Omit<CreateWorkNode, 'treeVersion'>,
    actorId: string,
    systemKey: string | null = null,
    journalDate: string | null = null,
  ) {
    const result = await connection.query<WorkNode>(
      `INSERT INTO work_node(parent_id,node_type,name,created_by,sort_order,system_key,journal_date)
      VALUES($1,$2,$3,$4,coalesce((SELECT max(sort_order)+1 FROM work_node WHERE parent_id IS NOT DISTINCT FROM $1 AND deleted_at IS NULL),0),$5,$6)
      RETURNING ${columns}`,
      [input.parentId, input.nodeType, input.name, actorId, systemKey, journalDate],
    );
    const node = result.rows[0];
    if (node.nodeType === 'DOCUMENT')
      await connection.query('INSERT INTO work_document(node_id) VALUES($1)', [node.id]);
    return node;
  }

  create(input: CreateWorkNode, actorId: string) {
    return this.mutate(actorId, input.treeVersion, 'created', async (connection, nodes) => {
      this.checkCapacity(nodes);
      this.parent(nodes, input.parentId);
      if (this.depth(nodes, input.parentId) > 7)
        throw new AppError(400, '최대 깊이는 7단계입니다.');
      return this.insert(connection, input, actorId);
    });
  }

  change(id: string, input: WorkChange, actorId: string) {
    return this.mutate(actorId, input.treeVersion, input.action, async (connection, nodes) => {
      const node = nodes.find((item) => item.id === id);
      if (!node) throw missing();
      if (input.action === 'restore') {
        if (!node.deletedAt || node.deleteBatch !== node.id) throw missing();
        const eligible = await connection.query(
          "SELECT id FROM work_node WHERE id=$1 AND deleted_at >= now()-interval '30 days'",
          [id],
        );
        if (!eligible.rows.length) throw new AppError(409, '복구 보존 기간이 지났습니다.');
        const parent = nodes.find((item) => item.id === node.parentId && !item.deletedAt);
        const parentId = parent?.id ?? null;
        let name = node.name;
        let suffix = 1;
        while (
          nodes.some((item) => !item.deletedAt && item.parentId === parentId && item.name === name)
        ) {
          name = `${node.name.slice(0, 185)} (복구 ${suffix++})`;
        }
        // Parent may have moved while this subtree was in the trash.
        const restored = nodes
          .filter((item) => item.deleteBatch === id)
          .map((item) => (item.id === id ? { ...item, parentId } : item));
        const after = [...nodes.filter((item) => item.deleteBatch !== id), ...restored];
        if (restored.some((item) => this.depth(after, item.parentId) > 7))
          throw new AppError(
            409,
            '복구 경로가 최대 깊이를 초과합니다. 상위 폴더를 먼저 이동해 주세요.',
          );
        await connection.query('UPDATE work_node SET parent_id=$2,name=$3 WHERE id=$1', [
          id,
          parentId,
          name,
        ]);
        await connection.query(
          'UPDATE work_document SET version=version+1,updated_at=now() WHERE node_id IN (SELECT id FROM work_node WHERE delete_batch=$1)',
          [id],
        );
        await connection.query(
          'UPDATE work_node SET deleted_at=NULL,delete_batch=NULL,is_public=false,updated_at=now() WHERE delete_batch=$1',
          [id],
        );
        return;
      }
      if (node.deletedAt) throw missing();
      if (input.action === 'rename') {
        await connection.query('UPDATE work_node SET name=$2,updated_at=now() WHERE id=$1', [
          id,
          input.name,
        ]);
      } else if (input.action === 'visibility') {
        await connection.query('UPDATE work_node SET is_public=$2,updated_at=now() WHERE id=$1', [
          id,
          input.isPublic,
        ]);
      } else if (input.action === 'delete') {
        await connection.query(
          `WITH RECURSIVE subtree AS (
          SELECT id FROM work_node WHERE id=$1 AND deleted_at IS NULL
          UNION ALL SELECT c.id FROM work_node c JOIN subtree p ON c.parent_id=p.id WHERE c.deleted_at IS NULL
        ) UPDATE work_node SET deleted_at=now(),delete_batch=$1,updated_at=now() WHERE id IN (SELECT id FROM subtree)`,
          [id],
        );
        await connection.query(
          'UPDATE work_document SET version=version+1,updated_at=now() WHERE node_id IN (SELECT id FROM work_node WHERE delete_batch=$1)',
          [id],
        );
      } else {
        this.parent(nodes, input.parentId);
        const after = nodes.map((item) =>
          item.id === id ? { ...item, parentId: input.parentId } : item,
        );
        if (after.some((item) => this.depth(after, item.parentId) > 7))
          throw new AppError(400, '최대 깊이는 7단계입니다.');
        await connection.query(
          'UPDATE work_node SET parent_id=$2,sort_order=$3,updated_at=now() WHERE id=$1',
          [id, input.parentId, input.sortOrder],
        );
        const siblings = nodes.filter(
          (item) => !item.deletedAt && item.parentId === input.parentId && item.id !== id,
        );
        siblings.splice(Math.min(input.sortOrder, siblings.length), 0, node);
        await connection.query(
          `UPDATE work_node n SET sort_order=ordered.position::int-1
           FROM unnest($1::uuid[]) WITH ORDINALITY AS ordered(id,position)
           WHERE n.id=ordered.id`,
          [siblings.map((sibling) => sibling.id)],
        );
      }
    });
  }

  save(id: string, content: string, version: number, actorId: string) {
    return this.mutate(actorId, undefined, 'saved', async (connection, nodes) => {
      if (!nodes.some((node) => node.id === id && !node.deletedAt && node.nodeType === 'DOCUMENT'))
        throw missing();
      const saved = await connection.query<{ version: number; updatedAt: string }>(
        `UPDATE work_document SET content=$2,version=version+1,updated_at=now()
        WHERE node_id=$1 AND version=$3 RETURNING version,updated_at AS "updatedAt"`,
        [id, content, version],
      );
      if (!saved.rows.length) throw conflict();
      await connection.query('UPDATE work_node SET updated_at=now() WHERE id=$1', [id]);
      return saved.rows[0];
    });
  }

  async trash() {
    const result = await this.db.query<{ nodes: WorkNode[]; version: number }>(`SELECT s.version,
      coalesce((SELECT json_agg(t) FROM (SELECT ${columns} FROM work_node
        WHERE delete_batch=id AND deleted_at>=now()-interval '30 days' ORDER BY deleted_at DESC LIMIT 2000) t),'[]'::json) AS nodes
      FROM work_space s WHERE s.id=1`);
    return serialize(result.rows[0]);
  }

  today(date: string, actorId: string) {
    return this.mutate(actorId, undefined, 'journal', async (connection, nodes) => {
      const existing = await connection.query<WorkNode>(
        `SELECT ${columns} FROM work_node WHERE journal_date=$1`,
        [date],
      );
      if (existing.rows[0]) {
        if (existing.rows[0].deletedAt)
          throw new AppError(409, '오늘 업무일지가 휴지통에 있습니다. 먼저 복구해 주세요.');
        return existing.rows[0];
      }
      let parentId: string | null = null;
      for (const [key, name] of [
        ['journal', '업무일지'],
        [`journal-${date.slice(0, 4)}`, date.slice(0, 4)],
        [`journal-${date.slice(0, 7)}`, `${Number(date.slice(5, 7))}월`],
      ]) {
        const existingFolder = await connection.query<WorkNode>(
          `SELECT ${columns} FROM work_node WHERE system_key=$1`,
          [key],
        );
        let folder: WorkNode | undefined = existingFolder.rows[0];
        if (folder?.deletedAt)
          throw new AppError(409, '업무일지 폴더가 휴지통에 있습니다. 먼저 복구해 주세요.');
        if (!folder) {
          folder = nodes.find(
            (item) => !item.deletedAt && item.parentId === parentId && item.name === name,
          );
          if (folder && folder.nodeType !== 'FOLDER')
            throw new AppError(
              409,
              '업무일지 경로에 같은 이름의 문서가 있습니다. 이름을 변경해 주세요.',
            );
          if (folder)
            await connection.query('UPDATE work_node SET system_key=$2 WHERE id=$1', [
              folder.id,
              key,
            ]);
          else {
            this.checkCapacity(nodes);
            folder = await this.insert(
              connection,
              { parentId, name, nodeType: 'FOLDER' },
              actorId,
              key,
            );
            nodes.push(folder);
          }
        }
        parentId = folder.id;
      }
      const fresh = (await connection.query<WorkNode>(`SELECT ${columns} FROM work_node`)).rows;
      if (this.depth(fresh, parentId) > 7)
        throw new AppError(409, '업무일지 경로가 최대 깊이를 초과합니다.');
      this.checkCapacity(nodes);
      const node = await this.insert(
        connection,
        { parentId, name: date, nodeType: 'DOCUMENT' },
        actorId,
        null,
        date,
      );
      await connection.query('UPDATE work_document SET content=$2 WHERE node_id=$1', [
        node.id,
        `# ${date} 업무일지\n\n## 오늘 할 일\n\n- [ ] \n\n## 진행 업무\n\n## 이슈\n\n## 해결 내용\n\n## 내일 할 일\n\n- [ ] \n`,
      ]);
      return node;
    });
  }
}
