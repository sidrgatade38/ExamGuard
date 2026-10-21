const { supabase } = require('../config/supabase');

/**
 * Retrieves authoritative role information for a user directly from the database.
 * This ensures authorization decisions never rely on client-supplied claims.
 *
 * @param {string} userId - UUID of the user
 * @returns {Promise<{ userId: string, roleId: string, roleName: string, isActive: boolean }>}
 */
async function getUserRole(userId) {
  if (!userId) {
    const err = new Error('User ID is required for role lookup');
    err.statusCode = 400;
    throw err;
  }

  // 1. Fetch user and embedded role
  const { data: user, error: userError } = await supabase
    .from('users')
    .select('id, role_id, is_active, roles(id, name)')
    .eq('id', userId)
    .maybeSingle();

  if (userError) {
    console.error('[AuthorizationService] Database query error:', userError.message);
    const dbErr = new Error('Authorization service temporarily unavailable');
    dbErr.statusCode = 500;
    throw dbErr;
  }

  if (!user) {
    const notFoundErr = new Error('User account not found');
    notFoundErr.statusCode = 403;
    throw notFoundErr;
  }

  if (!user.is_active) {
    const inactiveErr = new Error('User account is inactive');
    inactiveErr.statusCode = 403;
    throw inactiveErr;
  }

  // Handle case where role joined object exists or perform fallback lookup
  let roleName = user.roles?.name;
  if (!roleName && user.role_id) {
    const { data: roleRecord, error: roleError } = await supabase
      .from('roles')
      .select('id, name')
      .eq('id', user.role_id)
      .maybeSingle();

    if (!roleError && roleRecord) {
      roleName = roleRecord.name;
    }
  }

  if (!roleName) {
    console.error(`[AuthorizationService] No role found for user ID: ${userId}, role_id: ${user.role_id}`);
    const noRoleErr = new Error('User has no valid role assigned');
    noRoleErr.statusCode = 403;
    throw noRoleErr;
  }

  return {
    userId: user.id,
    roleId: user.role_id,
    roleName: roleName.toUpperCase(),
    isActive: user.is_active,
  };
}

module.exports = {
  getUserRole,
};
