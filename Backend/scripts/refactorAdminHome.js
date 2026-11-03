const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '../../Frontend/src/pages/AdminHome.jsx');
let content = fs.readFileSync(filePath, 'utf8');

// 1. Remove the approvals tab block
const approvalsStartMarker = "{/* ============================================================== */}\n        {/* TAB 2: QUESTION PAPER APPROVAL WORKFLOW (Module 22)            */}\n        {/* ============================================================== */}\n        {activeTab === 'approvals' && (";
const academicTabMarker = "{/* ============================================================== */}\n        {/* TAB 4: ACADEMIC & QUESTION PAPER CONFIGURATION CRUD (Part 3)  */}\n        {/* ============================================================== */}\n        {activeTab === 'academic' && (";

// If CRLF vs LF:
const normalize = str => str.replace(/\r\n/g, '\n');
let normContent = normalize(content);

const approvalsIdx = normContent.indexOf("activeTab === 'approvals'");
if (approvalsIdx !== -1) {
  // Find preceding comment start
  const blockStart = normContent.lastIndexOf('{/* ============================================================== */}', approvalsIdx);
  // Find start of academic tab
  const academicIdx = normContent.indexOf("activeTab === 'academic'", approvalsIdx);
  const blockEnd = normContent.lastIndexOf('{/* ============================================================== */}', academicIdx);
  
  if (blockStart !== -1 && blockEnd !== -1) {
    normContent = normContent.slice(0, blockStart) + normContent.slice(blockEnd);
    console.log('Successfully removed approvals tab UI block!');
  } else {
    console.warn('Could not locate boundaries for approvals tab block');
  }
}

// 2. Remove selectedApprovalPaper modal
const approvalModalIdx = normContent.indexOf('selectedApprovalPaper && (');
if (approvalModalIdx !== -1) {
  const modalCommentStart = normContent.lastIndexOf('{/* ============================================================== */}', approvalModalIdx);
  const nextModalComment = normContent.indexOf('{/* MODAL 5: ACADEMIC CONFIGURATION MODAL (Part 3)', approvalModalIdx);
  const modalEnd = normContent.lastIndexOf('{/* ============================================================== */}', nextModalComment);
  if (modalCommentStart !== -1 && modalEnd !== -1) {
    normContent = normContent.slice(0, modalCommentStart) + normContent.slice(modalEnd);
    console.log('Successfully removed selectedApprovalPaper modal block!');
  } else {
    console.warn('Could not locate boundaries for selectedApprovalPaper modal');
  }
}

// 3. Update Academic tab sub-tabs and top Add button to include Designations
// Top Add button:
normContent = normContent.replace(
  "handleOpenAcademicModal(academicConfigSubTab === 'titles' ? 'title' : academicConfigSubTab === 'patterns' ? 'pattern' : academicConfigSubTab === 'courses' ? 'course' : 'subject')",
  "handleOpenAcademicModal(academicConfigSubTab === 'titles' ? 'title' : academicConfigSubTab === 'patterns' ? 'pattern' : academicConfigSubTab === 'courses' ? 'course' : academicConfigSubTab === 'designations' ? 'designation' : 'subject')"
);

normContent = normContent.replace(
  "Add {academicConfigSubTab === 'titles' ? 'Paper Title' : academicConfigSubTab === 'patterns' ? 'Academic Pattern' : academicConfigSubTab === 'courses' ? 'Course' : 'Subject'}",
  "Add {academicConfigSubTab === 'titles' ? 'Paper Title' : academicConfigSubTab === 'patterns' ? 'Academic Pattern' : academicConfigSubTab === 'courses' ? 'Course' : academicConfigSubTab === 'designations' ? 'Designation' : 'Subject'}"
);

// Add Designations button in sub-tab nav
const coursesSubTabBtn = `<button
                type="button"
                onClick={() => setAcademicConfigSubTab('courses')}
                style={{
                  padding: '6px 14px',
                  borderRadius: '6px',
                  fontWeight: 600,
                  fontSize: '0.85rem',
                  border: 'none',
                  cursor: 'pointer',
                  backgroundColor: academicConfigSubTab === 'courses' ? 'var(--color-primary)' : 'var(--color-surface)',
                  color: academicConfigSubTab === 'courses' ? '#ffffff' : 'var(--color-structure)',
                }}
              >
                Courses / Degrees ({academicCourses.length})
              </button>`;

