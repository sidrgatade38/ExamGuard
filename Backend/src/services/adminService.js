/**
 * ExamGuard - Admin Management Service (Module 14)
 *
 * Implements authoritative administrative user management operations:
 * 1. User listing with search, filtering (by role and status), and pagination.
 * 2. Safe user profile retrieval (strictly omitting password hashes and secrets).
 * 3. Secure administrative user creation with bcrypt password hashing (cost factor 12).
 * 4. Account activation/deactivation with self-lockout and last-admin safeguards.
 * 5. User role assignment with self-demotion and last-admin safeguards.
 * 6. Admin-assisted secure password reset.
 * 7. System roles retrieval.
 *
 * Security Invariants:
 * - Password hashes, JWT tokens, and cryptographic keys are NEVER exposed.
 * - Authorization and validation are strictly enforced server-side.
 * - Operations are audited via auditLogService.
 */

const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { supabase } = require('../config/supabase');
const auditLogService = require('./auditLogService');
const notificationService = require('./notificationService');

/**
 * Standard RFC 4122 UUID validation regex.
 */
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isValidUuid(id) {
  return typeof id === 'string' && UUID_REGEX.test(id.trim());
}

/**
 * Canonical system roles supported by ExamGuard.
 */
const PERMITTED_ROLES = ['ADMIN', 'TEACHER', 'EXAM_COORDINATOR'];

/**
 * Helper to safely format a user record, excluding password_hash.
 */
function sanitizeUser(user, roleName = null) {
  if (!user) return null;
  const resolvedRole = roleName || user.roles?.name || 'UNKNOWN';
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    roleId: user.role_id,
    role: resolvedRole.toUpperCase(),
    isActive: Boolean(user.is_active),
    isDeleted: Boolean(user.is_deleted),
    deletedAt: user.deleted_at || null,
    phone: user.phone || null,
    createdAt: user.created_at,
    updatedAt: user.updated_at,
  };
}

/**
 * Retrieves all available system roles from the database.
 *
 * @returns {Promise<Array<{ id: string, name: string, description: string }>>}
 */
async function listRoles() {
  const { data: roles, error } = await supabase
    .from('roles')
    .select('id, name, description, created_at')
    .order('name', { ascending: true });

  if (error) {
    console.error('[AdminService] Error fetching system roles:', error.message);
    const dbErr = new Error('Failed to retrieve system roles');
    dbErr.statusCode = 500;
    throw dbErr;
  }

  return roles || [];
}

/**
 * Resolves a role ID given a role name.
 *
 * @param {string} roleName - Role name, e.g. 'ADMIN', 'TEACHER'
 * @returns {Promise<{ id: string, name: string }>}
 */
async function resolveRoleByName(roleName) {
  if (!roleName || typeof roleName !== 'string') {
    const err = new Error('Role name is required');
    err.statusCode = 400;
    throw err;
  }

  const normalized = roleName.trim().toUpperCase();
  if (!PERMITTED_ROLES.includes(normalized)) {
    const err = new Error(`Invalid role "${roleName}". Must be one of: ${PERMITTED_ROLES.join(', ')}`);
    err.statusCode = 400;
    throw err;
  }

  const { data: role, error } = await supabase
    .from('roles')
    .select('id, name')
    .eq('name', normalized)
    .maybeSingle();

  if (error || !role) {
    const err = new Error(`Role "${normalized}" not found in system`);
    err.statusCode = 400;
    throw err;
  }

  return role;
}

/**
 * Lists users with search, role and status filtering, and pagination.
 *
 * @param {Object} query
 * @param {string} [query.search] - Case-insensitive search on name or email
 * @param {string} [query.role] - Filter by role name ('ADMIN', 'TEACHER', etc.)
 * @param {string|boolean} [query.status] - 'active' / 'inactive' / true / false
 * @param {number} [query.page=1] - 1-based page index
 * @param {number} [query.limit=15] - Page size (max 100)
 * @param {string} [query.sortBy='created_at'] - Server-controlled sort column
 * @param {string} [query.sortOrder='desc'] - Sort order: 'asc' or 'desc'
 * @returns {Promise<{ users: Array<Object>, pagination: Object, metrics: Object }>}
 */
