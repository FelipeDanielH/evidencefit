import { Injectable } from '@nestjs/common';
import { compare, hash } from 'bcryptjs';

const PASSWORD_SALT_ROUNDS = 12;

@Injectable()
export class PasswordHashService {
  hash(password: string): Promise<string> {
    return hash(password, PASSWORD_SALT_ROUNDS);
  }

  verify(password: string, passwordHash: string): Promise<boolean> {
    return compare(password, passwordHash);
  }
}
