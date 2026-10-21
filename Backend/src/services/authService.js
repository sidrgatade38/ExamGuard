const bcrypt = require('bcryptjs');
const { supabase } = require('../config/supabase');
const { generateToken } = require('../utils/jwt');

/**
 * Resolves role name from embedded join or secondary lookup.
 */
async function resolveRoleName(user) {
  let roleName = user.roles?.name;
  if (!roleName && user.role_id) {
    const { data: roleRecord } = await supabase
      .from('roles')
      .select('id, name')
      .eq('id', user.role_id)
      .maybeSingle();
    if (roleRecord) {
      roleName = roleRecord.name;
    }
  }
  return roleName ? roleName.toUpperCase() : 'UNKNOWN';
}

/**
 * Authenticates user credentials and returns safe profile data with a signed JWT.
 * Enforces generic error messages to prevent account enumeration.
 *
 * @param {string} email
 * @param {string} password
 * @returns {Promise<{ token: string, user: Object }>}
 */
async function loginUser(email, password) {
  const normalizedEmail = email.trim().toLowerCase();

  // Query minimal required user attributes with embedded role
  const { data: user, error } = await supabase
    .from('users')
    .select('id, name, email, password_hash, role_id, is_active, roles(id, name)')
    .eq('email', normalizedEmail)
    .maybeSingle();

  if (error) {
    console.error('[AuthService] Supabase user query error:', error.message);
    const dbErr = new Error('Authentication service temporarily unavailable');
    dbErr.statusCode = 500;
    throw dbErr;
  }

  // Consistent generic error for both non-existent user and inactive account
  if (!user || !user.is_active) {
    const authErr = new Error('Invalid email or password');
    authErr.statusCode = 401;
    throw authErr;
  }

  // Compare submitted password with stored bcrypt hash
  const isPasswordValid = await bcrypt.compare(password, user.password_hash);
  if (!isPasswordValid) {
    const authErr = new Error('Invalid email or password');
    authErr.statusCode = 401;
    throw authErr;
  }

  // Resolve authoritative role name
  const roleName = await resolveRoleName(user);

  // Generate JWT token with minimal payload
  const token = generateToken({
    userId: user.id,
    roleId: user.role_id,
    email: user.email,
  });

  // Prepare safe user object (including role name for frontend navigation)
  const safeUser = {
    id: user.id,
    name: user.name,
    email: user.email,
    roleId: user.role_id,
    role: roleName,
  };

  return {
    token,
    user: safeUser,
  };
}

/**
 * Retrieves safe user profile for an authenticated identity including role name.
 *
 * @param {string} userId
 * @returns {Promise<Object>}
 */
async function getUserById(userId) {
  const { data: user, error } = await supabase
    .from('users')
    .select('id, name, email, role_id, is_active, roles(id, name)')
    .eq('id', userId)
    .maybeSingle();

  if (error) {
    console.error('[AuthService] Supabase user lookup error:', error.message);
    const dbErr = new Error('Failed to retrieve user profile');
    dbErr.statusCode = 500;
    throw dbErr;
  }

  if (!user || !user.is_active) {
    const notFoundErr = new Error('User profile not found or inactive');
    notFoundErr.statusCode = 404;
    throw notFoundErr;
  }

  const roleName = await resolveRoleName(user);

  return {
    id: user.id,
    name: user.name,
    email: user.email,
    roleId: user.role_id,
    role: roleName,
  };
}

module.exports = {
  loginUser,
  getUserById,
};