async function listUsers({
  search = '',
  role = '',
  status = '',
  page = 1,
  limit = 15,
  sortBy = 'created_at',
  sortOrder = 'desc',
} = {}) {
  const parsedPage = Math.max(1, parseInt(page, 10) || 1);
  const parsedLimit = Math.min(100, Math.max(1, parseInt(limit, 10) || 15));
  const from = (parsedPage - 1) * parsedLimit;
  const to = from + parsedLimit - 1;

  // Build Supabase query
  let query = supabase
    .from('users')
    .select('id, name, email, role_id, is_active, is_deleted, created_at, updated_at, roles!role_id (id, name)', {
      count: 'exact',
    });

  // Apply search
  if (search && typeof search === 'string' && search.trim().length > 0) {
    const term = search.trim();
    query = query.or(`name.ilike.%${term}%,email.ilike.%${term}%`);
  }

  // Apply status filter
  const cleanStatus = typeof status === 'string' ? status.trim().toLowerCase() : '';
  if (cleanStatus === 'active') {
    query = query.eq('is_active', true);
    if (typeof query.neq === 'function') query = query.neq('is_deleted', true);
  } else if (cleanStatus === 'inactive' || cleanStatus === 'blocked') {
    query = query.eq('is_active', false);
    if (typeof query.neq === 'function') query = query.neq('is_deleted', true);
  } else if (cleanStatus === 'deleted' || cleanStatus === 'archived') {
    query = query.eq('is_deleted', true);
  } else if (cleanStatus === 'all') {
    // Show all accounts including deleted/archived
  } else {
    // Default: show active and inactive accounts, omitting soft-deleted accounts
    if (typeof query.neq === 'function') query = query.neq('is_deleted', true);
  }

  // Apply sorting
  const allowedSortCols = ['created_at', 'name', 'email', 'updated_at'];
  const safeSortCol = allowedSortCols.includes(sortBy) ? sortBy : 'created_at';
  const isAsc = String(sortOrder).toLowerCase() === 'asc';
  query = query.order(safeSortCol, { ascending: isAsc });

  // Execute paginated query
  const { data: users, count, error } = await query.range(from, to);

  if (error) {
    console.error('[AdminService] Error querying users:', error.message);
    const dbErr = new Error('Failed to retrieve users');
    dbErr.statusCode = 500;
    throw dbErr;
  }

  // Enrich phone numbers from teacher_profiles for faculty
  if (users && users.length > 0) {
    try {
      const userIds = users.map((u) => u.id);
      const { data: profiles } = await supabase
        .from('teacher_profiles')
        .select('user_id, phone, mobile_number')
        .in('user_id', userIds);

      if (profiles && profiles.length > 0) {
        const phoneMap = new Map();
        profiles.forEach((p) => {
          phoneMap.set(p.user_id, p.mobile_number || p.phone);
        });
        users.forEach((u) => {
          if (phoneMap.has(u.id)) {
            u.phone = phoneMap.get(u.id);
          }
        });
      }
    } catch (_) {}
  }

  // Filter in-memory by role name if specified
  let formattedUsers = (users || []).map((u) => sanitizeUser(u));
  if (role && typeof role === 'string' && role.trim().length > 0) {
    const targetRole = role.trim().toUpperCase();
    formattedUsers = formattedUsers.filter((u) => u.role === targetRole);
  }

  const total = typeof count === 'number' ? count : formattedUsers.length;
  const totalPages = Math.ceil(total / parsedLimit) || 1;

  return {
    users: formattedUsers,
    pagination: {
      total,
      page: parsedPage,
      limit: parsedLimit,
      totalPages,
    },
  };
}

/**
 * Retrieves a single user's safe profile by ID.
 *
 * @param {string} userId - UUID of the user
 * @returns {Promise<Object>} Safe user object
 */
async function getUserById(userId) {
  if (!isValidUuid(userId)) {
    const err = new Error('Invalid user ID format. Expected standard RFC 4122 UUID.');
    err.statusCode = 400;
    throw err;
  }

  const { data: user, error } = await supabase
    .from('users')
    .select('id, name, email, role_id, is_active, created_at, updated_at, roles!role_id (id, name)')
    .eq('id', userId.trim())
    .maybeSingle();

  if (error) {
    console.error('[AdminService] Database lookup error for user:', error.message);
    const dbErr = new Error('Failed to retrieve user profile');
    dbErr.statusCode = 500;
    throw dbErr;
  }

  if (!user) {
    const notFoundErr = new Error('User not found');
    notFoundErr.statusCode = 404;
    throw notFoundErr;
  }

  return sanitizeUser(user);
}

