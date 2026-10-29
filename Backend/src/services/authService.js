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
    department: 'Department of Computer Engineering',
  };

  if (roleName === 'TEACHER') {
    try {
      safeUser.profile = await getOrCreateTeacherProfile(user.id, user);
    } catch (_) {
      safeUser.profile = {
        userId: user.id,
        name: user.name,
        email: user.email,
        facultyId: `COMP-FAC-${user.id.replace(/-/g, '').slice(0, 6).toUpperCase()}`,
        department: 'Department of Computer Engineering',
        designation: 'Assistant Professor',
        specialization: 'Computer Engineering',
        isActive: true,
        isProfileComplete: true,
        createdAt: user.created_at,
        role: 'TEACHER',
      };
    }
  }

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

  const safeUser = {
    id: user.id,
    name: user.name,
    email: user.email,
    roleId: user.role_id,
    role: roleName,
    department: 'Department of Computer Engineering',
  };

  if (roleName === 'TEACHER') {
    try {
      safeUser.profile = await getOrCreateTeacherProfile(user.id, user);
    } catch (_) {
      safeUser.profile = {
        userId: user.id,
        name: user.name,
        email: user.email,
        facultyId: `COMP-FAC-${user.id.replace(/-/g, '').slice(0, 6).toUpperCase()}`,
        department: 'Department of Computer Engineering',
        designation: 'Assistant Professor',
        specialization: 'Computer Engineering',
        isActive: true,
        isProfileComplete: true,
        createdAt: user.created_at,
        role: 'TEACHER',
      };
    }
  }

  return safeUser;
}

// In-memory fallback for teacher profiles if table migration is pending
const memoryTeacherProfiles = new Map();

/**
 * Gets or creates the independent teacher profile for the authenticated teacher.
 * Strictly guarantees the Department is "Department of Computer Engineering".
 */
async function getOrCreateTeacherProfile(userId, userRecord = null) {
  let user = userRecord;
  const defaultFacultyId = `COMP-FAC-${(userId || '').replace(/-/g, '').slice(0, 6).toUpperCase()}`;

  try {
    if (!user) {
      const { data: fetchedUser } = await supabase
        .from('users')
        .select('id, name, email, is_active, created_at, roles(name)')
        .eq('id', userId)
        .maybeSingle();
      user = fetchedUser;
    }

    const { data: profile, error } = await supabase
      .from('teacher_profiles')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();

    if (profile && !error) {
      return {
        userId: user?.id || userId,
        name: user?.name || 'Faculty Member',
        email: user?.email || '',
        facultyId: profile.faculty_id || defaultFacultyId,
        department: 'Department of Computer Engineering',
        designation: profile.designation || 'Assistant Professor',
        specialization: profile.specialization || 'Computer Engineering',
        phone: profile.phone || '',
        isActive: user ? Boolean(user.is_active) : true,
        isProfileComplete: Boolean(profile.is_profile_complete),
        createdAt: profile.created_at || user?.created_at,
        role: 'TEACHER',
      };
    }

    // If profile does not exist yet, create default
    const newProfile = {
      user_id: userId,
      faculty_id: defaultFacultyId,
      department: 'Department of Computer Engineering',
      designation: 'Assistant Professor',
      specialization: 'Computer Engineering',
      phone: '',
      is_profile_complete: true,
    };

    const { data: inserted, error: insertError } = await supabase
      .from('teacher_profiles')
      .insert([newProfile])
      .select()
      .maybeSingle();

    if (inserted && !insertError) {
      return {
        userId: user?.id || userId,
        name: user?.name || 'Faculty Member',
        email: user?.email || '',
        facultyId: inserted.faculty_id,
        department: 'Department of Computer Engineering',
        designation: inserted.designation,
        specialization: inserted.specialization,
        phone: inserted.phone || '',
        isActive: user ? Boolean(user.is_active) : true,
        isProfileComplete: Boolean(inserted.is_profile_complete),
        createdAt: inserted.created_at || user?.created_at,
        role: 'TEACHER',
      };
    }
  } catch (err) {
    console.warn('[AuthService] Falling back to memory profile:', err.message);
  }

  // Memory fallback
  if (!memoryTeacherProfiles.has(userId)) {
    memoryTeacherProfiles.set(userId, {
      userId,
      name: user?.name || 'Faculty Member',
      email: user?.email || '',
      facultyId: defaultFacultyId,
      department: 'Department of Computer Engineering',
      designation: 'Assistant Professor',
      specialization: 'Computer Engineering',
      phone: '',
      isActive: true,
      isProfileComplete: true,
      createdAt: user?.created_at || new Date().toISOString(),
      role: 'TEACHER',
    });
  }

  return memoryTeacherProfiles.get(userId);
}

/**
 * Updates a teacher's profile.
 * Department is strictly locked to "Department of Computer Engineering".
 */
async function updateTeacherProfile(userId, profileData) {
  const { facultyId, designation, specialization, phone } = profileData || {};

  const cleanFacultyId = (facultyId && facultyId.trim())
    ? facultyId.trim().toUpperCase()
    : `COMP-FAC-${userId.replace(/-/g, '').slice(0, 6).toUpperCase()}`;

  const cleanDesignation = (designation && designation.trim()) ? designation.trim() : 'Assistant Professor';
  const cleanSpecialization = specialization ? specialization.trim() : 'Computer Engineering';
  const cleanPhone = phone ? phone.trim() : '';

  const updatePayload = {
    user_id: userId,
    faculty_id: cleanFacultyId,
    department: 'Department of Computer Engineering',
    designation: cleanDesignation,
    specialization: cleanSpecialization,
    phone: cleanPhone,
    is_profile_complete: true,
    updated_at: new Date().toISOString(),
  };

  try {
    const { data: updated, error } = await supabase
      .from('teacher_profiles')
      .upsert(updatePayload, { onConflict: 'user_id' })
      .select()
      .maybeSingle();

    if (!error && updated) {
      return getOrCreateTeacherProfile(userId);
    }
  } catch (err) {
    console.warn('[AuthService] Supabase profile update error, using memory fallback:', err.message);
  }

  // Update memory fallback
  const existing = await getOrCreateTeacherProfile(userId);
  const merged = {
    ...existing,
    facultyId: cleanFacultyId,
    designation: cleanDesignation,
    specialization: cleanSpecialization,
    phone: cleanPhone,
    isProfileComplete: true,
  };
  memoryTeacherProfiles.set(userId, merged);
  return merged;
}

module.exports = {
  loginUser,
  getUserById,
  getOrCreateTeacherProfile,
  updateTeacherProfile,
};
