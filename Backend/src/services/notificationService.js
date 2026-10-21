const { supabase } = require('../config/supabase');
const auditLogService = require('./auditLogService');

/**
 * Validates whether a string is a valid UUID v4 format.
 */
function isValidUuid(id) {
  if (!id || typeof id !== 'string') return false;
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(id);
}

/**
 * Creates an in-app notification when a question paper is submitted and scheduled.
 * Incorporates an idempotency check to avoid duplicate records on retries.
 *
 * @param {Object} params
 * @param {string} params.recipientId - UUID of recipient user
 * @param {string} params.questionPaperId - UUID of the question paper
 * @param {string} params.title - Question paper title
 * @param {string} params.subject - Question paper subject
 * @param {string} [params.examDate] - Scheduled exam date
 * @param {string} params.scheduledDeliveryDate - Calculated delivery date (YYYY-MM-DD)
 * @returns {Promise<Object>} Created or existing notification record
 */
async function createQuestionPaperNotification({
  recipientId,
  questionPaperId,
  title,
  subject,
  examDate,
  scheduledDeliveryDate,
}) {
  if (!recipientId || !questionPaperId || !title || !scheduledDeliveryDate) {
    const err = new Error('Missing required notification parameters.');
    err.statusCode = 400;
    throw err;
  }

  const notificationType = 'QUESTION_PAPER_SCHEDULED';
  const notificationSubject = `Question Paper Scheduled: ${title} (${subject})`;
  const notificationMessage = `Question paper "${title}" for ${subject} has been assigned to you. It is scheduled for delivery on ${scheduledDeliveryDate}.`;
  const scheduledAt = `${scheduledDeliveryDate}T00:00:00.000Z`;
  const sentAt = new Date().toISOString();

  // 1. Idempotency Check: Prevent duplicate notifications for the same paper and recipient
  const { data: existing, error: checkError } = await supabase
    .from('notifications')
    .select('id, user_id, question_paper_id, type, channel, subject, message, scheduled_at, sent_at, status, created_at')
    .eq('user_id', recipientId)
    .eq('question_paper_id', questionPaperId)
    .eq('type', notificationType)
    .maybeSingle();

  if (checkError) {
    console.warn('[NotificationService] Check existing notification warning:', checkError.message);
  }

  if (existing) {
    return existing;
  }

  // 2. Insert new notification record
  const { data: created, error: insertError } = await supabase
    .from('notifications')
    .insert([
      {
        user_id: recipientId,
        question_paper_id: questionPaperId,
        type: notificationType,
        channel: 'IN_APP',
        subject: notificationSubject,
        message: notificationMessage,
        scheduled_at: scheduledAt,
        sent_at: sentAt,
        status: 'SENT',
      },
    ])
    .select('id, user_id, question_paper_id, type, channel, subject, message, scheduled_at, sent_at, status, created_at')
    .single();

  if (insertError || !created) {
    console.error('[NotificationService] Failed to insert notification:', insertError?.message);
    const dbErr = new Error('Failed to create notification.');
    dbErr.statusCode = 500;
    throw dbErr;
  }

  await auditLogService.logAuditEvent({
    userId: recipientId,
    action: 'QUESTION_PAPER_SCHEDULED',
    resourceType: 'NOTIFICATION',
    resourceId: created.id,
    outcome: 'SUCCESS',
    summary: `Question paper notification created for user ${recipientId}`,
    metadata: { questionPaperId, scheduledDeliveryDate },
  });

  return created;
}

/**
 * Retrieves all notifications for the authenticated user with safe metadata.
 * Strictly scopes to user_id and strips any sensitive storage/key attributes.
 *
 * @param {string} userId - UUID of authenticated user
 * @returns {Promise<Array<Object>>} List of sanitized notification records
 */