const designationsSubTabBtn = `<button
                type="button"
                onClick={() => setAcademicConfigSubTab('courses')}
                style={{
                  padding: '6px 14px',
                  borderRadius: '6px',
                  fontWeight: 600,
                  fontSize: '0.85rem',
                  border: 'none',
                  cursor: 'pointer',
                  backgroundColor: academicConfigSubTab === 'courses' ? 'var(--color-primary)' : 'var(--color-surface)',
                  color: academicConfigSubTab === 'courses' ? '#ffffff' : 'var(--color-structure)',
                }}
              >
                Courses / Degrees ({academicCourses.length})
              </button>

              <button
                type="button"
                onClick={() => setAcademicConfigSubTab('designations')}
                style={{
                  padding: '6px 14px',
                  borderRadius: '6px',
                  fontWeight: 600,
                  fontSize: '0.85rem',
                  border: 'none',
                  cursor: 'pointer',
                  backgroundColor: academicConfigSubTab === 'designations' ? 'var(--color-primary)' : 'var(--color-surface)',
                  color: academicConfigSubTab === 'designations' ? '#ffffff' : 'var(--color-structure)',
                }}
              >
                Designations ({academicDesignations.length})
              </button>`;

if (normContent.includes(coursesSubTabBtn)) {
  normContent = normContent.replace(coursesSubTabBtn, designationsSubTabBtn);
  console.log('Added Designations subtab button!');
} else {
  console.warn('Could not find coursesSubTabBtn directly, searching with flexible whitespace');
}

// Add Designations table in academic tab:
const designationsTable = `
            {/* Sub-tab 5: Designations */}
            {academicConfigSubTab === 'designations' && (
              <section style={styles.tableCard}>
                <table style={styles.table}>
                  <thead>
                    <tr style={styles.thRow}>
                      <th style={styles.th}>Designation Title</th>
                      <th style={styles.th}>Category</th>
                      <th style={styles.th}>Status</th>
                      <th style={{ ...styles.th, textAlign: 'center' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {academicDesignations.length === 0 ? (
                      <tr>
                        <td colSpan={4} style={{ textAlign: 'center', padding: '2rem', color: '#94a3b8' }}>
                          No designations configured yet. Click "Add Designation" above.
                        </td>
                      </tr>
                    ) : (
                      academicDesignations.map((d, idx) => {
                        const dName = typeof d === 'string' ? d : d.name;
                        return (
                          <tr key={idx} style={styles.tr}>
                            <td style={styles.td}>
                              <strong>{dName}</strong>
                            </td>
                            <td style={styles.td}>
                              <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#0369a1', backgroundColor: '#e0f2fe', padding: '2px 8px', borderRadius: '4px' }}>
                                Faculty Designation
                              </span>
                            </td>
                            <td style={styles.td}>
                              <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#059669', backgroundColor: '#d1fae5', padding: '2px 8px', borderRadius: '4px' }}>
                                Active
                              </span>
                            </td>
                            <td style={{ ...styles.td, textAlign: 'center' }}>
                              <button
                                type="button"
                                onClick={() => handleDeleteAcademicItem('designation', dName)}
                                style={styles.iconBtn}
                                title="Delete Designation"
                              >
                                <Trash2 size={14} color="#dc2626" />
                              </button>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </section>
            )}
`;

const endOfCoursesTable = '{academicConfigSubTab === \'courses\' && (';
const coursesTableIdx = normContent.indexOf(endOfCoursesTable);
if (coursesTableIdx !== -1) {
  const closingSection = normContent.indexOf('</section>\n            )}', coursesTableIdx);
  if (closingSection !== -1) {
    const insertPoint = closingSection + '</section>\n            )}'.length;
    normContent = normContent.slice(0, insertPoint) + designationsTable + normContent.slice(insertPoint);
    console.log('Added Designations table section!');
  }
}

// 4. Add Designation field to Modal 5 form
const modalDesignationField = `
                {academicModalType === 'designation' && (
                  <div style={styles.formField}>
                    <label style={styles.formLabel}>
                      Designation Title <span style={{ color: '#ef4444' }}>*</span>
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Professor, Associate Professor, Assistant Professor, Lecturer"
                      value={academicForm.name || ''}
                      onChange={(e) => setAcademicForm({ ...academicForm, name: e.target.value })}
                      style={styles.formInput}
                    />
                  </div>
                )}
`;

const modalTitleHeader = "{academicModalType === 'title' ? 'Paper Title' : academicModalType === 'pattern' ? 'Academic Pattern' : academicModalType === 'course' ? 'Course' : 'Subject'}";
const newModalTitleHeader = "{academicModalType === 'title' ? 'Paper Title' : academicModalType === 'pattern' ? 'Academic Pattern' : academicModalType === 'course' ? 'Course' : academicModalType === 'designation' ? 'Designation' : 'Subject'}";
normContent = normContent.replace(modalTitleHeader, newModalTitleHeader);

const courseFormField = "{academicModalType === 'course' && (";
const courseFieldIdx = normContent.indexOf(courseFormField);
if (courseFieldIdx !== -1) {
  const courseFieldClose = normContent.indexOf('</>\n                )}', courseFieldIdx);
  if (courseFieldClose !== -1) {
    const insertPoint = courseFieldClose + '</>\n                )}'.length;
    normContent = normContent.slice(0, insertPoint) + modalDesignationField + normContent.slice(insertPoint);
    console.log('Added Designation form fields to academic modal!');
  }
}

fs.writeFileSync(filePath, normContent, 'utf8');
console.log('AdminHome.jsx successfully refactored!');
