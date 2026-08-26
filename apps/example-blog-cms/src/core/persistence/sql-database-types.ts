/** Kysely table types for Example Blog CMS persistence. */

export interface CmsStateTable {
  readonly singleton_id: number;
  readonly entry_generation: number;
  readonly storage_generation: number;
  readonly catalog_json: string | null;
  readonly records_json: string;
  readonly assets_json: string;
  readonly updated_at: string;
}

export interface SqlDatabase {
  readonly cms_state: CmsStateTable;
}

export const cmsStateSingletonIdentifier = 1;
