import { Global, Module } from '@nestjs/common';
import { CloudinaryService } from './cloudinary.service';
import { CloudinaryProvider } from './cloudinary.config';

@Global()
@Module({
  providers: [CloudinaryProvider, CloudinaryService],
  exports: [CloudinaryService],
})
export class StorageModule {}