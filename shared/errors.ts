export class AppError extends Error {
 code:string; status:number;
 constructor(code:string,message:string,status=400){super(message);this.code=code;this.status=status;}
}
export function requireValue(value:unknown,code:string,message:string,status=400):asserts value {if(!value)throw new AppError(code,message,status);}
