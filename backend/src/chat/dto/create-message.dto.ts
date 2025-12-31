import { IsString, IsNotEmpty, MaxLength, IsMongoId, IsOptional } from 'class-validator';

export class CreateMessageDto {
  @IsMongoId()
  @IsNotEmpty()
  conversationId: string;

  @IsString()
  @IsOptional()
  @MaxLength(1000)
  content?: string;

  @IsString()
  @IsOptional()
  fileUrl?: string; // Optional if just sending text, but one of them required usually.
}
