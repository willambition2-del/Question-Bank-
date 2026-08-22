import { CompanionType, GradeLevel, UserRole } from '../../generated/prisma/enums';
import { PublicUser } from '../types/public-user.type';

export interface PublicUserSource {
  id: string;
  name: string;
  username: string;
  phone: string | null;
  email: string | null;
  role: UserRole;
  companion: CompanionType;
  schoolName: string | null;
  governorate?: string | null;
  gradeLevel?: GradeLevel | null;
  onboardingCompleted?: boolean | null;
  isActive: boolean;
  lastLoginAt: Date | null;
  createdAt: Date;
}

export function toPublicUser(user: PublicUserSource): PublicUser {
  const hasSchoolName = Boolean(user.schoolName && user.schoolName.trim().length > 0);
  const hasGovernorate = Boolean(user.governorate && user.governorate.trim().length > 0);
  const hasGradeLevel = Boolean(user.gradeLevel);
  const isComplete = Boolean(
    user.onboardingCompleted &&
    hasSchoolName &&
    hasGovernorate &&
    hasGradeLevel
  );

  return {
    id: user.id,
    name: user.name,
    username: user.username,
    phone: user.phone,
    email: user.email,
    role: user.role,
    companion: user.companion,
    schoolName: user.schoolName,
    governorate: user.governorate ?? null,
    gradeLevel: user.gradeLevel ?? null,
    onboardingCompleted: isComplete,
    isActive: user.isActive,
    lastLoginAt: user.lastLoginAt,
    createdAt: user.createdAt,
  };
}

