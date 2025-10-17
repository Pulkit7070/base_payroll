import { PrismaClient } from '@prisma/client';

/**
 * Global Prisma client instance
 * Using singleton pattern to avoid multiple instances in Next.js
 */
let prismaClientSingleton: PrismaClient | undefined;

export const prisma = (() => {
  if (process.env.NODE_ENV === 'production') {
    return new PrismaClient();
  } else {
    if (!prismaClientSingleton) {
      prismaClientSingleton = new PrismaClient();
    }
    return prismaClientSingleton;
  }
})();

export default prisma;
