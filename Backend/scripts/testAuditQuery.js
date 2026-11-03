require('dotenv').config();
const { getAuditLogs, getAuditStatistics } = require('../src/services/auditLogService');

async function test() {
  try {
    console.log('Testing getAuditLogs...');
    const result = await getAuditLogs({ page: 1, limit: 10 });
    console.log('Logs count:', result.logs ? result.logs.length : 0);
    console.log('Pagination:', result.pagination);
    console.log('First log:', result.logs ? result.logs[0] : null);

    console.log('Testing getAuditStatistics...');
    const stats = await getAuditStatistics();
    console.log('Stats:', stats);
  } catch (err) {
    console.error('Audit query error:', err);
  }
}

test();
