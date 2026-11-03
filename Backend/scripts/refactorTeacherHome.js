const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '../../Frontend/src/pages/TeacherHome.jsx');
let content = fs.readFileSync(filePath, 'utf8');

// 1. Add academicService import if missing
if (!content.includes("import academicService from '../services/academicService';")) {
  content = content.replace(
    "import blueprintService from '../services/blueprintService';",
    "import blueprintService from '../services/blueprintService';\nimport academicService from '../services/academicService';"
  );
  console.log('1. Imported academicService in TeacherHome.jsx!');
}

// 2. Add designationsList state and draftToDelete state
const stateMarker = "const [profileSuccess, setProfileSuccess] = useState('');\n  const [profileError, setProfileError] = useState('');";
const newStateAdditions = `const [profileSuccess, setProfileSuccess] = useState('');
  const [profileError, setProfileError] = useState('');
  const [designationsList, setDesignationsList] = useState([
    'Professor',
    'Associate Professor',
    'Assistant Professor',
    'Lecturer',
  ]);
  const [draftToDelete, setDraftToDelete] = useState(null);`;

if (content.includes(stateMarker)) {
  content = content.replace(stateMarker, newStateAdditions);
  console.log('2. Added designationsList and draftToDelete state!');
}

// 3. Fetch designations in fetchProfile or useEffect
const fetchProfileMarker = `      const res = await authService.getProfile();
      if (res?.data) {
        setProfileData(res.data);
      }`;

const newFetchProfile = `      const [res, desigRes] = await Promise.all([
        authService.getProfile().catch(() => ({ data: null })),
        academicService.getDesignations().catch(() => ({ data: [] })),
      ]);
      if (res?.data) {
        setProfileData(res.data);
      }
      if (desigRes?.data && desigRes.data.length > 0) {
        const dNames = desigRes.data.map(d => typeof d === 'string' ? d : d.name);
        setDesignationsList(dNames);
      }`;

if (content.includes(fetchProfileMarker)) {
  content = content.replace(fetchProfileMarker, newFetchProfile);
  console.log('3. Updated fetchProfile to also load designations dynamically!');
}

// 4. Update handleUpdateProfile with phone validation and immutability protection
const oldUpdateProfile = `  const handleUpdateProfile = async (e) => {
    e.preventDefault();
    setSavingProfile(true);
    setProfileError('');
    setProfileSuccess('');
    try {
      const res = await authService.updateProfile(profileData);
      setProfileData(res.data);
      setProfileSuccess('Profile updated successfully!');
      setTimeout(() => setProfileSuccess(''), 4000);
    } catch (err) {
      setProfileError(err.response?.data?.message || err.message || 'Failed to update profile.');
    } finally {
      setSavingProfile(false);
    }
  };`;

const newUpdateProfile = `  const handleUpdateProfile = async (e) => {
    e.preventDefault();
    setSavingProfile(true);
    setProfileError('');
    setProfileSuccess('');

    // Contact number validation (if provided)
    if (profileData?.phone && profileData.phone.trim()) {
      const cleanPhone = profileData.phone.trim();
      const phoneRegex = /^\\+?[0-9\\s-]{10,15}$/;
      if (!phoneRegex.test(cleanPhone)) {
        setProfileError('Please enter a valid 10-15 digit phone number (e.g. +91 9876543210 or 9876543210).');
        setSavingProfile(false);
        return;
      }
    }

    try {
      // Keep department strictly locked to Computer Engineering
      const payload = {
        ...profileData,
        department: 'Department of Computer Engineering',
      };
      const res = await authService.updateProfile(payload);
      setProfileData(res.data);
      setProfileSuccess('Faculty profile updated successfully!');
      setTimeout(() => setProfileSuccess(''), 4000);
    } catch (err) {
      setProfileError(err.response?.data?.message || err.message || 'Failed to update profile.');
    } finally {
      setSavingProfile(false);
    }
  };`;