/**
 * Creates a new user with bcrypt-hashed credentials.
 *
 * @param {Object} userData
 * @param {string} userData.name - User's full name
 * @param {string} userData.email - User's email address
 * @param {string} userData.password - Plaintext password (hashed with bcrypt, never stored or returned)
 * @param {string} userData.role - Role name ('ADMIN', 'TEACHER', 'EXAM_COORDINATOR')
 * @param {string} adminUserId - Authenticated administrator's user ID
 * @param {Object} [clientContext] - IP address and User-Agent
 * @returns {Promise<Object>} Safe created user object
 */
async function createUser(
  { name, email, password, role },
  adminUserId,
  clientContext = {}
) {
  // 1. Validate name
  if (!name || typeof name !== 'string' || name.trim().length < 2) {
    const err = new Error('User name must be at least 2 characters long');
    err.statusCode = 400;
    throw err;
  }
  const cleanName = name.trim();

  // 2. Validate email
  if (!email || typeof email !== 'string') {
    const err = new Error('Email address is required');
    err.statusCode = 400;
    throw err;
  }
  const cleanEmail = email.trim().toLowerCase();
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(cleanEmail)) {
    const err = new Error('Invalid email address format');
    err.statusCode = 400;
    throw err;
  }

  // 3. Validate password complexity (min 8 chars, 1 letter, 1 number)
  if (!password || typeof password !== 'string' || password.length < 8) {
    const err = new Error('Password must be at least 8 characters long');
    err.statusCode = 400;
    throw err;
  }
  const hasLetter = /[a-zA-Z]/.test(password);
  const hasNumber = /[0-9]/.test(password);
  if (!hasLetter || !hasNumber) {
    const err = new Error('Password must contain at least one letter and one number');
    err.statusCode = 400;
    throw err;
  }

  // 4. Validate and resolve role
  const resolvedRole = await resolveRoleByName(role || 'TEACHER');

  // 5. Check duplicate email
  const { data: existingUser, error: checkError } = await supabase
    .from('users')
    .select('id, email')
    .eq('email', cleanEmail)
    .maybeSingle();

  if (checkError) {
    console.error('[AdminService] Error checking duplicate email:', checkError.message);
    const dbErr = new Error('Failed to verify email availability');
    dbErr.statusCode = 500;
    throw dbErr;
  }

  if (existingUser) {
    const conflictErr = new Error(`User with email "${cleanEmail}" already exists`);
    conflictErr.statusCode = 409;
    throw conflictErr;
  }

  // 6. Hash password with bcrypt (12 rounds)
  const passwordHash = await bcrypt.hash(password, 12);

  // 7. Insert new user into database
  const { data: newUser, error: insertError } = await supabase
    .from('users')
    .insert([
      {
        name: cleanName,
        email: cleanEmail,
        password_hash: passwordHash,
        role_id: resolvedRole.id,
        is_active: true,
      },
    ])
    .select('id, name, email, role_id, is_active, created_at, updated_at')
    .single();

  if (insertError || !newUser) {
    console.error('[AdminService] Error inserting user:', insertError?.message);
    const dbErr = new Error('Failed to create user in database');
    dbErr.statusCode = 500;
    throw dbErr;
  }

  // 7.5 If the newly created user is a TEACHER, initialize their teacher profile immediately
  if (resolvedRole.name === 'TEACHER') {
    try {
      const authService = require('./authService');
      await authService.getOrCreateTeacherProfile(newUser.id, {
        id: newUser.id,
        name: cleanName,
        email: cleanEmail,
        is_active: true,
        created_at: newUser.created_at,
        role: 'TEACHER',
      });
    } catch (profileErr) {
      console.warn('[AdminService] Note: Teacher profile initialization deferred to first login:', profileErr.message);
    }
  }

  const safeUser = sanitizeUser(newUser, resolvedRole.name);

  // 7.6 Send notification email via Resend
  try {
    await notificationService.notifyAccountCreated({
      user: safeUser,
      adminName: 'Administrator',
    });
  } catch (notifErr) {
    console.warn('[AdminService] Note: Failed to send user creation email:', notifErr.message);
  }

  // 8. Record audit event
  auditLogService.logAuditEvent({
    userId: adminUserId,
    role: 'ADMIN',
    action: 'QUESTION_PAPER_CREATED', // canonical mapped action
    resourceType: 'USER',
    resourceId: safeUser.id,
    outcome: 'SUCCESS',
    summary: `Admin created new user "${safeUser.email}" with role ${safeUser.role}`,
    ipAddress: clientContext.ipAddress,
    userAgent: clientContext.userAgent,
    metadata: {
      adminAction: 'USER_CREATED',
      targetUserId: safeUser.id,
      targetEmail: safeUser.email,
      targetRole: safeUser.role,
    },
  });

  return safeUser;
}

