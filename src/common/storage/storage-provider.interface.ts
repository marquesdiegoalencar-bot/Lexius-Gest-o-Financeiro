export interface StorageSaveInput {
  relativeKey: string;
  buffer: Buffer;
  mimeType: string;
}

export interface StorageProvider {
  save(input: StorageSaveInput): Promise<string>;
  read(storageKey: string): Promise<Buffer>;
  delete(storageKey: string): Promise<void>;
}

export const STORAGE_PROVIDER = Symbol('STORAGE_PROVIDER');