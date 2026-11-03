const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '../../Frontend/src/components/QuestionPaperGeneratorWizard.jsx');
let content = fs.readFileSync(filePath, 'utf8');

// 1. Add top-left Back button to each step
// Step 1:
const step1Start = '{step === 1 && (\n        <div style={styles.stepContent}>';
const step1WithBack = `{step === 1 && (
        <div style={styles.stepContent}>
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: '14px' }}>
            <button
              type="button"
              onClick={onCancel}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '6px 14px',
                backgroundColor: '#ffffff',
                border: '1px solid #cbd5e1',
                borderRadius: '6px',
                color: '#334155',
                fontSize: '13px',
                fontWeight: '600',
                cursor: 'pointer',
                boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
              }}
            >
              <ArrowLeft size={16} />
              <span>Back to Dashboard</span>
            </button>
          </div>`;

if (content.includes(step1Start)) {
  content = content.replace(step1Start, step1WithBack);
  console.log('1. Added Top-Left Back button to Step 1!');
}

// Step 2:
const step2Start = '{step === 2 && (\n        <div style={styles.stepContent}>';
const step2WithBack = `{step === 2 && (
        <div style={styles.stepContent}>
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: '14px' }}>
            <button
              type="button"
              onClick={() => setStep(1)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '6px 14px',
                backgroundColor: '#ffffff',
                border: '1px solid #cbd5e1',
                borderRadius: '6px',
                color: '#334155',
                fontSize: '13px',
                fontWeight: '600',
                cursor: 'pointer',
                boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
              }}
            >
              <ArrowLeft size={16} />
              <span>Back to Step 1 (Blueprint)</span>
            </button>
          </div>`;

if (content.includes(step2Start)) {
  content = content.replace(step2Start, step2WithBack);
  console.log('2. Added Top-Left Back button to Step 2!');
}

// Step 3:
const step3Start = '{step === 3 && (\n        <div style={styles.stepContent}>';
const step3WithBack = `{step === 3 && (
        <div style={styles.stepContent}>
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: '14px' }}>
            <button
              type="button"
              onClick={() => setStep(2)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '6px 14px',
                backgroundColor: '#ffffff',
                border: '1px solid #cbd5e1',
                borderRadius: '6px',
                color: '#334155',
                fontSize: '13px',
                fontWeight: '600',
                cursor: 'pointer',
                boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
              }}
            >
              <ArrowLeft size={16} />
              <span>Back to Step 2 (Question Bank)</span>
            </button>
          </div>`;

if (content.includes(step3Start)) {
  content = content.replace(step3Start, step3WithBack);
  console.log('3. Added Top-Left Back button to Step 3!');
}

// Step 4:
const step4Start = '{step === 4 && activeSet && (\n        <div style={styles.stepContent}>';
const step4WithBack = `{step === 4 && activeSet && (
        <div style={styles.stepContent}>
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: '14px' }}>
            <button
              type="button"
              onClick={() => setStep(3)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '6px 14px',
                backgroundColor: '#ffffff',
                border: '1px solid #cbd5e1',
                borderRadius: '6px',
                color: '#334155',
                fontSize: '13px',
                fontWeight: '600',
                cursor: 'pointer',
                boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
              }}
            >
              <ArrowLeft size={16} />
              <span>Back to Step 3 (Feasibility)</span>
            </button>
          </div>`;

if (content.includes(step4Start)) {
  content = content.replace(step4Start, step4WithBack);
  console.log('4. Added Top-Left Back button to Step 4!');
}

// Step 5:
const step5Start = '{step === 5 && activeSet && (\n        <div style={styles.stepContent}>';
const step5WithBack = `{step === 5 && activeSet && (
        <div style={styles.stepContent}>
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: '14px' }}>
            <button
              type="button"
              onClick={() => setStep(4)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '6px 14px',
                backgroundColor: '#ffffff',
                border: '1px solid #cbd5e1',
                borderRadius: '6px',
                color: '#334155',
                fontSize: '13px',
                fontWeight: '600',
                cursor: 'pointer',
                boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
              }}
            >
              <ArrowLeft size={16} />
              <span>Back to Step 4 (Validation & Sets)</span>
            </button>
          </div>`;

if (content.includes(step5Start)) {
  content = content.replace(step5Start, step5WithBack);
  console.log('5. Added Top-Left Back button to Step 5!');
}

// 6. Update Step 3 Feasibility Pool Breakdown to clearly display missing count
const oldFeasibilityStatus = `<td style={styles.td}>
                            {p.sufficient ? (
                              <span style={{ color: '#059669', fontWeight: 600 }}>✓ Ready</span>
                            ) : (
                              <span style={{ color: '#dc2626', fontWeight: 600 }}>✗ Insufficient</span>
                            )}
                          </td>`;

const newFeasibilityStatus = `<td style={styles.td}>
                            {p.sufficient ? (
                              <span style={{ color: '#059669', fontWeight: 600, backgroundColor: '#dcfce7', padding: '2px 8px', borderRadius: '4px' }}>
                                ✓ Ready
                              </span>
                            ) : (
                              <span style={{ color: '#dc2626', fontWeight: 600, backgroundColor: '#fee2e2', padding: '2px 8px', borderRadius: '4px' }}>
                                ✗ {Math.max(0, p.requiredCount - p.availableCount)} Missing
                              </span>
                            )}
                          </td>`;

if (content.includes(oldFeasibilityStatus)) {
  content = content.replace(oldFeasibilityStatus, newFeasibilityStatus);
  console.log('6. Updated Feasibility pool missing counts!');
}

fs.writeFileSync(filePath, content, 'utf8');
console.log('Step flow and Back button enhancements completed!');
