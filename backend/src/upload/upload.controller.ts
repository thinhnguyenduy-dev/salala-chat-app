import { Controller, Post, Get } from '@nestjs/common';
import { UploadService } from './upload.service';

@Controller('upload')
export class UploadController {
  constructor(private readonly uploadService: UploadService) {}

  @Get('sign') // Changed to GET for simplicity in fetching config/sig, or POST if we want to secure it more. GET is fine for "getting" a fresh sig.
  getUploadSignature() {
    return this.uploadService.getUploadSignature();
  }
}
