/**
 * Minimal ambient types for `ssh2-sftp-client`, which ships no `.d.ts`.
 *
 * Declared here rather than pulling in `@types/ssh2-sftp-client` (+ `@types/ssh2`):
 * those would be dev-only dependencies that the PRODUCTION build must still
 * install in order to typecheck — an easy thing to break with `npm ci --omit=dev`.
 * Only the surface the backup transport actually uses is declared.
 */
declare module 'ssh2-sftp-client' {
  interface ConnectOptions {
    host: string;
    port?: number;
    username?: string;
    password?: string;
    readyTimeout?: number;
  }

  interface FileInfo {
    name: string;
    type: string;
    size: number;
  }

  class SftpClient {
    constructor(name?: string);
    connect(options: ConnectOptions): Promise<unknown>;
    /** The remote working directory the session landed in. */
    cwd(): Promise<string>;
    /** Resolves to the entry type ("d" | "-" | "l") when it exists, else false. */
    exists(remotePath: string): Promise<false | string>;
    mkdir(remotePath: string, recursive?: boolean): Promise<string>;
    list(remotePath: string): Promise<FileInfo[]>;
    fastPut(localPath: string, remotePath: string): Promise<string>;
    /** Download — used by the restore drill (scripts/backup-verify.ts). */
    fastGet(remotePath: string, localPath: string): Promise<string>;
    /** Remote size, so a download can be checked byte-exact (BACKUP.md §11.1). */
    stat(remotePath: string): Promise<{ size: number; isFile: boolean }>;
    delete(remotePath: string): Promise<string>;
    end(): Promise<void>;
  }

  export = SftpClient;
}
