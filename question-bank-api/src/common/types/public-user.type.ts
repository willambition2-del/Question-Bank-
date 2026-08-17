import { CompanionType, GradeLevel, UserRole } from '../../generated/prisma/enums';

export interface PublicUser {
  id: string;
  name: string;
  username: string;
  phone: string | null;
  email: string | null;
  role: UserRole;
  companion: CompanionType;
  schoolName: string | null;
  governorate: string | null;
  gradeLevel: GradeLevel | null;
  onboardingCompleted: boolean;
  isActive: boolean;
  lastLoginAt: Date | null;
  createdAt: Date;
}
