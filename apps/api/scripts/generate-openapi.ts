/**
 * Regenerates the checked-in OpenAPI 3.1 artifacts from the live Nest
 * Swagger document, so `openapi.json` / `openapi.yaml` can never drift from
 * the actual controllers.
 *
 * Runs fully offline against an ephemeral in-memory MongoDB; it never reads
 * the developer's configured Atlas URI.
 */
import * as fs from 'fs';
import * as path from 'path';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { dump as toYaml } from 'js-yaml';

async function main() {
  const mongod = await MongoMemoryServer.create();
  process.env.NODE_ENV = 'test';
  process.env.MONGODB_URI = mongod.getUri('obiren_openapi');
  process.env.JWT_ACCESS_SECRET ||= 'openapi-generation-access-secret-000000000000';
  process.env.JWT_REFRESH_SECRET ||= 'openapi-generation-refresh-secret-000000000000';

  // Import after the environment is pinned so config validation cannot read
  // a developer's local .env database.
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { NestFactory } = require('@nestjs/core');
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { AppModule } = require('../src/app.module');
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { configureApp } = require('../src/common/bootstrap');

  const app = await NestFactory.create(AppModule, { logger: false });
  configureApp(app);
  await app.listen(0, '127.0.0.1');

  try {
    const address = app.getHttpServer().address();
    const port = typeof address === 'object' && address ? address.port : 0;
    if (!port) throw new Error('Unable to determine the API port for document generation');

    const response = await fetch(`http://127.0.0.1:${port}/api/v1/docs-json`);
    if (!response.ok) throw new Error(`Swagger document request failed with status ${response.status}`);
    const document = await response.json();

    fs.writeFileSync(path.join(__dirname, '../openapi.json'), `${JSON.stringify(document, null, 2)}\n`);
    fs.writeFileSync(path.join(__dirname, '../openapi.yaml'), toYaml(document, { noRefs: true, lineWidth: 120 }));
    console.log(`Generated openapi.json and openapi.yaml (${Object.keys(document.paths || {}).length} paths).`);
  } finally {
    await app.close();
    await mongod.stop();
  }
}

main().catch((error) => {
  console.error('OpenAPI generation failed:', error);
  process.exit(1);
});
