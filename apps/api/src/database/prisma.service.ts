import { Injectable, OnModuleDestroy, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client.js';

@Injectable()
export class PrismaService implements OnModuleDestroy {
  private prismaClient: PrismaClient | null = null;

  constructor(private readonly configService: ConfigService) {}

  get client(): PrismaClient {
    if (!this.prismaClient) {
      this.prismaClient = this.createClient();
    }

    return this.prismaClient;
  }

  async onModuleDestroy(): Promise<void> {
    await this.prismaClient?.$disconnect();
  }

  private createClient(): PrismaClient {
    const connectionString = this.configService.get<string>('DATABASE_URL');
    if (!connectionString) {
      throw new ServiceUnavailableException('PostgreSQL is not configured.');
    }

    const adapter = new PrismaPg({ connectionString });
    return new PrismaClient({ adapter });
  }
}