/**
 * Activates or deactivates a user account with strict safeguards:
 * - Admin cannot deactivate their own account (self-lockout prevention).
 * - Admin cannot deactivate the last active administrator account.
 *
 * @param {string} targetUserId - UUID of target user
 * @param {boolean} isActive - New active status
 * @param {string} adminUserId - Authenticated administrator ID
 * @param {Object} [clientContext] - IP address and User-Agent
 * @returns {Promise<Object>} Updated safe user
 */
async function setUserStatus(targetUserId, isActive, adminUserId, clientContext = {}) {
  if (!isValidUuid(targetUserId)) {
    const err = new Error('Invalid user ID format');
    err.statusCode = 400;
    throw err;
  }

  if (typeof isActive !== 'boolean') {
    const err = new Error('Field "isActive" must be a boolean');
    err.statusCode = 400;
    throw err;
  }

  // 1. Fetch target user
  const { data: targetUser, error: fetchErr } = await supabase
    .from('users')
    .select('id, name, email, role_id, is_active, roles!role_id (id, name)')
    .eq('id', targetUserId.trim())
    .maybeSingle();

  if (fetchErr) {
    console.error('[AdminService] Error fetching target user:', fetchErr.message);
    const dbErr = new Error('Failed to retrieve user record');
    dbErr.statusCode = 500;
    throw dbErr;
  }

  if (!targetUser) {
    const notFoundErr = new Error('User not found');
    notFoundErr.statusCode = 404;
    throw notFoundErr;
  }

  const targetRole = targetUser.roles?.name || 'UNKNOWN';

  // 2. Safeguard 1: Prevent self-deactivation
  if (targetUserId.trim() === adminUserId && !isActive) {
    auditLogService.logAuditEvent({
      userId: adminUserId,
      role: 'ADMIN',
      action: 'UNAUTHORIZED_ACCESS',
      resourceType: 'USER',
      resourceId: targetUserId,
      outcome: 'DENIED',
      summary: 'Admin attempted to deactivate their own account',
      ipAddress: clientContext.ipAddress,
      userAgent: clientContext.userAgent,
    });
    const lockoutErr = new Error('Administrators cannot deactivate their own account');
    lockoutErr.statusCode = 400;
    throw lockoutErr;
  }

  // 3. Safeguard 2: Prevent deactivating the last active administrator
  if (targetRole.toUpperCase() === 'ADMIN' && !isActive) {
    // Count active admins
    const { data: activeAdmins, error: adminCountErr } = await supabase
      .from('users')
      .select('id, is_active, roles!role_id (id, name)')
      .eq('is_active', true);

    if (!adminCountErr && activeAdmins) {
      const remainingAdmins = activeAdmins.filter(
        (u) => (u.roles?.name || '').toUpperCase() === 'ADMIN' && u.id !== targetUserId
      );
      if (remainingAdmins.length === 0) {
        auditLogService.logAuditEvent({
          userId: adminUserId,
          role: 'ADMIN',
          action: 'UNAUTHORIZED_ACCESS',
          resourceType: 'USER',
          resourceId: targetUserId,
          outcome: 'DENIED',
          summary: 'Admin attempted to deactivate the last remaining active administrator account',
          ipAddress: clientContext.ipAddress,
          userAgent: clientContext.userAgent,
        });
        const lastAdminErr = new Error('Cannot deactivate the last active administrator account');
        lastAdminErr.statusCode = 400;
        throw lastAdminErr;
      }
    }
  }

  // 4. Update status in database
  const { data: updatedUser, error: updateErr } = await supabase
    .from('users')
    .update({ is_active: isActive, updated_at: new Date().toISOString() })
    .eq('id', targetUserId.trim())
    .select('id, name, email, role_id, is_active, created_at, updated_at, roles!role_id (id, name)')
    .single();

  if (updateErr || !updatedUser) {
    console.error('[AdminService] Error updating user status:', updateErr?.message);
    const dbErr = new Error('Failed to update user status in database');
    dbErr.statusCode = 500;
    throw dbErr;
  }

  const safeUpdated = sanitizeUser(updatedUser);

  // 4.5 Send status notification email via Resend
  try {
    await notificationService.notifyAccountStatusChanged({
      user: safeUpdated,
      isActive,
      adminName: 'Administrator',
    });
  } catch (notifErr) {
    console.warn('[AdminService] Note: Failed to send status update email:', notifErr.message);
  }

  // 5. Record audit event
  auditLogService.logAuditEvent({
    userId: adminUserId,
    role: 'ADMIN',
    action: isActive ? 'QUESTION_PAPER_ACCESSED' : 'UNAUTHORIZED_ACCESS',
    resourceType: 'USER',
    resourceId: safeUpdated.id,
    outcome: 'SUCCESS',
    summary: `Admin ${isActive ? 'activated' : 'deactivated'} user account "${safeUpdated.email}"`,
    ipAddress: clientContext.ipAddress,
    userAgent: clientContext.userAgent,
    metadata: {
      adminAction: isActive ? 'USER_ACTIVATED' : 'USER_DEACTIVATED',
      targetUserId: safeUpdated.id,
      targetEmail: safeUpdated.email,
      isActive,
    },
  });

  return safeUpdated;
}

