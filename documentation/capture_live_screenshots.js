/**
 * ExamGuard — Live Application Screenshot Capture
 * Captures real, genuine screenshots of all screens on https://examguardapp.vercel.app
 * using Edge CDP with authentic credentials:
 *   - Teacher: teacher@examguard.edu / Teacher@ExamGuard2026
 *   - Coordinator: coordinator@examguard.edu / Coord@ExamGuard2026
 *   - Admin: admin@examguard.edu / Admin@ExamGuard2026
 */

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const edgePath = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const userDataDir = path.resolve(__dirname, 'edge_cdp_profile_live');
const screenshotsDir = path.resolve(__dirname, 'user-manual', 'screenshots');

if (!fs.existsSync(screenshotsDir)) {
  fs.mkdirSync(screenshotsDir, { recursive: true });
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

class CDPClient {
  constructor(wsUrl) {
    this.wsUrl = wsUrl;
    this.ws = null;
    this.id = 1;
    this.callbacks = new Map();
  }

  connect() {
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(this.wsUrl);
      this.ws.onopen = () => resolve();
      this.ws.onerror = (err) => reject(err);
      this.ws.onmessage = (event) => {
        const msg = JSON.parse(event.data);
        if (msg.id && this.callbacks.has(msg.id)) {
          const { resolve, reject } = this.callbacks.get(msg.id);
          this.callbacks.delete(msg.id);
          if (msg.error) reject(new Error(msg.error.message));
          else resolve(msg.result);
        }
      };
    });
  }

  send(method, params = {}) {
    return new Promise((resolve, reject) => {
      const id = this.id++;
      this.callbacks.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }

  async eval(expression) {
    const res = await this.send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    return res.result ? res.result.value : null;
  }

  async screenshot(filename) {
    const filePath = path.join(screenshotsDir, filename);
    const { data } = await this.send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(filePath, Buffer.from(data, 'base64'));
    console.log(`  [Screenshot Saved] -> ${filename} (${Math.round(data.length * 0.75 / 1024)} KB)`);
  }

  close() {
    if (this.ws) this.ws.close();
  }
}

async function loginApi(email, password) {
  const res = await fetch('https://examguard-999h.onrender.com/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password })
  });
  return await res.json();
}

