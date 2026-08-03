import { IsBoolean, IsEnum, IsOptional } from 'class-validator';
import { PageQueryDto } from '../../common/pagination/page-query.dto';
import { NotificationType } from '../../generated/prisma/enums';

export class NotificationQueryDto extends PageQueryDto {
  @IsOptional()
  @IsEnum(NotificationType)
  type?: NotificationType;

  @IsOptional()
  @IsBoolean()
  unreadOnly?: boolean;
}
