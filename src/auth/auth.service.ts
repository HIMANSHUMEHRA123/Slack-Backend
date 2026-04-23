import {
  Injectable,
  UnauthorizedException,
  ConflictException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { JwtService } from '@nestjs/jwt';
import { User, UserDocument } from '../schemas/user.schema';
import { RegisterDto, LoginDto, UpdateProfileDto } from './dto/auth.dto';
import * as bcrypt from 'bcryptjs';

@Injectable()
export class AuthService {
  constructor(
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    private jwt: JwtService,
  ) {}

  // POST /api/auth/register
  async register(dto: RegisterDto) {
    // Email already exists check
    const existingEmail = await this.userModel.findOne({ email: dto.email });
    if (existingEmail) throw new ConflictException('Email already registered');

    // Username already exists check
    const username = dto.username ?? this.generateUsername(dto.full_name);
    const existingUsername = await this.userModel.findOne({ username });
    if (existingUsername) throw new ConflictException('Username already taken');

    // Password hash
    const hashedPassword = await bcrypt.hash(dto.password, 10);

    // User create
    const user = await this.userModel.create({
      email: dto.email,
      password: hashedPassword,
      full_name: dto.full_name,
      username,
    });

    const tokens = this.generateTokens(
      user._id.toString(),
      user.email,
    );

    return {
      user: this.excludePassword(user.toObject()),
      tokens,
    };
  }

  // POST /api/auth/login
  async login(dto: LoginDto) {
    const user = await this.userModel.findOne({ email: dto.email });

    if (!user) throw new UnauthorizedException('Invalid email or password');

    const passwordMatch = await bcrypt.compare(dto.password, user.password);
    if (!passwordMatch)
      throw new UnauthorizedException('Invalid email or password');

    const tokens = this.generateTokens(
      user._id.toString(),
      user.email,
    );

    return {
      user: this.excludePassword(user.toObject()),
      tokens,
    };
  }

  // GET /api/auth/me
  async getMe(userId: string) {
    const user = await this.userModel.findById(userId);
    if (!user) throw new UnauthorizedException('User not found');
    return this.excludePassword(user.toObject());
  }

  // PATCH /api/auth/me
  async updateProfile(userId: string, dto: UpdateProfileDto) {
    if (dto.username) {
      const existing = await this.userModel.findOne({ username: dto.username });
      if (existing && existing._id.toString() !== userId)
        throw new ConflictException('Username already taken');
    }

    const user = await this.userModel.findByIdAndUpdate(userId, dto, {
      new: true,
    });

    if (!user) throw new UnauthorizedException('User not found');

    return this.excludePassword(user.toObject());
  }

  // Token validate (JwtAuthGuard use karega)
  async validateUser(userId: string) {
    return this.userModel.findById(userId);
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
