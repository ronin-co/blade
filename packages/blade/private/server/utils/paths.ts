export const joinPaths = (parent: string, child: string) => {
  return parent ? [parent, child].join('/') : child;
};

export const getParentDirectories = (
  path: string,
  existingDirs: string[] = [],
): string[] => {
  if (!path.includes('/')) {
    existingDirs.push('');
    return existingDirs;
  }

  const currentDir = path.substring(0, path.lastIndexOf('/'));
  if (currentDir) existingDirs.push(currentDir);
  return getParentDirectories(currentDir, existingDirs);
};
