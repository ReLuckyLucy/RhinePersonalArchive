import{open,stat,mkdir}from'node:fs/promises';
import{createReadStream}from'node:fs';
import{createDeflateRaw,crc32}from'node:zlib';
import{Transform}from'node:stream';
import{dirname,join}from'node:path';
// Streaming ZIP32 with UTF-8 names and data descriptors; each file <4 GiB.
export async function createZip(root,files,target,prefix=''){
 await mkdir(dirname(target),{recursive:true});const out=await open(target,'wx');let offset=0;const directory=[];
 const write=async bytes=>{let done=0;while(done<bytes.length){const {bytesWritten}=await out.write(bytes,done,bytes.length-done);done+=bytesWritten;}offset+=bytes.length;};
 try{
  for(const file of files){
   if((await stat(join(root,file))).size>=0xffffffff)throw Error('ZIP32 file exceeds limit');
   const name=Buffer.from(prefix+file),start=offset,header=Buffer.alloc(30);
   header.writeUInt32LE(0x04034b50);header.writeUInt16LE(20,4);header.writeUInt16LE(0x808,6);header.writeUInt16LE(8,8);header.writeUInt16LE(33,12);header.writeUInt16LE(name.length,26);await write(header);await write(name);
   let crc=0,size=0,compressed=0;const meter=new Transform({transform(chunk,_enc,cb){crc=crc32(chunk,crc);size+=chunk.length;cb(null,chunk);}});
   for await(const chunk of createReadStream(join(root,file)).pipe(meter).pipe(createDeflateRaw({level:6}))){compressed+=chunk.length;await write(chunk);}
   const descriptor=Buffer.alloc(16);descriptor.writeUInt32LE(0x08074b50);descriptor.writeUInt32LE(crc,4);descriptor.writeUInt32LE(compressed,8);descriptor.writeUInt32LE(size,12);await write(descriptor);
   const central=Buffer.alloc(46);central.writeUInt32LE(0x02014b50);central.writeUInt16LE(20,4);central.writeUInt16LE(20,6);central.writeUInt16LE(0x808,8);central.writeUInt16LE(8,10);central.writeUInt16LE(33,14);central.writeUInt32LE(crc,16);central.writeUInt32LE(compressed,20);central.writeUInt32LE(size,24);central.writeUInt16LE(name.length,28);central.writeUInt32LE(start,42);directory.push(central,name);
  }
  const begin=offset;for(const bytes of directory)await write(bytes);const length=offset-begin;
  if(files.length>65535||offset>=0xffffffff)throw Error('ZIP32 archive exceeds limit');
  const end=Buffer.alloc(22);end.writeUInt32LE(0x06054b50);end.writeUInt16LE(files.length,8);end.writeUInt16LE(files.length,10);end.writeUInt32LE(length,12);end.writeUInt32LE(begin,16);await write(end);
 }finally{await out.close();}
}
