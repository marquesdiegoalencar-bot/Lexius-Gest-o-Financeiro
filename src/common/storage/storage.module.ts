import { Global, Module } from '@nestjs/common';
import { LocalDiskStorageProvider } from './local-disk-storage.provider';
import { STORAGE_PROVIDER } from './storage-provider.interface';

@Global()
@Module({
  providers: [
    LocalDiskStorageProvider,
    { provide: STORAGE_PROVIDER, useExisting: LocalDiskStorageProvider },
  ],
  exports: [STORAGE_PROVIDER, LocalDiskStorageProvider],
})
export class StorageModule {}