export const APP_ID='rhine-personal-archive-v1';
export type SessionData={csrf:string;instanceId:string;appId:typeof APP_ID};
export type LibraryInfo={name:string;directory:string;dossierCount:number;archivedDossierCount:number;sourceCount:number};
export type ExtractionState='pending'|'queued'|'running'|'ready'|'failed'|'unsupported';
export type ExtractionMaterial={id:string;name:string;version:number;state:ExtractionState;errorCode?:string};
export type ExtractionSnapshot={total:number;counts:Record<ExtractionState,number>;materials:ExtractionMaterial[]};
