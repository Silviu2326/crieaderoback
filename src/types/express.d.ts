import { UserRole } from '@prisma/client';

declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        email: string;
        role: UserRole;
        firstName: string;
        lastName: string;
      };
    }
  }
}

export interface TokenPayload {
  userId: string;
  email: string;
  role: UserRole;
  firstName: string;
  lastName: string;
}