async function main() {
  console.log('[Capture Tool] Authenticating live credentials via Render API...');
  const teacherAuth = await loginApi('teacher@examguard.edu', 'Teacher@ExamGuard2026');
  console.log('  Teacher Token Acquired:', !!teacherAuth.token);

  const coordAuth = await loginApi('coordinator@examguard.edu', 'Coord@ExamGuard2026');
  console.log('  Coordinator Token Acquired:', !!coordAuth.token);

  const adminAuth = await loginApi('admin@examguard.edu', 'Admin@ExamGuard2026');
  console.log('  Admin Token Acquired:', !!adminAuth.token);

  console.log('[Capture Tool] Starting Edge Headless with CDP on port 9224...');
  const edgeProcess = spawn(edgePath, [
    '--headless=new',
    '--remote-debugging-port=9224',
    `--user-data-dir=${userDataDir}`,
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-gpu',
    'about:blank'
  ], { stdio: 'ignore' });

  await sleep(3000);

  try {
    const listRes = await fetch('http://127.0.0.1:9224/json/list');
    const tabs = await listRes.json();
    const tab = tabs.find(t => t.type === 'page') || tabs[0];
    const client = new CDPClient(tab.webSocketDebuggerUrl);
    await client.connect();

    await client.send('Page.enable');
    await client.send('Runtime.enable');
    await client.send('Emulation.setDeviceMetricsOverride', {
      width: 1280,
      height: 850,
      deviceScaleFactor: 2,
      mobile: false,
    });

    // 1. LOGIN PAGE
    console.log('[Capture Tool] Navigating to Login Page...');
    await client.send('Page.navigate', { url: 'https://examguardapp.vercel.app/login' });
    await sleep(4000);
    await client.screenshot('01-login-page.png');

    // 2. LOGIN ERROR STATE
    console.log('[Capture Tool] Triggering login validation error...');
    await client.eval(`
      (() => {
        function setVal(el, val) {
          const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
          setter.call(el, val);
          el.dispatchEvent(new Event('input', { bubbles: true }));
          el.dispatchEvent(new Event('change', { bubbles: true }));
        }
        const email = document.querySelector('input[type="email"]');
        const pass = document.querySelector('input[type="password"]');
        const form = document.querySelector('form');
        if (email && pass && form) {
          setVal(email, 'invalid.user@examguard.edu');
          setVal(pass, 'WrongPassword123!');
          form.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
        }
      })()
    `);
    await sleep(3500);
    await client.screenshot('02-login-validation-error.png');

    // ==========================================
    // TEACHER SCREENS
    // ==========================================
    console.log('\n[Capture Tool] Injecting Teacher session into browser...');
    await client.eval(`
      (() => {
        localStorage.setItem('token', ${JSON.stringify(teacherAuth.token)});
        localStorage.setItem('user', ${JSON.stringify(JSON.stringify(teacherAuth.user))});
      })()
    `);
    await client.send('Page.navigate', { url: 'https://examguardapp.vercel.app/teacher' });
    await sleep(5000);

    // 3. Teacher Dashboard Overview
    await client.screenshot('03-teacher-dashboard-overview.png');

    // 4. Assigned to Me tab
    console.log('[Capture Tool] Opening Assigned to Me tab...');
    await client.eval(`
      (() => {
        const tabs = Array.from(document.querySelectorAll('button'));
        const assignedTab = tabs.find(b => b.textContent.includes('Assigned to Me'));
        if (assignedTab) assignedTab.click();
      })()
    `);
    await sleep(3000);
    await client.screenshot('04-teacher-assigned-papers.png');

    // 5. Create Question Paper Tab (Upload Option A)
    console.log('[Capture Tool] Opening Create Question Paper tab...');
    await client.eval(`
      (() => {
        const tabs = Array.from(document.querySelectorAll('button'));
        const createTab = tabs.find(b => b.textContent.includes('Create Question Paper'));
        if (createTab) createTab.click();
      })()
    `);
    await sleep(2500);
    await client.eval(`
      (() => {
        const btns = Array.from(document.querySelectorAll('button'));
        const uploadBtn = btns.find(b => b.textContent.includes('Upload Existing PDF'));
        if (uploadBtn) uploadBtn.click();
      })()
    `);
    await sleep(2000);
    await client.screenshot('05-teacher-upload-paper-form.png');

    // 6. Question Paper Generator Wizard (Step 1: Blueprint)
    console.log('[Capture Tool] Opening Generator Wizard (Step 1: Blueprint)...');
    await client.eval(`
      (() => {
        const tabs = Array.from(document.querySelectorAll('button'));
        const createTab = tabs.find(b => b.textContent.includes('Create Question Paper'));
        if (createTab) createTab.click();
      })()
    `);
    await sleep(1500);
    await client.eval(`
      (() => {
        const btns = Array.from(document.querySelectorAll('button'));
        const wizardBtn = btns.find(b => b.textContent.includes('Generate via Wizard'));
        if (wizardBtn) wizardBtn.click();
      })()
    `);
    await sleep(3000);
    await client.screenshot('06-teacher-generator-wizard-step1.png');

    // 7. Wizard Step 2: Question Bank
    console.log('[Capture Tool] Advancing to Wizard Step 2 (Question Bank)...');
    await client.eval(`
      (() => {
        const btns = Array.from(document.querySelectorAll('button'));
        const nextBtn = btns.find(b => b.textContent.includes('Next: Question Bank'));
        if (nextBtn) nextBtn.click();
      })()
    `);
    await sleep(3000);
    await client.screenshot('07-teacher-generator-wizard-step2.png');

    // 8. Wizard Step 3: Feasibility & Sets
    console.log('[Capture Tool] Advancing to Wizard Step 3 (Feasibility)...');
    await client.eval(`
      (() => {
        const btns = Array.from(document.querySelectorAll('button'));
        const nextBtn = btns.find(b => b.textContent.includes('Next: Feasibility'));
        if (nextBtn) nextBtn.click();
      })()
    `);
    await sleep(3000);
    await client.screenshot('08-teacher-generator-wizard-step3.png');

    // 9. Wizard Step 4: Preview & Swap
    console.log('[Capture Tool] Advancing to Step 4 (Preview & Swap)...');
    await client.eval(`
      (() => {
        const btns = Array.from(document.querySelectorAll('button'));
        const genBtn = btns.find(b => b.textContent.includes('Generate Sets Now') || b.textContent.includes('Next: Review'));
        if (genBtn) genBtn.click();
      })()
    `);
    await sleep(4000);
    await client.screenshot('09-teacher-generator-wizard-step4.png');

    // Return to My Papers
    await client.eval(`
      (() => {
        const tabs = Array.from(document.querySelectorAll('button'));
        const myPapersTab = tabs.find(b => b.textContent.includes('My Question Papers'));
        if (myPapersTab) myPapersTab.click();
      })()
    `);
    await sleep(2000);

    // 10. Algorithm Flow Modal
    console.log('[Capture Tool] Opening Algorithm Flow Modal...');
    await client.eval(`
      (() => {
        const btns = Array.from(document.querySelectorAll('button'));
        const flowBtn = btns.find(b => b.textContent.includes('View Algorithm Flow'));
        if (flowBtn) flowBtn.click();
      })()
    `);
    await sleep(2500);
    await client.screenshot('10-cryptographic-algorithm-flow-modal.png');

    // Close Modal
    await client.eval(`
      (() => {
        const closeBtn = document.querySelector('button[aria-label="Close"], button svg.lucide-x');
        if (closeBtn) closeBtn.closest('button').click();
      })()
    `);
    await sleep(1500);

    // 11. Answer Key Modal
    console.log('[Capture Tool] Opening Answer Key Modal...');
    await client.eval(`
      (() => {
        const btns = Array.from(document.querySelectorAll('button'));
        const keyBtn = btns.find(b => b.textContent.includes('Answer Key') || b.querySelector('svg.lucide-key'));
        if (keyBtn) keyBtn.click();
      })()
    `);
    await sleep(3000);
    await client.screenshot('11-teacher-answer-key-modal.png');

    // Close Modal
    await client.eval(`
      (() => {
        const closeBtn = document.querySelector('button[aria-label="Close"], button svg.lucide-x');
        if (closeBtn) closeBtn.closest('button').click();
      })()
    `);
    await sleep(1500);

    // 12. Delete Confirmation Modal
    console.log('[Capture Tool] Opening Delete Confirmation Modal...');
    await client.eval(`
      (() => {
        const trashBtn = document.querySelector('button svg.lucide-trash2');
        if (trashBtn) trashBtn.closest('button').click();
      })()
    `);
    await sleep(2500);
    await client.screenshot('12-teacher-delete-paper-modal.png');

    // Close Modal safely
    await client.eval(`
      (() => {
        const cancelBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Cancel'));
        if (cancelBtn) cancelBtn.click();
      })()
    `);
    await sleep(1500);

    // ==========================================
    // EXAM COORDINATOR SCREENS
    // ==========================================
    console.log('\n[Capture Tool] Injecting Coordinator session into browser...');
    await client.eval(`
      (() => {
        localStorage.setItem('token', ${JSON.stringify(coordAuth.token)});
        localStorage.setItem('user', ${JSON.stringify(JSON.stringify(coordAuth.user))});
      })()
    `);
    await client.send('Page.navigate', { url: 'https://examguardapp.vercel.app/exam-coordinator' });
    await sleep(5000);

    // 13. Coordinator Dashboard
    await client.screenshot('13-coordinator-dashboard-overview.png');

    // 14. Details Modal
    console.log('[Capture Tool] Opening Coordinator Details Modal...');
    await client.eval(`
      (() => {
        const eyeBtn = document.querySelector('button svg.lucide-eye');
        if (eyeBtn) eyeBtn.closest('button').click();
      })()
    `);
    await sleep(2500);
    await client.screenshot('14-coordinator-paper-details-modal.png');

    // Close Modal
    await client.eval(`
      (() => {
        const closeBtn = document.querySelector('button[aria-label="Close"], button svg.lucide-x');
        if (closeBtn) closeBtn.closest('button').click();
      })()
    `);
    await sleep(1500);

    // ==========================================
    // ADMIN SCREENS
    // ==========================================
    console.log('\n[Capture Tool] Injecting Admin session into browser...');
    await client.eval(`
      (() => {
        localStorage.setItem('token', ${JSON.stringify(adminAuth.token)});
        localStorage.setItem('user', ${JSON.stringify(JSON.stringify(adminAuth.user))});
      })()
    `);
    await client.send('Page.navigate', { url: 'https://examguardapp.vercel.app/admin' });
    await sleep(5000);

    // 15. Admin User Management Dashboard
    await client.screenshot('15-admin-user-management.png');

    // 16. Admin Create User Modal
    console.log('[Capture Tool] Opening Admin Create User Modal...');
    await client.eval(`
      (() => {
        const addBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Create') || b.textContent.includes('Add User') || b.querySelector('svg.lucide-user-plus'));
        if (addBtn) addBtn.click();
      })()
    `);
    await sleep(2500);
    await client.screenshot('16-admin-create-user-modal.png');

    // Close Modal safely
    await client.eval(`
      (() => {
        const cancelBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Cancel') || b.querySelector('svg.lucide-x'));
        if (cancelBtn) cancelBtn.click();
      })()
    `);
    await sleep(1500);

    // 17. Admin Audit Logs Tab
    console.log('[Capture Tool] Switching to Audit Logs tab...');
    await client.eval(`
      (() => {
        const tabs = Array.from(document.querySelectorAll('button'));
        const auditTab = tabs.find(b => b.textContent.includes('Audit Logs'));
        if (auditTab) auditTab.click();
      })()
    `);
    await sleep(3500);
    await client.screenshot('17-admin-audit-logs-dashboard.png');

    // 18. Audit Details Modal
    console.log('[Capture Tool] Opening Audit Log Details Modal...');
    await client.eval(`
      (() => {
        const eyeBtn = document.querySelector('button svg.lucide-eye');
        if (eyeBtn) eyeBtn.closest('button').click();
      })()
    `);
    await sleep(2500);
    await client.screenshot('18-admin-audit-details-modal.png');

    // Close Modal
    await client.eval(`
      (() => {
        const closeBtn = document.querySelector('button[aria-label="Close"], button svg.lucide-x');
        if (closeBtn) closeBtn.closest('button').click();
      })()
    `);
    await sleep(1500);

    console.log('\n============================================================');
    console.log('  ALL GENUINE REAL APPLICATION SCREENSHOTS CAPTURED CLEANLY!');
    console.log('============================================================\n');

    client.close();
  } catch (err) {
    console.error('[Capture Tool] Error during capture:', err);
  } finally {
    edgeProcess.kill();
  }
}

main();