async function getUserNotifications(userId) {
  if (!userId) {
    const err = new Error('User ID is required.');
    err.statusCode = 400;
    throw err;
  }

  const { data: notifications, error } = await supabase
    .from('notifications')
    .select(`
      id,
      user_id,
      question_paper_id,
      type,
      channel,
      subject,
      message,
      scheduled_at,
      sent_at,
      status,
      created_at
    `)
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('[NotificationService] Error fetching notifications:', error.message);
    const dbErr = new Error('Failed to retrieve notifications.');
    dbErr.statusCode = 500;
    throw dbErr;
  }

  if (!notifications || notifications.length === 0) {
    return [];
  }

  // Fetch safe metadata for related question papers if any
  const paperIds = notifications
    .map((n) => n.question_paper_id)
    .filter(Boolean);

  let paperMap = new Map();
  if (paperIds.length > 0) {
    const { data: papers, error: papersError } = await supabase
      .from('question_papers')
      .select(`
        id,
        title,
        subject,
        semester,
        academic_year,
        exam_type,
        exam_date,
        scheduled_delivery_date,
        status,
        teacher:users!teacher_id (
          id,
          name,
          email
        )
      `)
      .in('id', paperIds);

    if (!papersError && papers) {
      for (const p of papers) {
        paperMap.set(p.id, p);
      }
    }
  }

  const today = new Date().toISOString().split('T')[0];

  // Format safe notification records
  return notifications.map((n) => {
    const paper = n.question_paper_id ? paperMap.get(n.question_paper_id) : null;
    const isDeliverable = paper?.scheduled_delivery_date
      ? today >= paper.scheduled_delivery_date
      : false;

    return {
      id: n.id,
      userId: n.user_id,
      questionPaperId: n.question_paper_id,
      type: n.type,
      channel: n.channel,
      subject: n.subject,
      message: n.message,
      scheduledAt: n.scheduled_at,
      sentAt: n.sent_at,
      status: n.status,
      isRead: n.status === 'READ',
      createdAt: n.created_at,
      questionPaper: paper
        ? {
            id: paper.id,
            title: paper.title,
            subject: paper.subject,
            semester: paper.semester,
            academicYear: paper.academic_year,
            examType: paper.exam_type,
            examDate: paper.exam_date,
            scheduledDeliveryDate: paper.scheduled_delivery_date,
            status: paper.status,
            teacher: paper.teacher
              ? {
                  id: paper.teacher.id,
                  name: paper.teacher.name,
                  email: paper.teacher.email,
                }
              : null,
            isDeliverable,
          }
        : null,
    };
  });
}

/**
 * Returns the unread notification count for the authenticated user.
 *
 * @param {string} userId - UUID of authenticated user
 * @returns {Promise<{ unreadCount: number, count: number }>}
 */
async function getUnreadCount(userId) {
  if (!userId) {
    const err = new Error('User ID is required.');
    err.statusCode = 400;
    throw err;
  }

  const { data, error } = await supabase
    .from('notifications')
    .select('id, status')
    .eq('user_id', userId)
    .neq('status', 'READ');

  if (error) {
    console.error('[NotificationService] Error counting unread notifications:', error.message);
    const dbErr = new Error('Failed to retrieve unread notification count.');
    dbErr.statusCode = 500;
    throw dbErr;
  }

  const unreadCount = data ? data.length : 0;
  return { unreadCount, count: unreadCount };
}

/**
 * Marks a specific notification as read.
 * Enforces strict ownership check (404 if not found, 403 if foreign user).
 *
 * @param {string} notificationId - UUID of notification
 * @param {string} userId - UUID of authenticated user
 * @returns {Promise<Object>} Updated notification record
 */
async function markAsRead(notificationId, userId) {
  if (!isValidUuid(notificationId)) {
    const err = new Error('Invalid notification ID format.');
    err.statusCode = 400;
    throw err;
  }

  if (!userId) {
    const err = new Error('User ID is required.');
    err.statusCode = 400;
    throw err;
  }

  // 1. Fetch notification to verify existence and ownership
  const { data: existing, error: fetchError } = await supabase
    .from('notifications')
    .select('id, user_id, status')
    .eq('id', notificationId)
    .maybeSingle();

  if (fetchError) {
    console.error('[NotificationService] Error fetching notification:', fetchError.message);
    const dbErr = new Error('Failed to retrieve notification.');
    dbErr.statusCode = 500;
    throw dbErr;
  }

  if (!existing) {
    const notFoundErr = new Error('Notification not found.');
    notFoundErr.statusCode = 404;
    throw notFoundErr;
  }

  if (existing.user_id !== userId) {
    await auditLogService.logAuditEvent({
      userId,
      action: 'UNAUTHORIZED_ACCESS',
      resourceType: 'NOTIFICATION',
      resourceId: notificationId,
      outcome: 'DENIED',
      summary: `Unauthorized attempt to access notification ${notificationId}`,
      metadata: { requestedId: notificationId, ownerId: existing.user_id },
    });
    const forbiddenErr = new Error('Access forbidden. You do not own this notification.');
    forbiddenErr.statusCode = 403;
    throw forbiddenErr;
  }

  // 2. Update status to READ
  const { data: updated, error: updateError } = await supabase
    .from('notifications')
    .update({ status: 'READ' })
    .eq('id', notificationId)
    .eq('user_id', userId)
    .select('id, user_id, question_paper_id, type, channel, subject, message, scheduled_at, sent_at, status, created_at')
    .single();

  if (updateError || !updated) {
    console.error('[NotificationService] Error updating notification:', updateError?.message);
    const dbErr = new Error('Failed to mark notification as read.');
    dbErr.statusCode = 500;
    throw dbErr;
  }

  return {
    id: updated.id,
    userId: updated.user_id,
    questionPaperId: updated.question_paper_id,
    type: updated.type,
    channel: updated.channel,
    subject: updated.subject,
    message: updated.message,
    scheduledAt: updated.scheduled_at,
    sentAt: updated.sent_at,
    status: updated.status,
    isRead: true,
    createdAt: updated.created_at,
  };
}

