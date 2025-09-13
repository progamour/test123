// api/collect.js
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).send('Method Not Allowed');

  try {
    const webhookUrl = process.env.DISCORD_WEBHOOK_URL;
    if (!webhookUrl) return res.status(500).send('Missing DISCORD_WEBHOOK_URL');

    // Body komt van de frontend
    const body = req.body || {};
    // IP proberen te bepalen
    const ip = (req.headers['x-forwarded-for'] || '')
      .toString()
      .split(',')[0]
      .trim() || req.socket?.remoteAddress || 'unknown';

    // Maak een mooie embed
    const fields = [];

    // Device
    if (body.device) {
      const d = body.device;
      fields.push(
        { name: 'User Agent', value: safe(d.userAgent), inline: false },
        { name: 'Platform', value: safe(d.platform), inline: true },
        { name: 'Language', value: safe(d.language), inline: true },
        { name: 'Timezone', value: safe(d.timezone), inline: true },
        { name: 'Screen', value: `${d.screen?.width}×${d.screen?.height} @${d.screen?.pixelRatio}x`, inline: true },
        { name: 'Cookies Enabled', value: String(d.cookiesEnabled), inline: true },
      );
    }

    // Location
    if (body.location) {
      if (body.location.ok && body.location.coords) {
        const { latitude, longitude, accuracy } = body.location.coords;
        fields.push(
          { name: 'Latitude', value: String(latitude), inline: true },
          { name: 'Longitude', value: String(longitude), inline: true },
          { name: 'Accuracy (m)', value: String(accuracy ?? 'n/a'), inline: true },
        );
        fields.push({
          name: 'Maps',
          value: `https://maps.google.com/?q=${latitude},${longitude}`,
          inline: false
        });
      } else {
        fields.push({
          name: 'Location',
          value: `Not available (${String(body.location.reason)})`,
          inline: false
        });
      }
    } else {
      fields.push({ name: 'Location', value: 'Not provided', inline: false });
    }

    // Page info
    if (body.page) {
      fields.push(
        { name: 'Page URL', value: safe(body.page.url), inline: false },
        { name: 'Referrer', value: safe(body.page.referrer || '—'), inline: false },
      );
    }

    // IP
    fields.push({ name: 'Client IP', value: safe(ip), inline: false });

    const embed = {
      title: 'Nieuwe demo data ontvangen',
      description: 'Gegevens gedeeld via de consent-knop op de website.',
      timestamp: new Date().toISOString(),
      fields
      // Je kunt "color" zetten (integer), bv. 5814783
    };

    // Naar Discord sturen
    const resp = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      // Voor webhooks moet je of `content` of `embeds` meesturen
      body: JSON.stringify({
        content: null,
        embeds: [embed]
      })
    });

    // Discord retourneert vaak 204 No Content bij succes.
    if (resp.ok) {
      return res.status(200).json({ ok: true });
    } else {
      const text = await resp.text().catch(() => '');
      return res.status(500).send('Discord error: ' + text);
    }
  } catch (e) {
    console.error(e);
    return res.status(500).send('Server error');
  }
}

function safe(val) {
  if (val === null || val === undefined) return '—';
  const s = String(val);
  // Discord velden hebben limieten; trim om ellende te voorkomen
  return s.length > 900 ? s.slice(0, 900) + '…' : s;
}
