import { UserStatus } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const TEST_USERS = [
  { username: 'tester', displayName: '测试员小王', roleName: '普通用户', password: 'test123' },
  { username: 'dev', displayName: '程序员小李', roleName: '程序员', password: 'test123' },
  { username: 'manager', displayName: '管理者小张', roleName: '管理者', password: 'test123' },
  { username: 'pending', displayName: '待审批用户', roleName: '普通用户', password: 'test123', status: UserStatus.PENDING }
] as const;

async function main() {
  for (const entry of TEST_USERS) {
    const role = await prisma.role.findUnique({ where: { name: entry.roleName } });
    const passwordHash = await bcrypt.hash(entry.password, 10);
    const status = 'status' in entry ? entry.status : UserStatus.ACTIVE;

    await prisma.user.upsert({
      where: { username: entry.username },
      update: {
        displayName: entry.displayName,
        passwordHash,
        status,
        isAdmin: false,
        roleId: role?.id
      },
      create: {
        username: entry.username,
        displayName: entry.displayName,
        passwordHash,
        status,
        isAdmin: false,
        roleId: role?.id
      }
    });

    console.log(`✓ ${entry.username} (${entry.displayName}) — ${entry.roleName}${status === UserStatus.PENDING ? ' [待审批]' : ''}`);
  }
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
