const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

const query = (text, params) => pool.query(text, params);

// Helper to create response
const response = (statusCode, body) => ({
  statusCode,
  headers: {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
  },
  body: JSON.stringify(body)
});

exports.handler = async (event) => {
  // Handle CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return response(200, {});
  }

  const path = event.path.replace('/.netlify/functions/gtfs', '');

  try {
    // GET /stops - Get all stops
    if (path === '/stops' && event.httpMethod === 'GET') {
      const result = await query('SELECT * FROM stops ORDER BY stop_name');
      return response(200, result.rows);
    }

    // GET /routes - Get all routes
    if (path === '/routes' && event.httpMethod === 'GET') {
      const result = await query(`
        SELECT DISTINCT
          r.route_id,
          r.route_short_name,
          r.route_long_name,
          r.route_type,
          r.route_signboard,
          r.agency_id,
          a.agency_name
        FROM routes r
        LEFT JOIN agency a ON r.agency_id = a.agency_id
        ORDER BY r.route_short_name
      `);
      return response(200, result.rows);
    }

    // GET /routes/:routeId/stops - Get stops for a specific route
    const routeStopsMatch = path.match(/^\/routes\/([^\/]+)\/stops$/);
    if (routeStopsMatch && event.httpMethod === 'GET') {
      const routeId = routeStopsMatch[1];
      const result = await query(`
        SELECT DISTINCT
          s.stop_id,
          s.stop_name,
          s.stop_lat,
          s.stop_lon,
          s.city
        FROM stops s
        JOIN stop_times st ON s.stop_id = st.stop_id
        JOIN trips t ON st.trip_id = t.trip_id
        WHERE t.route_id = $1
        ORDER BY CASE WHEN s.stop_id = $2 THEN 0 ELSE 1 END
      `, [routeId]);
      return response(200, result.rows);
    }

    // GET /routes/:routeId/schedule - Get schedule for a specific route
    const routeScheduleMatch = path.match(/^\/routes\/([^\/]+)\/schedule$/);
    if (routeScheduleMatch && event.httpMethod === 'GET') {
      const routeId = routeScheduleMatch[1];
      const result = await query(`
        SELECT
          st.stop_id,
          st.arrival_time,
          st.departure_time,
          st.stop_sequence,
          s.stop_name
        FROM stop_times st
        JOIN trips t ON st.trip_id = t.trip_id
        JOIN stops s ON st.stop_id = s.stop_id
        WHERE t.route_id = $1
        ORDER BY st.stop_sequence
        LIMIT 100
      `, [routeId]);
      return response(200, result.rows);
    }

    // GET /find-routes/:fromStopId/:toStopId - Find routes connecting two stops
    const findRoutesMatch = path.match(/^\/find-routes\/([^\/]+)\/([^\/]+)$/);
    if (findRoutesMatch && event.httpMethod === 'GET') {
      const [, fromStopId, toStopId] = findRoutesMatch;

      // Get the stop coordinates for distance calculation
      const stopsResult = await query(`
        SELECT stop_id, stop_lat, stop_lon, stop_name
        FROM stops
        WHERE stop_id IN ($1, $2)
      `, [fromStopId, toStopId]);

      const fromStop = stopsResult.rows.find(s => s.stop_id === fromStopId);
      const toStop = stopsResult.rows.find(s => s.stop_id === toStopId);

      if (!fromStop || !toStop) {
        return response(404, { error: 'Stops not found' });
      }

      // Calculate distance using Haversine formula
      const toRad = (deg) => deg * (Math.PI / 180);
      const R = 6371; // Earth's radius in km
      const dLat = toRad(toStop.stop_lat - fromStop.stop_lat);
      const dLon = toRad(toStop.stop_lon - fromStop.stop_lon);
      const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
                Math.cos(toRad(fromStop.stop_lat)) * Math.cos(toRad(toStop.stop_lat)) *
                Math.sin(dLon / 2) * Math.sin(dLon / 2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      const distance_km = R * c;

      // First, check if there's a walking-only trip for short distances
      // This prioritizes walking segments when they're the most direct option
      const walkingOnlyResult = await query(`
        SELECT DISTINCT
          r.route_id,
          r.route_short_name,
          r.route_long_name,
          r.route_type,
          r.route_signboard,
          t.trip_id,
          t.trip_headsign
        FROM routes r
        JOIN trips t ON r.route_id = t.route_id
        WHERE EXISTS (
          SELECT 1 FROM stop_times st1
          JOIN stop_times st2 ON st1.trip_id = st2.trip_id
          WHERE st1.trip_id = t.trip_id
          AND st1.stop_id = $1
          AND st2.stop_id = $2
          AND st1.stop_sequence < st2.stop_sequence
        )
        AND (t.trip_headsign ILIKE '%walk%' OR t.trip_id ILIKE '%walk%')
        AND NOT EXISTS (
          SELECT 1 FROM stop_times st
          WHERE st.trip_id = t.trip_id
          AND st.stop_id NOT IN ($1, $2)
        )
      `, [fromStopId, toStopId]);

      // If distance is very short (< 0.5km) and walking-only trip exists, use only that
      const useWalkingOnly = distance_km < 0.5 && walkingOnlyResult.rows.length > 0;

      // Find DIRECT routes (single trip connects both stops in correct order)
      const directRoutesResult = await query(`
        SELECT DISTINCT
          r.route_id,
          r.route_short_name,
          r.route_long_name,
          r.route_type,
          r.route_signboard,
          COUNT(DISTINCT t.trip_id) as trip_count
        FROM routes r
        JOIN trips t ON r.route_id = t.route_id
        WHERE EXISTS (
          SELECT 1 FROM stop_times st1
          JOIN stop_times st2 ON st1.trip_id = st2.trip_id
          WHERE st1.trip_id = t.trip_id
          AND st1.stop_id = $1
          AND st2.stop_id = $2
          AND st1.stop_sequence < st2.stop_sequence
        )
        ${useWalkingOnly ? `AND (t.trip_headsign ILIKE '%walk%' OR t.trip_id ILIKE '%walk%')` : ''}
        GROUP BY r.route_id, r.route_short_name, r.route_long_name, r.route_type, r.route_signboard
      `, [fromStopId, toStopId]);

      let enrichedRoutes = [];

      // If direct routes found, use them
      if (directRoutesResult.rows.length > 0) {
        enrichedRoutes = await Promise.all(directRoutesResult.rows.map(async (route) => {
          // Get stops between origin and destination on a specific trip
          // First find a trip that connects both stops
          // Prefer walking-only trips for short distances, otherwise prefer trips where destination is closer to the end
          const tripResult = await query(`
            SELECT t.trip_id,
                   t.trip_headsign,
                   MAX(st_dest.stop_sequence) as dest_seq,
                   MAX(st_all.stop_sequence) as total_stops,
                   CASE
                     WHEN (t.trip_headsign ILIKE '%walk%' OR t.trip_id ILIKE '%walk%') THEN 1
                     ELSE 2
                   END as priority
            FROM trips t
            JOIN stop_times st_dest ON t.trip_id = st_dest.trip_id AND st_dest.stop_id = $3
            JOIN stop_times st_all ON t.trip_id = st_all.trip_id
            WHERE t.route_id = $1
            AND EXISTS (
              SELECT 1 FROM stop_times st1
              JOIN stop_times st2 ON st1.trip_id = st2.trip_id
              WHERE st1.trip_id = t.trip_id
              AND st1.stop_id = $2
              AND st2.stop_id = $3
              AND st1.stop_sequence < st2.stop_sequence
            )
            ${useWalkingOnly ? `AND (t.trip_headsign ILIKE '%walk%' OR t.trip_id ILIKE '%walk%')` : ''}
            GROUP BY t.trip_id, t.trip_headsign
            ORDER BY
              ${useWalkingOnly ? 'MAX(st_all.stop_sequence) ASC' : 'priority ASC, (MAX(st_all.stop_sequence) - MAX(st_dest.stop_sequence)) ASC'}
            LIMIT 1
          `, [route.route_id, fromStopId, toStopId]);

          let orderedStops;
          let selectedTripId = null;
          let isWalkingTrip = false;

          if (tripResult.rows.length === 0) {
            // Fallback: just return origin and destination
            orderedStops = [fromStop, toStop];
          } else {
            selectedTripId = tripResult.rows[0].trip_id;
            const tripId = selectedTripId;

            // Check if this is a walking trip
            isWalkingTrip = tripId.toLowerCase().includes('walk') ||
                           (tripResult.rows[0].trip_headsign && tripResult.rows[0].trip_headsign.toLowerCase().includes('walk'));

            // Get stops on this specific trip between origin and destination
            const routeStopsResult = await query(`
              SELECT s.stop_id, s.stop_name, s.stop_lat, s.stop_lon, st.stop_sequence
              FROM stop_times st
              JOIN stops s ON st.stop_id = s.stop_id
              WHERE st.trip_id = $1
              AND st.stop_sequence >= (
                SELECT stop_sequence FROM stop_times WHERE trip_id = $1 AND stop_id = $2
              )
              AND st.stop_sequence <= (
                SELECT stop_sequence FROM stop_times WHERE trip_id = $1 AND stop_id = $3
              )
              ORDER BY st.stop_sequence
            `, [tripId, fromStopId, toStopId]);

            orderedStops = routeStopsResult.rows;
          }

          const estimated_fare = isWalkingTrip ? 0 : (13 + Math.floor(distance_km));

          return {
            route_id: route.route_id,
            route_short_name: isWalkingTrip ? 'Walking' : route.route_short_name,
            route_long_name: isWalkingTrip ? `Walking from ${fromStop.stop_name} to ${toStop.stop_name}` : route.route_long_name,
            route_type: isWalkingTrip ? 2 : route.route_type, // 2 = walking in GTFS
            route_name: isWalkingTrip ? 'Walking' : (route.route_short_name || route.route_long_name || `Route ${route.route_id}`),
            route_signboard: isWalkingTrip ? null : route.route_signboard,
            trip_count: parseInt(route.trip_count) || 0,
            stops: orderedStops,
            distance_km: parseFloat(distance_km.toFixed(2)),
            estimated_fare: parseFloat(estimated_fare.toFixed(2)),
            is_multimodal: false
          };
        }));
      }

      // If no direct routes, check for SAME-ROUTE MULTI-TRIP connections (e.g., PRC01 with separate jeepney and walking trips)
      if (enrichedRoutes.length === 0) {
        const sameRouteMultiTripResult = await query(`
          SELECT DISTINCT
            r.route_id,
            r.route_short_name,
            r.route_long_name,
            r.route_type,
            r.route_signboard
          FROM routes r
          WHERE EXISTS (
            SELECT 1
            FROM trips t1
            JOIN stop_times st1a ON t1.trip_id = st1a.trip_id
            WHERE r.route_id = t1.route_id
              AND st1a.stop_id = $1
          )
          AND EXISTS (
            SELECT 1
            FROM trips t2
            JOIN stop_times st2b ON t2.trip_id = st2b.trip_id
            WHERE r.route_id = t2.route_id
              AND st2b.stop_id = $2
          )
        `, [fromStopId, toStopId]);

        if (sameRouteMultiTripResult.rows.length > 0) {
          enrichedRoutes = await Promise.all(sameRouteMultiTripResult.rows.map(async (route) => {
            // Find all trips on this route that serve either the origin or destination
            const tripsResult = await query(`
              WITH origin_trips AS (
                SELECT DISTINCT t.trip_id
                FROM trips t
                JOIN stop_times st ON t.trip_id = st.trip_id
                WHERE t.route_id = $1 AND st.stop_id = $2
              ),
              dest_trips AS (
                SELECT DISTINCT t.trip_id
                FROM trips t
                JOIN stop_times st ON t.trip_id = st.trip_id
                WHERE t.route_id = $1 AND st.stop_id = $3
              )
              SELECT t.trip_id, t.trip_headsign
              FROM trips t
              WHERE t.route_id = $1
                AND (t.trip_id IN (SELECT trip_id FROM origin_trips)
                     OR t.trip_id IN (SELECT trip_id FROM dest_trips))
              ORDER BY t.trip_id
            `, [route.route_id, fromStopId, toStopId]);

            // Build stops array starting from origin and ending at destination
            // First, find the trip that serves the origin (prefer one that starts with origin)
            const originTripResult = await query(`
              SELECT t.trip_id, t.trip_headsign,
                     CASE 
                       WHEN (SELECT MIN(st2.stop_sequence) FROM stop_times st2 WHERE st2.trip_id = t.trip_id) = 
                            (SELECT stop_sequence FROM stop_times st3 WHERE st3.trip_id = t.trip_id AND st3.stop_id = $2)
                       THEN 1
                       ELSE 2
                     END as priority
              FROM trips t
              JOIN stop_times st ON t.trip_id = st.trip_id
              WHERE t.route_id = $1 
                AND st.stop_id = $2
              ORDER BY priority, t.trip_id
              LIMIT 1
            `, [route.route_id, fromStopId]);
            
            let stops = [fromStop];
            
            if (originTripResult.rows.length > 0) {
              const originTripId = originTripResult.rows[0].trip_id;
              
              // Get stops from origin trip (from origin to transfer point or end)
              const originStopsResult = await query(`
                SELECT s.stop_id, s.stop_name, s.stop_lat, s.stop_lon, st.stop_sequence
                FROM stop_times st
                JOIN stops s ON st.stop_id = s.stop_id
                WHERE st.trip_id = $1
                  AND st.stop_sequence >= (
                    SELECT stop_sequence FROM stop_times WHERE trip_id = $1 AND stop_id = $2
                  )
                ORDER BY st.stop_sequence
              `, [originTripId, fromStopId]);
              
              // Add intermediate stops from origin trip (excluding the origin itself)
              const originStops = originStopsResult.rows.filter(s => s.stop_id !== fromStopId);
              stops.push(...originStops);
              
              // Find the last stop from origin trip (this should be the transfer point)
              const lastOriginStop = originStops.length > 0 ? originStops[originStops.length - 1] : null;
              const transferPointId = lastOriginStop ? lastOriginStop.stop_id : null;
              
              // If destination is not already in stops, find the trip that goes from transfer point to destination
              if (transferPointId && transferPointId !== toStopId) {
                const destTripResult = await query(`
                  SELECT t.trip_id
                  FROM trips t
                  JOIN stop_times st1 ON t.trip_id = st1.trip_id AND st1.stop_id = $1
                  JOIN stop_times st2 ON t.trip_id = st2.trip_id AND st2.stop_id = $2
                  WHERE t.route_id = $3
                    AND st1.stop_sequence < st2.stop_sequence
                  ORDER BY t.trip_id
                  LIMIT 1
                `, [transferPointId, toStopId, route.route_id]);
                
                if (destTripResult.rows.length > 0) {
                  const destTripId = destTripResult.rows[0].trip_id;
                  
                  // Get stops from destination trip (from transfer point to destination, excluding transfer point)
                  const destStopsResult = await query(`
                    SELECT s.stop_id, s.stop_name, s.stop_lat, s.stop_lon, st.stop_sequence
                    FROM stop_times st
                    JOIN stops s ON st.stop_id = s.stop_id
                    WHERE st.trip_id = $1
                      AND st.stop_sequence > (
                        SELECT stop_sequence FROM stop_times WHERE trip_id = $1 AND stop_id = $2
                      )
                      AND st.stop_sequence <= (
                        SELECT stop_sequence FROM stop_times WHERE trip_id = $1 AND stop_id = $3
                      )
                    ORDER BY st.stop_sequence
                  `, [destTripId, transferPointId, toStopId]);
                  
                  // Add stops from transfer point to destination (excluding transfer point)
                  const destStops = destStopsResult.rows.filter(s => s.stop_id !== transferPointId);
                  stops.push(...destStops);
                }
              }
            }
            
            // Ensure destination is at the end
            if (stops.length === 0 || stops[stops.length - 1].stop_id !== toStopId) {
              // Remove destination if it's already in the middle
              stops = stops.filter(s => s.stop_id !== toStopId);
              stops.push(toStop);
            }
            
            // Final fallback: if we somehow don't have proper stops, ensure we at least have origin and destination
            if (stops.length === 0 || stops[0].stop_id !== fromStopId) {
              stops = [fromStop, ...stops.filter(s => s.stop_id !== fromStopId)];
            }
            if (stops.length === 0 || stops[stops.length - 1].stop_id !== toStopId) {
              stops = [...stops.filter(s => s.stop_id !== toStopId), toStop];
            }

            // Find the transfer/connection point (a stop that appears in multiple trips)
            const transferStopResult = await query(`
              SELECT s.stop_id, s.stop_name, s.stop_lat, s.stop_lon, COUNT(DISTINCT st.trip_id) as trip_count
              FROM stops s
              JOIN stop_times st ON s.stop_id = st.stop_id
              WHERE st.trip_id = ANY($1::text[])
                AND s.stop_id NOT IN ($2, $3)
              GROUP BY s.stop_id, s.stop_name, s.stop_lat, s.stop_lon
              HAVING COUNT(DISTINCT st.trip_id) > 1
              LIMIT 1
            `, [tripsResult.rows.map(t => t.trip_id), fromStopId, toStopId]);

            const transferStop = transferStopResult.rows[0] || null;

            return {
              route_id: route.route_id,
              route_short_name: route.route_short_name,
              route_long_name: route.route_long_name,
              route_type: route.route_type,
              route_name: route.route_short_name || route.route_long_name || `Route ${route.route_id}`,
              route_signboard: route.route_signboard,
              trip_count: tripsResult.rows.length,
              stops: stops,
              distance_km: parseFloat(distance_km.toFixed(2)),
              estimated_fare: parseFloat((13 + Math.floor(distance_km)).toFixed(2)),
              is_multimodal: true,
              transfer_point: transferStop ? transferStop.stop_name : null,
              legs: [{
                route_id: route.route_id,
                route_name: route.route_short_name || route.route_long_name,
                route_signboard: route.route_signboard
              }]
            };
          }));
        }
      }

      if (enrichedRoutes.length === 0) {
        // No direct or same-route multi-trip routes - try MULTI-MODAL routing (with transfers)
        // Find all routes that serve the origin
        const fromRoutesResult = await query(`
          SELECT DISTINCT r.route_id
          FROM routes r
          JOIN trips t ON r.route_id = t.route_id
          JOIN stop_times st ON t.trip_id = st.trip_id
          WHERE st.stop_id = $1
        `, [fromStopId]);

        // Find all routes that serve the destination
        const toRoutesResult = await query(`
          SELECT DISTINCT r.route_id
          FROM routes r
          JOIN trips t ON r.route_id = t.route_id
          JOIN stop_times st ON t.trip_id = st.trip_id
          WHERE st.stop_id = $1
        `, [toStopId]);

        const fromRoutes = fromRoutesResult.rows.map(r => r.route_id);
        const toRoutes = toRoutesResult.rows.map(r => r.route_id);

        // For each combination, find common transfer points
        for (const fromRouteId of fromRoutes) {
          for (const toRouteId of toRoutes) {
            if (fromRouteId === toRouteId) continue; // Skip if same route

            // Find common stops between the two routes (potential transfer points)
            const transferStopsResult = await query(`
              SELECT DISTINCT s.stop_id, s.stop_name, s.stop_lat, s.stop_lon
              FROM stops s
              WHERE EXISTS (
                SELECT 1 FROM stop_times st1
                JOIN trips t1 ON st1.trip_id = t1.trip_id
                WHERE t1.route_id = $1 AND st1.stop_id = s.stop_id
              )
              AND EXISTS (
                SELECT 1 FROM stop_times st2
                JOIN trips t2 ON st2.trip_id = t2.trip_id
                WHERE t2.route_id = $2 AND st2.stop_id = s.stop_id
              )
              LIMIT 5
            `, [fromRouteId, toRouteId]);

            if (transferStopsResult.rows.length > 0) {
              // Found a multi-modal route! Use the first transfer point
              const transferStop = transferStopsResult.rows[0];

              // Get route info for both legs
              const fromRouteInfo = await query(`
                SELECT route_id, route_short_name, route_long_name, route_type, route_signboard
                FROM routes WHERE route_id = $1
              `, [fromRouteId]);

              const toRouteInfo = await query(`
                SELECT route_id, route_short_name, route_long_name, route_type, route_signboard
                FROM routes WHERE route_id = $1
              `, [toRouteId]);

              if (fromRouteInfo.rows.length > 0 && toRouteInfo.rows.length > 0) {
                const leg1 = fromRouteInfo.rows[0];
                const leg2 = toRouteInfo.rows[0];

                // Combine the routes
                enrichedRoutes.push({
                  route_id: `${fromRouteId}_${toRouteId}`,
                  route_short_name: `${leg1.route_short_name || leg1.route_long_name} → ${leg2.route_short_name || leg2.route_long_name}`,
                  route_long_name: `${leg1.route_long_name || leg1.route_short_name} to ${leg2.route_long_name || leg2.route_short_name}`,
                  route_name: `${leg1.route_short_name || leg1.route_long_name} → ${leg2.route_short_name || leg2.route_long_name}`,
                  route_type: 3, // Default to PUJ type
                  trip_count: 1,
                  stops: [fromStop, transferStop, toStop],
                  distance_km: parseFloat(distance_km.toFixed(2)),
                  estimated_fare: parseFloat((26 + Math.floor(distance_km)).toFixed(2)), // Double base fare for transfers
                  is_multimodal: true,
                  transfer_point: transferStop.stop_name,
                  legs: [
                    {
                      route_id: leg1.route_id,
                      route_name: leg1.route_short_name || leg1.route_long_name,
                      route_signboard: leg1.route_signboard,
                      from: fromStop.stop_name,
                      to: transferStop.stop_name
                    },
                    {
                      route_id: leg2.route_id,
                      route_name: leg2.route_short_name || leg2.route_long_name,
                      route_signboard: leg2.route_signboard,
                      from: transferStop.stop_name,
                      to: toStop.stop_name
                    }
                  ]
                });
              }
            }
          }
        }
      }

      return response(200, enrichedRoutes);
    }

    // GET /routes/:routeId/shape - Get shape data for a specific route
    const routeShapeMatch = path.match(/^\/routes\/([^\/]+)\/shape$/);
    if (routeShapeMatch && event.httpMethod === 'GET') {
      const routeId = routeShapeMatch[1];
      // First, find a trip with this route_id that has a shape_id
      const tripResult = await query(`
        SELECT shape_id
        FROM trips
        WHERE route_id = $1 AND shape_id IS NOT NULL
        LIMIT 1
      `, [routeId]);

      if (tripResult.rows.length === 0) {
        return response(200, []); // No shape data available
      }

      const shapeId = tripResult.rows[0].shape_id;

      // Get all shape points for this shape_id
      const shapeResult = await query(`
        SELECT
          shape_id,
          shape_pt_lat,
          shape_pt_lon,
          shape_pt_sequence,
          shape_dist_traveled
        FROM shapes
        WHERE shape_id = $1
        ORDER BY shape_pt_sequence
      `, [shapeId]);

      return response(200, shapeResult.rows);
    }

    // GET /trip-shapes/:fromStopId/:toStopId?routeId=xxx - Get all shapes for a complete journey
    const tripShapesMatch = path.match(/^\/trip-shapes\/([^\/]+)\/([^\/]+)$/);
    if (tripShapesMatch && event.httpMethod === 'GET') {
      const [, fromStopId, toStopId] = tripShapesMatch;
      const { routeId: requestedRouteId } = event.queryStringParameters || {};

      // Calculate distance for walking-only detection
      const stopsForDistance = await query(`
        SELECT stop_id, stop_lat, stop_lon
        FROM stops
        WHERE stop_id IN ($1, $2)
      `, [fromStopId, toStopId]);

      const fromStopDist = stopsForDistance.rows.find(s => s.stop_id === fromStopId);
      const toStopDist = stopsForDistance.rows.find(s => s.stop_id === toStopId);

      let distance_km = 0;
      if (fromStopDist && toStopDist) {
        const toRad = (deg) => deg * (Math.PI / 180);
        const R = 6371;
        const dLat = toRad(parseFloat(toStopDist.stop_lat) - parseFloat(fromStopDist.stop_lat));
        const dLon = toRad(parseFloat(toStopDist.stop_lon) - parseFloat(fromStopDist.stop_lon));
        const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
                  Math.cos(toRad(parseFloat(fromStopDist.stop_lat))) * Math.cos(toRad(parseFloat(toStopDist.stop_lat))) *
                  Math.sin(dLon / 2) * Math.sin(dLon / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        distance_km = R * c;
      }

      let routeId;

      if (requestedRouteId) {
        // Use the specific route requested
        routeId = requestedRouteId;
      } else {
        // Find the route that connects these stops (allows multi-modal trips)
        const routeResult = await query(`
          SELECT DISTINCT r.route_id
          FROM routes r
          WHERE EXISTS (
            SELECT 1 FROM stop_times st1
            JOIN trips t1 ON st1.trip_id = t1.trip_id
            WHERE t1.route_id = r.route_id AND st1.stop_id = $1
          )
          AND EXISTS (
            SELECT 1 FROM stop_times st2
            JOIN trips t2 ON st2.trip_id = t2.trip_id
            WHERE t2.route_id = r.route_id AND st2.stop_id = $2
          )
          LIMIT 1
        `, [fromStopId, toStopId]);

        if (routeResult.rows.length === 0) {
          return response(200, { segments: [] });
        }

        routeId = routeResult.rows[0].route_id;
      }

      // Check if we should filter to walking-only trips for short distances
      // Only apply walking filter if there's a direct trip available (not multi-trip)
      const checkWalkingOnlyResult = await query(`
        SELECT COUNT(*) as walk_count
        FROM trips t
        WHERE t.route_id = $1
          AND (t.trip_headsign ILIKE '%walk%' OR t.trip_id ILIKE '%walk%')
          AND EXISTS (
            SELECT 1 FROM stop_times st1
            JOIN stop_times st2 ON st1.trip_id = st2.trip_id
            WHERE st1.trip_id = t.trip_id
              AND st1.stop_id = $2
              AND st2.stop_id = $3
              AND st1.stop_sequence < st2.stop_sequence
          )
          AND NOT EXISTS (
            SELECT 1 FROM stop_times st
            WHERE st.trip_id = t.trip_id
            AND st.stop_id NOT IN ($2, $3)
          )
      `, [routeId, fromStopId, toStopId]);

      const hasWalkingOnlyTrip = checkWalkingOnlyResult.rows[0] && parseInt(checkWalkingOnlyResult.rows[0].walk_count) > 0;
      const useWalkingOnly = distance_km < 0.5 && hasWalkingOnlyTrip;

      // First, try to find trips that directly connect origin to destination on a single trip
      const directTripsResult = await query(`
        SELECT DISTINCT
          t.trip_id,
          t.trip_headsign,
          t.shape_id,
          CASE
            WHEN (t.trip_headsign ILIKE '%walk%' OR t.trip_id ILIKE '%walk%') THEN 1
            ELSE 2
          END as trip_priority
        FROM trips t
        WHERE t.route_id = $1
          AND EXISTS (
            SELECT 1 FROM stop_times st1
            JOIN stop_times st2 ON st1.trip_id = st2.trip_id
            WHERE st1.trip_id = t.trip_id
              AND st1.stop_id = $2
              AND st2.stop_id = $3
              AND st1.stop_sequence < st2.stop_sequence
          )
          ${useWalkingOnly ? `AND (t.trip_headsign ILIKE '%walk%' OR t.trip_id ILIKE '%walk%')` : ''}
        ORDER BY trip_priority, t.trip_id
      `, [routeId, fromStopId, toStopId]);

      let tripsResult;

      if (directTripsResult.rows.length > 0) {
        // Found direct trip(s) - use only those
        tripsResult = directTripsResult;
      } else {
        // No direct trip - get ALL trips that serve either origin or destination
        // This handles multi-trip routes like PRC01 with separate jeepney and walking segments
        tripsResult = await query(`
          WITH trip_stops AS (
            SELECT
              t.trip_id,
              t.trip_headsign,
              t.shape_id,
              st.stop_id,
              st.stop_sequence
            FROM trips t
            JOIN stop_times st ON t.trip_id = st.trip_id
            WHERE t.route_id = $1
          ),
          origin_trips AS (
            SELECT trip_id FROM trip_stops WHERE stop_id = $2
          ),
          dest_trips AS (
            SELECT trip_id FROM trip_stops WHERE stop_id = $3
          )
          SELECT DISTINCT
            t.trip_id,
            t.trip_headsign,
            t.shape_id,
            MIN(ts.stop_sequence) as min_seq
          FROM trips t
          JOIN trip_stops ts ON t.trip_id = ts.trip_id
          WHERE t.route_id = $1
            AND (
              t.trip_id IN (SELECT trip_id FROM origin_trips)
              OR t.trip_id IN (SELECT trip_id FROM dest_trips)
            )
          GROUP BY t.trip_id, t.trip_headsign, t.shape_id
          ORDER BY MIN(ts.stop_sequence)
        `, [routeId, fromStopId, toStopId]);
      }

      if (tripsResult.rows.length === 0) {
        return response(200, { segments: [] });
      }

      // Get shapes for all trips, avoiding duplicates by shape_id
      const segments = [];
      const seenShapeIds = new Set();

      for (const trip of tripsResult.rows) {
        if (trip.shape_id && !seenShapeIds.has(trip.shape_id)) {
          seenShapeIds.add(trip.shape_id);

          const shapesResult = await query(`
            SELECT
              shape_id,
              shape_pt_lat,
              shape_pt_lon,
              shape_pt_sequence,
              shape_dist_traveled
            FROM shapes
            WHERE shape_id = $1
            ORDER BY shape_pt_sequence
          `, [trip.shape_id]);

          if (shapesResult.rows.length > 0) {
            segments.push({
              trip_id: trip.trip_id,
              trip_headsign: trip.trip_headsign,
              shape_id: trip.shape_id,
              points: shapesResult.rows
            });
          }
        }
      }

      return response(200, { segments });
    }

    // GET /nearest-stop - Find nearest stops to a lat/lon
    const nearestStopMatch = path.match(/^\/nearest-stop$/);
    if (nearestStopMatch && event.httpMethod === 'GET') {
      const { lat, lon, radius = 1000, limit = 5 } = event.queryStringParameters || {};

      if (!lat || !lon) {
        return response(400, { error: 'Missing lat or lon parameters' });
      }

      // Use Haversine formula to find nearest stops
      const result = await query(`
        SELECT
          stop_id,
          stop_name,
          stop_lat,
          stop_lon,
          city,
          (
            6371000 * acos(
              cos(radians($1)) * cos(radians(CAST(stop_lat AS FLOAT))) *
              cos(radians(CAST(stop_lon AS FLOAT)) - radians($2)) +
              sin(radians($1)) * sin(radians(CAST(stop_lat AS FLOAT)))
            )
          ) AS distance
        FROM stops
        WHERE stop_lat IS NOT NULL AND stop_lon IS NOT NULL
        HAVING distance <= $3
        ORDER BY distance
        LIMIT $4
      `, [parseFloat(lat), parseFloat(lon), parseFloat(radius), parseInt(limit)]);

      return response(200, { stops: result.rows });
    }

    return response(404, { error: 'Not found' });
  } catch (error) {
    console.error('Error:', error);
    return response(500, { error: 'Internal server error', details: error.message });
  }
};
