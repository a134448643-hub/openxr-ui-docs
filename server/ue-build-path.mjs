import fs from 'node:fs/promises';
import path from 'node:path';
import {powershell,runProcess} from './ue-windows.mjs';

const dosQuery=`Add-Type -MemberDefinition '[DllImport("kernel32.dll", CharSet=CharSet.Unicode, SetLastError=true)] public static extern uint QueryDosDevice(string name, System.Text.StringBuilder target, uint size);' -Name DosDevice -Namespace UEBuild; `;

// Keep native compiler paths short and ASCII without relocating any project files.
// SUBST exists only for the current Windows logon; never replace an occupied drive.
export async function createBuildPathAlias(folder,runner=runProcess){
  const target=path.resolve(folder);await fs.access(target);
  if(process.platform!=='win32')return {root:target,release:async()=>{}};
  const env={UE_BUILD_FOLDER:target,UE_SUBST_EXE:path.join(process.env.SystemRoot||'C:\\Windows','System32/subst.exe')};
  const drive=await powershell(dosQuery+`
    foreach ($ueCode in 90..71) {
      $ueDrive = ([char]$ueCode).ToString() + ':';
      $ueBuffer = New-Object System.Text.StringBuilder 32768;
      if ([UEBuild.DosDevice]::QueryDosDevice($ueDrive, $ueBuffer, 32768) -ne 0) { continue };
      & $env:UE_SUBST_EXE $ueDrive $env:UE_BUILD_FOLDER | Out-Null;
      if ($LASTEXITCODE -eq 0) { [Console]::Write($ueDrive); break };
    }
  `,env,runner);
  if(!/^[G-Z]:$/.test(drive))throw Error('没有可用的临时构建盘符，无法为 UE 创建兼容的编译路径');
  let released=false;
  const release=async()=>{
    if(released)return;
    await powershell(dosQuery+`
      $ueBuffer = New-Object System.Text.StringBuilder 32768;
      if ([UEBuild.DosDevice]::QueryDosDevice($env:UE_BUILD_DRIVE, $ueBuffer, 32768) -ne 0) {
        if ($ueBuffer.ToString() -ine ('\\??\\' + $env:UE_BUILD_FOLDER)) { throw '临时构建盘符已被其他程序更改，保留当前映射' };
        & $env:UE_SUBST_EXE $env:UE_BUILD_DRIVE /D | Out-Null;
        if ($LASTEXITCODE -ne 0) { throw '无法释放临时构建盘符' };
      }
    `,{...env,UE_BUILD_DRIVE:drive},runner);
    released=true;
  };
  return {root:drive+'\\',release};
}

export async function createBuildWorkspacePath(folder){
  // UE 5.3 inspects the project directory's parent when finding a working set.
  // A project at the virtual drive root causes a UBT null-reference exception.
  const leaf=path.basename(folder);if(/[^\x00-\x7f]/.test(leaf))throw Error('临时构建工程目录名称必须为英文');
  const alias=await createBuildPathAlias(path.dirname(folder));return {root:path.join(alias.root,leaf),release:alias.release};
}
