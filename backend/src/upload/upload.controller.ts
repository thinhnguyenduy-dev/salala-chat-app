import { Controller, Get, Query } from '@nestjs/common';
import { UploadService } from './upload.service';

@Controller('upload')
export class UploadController {
  constructor(private readonly uploadService: UploadService) {}

  @Get('sign')
  getUploadSignature(
    @Query('resourceType') resourceType?: 'image' | 'video' | 'auto',
  ) {
    return this.uploadService.getUploadSignature(resourceType);
  }
}
