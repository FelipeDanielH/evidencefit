import {
  ConflictException,
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../database/prisma.service.js';
import type { User } from '../generated/prisma/client.js';
import type { LoginDto } from './dto/login.dto.js';
import type { RegisterDto } from './dto/register.dto.js';
import { PasswordHashService } from './password-hash.service.js';
import type { AuthResponse, JwtPayload, PublicUser } from './auth.types.js';

const DUMMY_PASSWORD_HASH = '$2b$12$qJ/9qssjhLxwPglNn7FXYOFmPZC38D8n6lCfeorBPZZzFQ1WR0FZK';

function isUniqueConstraintError(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002';
}

@Injectable()
export class AuthService {
  constructor(
    private readonly jwtService: JwtService,
    private readonly passwordHashService: PasswordHashService,
    private readonly prismaService: PrismaService,
  ) {}

  async register(input: RegisterDto): Promise<AuthResponse> {
    const email = this.normalizeEmail(input.email);
    const passwordHash = await this.passwordHashService.hash(input.password);
    let user: User;
    try {
      user = await this.prismaService.client.user.create({
        data: { email, passwordHash },
      });
    } catch (error: unknown) {
      if (isUniqueConstraintError(error)) {
        throw new ConflictException('No fue posible registrar esta cuenta.');
      }
      throw new ServiceUnavailableException('El registro no está disponible temporalmente.');
    }
    return this.createAuthResponse(user);
  }

  async login(input: LoginDto): Promise<AuthResponse> {
    const email = this.normalizeEmail(input.email);
    let user: User | null;
    try {
      user = await this.prismaService.client.user.findUnique({ where: { email } });
    } catch {
      throw new ServiceUnavailableException(
        'El inicio de sesión no está disponible temporalmente.',
      );
    }

    const passwordMatches = await this.passwordHashService.verify(
      input.password,
      user?.passwordHash ?? DUMMY_PASSWORD_HASH,
    );
    if (!user || !passwordMatches) {
      throw new UnauthorizedException('Email o contraseña inválidos.');
    }
    return this.createAuthResponse(user);
  }

  private async createAuthResponse(user: User): Promise<AuthResponse> {
    const payload: JwtPayload = { email: user.email, sub: user.id };
    return { accessToken: await this.jwtService.signAsync(payload), user: this.toPublicUser(user) };
  }

  private normalizeEmail(email: string): string {
    return email.trim().toLocaleLowerCase('en-US');
  }

  private toPublicUser(user: User): PublicUser {
    return { createdAt: user.createdAt.toISOString(), email: user.email, id: user.id };
  }
}
