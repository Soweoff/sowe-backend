import * as bcrypt from 'bcrypt';

async function run() {
  const hash = await bcrypt.hash('55v98g09hxz', 10);
  console.log(hash);
}

run();
