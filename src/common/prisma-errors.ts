// Códigos de erro do Prisma que tratamos explicitamente.
export const PRISMA_UNIQUE_VIOLATION = 'P2002';
export const PRISMA_RECORD_NOT_FOUND = 'P2025';

export function isPrismaError(error: unknown, code: string): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    (error as { code?: string }).code === code
  );
}
