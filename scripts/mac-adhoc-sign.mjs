import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const run = promisify(execFile);

/* This is a personal build with no Apple Developer ID, so `mac.identity` is null
   and electron-builder skips signing. That leaves the bundle carrying Electron's
   own linker signature: identity "Electron", Info.plist unbound, resources
   unsealed. macOS then treats each rebuild as a different app and re-asks for
   permissions. Ad-hoc signing the bundle ourselves gives Toolbelt a stable
   identity of its own without a certificate. */
export default async function adhocSignMac(context) {
  if (context.electronPlatformName !== "darwin") return;

  const app = path.join(context.appOutDir, `${context.packager.appInfo.productFilename}.app`);
  await run("codesign", ["--force", "--deep", "--sign", "-", app]);
  const { stdout, stderr } = await run("codesign", ["-dv", "--verbose=2", app]);
  console.log(`  • ad-hoc signed Toolbelt.app\n${(stderr || stdout).trim()}`);
}
