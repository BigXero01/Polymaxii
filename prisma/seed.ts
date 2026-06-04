import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const db = new PrismaClient()

async function main() {
  console.log('Seeding database...')

  const passwordHash = await bcrypt.hash('password123', 12)
  const user = await db.user.upsert({
    where: { email: 'demo@polymaxii.com' },
    update: {},
    create: {
      email: 'demo@polymaxii.com',
      name: 'Demo User',
      passwordHash,
    },
  })

  await db.portfolio.upsert({
    where: { userId: user.id },
    update: {},
    create: {
      userId: user.id,
      usdBalance: 10000,
      totalDeposited: 10000,
    },
  })

  await db.botSettings.upsert({
    where: { userId: user.id },
    update: {},
    create: {
      userId: user.id,
      isActive: false,
      tradingMode: 'PAPER',
    },
  })

  console.log(`✓ Demo user created: demo@polymaxii.com / password123`)
  console.log(`✓ Portfolio: $10,000 paper balance`)
}

main()
  .catch(console.error)
  .finally(() => db.$disconnect())