/**
 * Changes a user's role with strict safeguards:
 * - Admin cannot demote their own account role (self-demotion prevention).
 * - Admin cannot change the role of the last active administrator.
 *
 * @param {string} targetUserId - UUID of target user
 * @param {string} newRoleName - New role ('ADMIN', 'TEACHER', 'EXAM_COORDINATOR')
 * @param {string} adminUserId - Authenticated administrator ID
 * @param {Object} [clientContext] - IP address and User-Agent
 * @returns {Promise<Object>} Updated safe user
 */
async function setUserRole(targetUserId, newRoleName, adminUserId, clientContext = {}) {
  if (!isValidUuid(targetUserId)) {
    const err = new Error('Invalid user ID format');
    err.statusCode = 400;
    throw err;
  }

  const resolvedNewRole = await resolveRoleByName(newRoleName);

  // 1. Fetch target user
  const { data: targetUser, error: fetchErr } = await supabase
    .from('users')
    .select('id, name, email, role_id, is_active, roles!role_id (id, name)')
    .eq('id', targetUserId.trim())
    .maybeSingle();

  if (fetchErr) {
    console.error('[AdminService] Error fetching user for role change:', fetchErr.message);
    const dbErr = new Error('Failed to retrieve user record');
    dbErr.statusCode = 500;
    throw dbErr;
  }

  if (!targetUser) {
    const notFoundErr = new Error('User not found');
    notFoundErr.statusCode = 404;
    throw notFoundErr;
  }

  const currentRole = (targetUser.roles?.name || '').toUpperCase();

  // 2. Safeguard 1: Prevent self-demotion
  if (targetUserId.trim() === adminUserId && resolvedNewRole.name !== 'ADMIN') {
    auditLogService.logAuditEvent({
      userId: adminUserId,
      role: 'ADMIN',
      action: 'UNAUTHORIZED_ACCESS',
      resourceType: 'USER',
      resourceId: targetUserId,
      outcome: 'DENIED',
      summary: 'Admin attempted to demote their own account role',
      ipAddress: clientContext.ipAddress,
      userAgent: clientContext.userAgent,
    });
    const demoteErr = new Error('Administrators cannot demote their own account role');
    demoteErr.statusCode = 400;
    throw demoteErr;
  }

  // 3. Safeguard 2: Prevent demoting the last active administrator
  if (currentRole === 'ADMIN' && resolvedNewRole.name !== 'ADMIN') {
    const { data: activeAdmins, error: adminCountErr } = await supabase
      .from('users')
      .select('id, is_active, roles!role_id (id, name)')
      .eq('is_active', true);

    if (!adminCountErr && activeAdmins) {
      const remainingAdmins = activeAdmins.filter(
        (u) => (u.roles?.name || '').toUpperCase() === 'ADMIN' && u.id !== targetUserId
      );
      if (remainingAdmins.length === 0) {
        auditLogService.logAuditEvent({
          userId: adminUserId,
          role: 'ADMIN',
          action: 'UNAUTHORIZED_ACCESS',
          resourceType: 'USER',
          resourceId: targetUserId,
          outcome: 'DENIED',
          summary: 'Admin attempted to change role of the last remaining active administrator account',
          ipAddress: clientContext.ipAddress,
          userAgent: clientContext.userAgent,
        });
        const lastAdminErr = new Error('Cannot change role: at least one active administrator account must remain');
        lastAdminErr.statusCode = 400;
        throw lastAdminErr;
      }
    }
  }

  // 4. Update role in database
  const { data: updatedUser, error: updateErr } = await supabase
    .from('users')
    .update({ role_id: resolvedNewRole.id, updated_at: new Date().toISOString() })
    .eq('id', targetUserId.trim())
    .select('id, name, email, role_id, is_active, created_at, updated_at')
    .single();

  if (updateErr || !updatedUser) {
    console.error('[AdminService] Error updating user role:', updateErr?.message);
    const dbErr = new Error('Failed to update user role in database');
    dbErr.statusCode = 500;
    throw dbErr;
  }

  const safeUpdated = sanitizeUser(updatedUser, resolvedNewRole.name);

  // 5. Record audit event
  auditLogService.logAuditEvent({
    userId: adminUserId,
    role: 'ADMIN',
    action: 'QUESTION_PAPER_ACCESSED',
    resourceType: 'USER',
    resourceId: safeUpdated.id,
    outcome: 'SUCCESS',
    summary: `Admin changed role for user "${safeUpdated.email}" from ${currentRole} to ${safeUpdated.role}`,
    ipAddress: clientContext.ipAddress,
    userAgent: clientContext.userAgent,
    metadata: {
      adminAction: 'USER_ROLE_CHANGED',
      targetUserId: safeUpdated.id,
      targetEmail: safeUpdated.email,
      oldRole: currentRole,
      newRole: safeUpdated.role,
    },
  });

  // 6. Notify user of role change via official email notification
  try {
    const { data: adminRecord } = await supabase
      .from('users')
      .select('name')
      .eq('id', adminUserId)
      .maybeSingle();
    const adminName = adminRecord?.name || 'Administrator';

    await notificationService.notifyUserRoleChanged({
      user: safeUpdated,
      oldRole: currentRole,
      newRole: safeUpdated.role,
      adminName,
    });
  } catch (notifErr) {
    console.warn('[AdminService] Non-fatal notification failure in setUserRole:', notifErr.message);
  }

  return safeUpdated;
}

