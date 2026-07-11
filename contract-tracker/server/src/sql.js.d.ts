declare module 'sql.js' {
  interface SqlJsDatabase {
    run(sql: string, params?: unknown[]): SqlJsDatabase;
    exec(sql: string): { columns: string[]; values: unknown[][] }[];
    prepare(sql: string): {
      bind(params: unknown[]): boolean;
      step(): boolean;
      getAsObject(): Record<string, unknown>;
      free(): boolean;
    };
    export(): Uint8Array;
  }

  interface DatabaseConstructor {
    new(data?: ArrayLike<number> | Buffer | null): SqlJsDatabase;
    (data?: ArrayLike<number> | Buffer | null): SqlJsDatabase;
  }

  interface SqlJsStatic {
    Database: DatabaseConstructor;
  }

  export type { SqlJsStatic, SqlJsDatabase };

  export default function initSqlJs(config?: Record<string, unknown>): Promise<SqlJsStatic>;
}
