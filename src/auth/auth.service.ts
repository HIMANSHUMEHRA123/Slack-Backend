import {
  Injectable,
  UnauthorizedException,
  ConflictException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import { RegisterDto, LoginDto, UpdateProfileDto } from './dto/auth.dto';
import * as bcrypt from 'bcryptjs';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
  ) {}

  // POST /api/auth/register
  async register(dto: RegisterDto) {
    // Email already exists check
    const existingEmail = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    if (existingEmail) throw new ConflictException('Email already registered');

    // Username already exists check
    const username = dto.username ?? this.generateUsername(dto.full_name);
    const existingUsername = await this.prisma.user.findUnique({
      where: { username },
    });
    if (existingUsername) throw new ConflictException('Username already taken');

    // Password hash
    const hashedPassword = await bcrypt.hash(dto.password, 10);

    // User create
    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        password: hashedPassword,
        full_name: dto.full_name,
        username,
      },
    });

    const tokens = this.generateTokens(user.id, user.email);

    return {
      user: this.excludePassword(user),
      tokens,
    };
  }

  // POST /api/auth/login
  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    if (!user) throw new UnauthorizedException('Invalid email or password');

    const passwordMatch = await bcrypt.compare(dto.password, user.password);
    if (!passwordMatch)
      throw new UnauthorizedException('Invalid email or password');

    const tokens = this.generateTokens(user.id, user.email);

    return {
      user: this.excludePassword(user),
      tokens,
    };
  }

  // GET /api/auth/me
  async getMe(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });
    if (!user) throw new UnauthorizedException('User not found');
    return this.excludePassword(user);
  }

  // PATCH /api/auth/me
  async updateProfile(userId: string, dto: UpdateProfileDto) {
    if (dto.username) {
      const existing = await this.prisma.user.findUnique({
        where: { username: dto.username },
      });
      if (existing && existing.id !== userId)
        throw new ConflictException('Username already taken');
    }

    const user = await this.prisma.user.update({
      where: { id: userId },
      data: dto,
    });

    return this.excludePassword(user);
  }

  // Token validate (JwtAuthGuard use karega)
  async validateUser(userId: string) {
    return this.prisma.user.findUnique({ where: { id: userId } });
  }

  // ── Helpers ──────────────────────────────────────────────
  private generateTokens(userId: string, email: string) {
    const payload = { sub: userId, email };
    return {
      access_token: this.jwt.sign(payload),
      refresh_token: this.jwt.sign(payload, { expiresIn: '30d' }),
    };
  }

  private excludePassword(user: any) {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { password, ...rest } = user;
    return rest;
  }

  private generateUsername(fullName: string): string {
    const base = fullName
      .toLowerCase()
      .replace(/\s+/g, '.')
      .replace(/[^a-z0-9.]/g, '');
    const suffix = Math.floor(1000 + Math.random() * 9000);
    return `${base}${suffix}`;
  }
}
