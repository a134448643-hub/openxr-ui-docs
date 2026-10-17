import fs from 'node:fs/promises';
import {inflateRawSync} from 'node:zlib';

// Read a bounded entry from an APK without loading or extracting the game data.
export async function readApkEntry(file,name,limit=4*1024*1024){
 const handle=await fs.open(file,'r');
 async function read(position,length){const buffer=Buffer.alloc(length);const result=await handle.read(buffer,0,length,position);if(result.bytesRead!==length)throw Error('APK 资源数据不完整');return buffer;}
 try{
  const {size}=await handle.stat(),tail=await read(Math.max(0,size-65557),Math.min(size,65557));let end=-1;
  for(let i=tail.length-22;i>=0;i--)if(tail.readUInt32LE(i)===0x06054b50&&i+22+tail.readUInt16LE(i+20)===tail.length){end=i;break;}
  if(end<0)throw Error('APK 缺少 ZIP 目录');
  const length=tail.readUInt32LE(end+12),offset=tail.readUInt32LE(end+16);
  if(length>32*1024*1024||offset+length>size||offset===0xffffffff)throw Error('APK 资源目录超出读取范围');
  const central=await read(offset,length);
  for(let i=0;i+46<=central.length;){
   if(central.readUInt32LE(i)!==0x02014b50)throw Error('APK 资源目录格式异常');
   const nameLength=central.readUInt16LE(i+28),extra=central.readUInt16LE(i+30),comment=central.readUInt16LE(i+32),next=i+46+nameLength+extra+comment;
   if(next>central.length)throw Error('APK 资源目录不完整');
   if(central.toString('utf8',i+46,i+46+nameLength)===name){
    const compressed=central.readUInt32LE(i+20),uncompressed=central.readUInt32LE(i+24),method=central.readUInt16LE(i+10),start=central.readUInt32LE(i+42);
    if(compressed>limit||uncompressed>limit||start+30>offset)throw Error('APK 图标资源超出读取范围');
    const header=await read(start,30);if(header.readUInt32LE(0)!==0x04034b50)throw Error('APK 资源头格式异常');
    const dataOffset=start+30+header.readUInt16LE(26)+header.readUInt16LE(28);if(dataOffset+compressed>offset)throw Error('APK 资源位置异常');
    const packed=await read(dataOffset,compressed),data=method===0?packed:method===8?inflateRawSync(packed,{maxOutputLength:limit}):null;
    if(!data||data.length!==uncompressed)throw Error('APK 图标资源压缩格式异常');return data;
   }i=next;
  }throw Error('APK 缺少图标资源：'+name);
 }finally{await handle.close();}
}

export async function sameAndroidIcon(first,second){
 const {nativeImage}=await import('electron'),a=nativeImage.createFromBuffer(first),b=nativeImage.createFromBuffer(second);
 if(a.isEmpty()||b.isEmpty()||JSON.stringify(a.getSize())!==JSON.stringify(b.getSize()))return false;
 const left=a.toBitmap(),right=b.toBitmap();
 // Fully transparent RGB pixels have no visible meaning and may change during PNG optimization.
 for(const bytes of [left,right])for(let i=0;i<bytes.length;i+=4)if(bytes[i+3]===0)bytes.fill(0,i,i+3);
 return left.equals(right);
}
