import AdmZip from 'adm-zip';
import { readdirSync, statSync } from 'fs';
import { resolve, relative, sep } from 'path';
import { logger } from '../utils/logger';

function walkDir(dir: string, basePath: string): string[] {
  const files: string[] = [];
  const entries = readdirSync(dir);
  for (const entry of entries) {
    const fullPath = resolve(dir, entry);
    const stat = statSync(fullPath);
    if (stat.isDirectory()) {
      files.push(...walkDir(fullPath, basePath));
    } else {
      files.push(fullPath);
    }
  }
  return files;
}

export function createZip(
  projectDir: string,
  dist: string,
): AdmZip {
  logger.debug(`Packaging ${dist} directory`);

  const distPath = resolve(projectDir, dist);
  const allFiles = walkDir(distPath, distPath);

  const zip = new AdmZip();

  for (const filePath of allFiles) {
    const relativePath = filePath.replace(distPath + sep, '');
    // Normalize to forward slashes for cross-platform zip compatibility
    const normalizedPath = relativePath.split(sep).join('/');
    const lastSlash = normalizedPath.lastIndexOf('/');
    const zipDir = lastSlash >= 0 ? normalizedPath.slice(0, lastSlash + 1) : '';

    zip.addLocalFile(filePath, zipDir);
  }

  logger.success(`Packaged ${allFiles.length} files`);
  return zip;
}
