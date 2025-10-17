import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function seed() {
  console.log('Seeding database...');

  // Create test users
  const adminUser = await prisma.user.upsert({
    where: { email: 'admin@example.com' },
    update: {},
    create: {
      email: 'admin@example.com',
      name: 'Admin User',
      role: 'ADMIN',
    },
  });

  const normalUser = await prisma.user.upsert({
    where: { email: 'user@example.com' },
    update: {},
    create: {
      email: 'user@example.com',
      name: 'Regular User',
      role: 'USER',
    },
  });

  console.log('✓ Test users created:');
  console.log(`  Admin: ${adminUser.email} (ID: ${adminUser.id})`);
  console.log(`  User: ${normalUser.email} (ID: ${normalUser.id})`);

  // Create a sample job for testing
  const sampleJob = await prisma.bulkPayrollJob.create({
    data: {
      uploaderId: normalUser.id,
      status: 'COMPLETED',
      totalRows: 5,
      validRows: 3,
      invalidRows: 2,
      processedRows: 3,
      failedRows: 0,
      completedAt: new Date(),
      rawPayload: JSON.stringify({
        headers: ['employee_email', 'amount', 'currency', 'pay_date'],
        note: 'Sample completed job',
      }),
    },
  });

  console.log(`✓ Sample job created: ${sampleJob.id}`);

  console.log('✅ Seeding completed!');
  console.log('\nTest credentials:');
  console.log('  Admin Email: admin@example.com');
  console.log('  User Email: user@example.com');
}

seed()
  .catch((error) => {
    console.error('Seeding failed:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
