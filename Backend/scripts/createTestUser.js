/**
 * Development Script: Create Test User with Specific Role
 * 
 * Usage:
 *   node scripts/createTestUser.js [email] [name] [password] [role]
 * Example:
 *   node scripts/createTestUser.js "admin.demo@examguard.edu" "System Admin" "ExamGuard@Admin2026" "ADMIN"
 *   node scripts/createTestUser.js "teacher.demo@examguard.edu" "Prof. Alan Turing" "ExamGuard@Teacher2026" "TEACHER"
 *   node scripts/createTestUser.js "coordinator.demo@examguard.edu" "Exam Coordinator" "ExamGuard@Coord2026" "EXAM_COORDINATOR"
 */

const readline = require('readline');
const bcrypt = require('bcryptjs');
const dotenv = require('dotenv');
const path = require('path');

// Load environment variables from Backend/.env
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const config = require('../src/config');
const { getSupabaseClient } = require('../src/config/supabase');

const VALID_ROLES = ['ADMIN', 'TEACHER', 'EXAM_COORDINATOR'];

function promptInput(promptText) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(promptText, (answer) => {
      rl.close();
      resolve(answer);
    });
  });
}

async function createTestUser() {
  if (config.nodeEnv === 'production') {
    console.error('ERROR: createTestUser.js cannot be executed in production environment.');
    process.exit(1);
  }

  const supabase = getSupabaseClient();

  const args = process.argv.slice(2);
  let email = args[0] || process.env.TEST_USER_EMAIL;
  let name = args[1] || process.env.TEST_USER_NAME;
  let password = args[2] || process.env.TEST_USER_PASSWORD;
  let roleInput = args[3] || process.env.TEST_USER_ROLE;

  if (!email) {
    email = await promptInput('Enter test user email: ');
    if (!email.trim()) {
      email = 'faculty.demo@examguard.edu';
    }
  }

  if (!name) {
    name = await promptInput('Enter test user full name: ');
    if (!name.trim()) {
      name = 'Test Faculty Member';
    }
  }

  if (!password) {
    password = await promptInput('Enter test user password: ');
    if (!password.trim()) {
      password = 'ExamGuard@2026';
    }
  }

  if (!roleInput) {
    roleInput = await promptInput('Enter role (ADMIN / TEACHER / EXAM_COORDINATOR) [default: TEACHER]: ');
    if (!roleInput.trim()) {
      roleInput = 'TEACHER';
    }
  }

  const targetRoleName = roleInput.trim().toUpperCase();
  if (!VALID_ROLES.includes(targetRoleName)) {
    console.error(`\nError: Invalid role "${targetRoleName}". Must be one of: ${VALID_ROLES.join(', ')}`);
    process.exit(1);
  }

  const normalizedEmail = email.trim().toLowerCase();

  console.log(`\n[createTestUser] Preparing test user...`);
  console.log(`[createTestUser] Target email: ${normalizedEmail}`);
  console.log(`[createTestUser] Target name:  ${name.trim()}`);
  console.log(`[createTestUser] Target role:  ${targetRoleName}`);

  // 1. Fetch requested role dynamically from roles table
  const { data: role, error: roleError } = await supabase
    .from('roles')
    .select('id, name')
    .eq('name', targetRoleName)
    .single();

  if (roleError || !role) {
    console.error(`\nError: Failed to find role "${targetRoleName}" in database.`);
    console.error('Ensure database/schema.sql has been executed in Supabase SQL editor.');
    process.exit(1);
  }

  // 2. Check if user already exists
  const { data: existingUser, error: checkError } = await supabase
    .from('users')
    .select('id, email, name, role_id')
    .eq('email', normalizedEmail)
    .maybeSingle();

  if (checkError) {
    console.error('\nError checking existing user:', checkError.message);
    process.exit(1);
  }

  if (existingUser) {
    console.log(`\nNotice: User "${normalizedEmail}" already exists (ID: ${existingUser.id}). Duplicate user not created.`);
    process.exit(0);
  }

  // 3. Hash password using bcrypt (cost factor 12)
  const saltRounds = 12;
  const passwordHash = await bcrypt.hash(password, saltRounds);

  // 4. Insert test user
  const { data: newUser, error: insertError } = await supabase
    .from('users')
    .insert([
      {
        name: name.trim(),
        email: normalizedEmail,
        password_hash: passwordHash,
        role_id: role.id,
        is_active: true,
      },
    ])
    .select('id, name, email, role_id, is_active, created_at')
    .single();

  if (insertError) {
    console.error('\nError creating user in Supabase:', insertError.message);
    process.exit(1);
  }

  console.log('\n=============================================');
  console.log(`Test ${targetRoleName} user created successfully!`);
  console.log('=============================================');
  console.log(`User ID:   ${newUser.id}`);
  console.log(`Name:      ${newUser.name}`);
  console.log(`Email:     ${newUser.email}`);
  console.log(`Role:      ${targetRoleName} (${role.id})`);
  console.log(`Active:    ${newUser.is_active}`);
  console.log('Security:  Password hash stored securely via bcrypt (cost factor 12). Plaintext password not logged.');
  console.log('=============================================\n');
}

createTestUser().catch((err) => {
  console.error('\nUnexpected error during test user creation:', err.message);
  process.exit(1);
});
