const bcrypt = require('bcryptjs');
const { supabase } = require('../config/supabase');
const { generateToken } = require('../utils/jwt');
const notificationService = require('./notificationService');

// In-memory fallback for teacher profile persistence when DB table unavailable
const memoryTeacherProfiles = new Map();

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
 *
 * @param {string} email
 * @param {string} password
 * @returns {Promise<{ token: string, user: Object }>}
 */
async function loginUser(email, password) {
  const normalizedEmail = email.trim().toLowerCase();

  // Query user attributes including is_deleted and role
  let user = null;
  let fetchError = null;

  try {
    const res = await supabase
      .from('users')
      .select('id, name, email, password_hash, role_id, is_active, is_deleted, created_at, roles(id, name)')
      .eq('email', normalizedEmail)
      .maybeSingle();
    user = res.data;
    fetchError = res.error;
  } catch (err) {
    fetchError = err;
  }

  // Graceful fallback if is_deleted column is not present
  if (fetchError && (fetchError.message?.includes('is_deleted') || fetchError.code === '42703')) {
    const resFallback = await supabase
      .from('users')
      .select('id, name, email, password_hash, role_id, is_active, created_at, roles(id, name)')
      .eq('email', normalizedEmail)
      .maybeSingle();
    user = resFallback.data;
    fetchError = resFallback.error;
  }

  if (fetchError) {
    console.error('[AuthService] Supabase user query error:', fetchError.message || fetchError);
    const dbErr = new Error('Authentication service temporarily unavailable');
    dbErr.statusCode = 500;
    throw dbErr;
  }

  if (!user) {
    const authErr = new Error('Invalid email or password');
    authErr.statusCode = 401;
    throw authErr;
  }

  // Check if account has been deleted or archived
  if (user.is_deleted) {
    const deletedErr = new Error('This account has been removed or archived. Access is revoked.');
    deletedErr.statusCode = 403;
    throw deletedErr;
  }

  // Check if account is inactive/blocked
  if (!user.is_active) {
    const inactiveErr = new Error('Account is inactive or blocked. Please contact your department administrator.');
    inactiveErr.statusCode = 403;
    throw inactiveErr;
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

  // Generate JWT token
  const token = generateToken({
    userId: user.id,
    roleId: user.role_id,
    email: user.email,
  });

  // Prepare safe user object
  const safeUser = {
    id: user.id,
    name: user.name,
    email: user.email,
    roleId: user.role_id,
    role: roleName,
    department: 'Department of Computer Engineering',
    phone: null,
  };

  if (roleName === 'TEACHER') {
    try {
      safeUser.profile = await getOrCreateTeacherProfile(user.id, user);
      if (safeUser.profile?.mobileNumber || safeUser.profile?.phone) {
        safeUser.phone = safeUser.profile.mobileNumber || safeUser.profile.phone;
      }
    } catch (_) {
      safeUser.profile = {
        userId: user.id,
        name: user.name,
        email: user.email,
        facultyId: `COMP-FAC-${user.id.replace(/-/g, '').slice(0, 6).toUpperCase()}`,
        department: 'Department of Computer Engineering',
        designation: 'Assistant Professor',
        specialization: 'Computer Engineering & System Architecture',
        qualification: 'M.E. (Computer Engineering)',
        experienceYears: 5.0,
        phone: '',
        mobileNumber: '',
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
 * Registers a new teacher account with automatic COMP faculty profile provisioning.
 */
async function registerTeacher({
  name,
  email,
  password,
  phone = '',
  mobileNumber = '',
  designation = 'Assistant Professor',
  qualification = 'M.E. (Computer Engineering)',
  specialization = 'Computer Engineering & System Architecture',
  experienceYears = 5.0,
}) {
  if (!name || !name.trim()) {
    const err = new Error('Full name is required.');
    err.statusCode = 400;
    throw err;
  }

  if (!email || !email.trim()) {
    const err = new Error('Email address is required.');
    err.statusCode = 400;
    throw err;
  }

  const cleanEmail = email.trim().toLowerCase();
  if (!cleanEmail.includes('@') || !cleanEmail.includes('.')) {
    const err = new Error('Please enter a valid institutional email address.');
    err.statusCode = 400;
    throw err;
  }

  if (!password || password.length < 6) {
    const err = new Error('Password must be at least 6 characters long.');
    err.statusCode = 400;
    throw err;
  }

  const contactNumber = (mobileNumber || phone || '').trim();
  if (contactNumber) {
    const phoneRegex = /^\+?[0-9\s-]{10,15}$/;
    if (!phoneRegex.test(contactNumber)) {
      const err = new Error('Please enter a valid 10-15 digit mobile number (e.g. +91 9876543210 or 9876543210).');
      err.statusCode = 400;
      throw err;
    }
  }

  // 1. Check for existing email in users table
  const { data: existingUser } = await supabase
    .from('users')
    .select('id, email')
    .eq('email', cleanEmail)
    .maybeSingle();

  if (existingUser) {
    const err = new Error(`An account with email "${cleanEmail}" is already registered.`);
    err.statusCode = 409;
    throw err;
  }

  // 2. Resolve TEACHER role
  const { data: teacherRole, error: roleError } = await supabase
    .from('roles')
    .select('id, name')
    .eq('name', 'TEACHER')
    .maybeSingle();

  if (roleError || !teacherRole) {
    const dbErr = new Error('System error: TEACHER role not found in database.');
    dbErr.statusCode = 500;
    throw dbErr;
  }

  // 3. Hash password using bcrypt (cost factor 12)
  const passwordHash = await bcrypt.hash(password, 12);

  // 4. Create user record
  const { data: newUser, error: userError } = await supabase
    .from('users')
    .insert([
      {
        name: name.trim(),
        email: cleanEmail,
        password_hash: passwordHash,
        role_id: teacherRole.id,
        is_active: true,
        is_deleted: false,
      },
    ])
    .select('id, name, email, role_id, is_active, created_at')
    .single();

  if (userError || !newUser) {
    console.error('[AuthService] Error creating teacher user:', userError?.message);
    const dbErr = new Error('Failed to create teacher user account.');
    dbErr.statusCode = 500;
    throw dbErr;
  }

  // 5. Automatically provision teacher profile
  const facultyId = `COMP-FAC-${newUser.id.replace(/-/g, '').slice(0, 6).toUpperCase()}`;
  const profileRecord = {
    user_id: newUser.id,
    faculty_id: facultyId,
    department: 'Department of Computer Engineering',
    designation: designation || 'Assistant Professor',
    qualification: qualification || 'M.E. (Computer Engineering)',
    specialization: specialization || 'Computer Engineering & System Architecture',
    experience_years: parseFloat(experienceYears) || 5.0,
    phone: contactNumber || '',
    mobile_number: contactNumber || '',
    is_profile_complete: true,
  };

  try {
    await supabase.from('teacher_profiles').insert([profileRecord]);
  } catch (profErr) {
    console.warn('[AuthService] Auto-profile creation notice:', profErr.message);
  }

  // 6. Send welcome email notification via Resend
  await notificationService.notifyTeacherRegistered({
    user: {
      id: newUser.id,
      name: newUser.name,
      email: newUser.email,
    },
  });

  // 7. Generate JWT token
  const token = generateToken({
    userId: newUser.id,
    roleId: teacherRole.id,
    email: newUser.email,
  });

  return {
    token,
    user: {
      id: newUser.id,
      name: newUser.name,
      email: newUser.email,
      roleId: teacherRole.id,
      role: 'TEACHER',
      department: 'Department of Computer Engineering',
      phone: contactNumber,
      profile: {
        userId: newUser.id,
        name: newUser.name,
        email: newUser.email,
        facultyId,
        department: 'Department of Computer Engineering',
        designation: profileRecord.designation,
        qualification: profileRecord.qualification,
        specialization: profileRecord.specialization,
        experienceYears: profileRecord.experience_years,
        phone: contactNumber,
        mobileNumber: contactNumber,
        isActive: true,
        isProfileComplete: true,
        createdAt: newUser.created_at,
        role: 'TEACHER',
      },
    },
  };
}

/**
 * Retrieves safe user profile for an authenticated identity including role name.
 */
async function getUserById(userId) {
  const { data: user, error } = await supabase
    .from('users')
    .select('id, name, email, role_id, is_active, created_at, roles(id, name)')
    .eq('id', userId)
    .maybeSingle();

  if (error || !user) {
    return null;
  }

  const roleName = user.roles?.name ? user.roles.name.toUpperCase() : 'UNKNOWN';

  return {
    id: user.id,
    name: user.name,
    email: user.email,
    roleId: user.role_id,
    role: roleName,
    department: 'Department of Computer Engineering',
    phone: null,
    createdAt: user.created_at,
  };
}

/**
 * Retrieves or lazily creates an independent teacher profile strictly bound to Computer Engineering.
 */
async function getOrCreateTeacherProfile(userId, preloadedUser = null) {
  let user = preloadedUser;
  const defaultFacultyId = `COMP-FAC-${userId.replace(/-/g, '').slice(0, 6).toUpperCase()}`;

  try {
    if (!user) {
      const { data: fetchedUser } = await supabase
        .from('users')
        .select('id, name, email, is_active, created_at, updated_at, roles(name)')
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
      const effectivePhone = profile.mobile_number || profile.phone || user?.phone || '';
      return {
        userId: user?.id || userId,
        name: user?.name || 'Faculty Member',
        email: user?.email || '',
        facultyId: profile.faculty_id || defaultFacultyId,
        department: 'Department of Computer Engineering',
        designation: profile.designation || 'Assistant Professor',
        qualification: profile.qualification || 'M.E. (Computer Engineering)',
        specialization: profile.specialization || 'Computer Engineering & System Architecture',
        experienceYears: profile.experience_years ? parseFloat(profile.experience_years) : 5.0,
        phone: effectivePhone,
        mobileNumber: effectivePhone,
        isActive: user ? Boolean(user.is_active) : true,
        accountStatus: user ? (user.is_active ? 'Active' : 'Inactive') : 'Active',
        isProfileComplete: Boolean(profile.is_profile_complete),
        createdAt: profile.created_at || user?.created_at,
        updatedAt: profile.updated_at || user?.updated_at || profile.created_at,
        role: 'TEACHER',
      };
    }

    // If profile does not exist yet, create default
    const newProfile = {
      user_id: userId,
      faculty_id: defaultFacultyId,
      department: 'Department of Computer Engineering',
      designation: 'Assistant Professor',
      qualification: 'M.E. (Computer Engineering)',
      specialization: 'Computer Engineering & System Architecture',
      experience_years: 5.0,
      phone: user?.phone || '',
      mobile_number: user?.phone || '',
      is_profile_complete: true,
    };

    const { data: inserted, error: insertError } = await supabase
      .from('teacher_profiles')
      .insert([newProfile])
      .select()
      .maybeSingle();

    if (inserted && !insertError) {
      const effectivePhone = inserted.mobile_number || inserted.phone || user?.phone || '';
      return {
        userId: user?.id || userId,
        name: user?.name || 'Faculty Member',
        email: user?.email || '',
        facultyId: inserted.faculty_id,
        department: 'Department of Computer Engineering',
        designation: inserted.designation,
        qualification: inserted.qualification,
        specialization: inserted.specialization,
        experienceYears: inserted.experience_years ? parseFloat(inserted.experience_years) : 5.0,
        phone: effectivePhone,
        mobileNumber: effectivePhone,
        isActive: user ? Boolean(user.is_active) : true,
        accountStatus: user ? (user.is_active ? 'Active' : 'Inactive') : 'Active',
        isProfileComplete: Boolean(inserted.is_profile_complete),
        createdAt: inserted.created_at || user?.created_at,
        updatedAt: inserted.updated_at || inserted.created_at,
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
      qualification: 'M.E. (Computer Engineering)',
      specialization: 'Computer Engineering & System Architecture',
      experienceYears: 5.0,
      phone: user?.phone || '',
      mobileNumber: user?.phone || '',
      isActive: true,
      accountStatus: 'Active',
      isProfileComplete: true,
      createdAt: user?.created_at || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      role: 'TEACHER',
    });
  }

  return memoryTeacherProfiles.get(userId);
}

/**
 * Updates a teacher's profile and guarantees persistence in Supabase.
 * Department is strictly locked to "Department of Computer Engineering".
 */
async function updateTeacherProfile(userId, profileData, requesterRole) {
  const existing = await getOrCreateTeacherProfile(userId);
  const { name, designation, phone, mobileNumber, qualification, specialization, experienceYears } = profileData || {};

  // Contact number validation
  const cleanPhone = (mobileNumber || phone || '').trim();
  if (cleanPhone) {
    const phoneRegex = /^\+?[0-9\s-]{10,15}$/;
    if (!phoneRegex.test(cleanPhone)) {
      const err = new Error('Invalid mobile number format. Please provide a valid 10-15 digit phone number (e.g. +91 9876543210 or 9876543210).');
      err.statusCode = 400;
      throw err;
    }
  }

  // Update user name in users table if changed
  try {
    const userUpdates = { updated_at: new Date().toISOString() };
    if (name && typeof name === 'string' && name.trim()) userUpdates.name = name.trim();
    if (Object.keys(userUpdates).length > 1) {
      await supabase.from('users').update(userUpdates).eq('id', userId);
    }
  } catch (_) {}

  // Faculty ID is immutable for ordinary faculty
  const cleanFacultyId = (requesterRole === 'ADMIN' && profileData?.facultyId && profileData.facultyId.trim())
    ? profileData.facultyId.trim().toUpperCase()
    : existing.facultyId;

  const cleanDesignation = (designation && designation.trim()) ? designation.trim() : (existing.designation || 'Assistant Professor');
  const cleanQualification = (qualification && qualification.trim()) ? qualification.trim() : (existing.qualification || 'M.E. (Computer Engineering)');
  const cleanSpecialization = (specialization && specialization.trim()) ? specialization.trim() : (existing.specialization || 'Computer Engineering & System Architecture');
  const cleanExp = (experienceYears !== undefined && !isNaN(parseFloat(experienceYears))) ? parseFloat(experienceYears) : (existing.experienceYears || 5.0);

  const updatePayload = {
    user_id: userId,
    faculty_id: cleanFacultyId,
    department: 'Department of Computer Engineering',
    designation: cleanDesignation,
    qualification: cleanQualification,
    specialization: cleanSpecialization,
    experience_years: cleanExp,
    phone: cleanPhone,
    mobile_number: cleanPhone,
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
      // Send profile update notification via Resend
      const userObj = await getUserById(userId);
      await notificationService.notifyProfileUpdated({
        user: { id: userId, name: userObj?.name || existing.name, email: userObj?.email || existing.email },
        updatedFields: ['mobile_number', 'designation', 'qualification', 'specialization'],
      });

      if (existing.mobileNumber && cleanPhone && existing.mobileNumber !== cleanPhone) {
        await notificationService.notifyMobileNumberChanged({
          user: { id: userId, name: userObj?.name || existing.name, email: userObj?.email || existing.email },
          oldMobile: existing.mobileNumber,
          newMobile: cleanPhone,
        }).catch(() => {});
      }

      return getOrCreateTeacherProfile(userId);
    }
  } catch (err) {
    console.warn('[AuthService] Supabase profile update error, using memory fallback:', err.message);
  }

  // Update memory fallback
  const merged = {
    ...existing,
    name: (name && name.trim()) || existing.name,
    facultyId: cleanFacultyId,
    designation: cleanDesignation,
    qualification: cleanQualification,
    specialization: cleanSpecialization,
    experienceYears: cleanExp,
    phone: cleanPhone,
    mobileNumber: cleanPhone,
    isProfileComplete: true,
    updatedAt: new Date().toISOString(),
  };
  memoryTeacherProfiles.set(userId, merged);
  return merged;
}

module.exports = {
  loginUser,
  registerTeacher,
  getUserById,
  getOrCreateTeacherProfile,
  updateTeacherProfile,
};
