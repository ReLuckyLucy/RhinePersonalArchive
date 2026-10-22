import { backup,type DatabaseSync } from 'node:sqlite';
import { join } from 'node:path';
import { transaction } from './transaction.ts';
import { searchMigration } from './search-migration.ts';
export const migrations=[`
CREATE TABLE profile(id TEXT PRIMARY KEY CHECK(id='main'), revision INTEGER NOT NULL, data TEXT NOT NULL);
CREATE TABLE dossiers(id TEXT PRIMARY KEY,revision INTEGER NOT NULL,data TEXT NOT NULL);
CREATE TABLE sources(id TEXT PRIMARY KEY,relative_path TEXT NOT NULL UNIQUE COLLATE NOCASE,hash TEXT NOT NULL,version INTEGER NOT NULL,data TEXT NOT NULL);
CREATE INDEX source_hash ON sources(hash);
CREATE TABLE source_versions(source_id TEXT NOT NULL REFERENCES sources(id),version INTEGER NOT NULL,hash TEXT NOT NULL,relative_path TEXT NOT NULL,available INTEGER NOT NULL DEFAULT 1,data TEXT NOT NULL,PRIMARY KEY(source_id,version));
CREATE TABLE origins(id TEXT PRIMARY KEY,source_id TEXT NOT NULL REFERENCES sources(id),data TEXT NOT NULL);
CREATE TABLE dossier_sources(dossier_id TEXT REFERENCES dossiers(id),source_id TEXT REFERENCES sources(id),PRIMARY KEY(dossier_id,source_id));
CREATE TABLE facts(id TEXT PRIMARY KEY,dossier_id TEXT NOT NULL REFERENCES dossiers(id),revision INTEGER NOT NULL,status TEXT NOT NULL,data TEXT NOT NULL);
CREATE TABLE fact_revisions(fact_id TEXT REFERENCES facts(id),revision INTEGER NOT NULL,data TEXT NOT NULL,PRIMARY KEY(fact_id,revision));
CREATE TABLE evidence(fact_id TEXT NOT NULL,revision INTEGER NOT NULL,source_id TEXT NOT NULL,source_version INTEGER NOT NULL,data TEXT NOT NULL,FOREIGN KEY(fact_id,revision) REFERENCES fact_revisions(fact_id,revision),FOREIGN KEY(source_id,source_version) REFERENCES source_versions(source_id,version));
CREATE TABLE resume_drafts(id TEXT PRIMARY KEY,revision INTEGER NOT NULL,data TEXT NOT NULL);
CREATE TABLE resume_versions(id TEXT PRIMARY KEY,data TEXT NOT NULL);
CREATE TABLE exports(id TEXT PRIMARY KEY,version_id TEXT REFERENCES resume_versions(id),data TEXT NOT NULL);
CREATE TABLE jobs(id TEXT PRIMARY KEY,source_id TEXT REFERENCES sources(id),version INTEGER NOT NULL,state TEXT NOT NULL,data TEXT NOT NULL);
CREATE TABLE extracted(source_id TEXT REFERENCES sources(id),version INTEGER NOT NULL,data TEXT NOT NULL,PRIMARY KEY(source_id,version));
CREATE TABLE audit(id INTEGER PRIMARY KEY,at TEXT NOT NULL,action TEXT NOT NULL,entity_id TEXT NOT NULL);
CREATE TABLE settings(key TEXT PRIMARY KEY,data TEXT NOT NULL);
CREATE VIRTUAL TABLE search_index USING fts5(entity_id UNINDEXED,entity_type UNINDEXED,title,body,tokenize='trigram');
`,searchMigration,`
CREATE TABLE catalog_topics(
 catalog_key TEXT NOT NULL,
 topic_key TEXT NOT NULL,
 dossier_id TEXT NOT NULL REFERENCES dossiers(id),
 PRIMARY KEY(catalog_key,topic_key)
);
CREATE INDEX catalog_topics_owner ON catalog_topics(dossier_id);
-- Existing origins retain the immutable imported category/subject. Prefer a unique
-- live owner (including a previous merge target); never infer from the edited title alone.
WITH origin_topics AS (
 SELECT substr(id,1,64) catalog_key,
 json_array(CAST(coalesce(json_extract(data,'$.category'),'') AS TEXT),CAST(coalesce(json_extract(data,'$.subject'),'待整理材料') AS TEXT)) topic_key,
 CAST(coalesce(json_extract(data,'$.subject'),'待整理材料') AS TEXT) subject,source_id
 FROM origins WHERE substr(id,65,1)=':' AND length(id)>65 AND json_extract(data,'$.uploadDossierId') IS NULL
), candidates AS (
 SELECT DISTINCT o.catalog_key,o.topic_key,d.id dossier_id,
 CASE WHEN s.key IS NULL THEN 1 ELSE 0 END active,
 CASE WHEN json_extract(d.data,'$.title')=o.subject THEN 1 ELSE 0 END title_matches
 FROM origin_topics o JOIN dossier_sources ds ON ds.source_id=o.source_id
 JOIN dossiers d ON d.id=ds.dossier_id
 LEFT JOIN settings s ON s.key='archived-dossier:'||d.id
), counted AS (
 SELECT *,count(*) OVER topic owner_count,sum(active) OVER topic active_count,
 sum(title_matches) OVER topic title_count,sum(active*title_matches) OVER topic active_title_count
 FROM candidates WINDOW topic AS (PARTITION BY catalog_key,topic_key)
)
INSERT INTO catalog_topics(catalog_key,topic_key,dossier_id)
SELECT catalog_key,topic_key,dossier_id FROM counted
WHERE (active=1 AND (active_count=1 OR (active_title_count=1 AND title_matches=1)))
 OR (active_count=0 AND owner_count=1);
`];
export async function migrate(db:DatabaseSync,runtimeRoot:string,steps=migrations){
 const version=Number((db.prepare('PRAGMA user_version').get() as any).user_version);
 if(version>steps.length)throw new Error('Database is newer than this application');
 if(version<steps.length){await backup(db,join(runtimeRoot,`migration-before-${version}-${Date.now()}.sqlite`));transaction(db,()=>{for(let i=version;i<steps.length;i++){db.exec(steps[i]);db.exec(`PRAGMA user_version=${i+1}`);}});}
}
