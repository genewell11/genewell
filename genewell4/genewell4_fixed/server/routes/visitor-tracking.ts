import { RequestHandler } from 'express';
import { query } from '../lib/db';

async function getGeoLocation(ip: string): Promise<{
  country: string;
  region: string;
  city: string;
  latitude: number;
  longitude: number;
  timezone: string;
  isp: string;
}> {
  try {
    const cleanIp = ip === '::1' || ip === '127.0.0.1' || ip === '::ffff:127.0.0.1' ? '' : ip;
    const url = cleanIp
      ? `http://ip-api.com/json/${cleanIp}?fields=status,country,regionName,city,lat,lon,timezone,isp`
      : `http://ip-api.com/json/?fields=status,country,regionName,city,lat,lon,timezone,isp`;

    const response = await fetch(url);
    const data = await response.json();

    if (data.status === 'success') {
      return {
        country: data.country || 'Unknown',
        region: data.regionName || 'Unknown',
        city: data.city || 'Unknown',
        latitude: data.lat || 0,
        longitude: data.lon || 0,
        timezone: data.timezone || 'Unknown',
        isp: data.isp || 'Unknown',
      };
    }
  } catch (error) {
    console.error('Geolocation lookup failed:', error);
  }

  return {
    country: 'Unknown',
    region: 'Unknown',
    city: 'Unknown',
    latitude: 0,
    longitude: 0,
    timezone: 'Unknown',
    isp: 'Unknown',
  };
}

function getClientIp(req: any): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) {
    const ips = typeof forwarded === 'string' ? forwarded : forwarded[0];
    return ips.split(',')[0].trim();
  }
  return req.headers['x-real-ip'] || req.connection?.remoteAddress || req.ip || '';
}

export const handleTrackVisitor: RequestHandler = async (req, res) => {
  try {
    const ip = getClientIp(req);
    const page = req.body.page || '/';
    const referrer = req.body.referrer || req.headers.referer || '';
    const userAgent = req.headers['user-agent'] || '';

    const geo = await getGeoLocation(ip);

    await query(
      `INSERT INTO visitor_tracking (ip_address, country, region, city, latitude, longitude, timezone, isp, page_visited, referrer, user_agent)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
      [ip, geo.country, geo.region, geo.city, geo.latitude, geo.longitude, geo.timezone, geo.isp, page, referrer, userAgent]
    );

    res.json({ success: true });
  } catch (error) {
    console.error('Visitor tracking error:', error);
    res.json({ success: true });
  }
};
