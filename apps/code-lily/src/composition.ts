import 'server-only';
import { getDatabase } from './infrastructure/database';
import { PostsService } from './modules/posts/application/posts.service';
import { PostgresPostsRepository } from './modules/posts/infrastructure/postgres-posts.repository';
import { AboutService } from './modules/about/application/about.service';
import { PostgresAboutRepository } from './modules/about/infrastructure/postgres-about.repository';
import { TelemetryService } from './modules/telemetry/application/telemetry.service';
import { PostgresTelemetryRepository } from './modules/telemetry/infrastructure/postgres-telemetry.repository';
import { storageFromEnvironment } from '@codelily/storage';
import { UploadsService } from './modules/uploads/application/uploads.service';
import { PostgresUploadsRepository } from './modules/uploads/infrastructure/postgres-uploads.repository';
import { MembersService } from './modules/identity/application/members.service';
import { PostgresMembersRepository } from './modules/identity/infrastructure/postgres-members.repository';
import { WorkService } from './modules/work/application/work.service';
import { PostgresWorkRepository } from './modules/work/infrastructure/postgres-work.repository';

export async function services() {
  const db = await getDatabase();
  return {
    posts: new PostsService(new PostgresPostsRepository(db)),
    about: new AboutService(new PostgresAboutRepository(db)),
    telemetry: new TelemetryService(new PostgresTelemetryRepository(db)),
    members: new MembersService(new PostgresMembersRepository(db)),
    work: new WorkService(new PostgresWorkRepository(db)),
  };
}
export async function uploadsService() {
  return new UploadsService(
    new PostgresUploadsRepository(await getDatabase()),
    storageFromEnvironment(),
  );
}
