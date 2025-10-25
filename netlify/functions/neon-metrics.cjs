const https = require('https');

/**
 * Netlify Function to fetch Neon database metrics
 * Requires NEON_API_KEY and NEON_PROJECT_ID environment variables
 */

// Helper function to make HTTPS requests
function httpsRequest(options, postData = null) {
  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          try {
            resolve(JSON.parse(data));
          } catch (e) {
            resolve(data);
          }
        } else {
          reject(new Error(`HTTP ${res.statusCode}: ${data}`));
        }
      });
    });

    req.on('error', reject);

    if (postData) {
      req.write(postData);
    }

    req.end();
  });
}

// Fetch metrics from Neon API
async function fetchNeonMetrics(apiKey, projectId, branchId = 'main') {
  const baseOptions = {
    hostname: 'console.neon.tech',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Accept': 'application/json',
      'Content-Type': 'application/json'
    }
  };

  try {
    // Get project details
    const projectOptions = {
      ...baseOptions,
      path: `/api/v2/projects/${projectId}`,
      method: 'GET'
    };
    const projectData = await httpsRequest(projectOptions);

    // Get branches to find the main/primary branch
    const branchesOptions = {
      ...baseOptions,
      path: `/api/v2/projects/${projectId}/branches`,
      method: 'GET'
    };
    const branchesData = await httpsRequest(branchesOptions);

    // Find the primary branch
    const primaryBranch = branchesData.branches?.find(b => b.primary) || branchesData.branches?.[0];
    const targetBranchId = primaryBranch?.id;

    if (!targetBranchId) {
      throw new Error('No branch found for the project');
    }

    // Get endpoints info
    const metricsOptions = {
      ...baseOptions,
      path: `/api/v2/projects/${projectId}/branches/${targetBranchId}/endpoints`,
      method: 'GET'
    };
    const endpointsData = await httpsRequest(metricsOptions);

    // Get operations/queries metrics
    const operationsOptions = {
      ...baseOptions,
      path: `/api/v2/projects/${projectId}/operations`,
      method: 'GET'
    };
    const operationsData = await httpsRequest(operationsOptions);

    // Get consumption metrics (time-series data for last 6 hours)
    const now = new Date();
    const sixHoursAgo = new Date(now.getTime() - 6 * 60 * 60 * 1000);

    const consumptionOptions = {
      ...baseOptions,
      path: `/api/v2/consumption_history/projects/${projectId}?` +
        `from=${sixHoursAgo.toISOString()}&` +
        `to=${now.toISOString()}&` +
        `granularity=hourly`,
      method: 'GET'
    };

    let consumptionData = null;
    try {
      consumptionData = await httpsRequest(consumptionOptions);
    } catch (consumptionError) {
      // Consumption API might not be available on all plans
      console.warn('Could not fetch consumption metrics:', consumptionError.message);
    }

    return {
      project: projectData.project,
      branch: primaryBranch,
      endpoints: endpointsData.endpoints || [],
      operations: operationsData.operations || [],
      consumption: consumptionData,
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    console.error('Error fetching Neon metrics:', error);
    throw error;
  }
}

// Parse DATABASE_URL to extract project ID
function extractProjectIdFromDatabaseUrl(databaseUrl) {
  // Neon database URLs follow pattern: postgresql://user:pass@ep-name-id.region.aws.neon.tech/dbname
  // Project ID can be extracted from the endpoint host
  const match = databaseUrl.match(/ep-[^.]+\.([^.]+)\.([^.]+)\.neon\.tech/);
  if (match) {
    // The endpoint prefix contains project info
    const endpointMatch = databaseUrl.match(/ep-([^-]+)-([^.]+)/);
    if (endpointMatch) {
      return endpointMatch[2]; // This might need adjustment based on actual Neon URL structure
    }
  }
  return null;
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

  try {
    const neonApiKey = process.env.NEON_API_KEY;
    const neonProjectId = process.env.NEON_PROJECT_ID;

    if (!neonApiKey) {
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({
          error: 'NEON_API_KEY environment variable not configured',
          hint: 'Get your API key from https://console.neon.tech/app/settings/api-keys'
        })
      };
    }

    if (!neonProjectId) {
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({
          error: 'NEON_PROJECT_ID environment variable not configured',
          hint: 'Find your project ID in the Neon console URL or project settings'
        })
      };
    }

    // Fetch metrics from Neon
    const metrics = await fetchNeonMetrics(neonApiKey, neonProjectId);

    // Transform metrics into a more usable format
    const transformedMetrics = {
      projectInfo: {
        id: metrics.project?.id,
        name: metrics.project?.name,
        region: metrics.project?.region_id,
        createdAt: metrics.project?.created_at,
        platformVersion: metrics.project?.pg_version
      },
      branch: {
        id: metrics.branch?.id,
        name: metrics.branch?.name,
        primary: metrics.branch?.primary,
        createdAt: metrics.branch?.created_at
      },
      compute: {
        endpoints: metrics.endpoints.map(ep => ({
          id: ep.id,
          type: ep.type,
          currentState: ep.current_state,
          autoscalingLimitMinCu: ep.autoscaling_limit_min_cu,
          autoscalingLimitMaxCu: ep.autoscaling_limit_max_cu,
          suspendTimeoutSeconds: ep.suspend_timeout_seconds,
          poolerEnabled: ep.pooler_enabled,
          poolerMode: ep.pooler_mode,
          disabled: ep.disabled,
          host: ep.host,
          createdAt: ep.created_at,
          updatedAt: ep.updated_at
        }))
      },
      recentOperations: {
        count: metrics.operations.length,
        operations: metrics.operations.slice(0, 10).map(op => ({
          id: op.id,
          action: op.action,
          status: op.status,
          createdAt: op.created_at,
          updatedAt: op.updated_at
        }))
      },
      consumption: metrics.consumption ? {
        periods: metrics.consumption.periods || [],
        // Parse consumption data for time-series charts
        timeSeries: (metrics.consumption.periods || []).flatMap(period =>
          (period.consumption || []).map(point => ({
            timestamp: point.timeframe_start,
            activeTimeSeconds: point.active_time_seconds || 0,
            computeTimeSeconds: point.compute_time_seconds || 0,
            writtenDataBytes: point.written_data_bytes || 0,
            syntheticStorageBytes: point.synthetic_storage_size_bytes || 0,
            logicalSizeBytes: point.logical_size_bytes || 0
          }))
        )
      } : null,
      timestamp: metrics.timestamp
    };

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        metrics: transformedMetrics
      })
    };

  } catch (error) {
    console.error('Error in neon-metrics function:', error);

    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: 'Failed to fetch Neon metrics',
        message: error.message,
        hint: 'Check that your NEON_API_KEY and NEON_PROJECT_ID are correct'
      })
    };
  }
};