/**
 * Resets a user's password with bcrypt hashing.
 *
 * @param {string} targetUserId - UUID of target user
 * @param {string} newPassword - New plaintext password
 * @param {string} adminUserId - Authenticated administrator ID
 * @param {Object} [clientContext] - IP address and User-Agent
 * @returns {Promise<{ success: boolean, message: string }>}
 */
async function resetUserPassword(targetUserId, newPassword, adminUserId, clientContext = {}) {
  if (!isValidUuid(targetUserId)) {
    const err = new Error('Invalid user ID format');
    err.statusCode = 400;
    throw err;
  }

  // 1. Validate new password complexity
  if (!newPassword || typeof newPassword !== 'string' || newPassword.length < 8) {
    const err = new Error('New password must be at least 8 characters long');
    err.statusCode = 400;
    throw err;
  }
  const hasLetter = /[a-zA-Z]/.test(newPassword);
  const hasNumber = /[0-9]/.test(newPassword);
  if (!hasLetter || !hasNumber) {
    const err = new Error('New password must contain at least one letter and one number');
    err.statusCode = 400;
    throw err;
  }

  // 2. Fetch target user
  const { data: targetUser, error: fetchErr } = await supabase
    .from('users')
    .select('id, name, email, is_active')
    .eq('id', targetUserId.trim())
    .maybeSingle();

  if (fetchErr) {
    console.error('[AdminService] Error fetching user for password reset:', fetchErr.message);
    const dbErr = new Error('Failed to retrieve user record');
    dbErr.statusCode = 500;
    throw dbErr;
  }

  if (!targetUser) {
    const notFoundErr = new Error('User not found');
    notFoundErr.statusCode = 404;
    throw notFoundErr;
  }

  // 3. Hash new password using bcrypt (12 rounds)
  const passwordHash = await bcrypt.hash(newPassword, 12);

  // 4. Update password hash in database
  const { error: updateErr } = await supabase
    .from('users')
    .update({ password_hash: passwordHash, updated_at: new Date().toISOString() })
    .eq('id', targetUserId.trim());

  if (updateErr) {
    console.error('[AdminService] Error updating password hash:', updateErr.message);
    const dbErr = new Error('Failed to update password');
    dbErr.statusCode = 500;
    throw dbErr;
  }

  // 4.5 Send password reset confirmation email via Resend
  try {
    await notificationService.notifyPasswordReset({
      user: { id: targetUser.id, name: targetUser.name, email: targetUser.email },
    });
  } catch (notifErr) {
    console.warn('[AdminService] Note: Failed to send password reset email:', notifErr.message);
  }

  // 5. Record audit event (NEVER include plaintext password or hash!)
  auditLogService.logAuditEvent({
    userId: adminUserId,
    role: 'ADMIN',
    action: 'QUESTION_PAPER_ACCESSED',
    resourceType: 'USER',
    resourceId: targetUser.id,
    outcome: 'SUCCESS',
    summary: `Admin performed password reset for user "${targetUser.email}"`,
    ipAddress: clientContext.ipAddress,
    userAgent: clientContext.userAgent,
    metadata: {
      adminAction: 'PASSWORD_RESET',
      targetUserId: targetUser.id,
      targetEmail: targetUser.email,
    },
  });

  return {
    success: true,
    message: 'User password reset successfully',
  };
}

