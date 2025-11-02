import { logger } from '../../../../shared/utils/logger';
import { ForbiddenError } from '../../../../shared/utils/errors';

export enum Permission {
  // Device permissions
  DEVICE_READ = 'device:read',
  DEVICE_WRITE = 'device:write',
  DEVICE_DELETE = 'device:delete',
  DEVICE_CONTROL = 'device:control',
  
  // Automation permissions
  AUTOMATION_READ = 'automation:read',
  AUTOMATION_WRITE = 'automation:write',
  AUTOMATION_DELETE = 'automation:delete',
  AUTOMATION_EXECUTE = 'automation:execute',
  
  // Scene permissions
  SCENE_READ = 'scene:read',
  SCENE_WRITE = 'scene:write',
  SCENE_DELETE = 'scene:delete',
  SCENE_EXECUTE = 'scene:execute',
  
  // User permissions
  USER_READ = 'user:read',
  USER_WRITE = 'user:write',
  USER_DELETE = 'user:delete',
  
  // Home permissions
  HOME_READ = 'home:read',
  HOME_WRITE = 'home:write',
  HOME_DELETE = 'home:delete',
  HOME_MANAGE_USERS = 'home:manage_users',
  
  // Energy permissions
  ENERGY_READ = 'energy:read',
  ENERGY_WRITE = 'energy:write',
  
  // Analytics permissions
  ANALYTICS_READ = 'analytics:read',
  ANALYTICS_EXPORT = 'analytics:export',
  
  // System permissions
  SYSTEM_ADMIN = 'system:admin',
  SYSTEM_LOGS = 'system:logs',
  SYSTEM_SETTINGS = 'system:settings'
}

export enum Role {
  SUPER_ADMIN = 'super_admin',
  HOME_OWNER = 'home_owner',
  HOME_ADMIN = 'home_admin',
  HOME_MEMBER = 'home_member',
  GUEST = 'guest'
}

interface RolePermissions {
  role: Role;
  permissions: Permission[];
  inherits?: Role[];
}

export class RBACService {
  private rolePermissions: Map<Role, Set<Permission>> = new Map();

  constructor() {
    this.initializeRoles();
  }

  private initializeRoles() {
    const roles: RolePermissions[] = [
      {
        role: Role.SUPER_ADMIN,
        permissions: Object.values(Permission)
      },
      {
        role: Role.HOME_OWNER,
        permissions: [
          Permission.DEVICE_READ,
          Permission.DEVICE_WRITE,
          Permission.DEVICE_DELETE,
          Permission.DEVICE_CONTROL,
          Permission.AUTOMATION_READ,
          Permission.AUTOMATION_WRITE,
          Permission.AUTOMATION_DELETE,
          Permission.AUTOMATION_EXECUTE,
          Permission.SCENE_READ,
          Permission.SCENE_WRITE,
          Permission.SCENE_DELETE,
          Permission.SCENE_EXECUTE,
          Permission.USER_READ,
          Permission.HOME_READ,
          Permission.HOME_WRITE,
          Permission.HOME_MANAGE_USERS,
          Permission.ENERGY_READ,
          Permission.ENERGY_WRITE,
          Permission.ANALYTICS_READ,
          Permission.ANALYTICS_EXPORT
        ]
      },
      {
        role: Role.HOME_ADMIN,
        permissions: [
          Permission.DEVICE_READ,
          Permission.DEVICE_WRITE,
          Permission.DEVICE_CONTROL,
          Permission.AUTOMATION_READ,
          Permission.AUTOMATION_WRITE,
          Permission.AUTOMATION_EXECUTE,
          Permission.SCENE_READ,
          Permission.SCENE_WRITE,
          Permission.SCENE_EXECUTE,
          Permission.USER_READ,
          Permission.HOME_READ,
          Permission.ENERGY_READ,
          Permission.ANALYTICS_READ
        ]
      },
      {
        role: Role.HOME_MEMBER,
        permissions: [
          Permission.DEVICE_READ,
          Permission.DEVICE_CONTROL,
          Permission.AUTOMATION_READ,
          Permission.AUTOMATION_EXECUTE,
          Permission.SCENE_READ,
          Permission.SCENE_EXECUTE,
          Permission.HOME_READ,
          Permission.ENERGY_READ
        ]
      },
      {
        role: Role.GUEST,
        permissions: [
          Permission.DEVICE_READ,
          Permission.SCENE_READ,
          Permission.HOME_READ
        ]
      }
    ];

    roles.forEach(roleConfig => {
      this.rolePermissions.set(roleConfig.role, new Set(roleConfig.permissions));
    });
  }

  public hasPermission(role: Role, permission: Permission): boolean {
    const permissions = this.rolePermissions.get(role);
    if (!permissions) {
      logger.warn('Unknown role', { role });
      return false;
    }

    return permissions.has(permission);
  }

  public hasAnyPermission(role: Role, permissions: Permission[]): boolean {
    return permissions.some(permission => this.hasPermission(role, permission));
  }

  public hasAllPermissions(role: Role, permissions: Permission[]): boolean {
    return permissions.every(permission => this.hasPermission(role, permission));
  }

  public checkPermission(role: Role, permission: Permission): void {
    if (!this.hasPermission(role, permission)) {
      logger.warn('Permission denied', { role, permission });
      throw new ForbiddenError(`Insufficient permissions: ${permission} required`);
    }
  }

  public getRolePermissions(role: Role): Permission[] {
    const permissions = this.rolePermissions.get(role);
    return permissions ? Array.from(permissions) : [];
  }

  public canAccessResource(
    userRole: Role,
    resourceOwnerId: string,
    userId: string,
    requiredPermission: Permission
  ): boolean {
    // Super admin can access everything
    if (userRole === Role.SUPER_ADMIN) {
      return true;
    }

    // Owner can access their own resources
    if (resourceOwnerId === userId && this.hasPermission(userRole, requiredPermission)) {
      return true;
    }

    // Check if user has permission for other users' resources
    return this.hasPermission(userRole, requiredPermission);
  }
}

export const rbacService = new RBACService();
