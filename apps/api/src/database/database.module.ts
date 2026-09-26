import { Module, type DynamicModule } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { config } from 'dotenv';
import { PrismaService } from './prisma.service.js';

config({ path: ['.env.local', '.env', '../../.env.local', '../../.env'], quiet: true });

function getMongooseImports(): DynamicModule[] {
  if (!process.env.MONGODB_URI?.trim()) {
    return [];
  }

  return [
    MongooseModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        connectTimeoutMS: 5_000,
        dbName: configService.get<string>('MONGODB_DB_NAME', 'evidencefit'),
        serverSelectionTimeoutMS: 5_000,
        uri: configService.getOrThrow<string>('MONGODB_URI'),
      }),
    }),
  ];
}

@Module({
  imports: getMongooseImports(),
  providers: [PrismaService],
  exports: [PrismaService],
})
export class DatabaseModule {}
