export interface SourceFile {
  path: string;
  content: string;
}

export interface BuildOptions {
  sourceFiles: Array<SourceFile>;
}

export const build = (options: BuildOptions) => {
  console.log('test');
};
