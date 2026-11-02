import { transaction, type Database } from '../../../infrastructure/database';
import type { AboutInput, AboutRepository, AboutSection } from '../domain/models';
const select = `SELECT id,kind,title,subtitle,source,format,rendered_html AS "renderedHtml",items,sort_order AS "sortOrder",published FROM about_sections`;
export class PostgresAboutRepository implements AboutRepository {
  constructor(private db: Database) {}
  async list(includeDrafts = false) {
    return (
      await this.db.query<AboutSection>(
        `${select} ${includeDrafts ? '' : 'WHERE published=TRUE'} ORDER BY sort_order,id`,
      )
    ).rows;
  }
  async save(input: AboutInput & { renderedHtml: string }, actorId: string) {
    const id = await transaction(this.db, async (connection) => {
      const values = [
        input.kind,
        input.title,
        input.subtitle,
        input.source,
        input.format,
        input.renderedHtml,
        JSON.stringify(input.items),
        input.sortOrder,
        input.published,
      ];
      const result = input.id
        ? await connection.query<{ id: string }>(
            `UPDATE about_sections SET kind=$1,title=$2,subtitle=$3,source=$4,format=$5,rendered_html=$6,items=$7,sort_order=$8,published=$9,updated_at=now() WHERE id=$10 RETURNING id`,
            [...values, input.id],
          )
        : await connection.query<{ id: string }>(
            `INSERT INTO about_sections(kind,title,subtitle,source,format,rendered_html,items,sort_order,published) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id`,
            values,
          );
      if (!result.rows[0]) throw new Error('About section not found');
      const id = result.rows[0].id;
      await connection.query('INSERT INTO audit_logs(actor_id,action,entity_id) VALUES($1,$2,$3)', [
        actorId,
        'about.saved',
        id,
      ]);
      return id;
    });
    return (await this.db.query<AboutSection>(`${select} WHERE id=$1`, [id])).rows[0];
  }
  async delete(id: string, actorId: string) {
    await transaction(this.db, async (connection) => {
      await connection.query('DELETE FROM about_sections WHERE id=$1', [id]);
      await connection.query('INSERT INTO audit_logs(actor_id,action,entity_id) VALUES($1,$2,$3)', [
        actorId,
        'about.deleted',
        id,
      ]);
    });
  }
}
