import { CompanionType, UserRole } from '../../generated/prisma/enums';

export interface PublicUser {
  id: string;
  name: string;
  username: string;
  phone: string | null;
  email: string | null;
  role: UserRole;
  companion: CompanionType;
  schoolName: string | null;
  isActive: boolean;
  lastLoginAt: Date | null;
  createdAt: Date;
}
