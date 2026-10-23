import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { hasAnyRole } from '../auth/roles';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<string[]>('roles', [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user || !user.roles) {
      throw new ForbiddenException('Access denied: missing role claims');
    }

    // Case-insensitive: role rows may predate the lowercase canonical set.
    if (!hasAnyRole(user.roles, requiredRoles)) {
      throw new ForbiddenException(`Access denied: required role ${requiredRoles.join(', ')}`);
    }

    return true;
  }
}