if (content.includes(oldUpdateProfile)) {
  content = content.replace(oldUpdateProfile, newUpdateProfile);
  console.log('4. Added phone validation and locked department in handleUpdateProfile!');
}

// 5. Replace window.confirm in handleDeleteDraft
const oldHandleDeleteDraft = `  // Delete Draft Handler
  const handleDeleteDraft = async (draftId, draftTitle) => {
    if (!window.confirm(\`Are you sure you want to delete draft "\${draftTitle || 'Untitled Draft'}"?\`)) {
      return;
    }
    try {
      await blueprintService.deleteDraft(draftId);
      setActionAlert({
        type: 'success',
        message: \`Draft "\${draftTitle || 'Draft'}" was deleted successfully.\`,
      });
      fetchDrafts();
    } catch (err) {
      setActionAlert({
        type: 'danger',
        message: \`Failed to delete draft: \${err.message}\`,
      });
    }
  };`;

const newHandleDeleteDraft = `  // Delete Draft Handler with inline confirmation modal
  const handleDeleteDraft = (draftId, draftTitle) => {
    setDraftToDelete({ id: draftId, title: draftTitle || 'Untitled Draft' });
  };

  const confirmDeleteDraft = async () => {
    if (!draftToDelete) return;
    try {
      await blueprintService.deleteDraft(draftToDelete.id);
      setActionAlert({
        type: 'success',
        message: \`Draft "\${draftToDelete.title}" was deleted successfully.\`,
      });
      fetchDrafts();
      setDraftToDelete(null);
    } catch (err) {
      setActionAlert({
        type: 'danger',
        message: \`Failed to delete draft: \${err.message}\`,
      });
      setDraftToDelete(null);
    }
  };`;

if (content.includes(oldHandleDeleteDraft)) {
  content = content.replace(oldHandleDeleteDraft, newHandleDeleteDraft);
  console.log('5. Replaced window.confirm in handleDeleteDraft with modal confirmation!');
}

// 6. Update Profile UI:
// Make Faculty ID immutable, remove Domain Specialization, use dynamic designationsList, show creation date
const oldProfileForm = `                <form onSubmit={handleUpdateProfile} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  <div>
                    <label style={styles.label}>Faculty / Employee Identifier</label>
                    <input
                      type="text"
                      style={styles.input}
                      value={profileData?.facultyId || ''}
                      onChange={(e) => setProfileData({ ...profileData, facultyId: e.target.value })}
                      placeholder="e.g. COMP-FAC-102"
                      required
                    />
                  </div>

                  <div>
                    <label style={styles.label}>Academic Department (Locked)</label>
                    <input
                      type="text"
                      style={{ ...styles.input, backgroundColor: 'var(--color-surface-subtle)', color: 'var(--color-text-muted)', cursor: 'not-allowed' }}
                      value="Department of Computer Engineering"
                      disabled
                    />
                    <div style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', marginTop: '3px' }}>
                      ExamGuard is exclusively for the Computer Engineering Department.
                    </div>
                  </div>

                  <div>
                    <label style={styles.label}>Academic Designation</label>
                    <select
                      style={styles.select}
                      value={profileData?.designation || 'Assistant Professor'}
                      onChange={(e) => setProfileData({ ...profileData, designation: e.target.value })}
                    >
                      <option value="Assistant Professor">Assistant Professor</option>
                      <option value="Associate Professor">Associate Professor</option>
                      <option value="Professor">Professor</option>
                      <option value="Head of Department">Head of Department (HOD)</option>
                      <option value="Adjunct Faculty">Adjunct Faculty</option>
                    </select>
                  </div>

                  <div>
                    <label style={styles.label}>Domain Specialization</label>
                    <input
                      type="text"
                      style={styles.input}
                      value={profileData?.specialization || ''}
                      onChange={(e) => setProfileData({ ...profileData, specialization: e.target.value })}
                      placeholder="e.g. Computer Networks & Security, Algorithms"
                    />
                  </div>

                  <div>
                    <label style={styles.label}>Contact Phone Number</label>
                    <input
                      type="tel"
                      style={styles.input}
                      value={profileData?.phone || ''}
                      onChange={(e) => setProfileData({ ...profileData, phone: e.target.value })}
                      placeholder="+91 98765 43210"
                    />
                  </div>`;

