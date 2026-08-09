// One-time script to reset admin@oasis.local password to Admin@123
// Run: node scripts/reset-admin-password.js

const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

require('dotenv').config({ path: '.env.local' });

async function main() {
  const prisma = new PrismaClient();
  try {
    const hash = await bcrypt.hash('Admin@123', 12);
    const user = await prisma.user.update({
      where: { email: 'admin@oasis.local' },
      data: { password: hash },
    });
    console.log('Password reset for:', user.email);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch(console.error);
