export function openSourceFile(target:string,kind?:'source'|'browser'):Promise<void>;
export function systemOpenCommand(target:string,kind?:'source'|'browser',platform?:string,env?:NodeJS.ProcessEnv):{command:string;args:string[]};
