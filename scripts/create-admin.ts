// Cria (ou atualiza) o usuário administrador sem deixar senha no código.
//
// Uso (PowerShell):
//   $env:ADMIN_EMAIL="voce@email.com"; $env:ADMIN_PASSWORD="uma-senha-forte"; npm run create-admin
// Uso (Linux/macOS):
//   ADMIN_EMAIL=voce@email.com ADMIN_PASSWORD=uma-senha-forte npm run create-admin
//
// Precisa de DATABASE_URL no ambiente ou no arquivo .env (o Prisma Client lê
// o .env sozinho). Use o e-mail EXATAMENTE como já está no banco para
// atualizar a conta existente; um e-mail diferente cria um novo usuário.
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

async function main() {
  const email = process.env.ADMIN_EMAIL?.trim();
  const password = process.env.ADMIN_PASSWORD;
  const name = process.env.ADMIN_NAME?.trim() || 'Administrador';

  if (!email || !password) {
    console.error('Defina ADMIN_EMAIL e ADMIN_PASSWORD antes de executar.');
    process.exit(1);
  }

  if (password.length < 10) {
    console.error('Use uma senha com pelo menos 10 caracteres.');
    process.exit(1);
  }

  const prisma = new PrismaClient();

  try {
    const hash = await bcrypt.hash(password, 10);

    const user = await prisma.user.upsert({
      where: { email },
      update: { password: hash, role: 'ADMIN', name },
      create: { email, name, password: hash, role: 'ADMIN' },
      select: { id: true, email: true, role: true },
    });

    console.log(`Administrador pronto: ${user.email} (id ${user.id})`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
