export interface WorkNode {
  id: string;
  parentId: string | null;
  nodeType: 'FOLDER' | 'DOCUMENT';
  name: string;
  sortOrder: number;
  isPublic: boolean;
  updatedAt: string;
  deletedAt: string | null;
  deleteBatch: string | null;
}

export interface WorkTree {
  nodes: WorkNode[];
  version: number;
}

export interface WorkDocument {
  id: string;
  name: string;
  content: string;
  version: number;
  updatedAt: string;
  renderedHtml: string;
}

export interface CreateWorkNode {
  parentId: string | null;
  name: string;
  nodeType: WorkNode['nodeType'];
  treeVersion: number;
}

export type WorkChangeFields =
  | { action: 'rename'; name: string }
  | { action: 'visibility'; isPublic: boolean }
  | { action: 'move'; parentId: string | null; sortOrder: number }
  | { action: 'delete' }
  | { action: 'restore' };
export type WorkChange = WorkChangeFields & { treeVersion: number };

export interface WorkRepository {
  tree(manage: boolean): Promise<WorkTree>;
  read(id: string, manage: boolean): Promise<Omit<WorkDocument, 'renderedHtml'> | null>;
  create(input: CreateWorkNode, actorId: string): Promise<WorkNode>;
  change(id: string, input: WorkChange, actorId: string): Promise<void>;
  save(
    id: string,
    content: string,
    version: number,
    actorId: string,
  ): Promise<{ version: number; updatedAt: string }>;
  trash(): Promise<WorkTree>;
  today(date: string, actorId: string): Promise<WorkNode>;
}
