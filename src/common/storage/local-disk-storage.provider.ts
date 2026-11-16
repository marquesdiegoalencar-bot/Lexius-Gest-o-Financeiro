import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs/promises';
import * as path from 'path';
import { StorageProvider, StorageSaveInput } from './storage-provider.interface';

@Injectable()
export class LocalDiskStorageProvider implements StorageProvider {
  private readonly basePath: string;

  constructor(config: ConfigService) {
    this.basePath = path.resolve(config.get<string>('STORAGE_LOCAL_PATH') ?? 'storage');
  }

  private resolve(storageKey: string) {
    const full = path.join(this.basePath, storageKey);
    const normalizedBase = path.resolve(this.basePath) + path.sep;
    if (!path.resolve(full).startsWith(normalizedBase)) {
      throw new Error('Chave de storage inválida');
    }
    return full;
  }

  async save(input: StorageSaveInput): Promise<string> {
    const full = this.resolve(input.relativeKey);
    await fs.mkdir(path.dirname(full), { recursive: true });
    await fs.writeFile(full, input.buffer);
    return input.relativeKey;
  }

  async read(storageKey: string): Promise<Buffer> {
    return fs.readFile(this.resolve(storageKey));
  }

  async delete(storageKey: string): Promise<void> {
    await fs.unlink(this.resolve(storageKey)).catch(() => undefined);
  }
}