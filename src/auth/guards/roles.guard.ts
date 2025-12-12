import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';

@Injectable()
export class RolesGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest();
    const user = req.user;
    const requiredRoles = Reflect.getMetadata('roles', context.getHandler()) || [];

    if (requiredRoles.length === 0) return true;

    const hasRole = requiredRoles.some((role: string) => user.role === role);
    if (!hasRole) throw new ForbiddenException('Insufficient permissions');
    return true;
  }
}