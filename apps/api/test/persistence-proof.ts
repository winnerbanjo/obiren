import { NestFactory } from '@nestjs/core';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { AppModule } from '../src/app.module';
import { runIndexMigration } from '../src/database/migrations/index-migration';
import { UsersService } from '../src/modules/users/users.service';
import { CyclesService } from '../src/modules/cycles/cycles.service';
import { PregnancyService } from '../src/modules/pregnancy/pregnancy.service';
import { SafetyService } from '../src/modules/safety/safety.service';
import { HealthVaultService } from '../src/modules/health-vault/health-vault.service';
import { getModelToken } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User } from '../src/database/schemas/user.schema';
import { Session } from '../src/database/schemas/session.schema';
import { Cycle, DailyLog } from '../src/database/schemas/cycle.schema';
import { Pregnancy } from '../src/database/schemas/pregnancy.schema';
import { DirectoryService } from '../src/database/schemas/directory.schema';
import { NotificationOutbox } from '../src/database/schemas/notification.schema';
import { SafetyIncident } from '../src/database/schemas/safety.schema';
import { HealthVaultDoc } from '../src/database/schemas/health-vault.schema';
import { AuditLog } from '../src/database/schemas/audit-log.schema';

async function runNestJsPersistenceProof() {
  console.log('🚀 Starting MongoMemoryServer instance for NestJS Model Persistence Proof...');
  const mongod = await MongoMemoryServer.create();
  const uri = mongod.getUri();
  process.env.MONGODB_URI = uri;
  console.log(`📡 MongoDB Test URI: ${uri}`);

  // 1. Run Explicit Index Migration
  await runIndexMigration(uri);

  console.log('\n--- 1. BOOTING NESTJS APP CONTEXT (PROCESS 1) ---');
  const app1 = await NestFactory.createApplicationContext(AppModule);

  const usersService1 = app1.get(UsersService);
  const cyclesService1 = app1.get(CyclesService);
  const pregnancyService1 = app1.get(PregnancyService);
  const safetyService1 = app1.get(SafetyService);
  const vaultService1 = app1.get(HealthVaultService);

  // Register user
  const userModel = app1.get<Model<User>>(getModelToken(User.name));
  const createdUser = await userModel.create({
    email: 'nestjs.proof@obiren.com',
    emailNormalized: 'nestjs.proof@obiren.com',
    passwordHash: '$argon2id$v=19$m=65536,t=3,p=4$simulated_hash',
    status: 'active',
    countryCode: 'NG',
  });

  const userId = createdUser._id.toString();
  console.log(`Created User via NestJS Model: ${userId} (${createdUser.email})`);

  // Create Cycle
  await cyclesService1.startPeriod(userId, '2026-07-01');

  // Create Daily Log
  await cyclesService1.upsertDailyLog(userId, '2026-07-23', { bleeding: { level: 'heavy' }, symptoms: ['cramps'] });

  // Create Pregnancy
  await pregnancyService1.createPregnancy(userId, {
    lastMenstrualPeriod: '2026-02-24',
    estimatedDueDate: '2026-12-01',
  });

  // Create Safety SOS Incident
  await safetyService1.triggerSos(userId, { gps: '6.5244 N, 3.3792 E' });

  // Create Health Vault Document
  await vaultService1.saveDocument(userId, { title: 'NestJS Vault Proof Document', documentType: 'prescription' });

  console.log('✅ Created records across NestJS services successfully.');

  console.log('\n--- 2. SHUTTING DOWN NESTJS APP CONTEXT (PROCESS 1 RESTART SIMULATION) ---');
  await app1.close();

  console.log('\n--- 3. BOOTING NEW NESTJS APP CONTEXT (PROCESS 2 AFTER RESTART) ---');
  const app2 = await NestFactory.createApplicationContext(AppModule);

  const usersService2 = app2.get(UsersService);
  const cyclesService2 = app2.get(CyclesService);
  const pregnancyService2 = app2.get(PregnancyService);
  const safetyService2 = app2.get(SafetyService);
  const vaultService2 = app2.get(HealthVaultService);

  // Re-fetch data from Process 2 to prove real persistence
  const fetchedUser = await usersService2.getProfile(userId);
  const fetchedCycle = await cyclesService2.getCurrentCycle(userId);
  const fetchedLog = await cyclesService2.getDailyLog(userId, '2026-07-23');
  const fetchedPregnancy = await pregnancyService2.getCurrentPregnancy(userId);
  const fetchedIncidents = await safetyService2.getIncidents(userId);
  const fetchedDocs = await vaultService2.getDocuments(userId);

  console.log(`Re-fetched User Email: ${fetchedUser.data.email}`);
  console.log(`Re-fetched Cycle Day: Day ${fetchedCycle.data?.dayOfCycle}`);
  console.log(`Re-fetched Daily Log Bleeding: ${fetchedLog.data?.bleeding?.level}`);
  console.log(`Re-fetched Pregnancy Gestational Week: Week ${fetchedPregnancy.data?.currentWeek}`);
  console.log(`Re-fetched SOS Incidents Count: ${fetchedIncidents.data?.length}`);
  console.log(`Re-fetched Health Vault Docs Count: ${fetchedDocs.data?.length}`);

  console.log('\n--- 4. INSPECTING CREATED MONGOOSE INDEXES VIA NESTJS MODELS ---');
  const modelTokens = [
    { name: 'User', token: User.name },
    { name: 'Session', token: Session.name },
    { name: 'Cycle', token: Cycle.name },
    { name: 'DailyLog', token: DailyLog.name },
    { name: 'Pregnancy', token: Pregnancy.name },
    { name: 'NotificationOutbox', token: NotificationOutbox.name },
    { name: 'DirectoryService', token: DirectoryService.name },
    { name: 'SafetyIncident', token: SafetyIncident.name },
    { name: 'HealthVaultDoc', token: HealthVaultDoc.name },
    { name: 'AuditLog', token: AuditLog.name },
  ];

  for (const m of modelTokens) {
    const model = app2.get<Model<any>>(getModelToken(m.token));
    const indexes = await model.listIndexes();
    console.log(`\nNestJS Model [${m.name}] Collection Indexes:`);
    indexes.forEach((idx) => {
      console.log(`  - Index Name: "${idx.name}", Keys: ${JSON.stringify(idx.key)}${idx.unique ? ' (UNIQUE)' : ''}`);
    });
  }

  await app2.close();
  await mongod.stop();
  console.log('\n✅ NestJS Persistence Proof Completed Successfully.');
}

runNestJsPersistenceProof().catch((err) => {
  console.error('NestJS Persistence Proof Failed:', err);
  process.exit(1);
});