/**
 * Marks a specific notification as unread.
 * Enforces strict ownership check (404 if not found, 403 if foreign user).
 *
 * @param {string} notificationId - UUID of notification
 * @param {string} userId - UUID of authenticated user
 * @returns {Promise<Object>} Updated notification record
 */
async function markAsUnread(notificationId, userId) {
  if (!isValidUuid(notificationId)) {
    const err = new Error('Invalid notification ID format.');
    err.statusCode = 400;
    throw err;
  }

  if (!userId) {
    const err = new Error('User ID is required.');
    err.statusCode = 400;
    throw err;
  }

  const { data: existing, error: fetchError } = await supabase
    .from('notifications')
    .select('id, user_id, status')
    .eq('id', notificationId)
    .maybeSingle();

  if (fetchError) {
    const dbErr = new Error('Failed to retrieve notification.');
    dbErr.statusCode = 500;
    throw dbErr;
  }

  if (!existing) {
    const notFoundErr = new Error('Notification not found.');
    notFoundErr.statusCode = 404;
    throw notFoundErr;
  }

  if (existing.user_id !== userId) {
    await auditLogService.logAuditEvent({
      userId,
      action: 'UNAUTHORIZED_ACCESS',
      resourceType: 'NOTIFICATION',
      resourceId: notificationId,
      outcome: 'DENIED',
      summary: `Unauthorized attempt to modify notification ${notificationId}`,
      metadata: { requestedId: notificationId, ownerId: existing.user_id },
    });
    const forbiddenErr = new Error('Access forbidden. You do not own this notification.');
    forbiddenErr.statusCode = 403;
    throw forbiddenErr;
  }

  const { data: updated, error: updateError } = await supabase
    .from('notifications')
    .update({ status: 'SENT' })
    .eq('id', notificationId)
    .eq('user_id', userId)
    .select('id, user_id, question_paper_id, type, channel, subject, message, scheduled_at, sent_at, status, created_at')
    .single();

  if (updateError || !updated) {
    const dbErr = new Error('Failed to mark notification as unread.');
    dbErr.statusCode = 500;
    throw dbErr;
  }

  return {
    id: updated.id,
    userId: updated.user_id,
    questionPaperId: updated.question_paper_id,
    type: updated.type,
    channel: updated.channel,
    subject: updated.subject,
    message: updated.message,
    scheduledAt: updated.scheduled_at,
    sentAt: updated.sent_at,
    status: updated.status,
    isRead: false,
    createdAt: updated.created_at,
  };
}

/**
 * Marks all notifications for the authenticated user as read.
 * Scoped strictly to userId.
 *
 * @param {string} userId - UUID of authenticated user
 * @returns {Promise<{ updatedCount: number, message: string }>}
 */
async function markAllAsRead(userId) {
  if (!userId) {
    const err = new Error('User ID is required.');
    err.statusCode = 400;
    throw err;
  }

  const { data: updated, error } = await supabase
    .from('notifications')
    .update({ status: 'READ' })
    .eq('user_id', userId)
    .neq('status', 'READ')
    .select('id');

  if (error) {
    console.error('[NotificationService] Error marking all notifications read:', error.message);
    const dbErr = new Error('Failed to mark all notifications as read.');
    dbErr.statusCode = 500;
    throw dbErr;
  }

  const updatedCount = updated ? updated.length : 0;
  return {
    updatedCount,
    count: updatedCount,
    message: `${updatedCount} notification(s) marked as read.`,
  };
}

module.exports = {
  createQuestionPaperNotification,
  getUserNotifications,
  getUnreadCount,
  markAsRead,
  markAsUnread,
  markAllAsRead,
};
