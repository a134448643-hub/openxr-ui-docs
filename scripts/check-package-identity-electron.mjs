import {app} from 'electron';
import fs from 'node:fs';import path from 'node:path';
const profile=path.resolve('.local/checks/electron-identity-runtime-'+Date.now());fs.mkdirSync(profile,{recursive:true});app.setPath('userData',profile);
app.whenReady().then(async()=>{const fixture=await import('./check-package-identity.mjs');const {checkPackagingUpdates}=await import('./check-packaging-updates.mjs');await checkPackagingUpdates(fixture);app.quit();}).catch(error=>{console.error(error);app.exit(1);});