/**
 * Permanently revokes user access and soft-deletes/archives account.
 * Strict safeguards:
 * - Admin cannot delete their own account.
 * - Admin cannot delete the last active administrator.
 * - Does NOT cascade delete question papers, signatures, or audit logs.
 * - Revokes authentication and prevents future login.
 * - Sends notification email via Resend.
 */
async function deleteUser(targetUserId, adminUserId, clientContext = {}) {
  if (!isValidUuid(targetUserId)) {
    const err = new Error('Invalid user ID format');
    err.statusCode = 400;
    throw err;
  }

  // 1. Fetch target user
  const { data: targetUser, error: fetchErr } = await supabase
    .from('users')
    .select('id, name, email, role_id, is_active, is_deleted, roles!role_id (id, name)')
    .eq('id', targetUserId.trim())
    .maybeSingle();

  if (fetchErr) {
    const dbErr = new Error('Failed to retrieve user record');
    dbErr.statusCode = 500;
    throw dbErr;
  }

  if (!targetUser) {
    const notFoundErr = new Error('User not found');
    notFoundErr.statusCode = 404;
    throw notFoundErr;
  }

  // 2. Safeguard 1: Prevent self-deletion
  if (targetUserId.trim() === adminUserId) {
    const lockoutErr = new Error('Administrators cannot delete their own account');
    lockoutErr.statusCode = 400;
    throw lockoutErr;
  }

  // 3. Safeguard 2: Prevent deleting the last active admin
  const targetRole = targetUser.roles?.name || 'UNKNOWN';
  if (targetRole.toUpperCase() === 'ADMIN') {
    const { data: activeAdmins } = await supabase
      .from('users')
      .select('id, is_active, is_deleted, roles!role_id (id, name)')
      .eq('is_active', true)
      .neq('is_deleted', true);

    const remainingAdmins = (activeAdmins || []).filter(
      (u) => (u.roles?.name || '').toUpperCase() === 'ADMIN' && u.id !== targetUserId
    );
    if (remainingAdmins.length === 0) {
      const lastAdminErr = new Error('Cannot delete the last remaining active administrator account');
      lastAdminErr.statusCode = 400;
      throw lastAdminErr;
    }
  }

  // 4. Invalidate credentials and mark as deleted/archived
  // Randomizing password hash prevents any possible password login
  const revokedPasswordHash = `$2a$12$revoked_${crypto.randomBytes(24).toString('hex')}`;
  const now = new Date().toISOString();

  const { data: updatedUser, error: updateErr } = await supabase
    .from('users')
    .update({
      is_active: false,
      is_deleted: true,
      deleted_by: adminUserId,
      password_hash: revokedPasswordHash,
      updated_at: now,
    })
    .eq('id', targetUserId.trim())
    .select('id, name, email, role_id, is_active, is_deleted, created_at, updated_at, roles!role_id (id, name)')
    .single();

  if (updateErr) {
    console.error('[AdminService] Error archiving user account:', updateErr.message);
    const dbErr = new Error('Failed to archive user account');
    dbErr.statusCode = 500;
    throw dbErr;
  }

  // 5. Send notification email via Resend
  await notificationService.notifyAccountDeleted({
    user: { id: targetUser.id, name: targetUser.name, email: targetUser.email },
    adminName: 'Administrator',
  });

  // 6. Record audit event
  await auditLogService.logAuditEvent({
    userId: adminUserId,
    role: 'ADMIN',
    action: 'UNAUTHORIZED_ACCESS',
    resourceType: 'USER',
    resourceId: targetUserId,
    outcome: 'SUCCESS',
    summary: `Admin archived and revoked access for user "${targetUser.email}" (${targetRole})`,
    ipAddress: clientContext.ipAddress,
    userAgent: clientContext.userAgent,
    metadata: {
      adminAction: 'USER_DELETED_ARCHIVED',
      targetUserId,
      targetEmail: targetUser.email,
      targetRole,
    },
  });

  return {
    success: true,
    message: `Account for "${targetUser.name}" (${targetUser.email}) was safely archived and login access revoked. Institutional records, question papers, and audit history remain preserved.`,
    user: sanitizeUser(updatedUser),
  };
}

