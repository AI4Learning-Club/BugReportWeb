import { Permission } from '@prisma/client';

export type AuthUser = {
  id: string;
  username: string;
  displayName: string;
  isAdmin: boolean;
  permissions: Permission[];
};

export type RequestWithUser = Request & {
  user: AuthUser;
};
