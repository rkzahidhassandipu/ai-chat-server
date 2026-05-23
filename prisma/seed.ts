import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  await prisma.blockedUser.deleteMany();
  await prisma.refreshToken.deleteMany();
  await prisma.user.deleteMany();

  const adminPassword = await bcrypt.hash('Admin@12345', 12);
  const userPassword = await bcrypt.hash('User@12345', 12);

  const admin = await prisma.user.create({
    data: {
      name: 'Admin User',
      email: 'admin@aichat.com',
      password: adminPassword,
      role: 'ADMIN',
      isEmailVerified: true,
      status: 'ONLINE',
      preferredLanguage: 'en',
    },
  });

  const users = await Promise.all([
    prisma.user.create({
      data: {
        name: 'Alice Johnson',
        email: 'alice@example.com',
        password: userPassword,
        isEmailVerified: true,
        preferredLanguage: 'en',
        bio: 'Hello, I am Alice!',
      },
    }),
    prisma.user.create({
      data: {
        name: 'Bob Smith',
        email: 'bob@example.com',
        password: userPassword,
        isEmailVerified: true,
        preferredLanguage: 'bn',
        bio: 'Hello, I am Bob!',
      },
    }),
    prisma.user.create({
      data: {
        name: 'Carol Williams',
        email: 'carol@example.com',
        password: userPassword,
        isEmailVerified: true,
        preferredLanguage: 'es',
        bio: 'Hello, I am Carol!',
      },
    }),
  ]);

  console.log('✅ Seeded:');
  console.log(`  Admin : ${admin.email}  →  Admin@12345`);
  users.forEach((u) => console.log(`  User  : ${u.email}  →  User@12345`));
}

main()
  .catch((e) => {
    console.error('❌ Seed error:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
