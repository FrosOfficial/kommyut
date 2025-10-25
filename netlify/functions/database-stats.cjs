const { Pool } = require('pg');

/**
 * Netlify Function to fetch PostgreSQL database statistics
 * Queries system views for connection count, database size, cache hit rate, etc.
 */

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  },
  // Connection pool settings
  max: 3, // Limit connections for this monitoring function
  connectionTimeoutMillis: 5000,
});

async function getDatabaseStats(client) {
  const stats = {};

  try {
    // Get connection statistics
    const connectionStats = await client.query(`
      SELECT
        count(*) FILTER (WHERE state = 'active') as active_connections,
        count(*) FILTER (WHERE state = 'idle') as idle_connections,
        count(*) FILTER (WHERE wait_event_type IS NOT NULL) as waiting_connections,
        count(*) as total_connections,
        max(EXTRACT(EPOCH FROM (now() - state_change))) as longest_idle_time
      FROM pg_stat_activity
      WHERE datname = current_database()
        AND pid != pg_backend_pid();
    `);
    stats.connections = connectionStats.rows[0];

    // Get database size
    const dbSize = await client.query(`
      SELECT
        pg_database_size(current_database()) as size_bytes,
        pg_size_pretty(pg_database_size(current_database())) as size_formatted
    `);
    stats.database_size = dbSize.rows[0];

    // Get cache hit rate
    const cacheHitRate = await client.query(`
      SELECT
        sum(heap_blks_read) as heap_read,
        sum(heap_blks_hit) as heap_hit,
        CASE
          WHEN sum(heap_blks_hit) + sum(heap_blks_read) = 0 THEN 0
          ELSE (sum(heap_blks_hit) / (sum(heap_blks_hit) + sum(heap_blks_read))::float * 100)
        END as cache_hit_ratio
      FROM pg_statio_user_tables;
    `);
    stats.cache = cacheHitRate.rows[0];

    // Get table statistics
    const tableStats = await client.query(`
      SELECT
        schemaname,
        relname as tablename,
        pg_size_pretty(pg_total_relation_size(quote_ident(schemaname)||'.'||quote_ident(relname))) as total_size,
        pg_total_relation_size(quote_ident(schemaname)||'.'||quote_ident(relname)) as size_bytes,
        n_live_tup as row_count,
        n_dead_tup as dead_rows,
        last_vacuum,
        last_autovacuum,
        last_analyze,
        last_autoanalyze
      FROM pg_stat_user_tables
      ORDER BY pg_total_relation_size(quote_ident(schemaname)||'.'||quote_ident(relname)) DESC
      LIMIT 10;
    `);
    stats.tables = tableStats.rows;

    // Get locks and deadlocks
    const locks = await client.query(`
      SELECT
        locktype,
        mode,
        count(*) as count
      FROM pg_locks
      WHERE database = (SELECT oid FROM pg_database WHERE datname = current_database())
      GROUP BY locktype, mode
      ORDER BY count DESC;
    `);
    stats.locks = locks.rows;

    // Get transaction statistics
    const txStats = await client.query(`
      SELECT
        numbackends as backends,
        xact_commit as commits,
        xact_rollback as rollbacks,
        CASE
          WHEN (xact_commit + xact_rollback) = 0 THEN 0
          ELSE (xact_commit::float / (xact_commit + xact_rollback)::float * 100)
        END as commit_ratio,
        blks_read,
        blks_hit,
        tup_returned,
        tup_fetched,
        tup_inserted,
        tup_updated,
        tup_deleted,
        conflicts,
        temp_files,
        temp_bytes,
        deadlocks,
        blk_read_time,
        blk_write_time,
        stats_reset
      FROM pg_stat_database
      WHERE datname = current_database();
    `);
    stats.transactions = txStats.rows[0];

    // Get index statistics
    const indexStats = await client.query(`
      SELECT
        schemaname,
        relname as tablename,
        indexrelname as indexname,
        idx_scan as scans,
        idx_tup_read as tuples_read,
        idx_tup_fetch as tuples_fetched,
        pg_size_pretty(pg_relation_size(indexrelid)) as index_size
      FROM pg_stat_user_indexes
      ORDER BY idx_scan DESC
      LIMIT 10;
    `);
    stats.top_indexes = indexStats.rows;

    // Get slow queries (if pg_stat_statements is available)
    try {
      const slowQueries = await client.query(`
        SELECT
          query,
          calls,
          total_exec_time,
          mean_exec_time,
          max_exec_time,
          rows
        FROM pg_stat_statements
        WHERE query NOT LIKE '%pg_stat_statements%'
        ORDER BY mean_exec_time DESC
        LIMIT 5;
      `);
      stats.slow_queries = slowQueries.rows;
    } catch (e) {
      // pg_stat_statements extension not available
      stats.slow_queries = [];
    }

    // Get replication status (if applicable)
    try {
      const replication = await client.query(`
        SELECT
          client_addr,
          state,
          sync_state,
          replay_lag
        FROM pg_stat_replication;
      `);
      stats.replication = replication.rows;
    } catch (e) {
      stats.replication = [];
    }

    // PostgreSQL version and settings
    const version = await client.query('SELECT version()');
    stats.version = version.rows[0].version;

    const settings = await client.query(`
      SELECT name, setting, unit, short_desc
      FROM pg_settings
      WHERE name IN (
        'max_connections',
        'shared_buffers',
        'effective_cache_size',
        'maintenance_work_mem',
        'checkpoint_completion_target',
        'wal_buffers',
        'default_statistics_target',
        'random_page_cost',
        'effective_io_concurrency',
        'work_mem',
        'min_wal_size',
        'max_wal_size'
      );
    `);
    stats.settings = settings.rows;

    return stats;

  } catch (error) {
    console.error('Error fetching database stats:', error);
    throw error;
  }
}

exports.handler = async (event, context) => {
  // Set CORS headers
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET, OPTIONS'
  };

  // Handle preflight requests
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers,
      body: ''
    };
  }

  // Only allow GET requests
  if (event.httpMethod !== 'GET') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  let client;
  try {
    client = await pool.connect();
    const stats = await getDatabaseStats(client);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        timestamp: new Date().toISOString(),
        stats: stats
      })
    };

  } catch (error) {
    console.error('Error in database-stats function:', error);

    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: 'Failed to fetch database statistics',
        message: error.message
      })
    };
  } finally {
    if (client) {
      client.release();
    }
  }
};