const newProfileForm = `                <form onSubmit={handleUpdateProfile} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <label style={styles.label}>Faculty ID (System-Generated)</label>
                      <span style={{ fontSize: '11px', color: '#0369a1', backgroundColor: '#e0f2fe', padding: '1px 6px', borderRadius: '4px', fontWeight: 600 }}>
                        IMMUTABLE
                      </span>
                    </div>
                    <input
                      type="text"
                      style={{ ...styles.input, backgroundColor: 'var(--color-surface-subtle)', color: 'var(--color-text-muted)', cursor: 'not-allowed', fontFamily: 'var(--font-jetbrains)' }}
                      value={profileData?.facultyId || \`COMP-FAC-\${(user?.id || 'FACULTY').slice(0, 6).toUpperCase()}\`}
                      readOnly
                      disabled
                      title="Faculty ID is permanent and managed by the institution."
                    />
                  </div>

                  <div>
                    <label style={styles.label}>Academic Department (Locked)</label>
                    <input
                      type="text"
                      style={{ ...styles.input, backgroundColor: 'var(--color-surface-subtle)', color: 'var(--color-text-muted)', cursor: 'not-allowed' }}
                      value="Department of Computer Engineering"
                      disabled
                    />
                    <div style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', marginTop: '3px' }}>
                      ExamGuard is exclusively for the Computer Engineering Department.
                    </div>
                  </div>

                  <div>
                    <label style={styles.label}>Academic Designation</label>
                    <select
                      style={styles.select}
                      value={profileData?.designation || 'Assistant Professor'}
                      onChange={(e) => setProfileData({ ...profileData, designation: e.target.value })}
                    >
                      {designationsList.map((d, idx) => (
                        <option key={idx} value={d}>
                          {d}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label style={styles.label}>Contact Phone Number (Optional)</label>
                    <input
                      type="tel"
                      style={styles.input}
                      value={profileData?.phone || ''}
                      onChange={(e) => setProfileData({ ...profileData, phone: e.target.value })}
                      placeholder="+91 98765 43210"
                    />
                    <div style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', marginTop: '3px' }}>
                      Institutional contact phone for urgent Examination Cell notifications.
                    </div>
                  </div>`;

if (content.includes(oldProfileForm)) {
  content = content.replace(oldProfileForm, newProfileForm);
  console.log('6. Updated Profile Edit form (immutable Faculty ID, dynamic designations, removed specialization)!');
}

// 7. Update Profile Badge Card to remove Domain Specialization and show account creation date
const oldProfileCardMeta = `                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--color-text-muted)' }}>Specialization:</span>
                    <span>{profileData?.specialization || 'Computer Engineering'}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--color-text-muted)' }}>Contact Phone:</span>
                    <span>{profileData?.phone || 'Not configured'}</span>
                  </div>`;

const newProfileCardMeta = `                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--color-text-muted)' }}>Contact Phone:</span>
                    <span>{profileData?.phone || 'Not configured'}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--color-text-muted)' }}>Account Created:</span>
                    <span>{user?.created_at || user?.createdAt ? new Date(user.created_at || user.createdAt).toLocaleDateString() : 'Active Member'}</span>
                  </div>`;

if (content.includes(oldProfileCardMeta)) {
  content = content.replace(oldProfileCardMeta, newProfileCardMeta);
  console.log('7. Updated Profile Badge Card with creation date!');
}

