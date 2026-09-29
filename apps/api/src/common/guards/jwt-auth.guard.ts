import { Injectable, CanActivate, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { env } from '../../config/env.validation';
import { User, UserDocument } from '../../database/schemas/user.schema';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';

/**
 * JWT authentication guard with authoritative DB validation.
 * Verifies the access token signature AND re-checks the user's current
 * status/roles in the database on every request, so demoted, suspended,
 * or deleted accounts lose access immediately - not when the JWT expires.
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    @InjectModel(User.name) private userModel: Model<UserDocument>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const authHeader = request.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing or invalid Authorization header');
    }

    const token = authHeader.split(' ')[1];
    let payload: any;
    try {
      payload = this.jwtService.verify(token, { secret: env().jwtAccessSecret });
    } catch {
      throw new UnauthorizedException('Token is invalid or expired');
    }

    if (!payload?.sub) {
      throw new UnauthorizedException('Token payload is invalid');
    }

    const user = await this.userModel.findById(payload.sub);
    if (!user || ['suspended', 'restricted', 'deleted'].includes(user.status)) {
      throw new UnauthorizedException('Account is not active');
    }

    // Authoritative claims from the database, never from the token alone.
    request.user = {
      sub: (user._id as any).toString(),
      email: user.email,
      roles: user.roles,
      status: user.status,
    };
    return true;
  }
}
