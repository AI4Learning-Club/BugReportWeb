import { Permission, UserStatus } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const normalRole = await prisma.role.upsert({
    where: { name: '普通用户' },
    update: {
      permissions: [Permission.CREATE_BUG, Permission.RETEST_BUG, Permission.ADD_BUG_EVIDENCE]
    },
    create: {
      name: '普通用户',
      permissions: [Permission.CREATE_BUG, Permission.RETEST_BUG, Permission.ADD_BUG_EVIDENCE]
    }
  });

  await prisma.role.upsert({
    where: { name: '程序员' },
    update: {
      permissions: [
        Permission.CREATE_BUG,
        Permission.RETEST_BUG,
        Permission.ADD_BUG_EVIDENCE,
        Permission.MARK_BUG_FIXED
      ]
    },
    create: {
      name: '程序员',
      permissions: [
        Permission.CREATE_BUG,
        Permission.RETEST_BUG,
        Permission.ADD_BUG_EVIDENCE,
        Permission.MARK_BUG_FIXED
      ]
    }
  });

  const passwordHash = await bcrypt.hash('admin123', 10);
  await prisma.user.upsert({
    where: { username: 'admin' },
    update: {
      displayName: '系统管理员',
      status: UserStatus.ACTIVE,
      isAdmin: true,
      roleId: normalRole.id
    },
    create: {
      username: 'admin',
      displayName: '系统管理员',
      passwordHash,
      status: UserStatus.ACTIVE,
      isAdmin: true,
      roleId: normalRole.id
    }
  });
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
