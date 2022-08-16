/*
 * @Author: Rikka
 * @Date: 2022-05-11 14:11:53
 * @LastEditTime: 2022-05-11 15:43:47
 * @LastEditors: Rikka
 * @Description:
 * @FilePath: \faw-operate-plateform-workspace\apps\tools\upload\src\zip.ts
 */
import * as fsWalk from "@nodelib/fs.walk";
import AdmZip from "adm-zip";
import { relative, resolve, sep } from "path";

function createZip(path: string, dist: string): AdmZip {
  const allFile = fsWalk
    .walkSync(resolve(path, dist))
    .map((item) => {
      return { ...item, relative: relative(path, item.path) };
    })
    .filter(
      (item) =>
        !item.path.includes(".bundle_info") && !item.dirent.isDirectory()
    )
    .map((item) => {
      const relativePath = item.relative.split(sep).join("/").split(dist)[1];
      const lastIndex = relativePath.lastIndexOf("/");
      return {
        ...item,
        relative: relativePath.slice(0, Math.max(0, lastIndex + 1))
      };
    });
  const zip = new AdmZip();
  allFile.forEach((item) => {
    zip.addLocalFile(item.path, item.relative);
  });
  return zip;
}

export { createZip };
