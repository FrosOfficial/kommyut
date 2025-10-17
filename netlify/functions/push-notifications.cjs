const webpush = require('web-push');
const { Pool } = require('pg');

// Initialize Web Push with VAPID keys
webpush.setVapidDetails(
  'mailto:' + process.env.VAPID_EMAIL || 'admin@kommyut.app',
  process.env.VAPID_PUBLIC_KEY,
  process.env.VAPID_PRIVATE_KEY
);

// Initialize PostgreSQL connection pool
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

exports.handler = async (event, context) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, GET, DELETE, OPTIONS',
  };

  // Handle OPTIONS request for CORS
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers,
      body: '',
    };
  }

  const path = event.path.replace('/.netlify/functions/push-notifications', '');

  // Handle subscription management
  if (path === '/subscribe' && event.httpMethod === 'POST') {
    try {
      const { subscription, userUid } = JSON.parse(event.body);

      if (!subscription || !subscription.endpoint) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: 'Invalid subscription data' }),
        };
      }

      const client = await pool.connect();
      try {
        await client.query(
          `INSERT INTO push_subscriptions (user_uid, endpoint, p256dh_key, auth_key, user_agent)
           VALUES ($1, $2, $3, $4, $5)
           ON CONFLICT (endpoint)
           DO UPDATE SET last_active = CURRENT_TIMESTAMP`,
          [
            userUid || null,
            subscription.endpoint,
            subscription.keys.p256dh,
            subscription.keys.auth,
            event.headers['user-agent'] || null,
          ]
        );

        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({ success: true, message: 'Subscription saved' }),
        };
      } finally {
        client.release();
      }
    } catch (error) {
      console.error('Error saving subscription:', error);
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ error: 'Failed to save subscription' }),
      };
    }
  }

  // Handle unsubscribe
  if (path === '/unsubscribe' && event.httpMethod === 'DELETE') {
    try {
      const { endpoint } = JSON.parse(event.body);

      const client = await pool.connect();
      try {
        await client.query('DELETE FROM push_subscriptions WHERE endpoint = $1', [endpoint]);

        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({ success: true, message: 'Unsubscribed successfully' }),
        };
      } finally {
        client.release();
      }
    } catch (error) {
      console.error('Error unsubscribing:', error);
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ error: 'Failed to unsubscribe' }),
      };
    }
  }

  // Handle getting all notifications (for in-app display)
  if (path === '/all' && event.httpMethod === 'GET') {
    try {
      const client = await pool.connect();
      try {
        const result = await client.query(
          `SELECT id, title, message, created_at
           FROM global_notifications
           WHERE created_at > NOW() - INTERVAL '30 days'
           ORDER BY created_at DESC
           LIMIT 50`
        );

        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({
            success: true,
            notifications: result.rows
          }),
        };
      } finally {
        client.release();
      }
    } catch (error) {
      console.error('Error fetching notifications:', error);
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ error: 'Failed to fetch notifications' }),
      };
    }
  }

  // Handle sending notifications
  if (event.httpMethod === 'POST' && !path) {
    try {
      const { message, title = 'Kommyut', userUid } = JSON.parse(event.body);

      if (!message || message.trim().length === 0) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: 'Message is required' }),
        };
      }

      const client = await pool.connect();
      try {
        // Store notification for in-app display (GLOBAL - all users see this)
        await client.query(
          `INSERT INTO global_notifications (title, message, sent_by_uid)
           VALUES ($1, $2, $3)`,
          [title, message, userUid || null]
        );

        // Get all active subscriptions
        const result = await client.query(
          'SELECT id, endpoint, p256dh_key, auth_key FROM push_subscriptions ORDER BY last_active DESC'
        );

        const subscriptions = result.rows;

        // Always return success since notification is saved for in-app display
        if (subscriptions.length === 0) {
          return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
              success: true,
              message: 'Notification saved! All users will see it in-app.',
              response: { successCount: 0, failureCount: 0, inAppNotificationSaved: true },
            }),
          };
        }

        const payload = JSON.stringify({
          title,
          body: message,
          icon: '/icon-192x192.png',
          badge: '/icon-192x192.png',
          timestamp: Date.now(),
        });

        let successCount = 0;
        let failureCount = 0;
        const failedSubscriptions = [];

        // Send notifications to all subscriptions
        await Promise.all(
          subscriptions.map(async (sub) => {
            try {
              await webpush.sendNotification(
                {
                  endpoint: sub.endpoint,
                  keys: {
                    p256dh: sub.p256dh_key,
                    auth: sub.auth_key,
                  },
                },
                payload
              );
              successCount++;
            } catch (error) {
              console.error('Push error for subscription:', error);
              failureCount++;

              // If subscription is no longer valid, mark it for removal
              if (error.statusCode === 410 || error.statusCode === 404) {
                failedSubscriptions.push(sub.id);
              }
            }
          })
        );

        // Remove invalid subscriptions
        if (failedSubscriptions.length > 0) {
          await client.query(
            'DELETE FROM push_subscriptions WHERE id = ANY($1)',
            [failedSubscriptions]
          );
        }

        // Store notification history
        await client.query(
          `INSERT INTO notification_history (message, title, sent_by_uid, recipients_count, success_count, failure_count)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [message, title, userUid || null, subscriptions.length, successCount, failureCount]
        );

        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({
            success: true,
            message: 'Notifications sent successfully',
            response: {
              successCount,
              failureCount,
              totalSubscriptions: subscriptions.length,
            },
          }),
        };
      } finally {
        client.release();
      }
    } catch (error) {
      console.error('Error sending notifications:', error);
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({
          error: 'Failed to send notifications',
          details: error.message,
        }),
      };
    }
  }

  return {
    statusCode: 405,
    headers,
    body: JSON.stringify({ error: 'Method not allowed' }),
  };
};