// 8. Add Draft Delete Modal to end of modals
const modalSectionEnd = '      {/* QUESTION PAPER DETAILS MODAL */}';
const draftDeleteModalHtml = `      {/* CONFIRM DRAFT DELETION MODAL */}
      {draftToDelete && (
        <div style={styles.modalOverlay}>
          <div style={{ ...styles.modalCard, maxWidth: '420px' }}>
            <div style={styles.modalHeader}>
              <h3 style={styles.modalTitle}>Delete Draft</h3>
              <button onClick={() => setDraftToDelete(null)} style={styles.modalCloseBtn}>
                <X size={18} />
              </button>
            </div>
            <div style={{ padding: '1.25rem' }}>
              <p style={{ margin: '0 0 1rem 0', fontSize: '0.9rem', color: '#334155' }}>
                Are you sure you want to delete the draft <strong>&ldquo;{draftToDelete.title}&rdquo;</strong>? This action cannot be undone.
              </p>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                <button
                  type="button"
                  onClick={() => setDraftToDelete(null)}
                  style={styles.cancelBtn}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={confirmDeleteDraft}
                  style={{
                    ...styles.submitBtn,
                    backgroundColor: '#dc2626',
                    borderColor: '#b91c1c',
                    color: '#ffffff',
                    padding: '6px 14px',
                    fontSize: '0.85rem',
                  }}
                >
                  Yes, Delete Draft
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* QUESTION PAPER DETAILS MODAL */}`;

if (content.includes(modalSectionEnd)) {
  content = content.replace(modalSectionEnd, draftDeleteModalHtml);
  console.log('8. Added inline Draft Delete confirmation modal!');
}

// 9. In Paper Cards, move cryptographic details into collapsible <details>
const oldCardVerificationAlert = `{verificationResults[paper.id] && (
                        <div
                          style={
                            verificationResults[paper.id].verified
                              ? styles.verificationSuccessAlert
                              : styles.verificationFailureAlert
                          }
                        >
                          {verificationResults[paper.id].verified ? (
                            <span>✔ RSA-PSS Signature Verified Valid</span>
                          ) : (
                            <span>✖ Signature/Integrity Check Failed</span>
                          )}
                        </div>
                      )}`;

const newCardVerificationAlert = `                      {/* Collapsible Cryptographic Security Details */}
                      <details style={{ marginTop: '0.5rem', marginBottom: '0.5rem', fontSize: '0.75rem', backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '6px', padding: '6px 10px' }}>
                        <summary style={{ cursor: 'pointer', fontWeight: 600, color: '#0369a1', outline: 'none' }}>
                          🔒 Security &amp; Cryptographic Details
                        </summary>
                        <div style={{ marginTop: '6px', display: 'flex', flexDirection: 'column', gap: '4px', color: '#475569' }}>
                          <div><strong>Cipher:</strong> AES-256-GCM (Payload)</div>
                          <div><strong>Envelope Key:</strong> RSA-OAEP (2048-bit)</div>
                          <div><strong>Digital Signature:</strong> RSA-PSS (SHA-256)</div>
                          <div><strong>Integrity Digest:</strong> SHA-256 Validated</div>
                        </div>
                        {verificationResults[paper.id] && (
                          <div
                            style={{
                              marginTop: '6px',
                              padding: '4px 8px',
                              borderRadius: '4px',
                              backgroundColor: verificationResults[paper.id].verified ? '#dcfce7' : '#fee2e2',
                              color: verificationResults[paper.id].verified ? '#15803d' : '#991b1b',
                              fontWeight: 600,
                            }}
                          >
                            {verificationResults[paper.id].verified
                              ? '✔ RSA-PSS Signature & SHA-256 Verified Valid'
                              : '✖ Signature or Integrity Check Failed'}
                          </div>
                        )}
                      </details>`;

if (content.includes(oldCardVerificationAlert)) {
  content = content.replace(oldCardVerificationAlert, newCardVerificationAlert);
  console.log('9. Replaced card verification block with collapsible Security & Cryptographic Details!');
}

fs.writeFileSync(filePath, content, 'utf8');
console.log('TeacherHome.jsx refactoring completed successfully!');
