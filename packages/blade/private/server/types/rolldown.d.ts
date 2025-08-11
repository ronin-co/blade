declare module 'rolldown' {
  export interface Plugin {
    name: string;
    buildStart?(): void | Promise<void>;
    resolveId?(
      id: string,
      importer?: string,
    ): string | null | undefined | Promise<string | null | undefined>;
    load?(id: string): string | null | undefined | Promise<string | null | undefined>;
    transform?(
      code: string,
      id: string,
    ):
      | { code: string; map: any }
      | string
      | null
      | undefined
      | Promise<{ code: string; map: any } | string | null | undefined>;
    generateBundle?(options: any, bundle: Record<string, any>): void | Promise<void>;
    writeBundle?(): void | Promise<void>;
  }

  export interface OutputChunk {
    type: 'chunk';
    fileName: string;
    code: string;
    facadeModuleId?: string | null;
  }

  export interface OutputAsset {
    type: 'asset';
    fileName: string;
    source: string | Uint8Array;
  }

  export interface RollupBuild {
    write(options: any): Promise<any>;
    generate(options: any): Promise<{ output: Array<OutputChunk | OutputAsset> }>;
    cache?: any;
  }

  export function rollup(config: {
    input: Record<string, string> | string | string[];
    plugins?: Array<Plugin>;
    external?: Array<string> | ((id: string) => boolean);
    cache?: any;
  }): Promise<RollupBuild>;

  export type { Plugin as RolldownPlugin };
}
