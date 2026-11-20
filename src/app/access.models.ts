export interface AccessPermission { code:string; name:string; group:string; description:string; globalOnly:boolean }
export interface AccessRole { id:string; code:string; name:string; description:string|null; isActive:boolean; isSystem:boolean; permissions:string[]; rowVersion:string }
export interface RoleAssignment { roleId:string; scope:string; divisionId:string|null; reportDefinitionId:string|null }
export interface AccessCatalog { roles:AccessRole[]; permissions:AccessPermission[]; divisions:{id:string;name:string}[]; reports:{id:string;code:string;name:string}[] }
export interface UserAccess { userId:string; user:string; divisionId:string; rowVersion:string; assignments:(RoleAssignment & {name:string;isRoleActive:boolean})[]; effectivePermissions:{code:string;scope:string;divisionId:string|null;reportDefinitionId:string|null;sources:string[]}[] }