/**
 * Updates permitted user account information (Name, Email, Phone, Role)
 */
async function updateUser(targetUserId, updateData, adminUserId, clientContext = {}) {
  if (!isValidUuid(targetUserId)) {
    const err = new Error('Invalid user ID format');
    err.statusCode = 400;
    throw err;
  }

  const { name, email, phone, role } = updateData || {};

  const { data: existingUser, error: fetchErr } = await supabase
    .from('users')
    .select('id, name, email, role_id, is_active, is_deleted, roles!role_id (id, name)')
    .eq('id', targetUserId.trim())
    .maybeSingle();

  if (fetchErr || !existingUser) {
    const err = new Error('User not found');
    err.statusCode = 404;
    throw err;
  }

  const updates = { updated_at: new Date().toISOString() };

  if (name && typeof name === 'string' && name.trim()) {
    updates.name = name.trim();
  }

  if (email && typeof email === 'string' && email.trim()) {
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail.includes('@') || !cleanEmail.includes('.')) {
      const err = new Error('Invalid email format');
      err.statusCode = 400;
      throw err;
    }
    // Check uniqueness if changed
    if (cleanEmail !== existingUser.email.toLowerCase()) {
      const { data: dup } = await supabase
        .from('users')
        .select('id')
        .eq('email', cleanEmail)
        .neq('id', targetUserId.trim())
        .maybeSingle();
      if (dup) {
        const err = new Error(`Email "${cleanEmail}" is already in use by another account.`);
        err.statusCode = 409;
        throw err;
      }
      updates.email = cleanEmail;
    }
  }

  if (phone !== undefined) {
    try {
      await supabase
        .from('teacher_profiles')
        .upsert(
          {
            user_id: targetUserId.trim(),
            phone: phone ? phone.trim() : '',
            mobile_number: phone ? phone.trim() : '',
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'user_id' }
        );
    } catch (_) {}
  }

  if (role && typeof role === 'string' && role.trim()) {
    const resolvedRole = await resolveRoleByName(role.trim());
    updates.role_id = resolvedRole.id;
  }

  const { data: updated, error: updateErr } = await supabase
    .from('users')
    .update(updates)
    .eq('id', targetUserId.trim())
    .select('id, name, email, role_id, is_active, is_deleted, created_at, updated_at, roles!role_id (id, name)')
    .single();

  if (updateErr) {
    const dbErr = new Error('Failed to update user account details');
    dbErr.statusCode = 500;
    throw dbErr;
  }

  await auditLogService.logAuditEvent({
    userId: adminUserId,
    role: 'ADMIN',
    action: 'QUESTION_PAPER_ACCESSED',
    resourceType: 'USER',
    resourceId: targetUserId,
    outcome: 'SUCCESS',
    summary: `Admin updated account information for user "${existingUser.email}"`,
    ipAddress: clientContext.ipAddress,
    userAgent: clientContext.userAgent,
    metadata: {
      adminAction: 'USER_UPDATED',
      updates,
    },
  });

  return sanitizeUser(updated);
}

module.exports = {
  listRoles,
  listUsers,
  getUserById,
  createUser,
  setUserStatus,
  setUserRole,
  resetUserPassword,
  deleteUser,
  updateUser,
  PERMITTED_ROLES,
  sanitizeUser,
};
