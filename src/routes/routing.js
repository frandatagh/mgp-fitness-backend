import { Router } from 'express';

const router = Router();

router.post('/route', async (req, res) => {
  try {
    const { from, to } = req.body;

    if (!from || !to) {
      return res.status(400).json({ message: 'Faltan coordenadas' });
    }

    if (!process.env.ORS_API_KEY) {
      return res.status(500).json({ message: 'Falta ORS_API_KEY en el servidor' });
    }

    const url = 'https://api.openrouteservice.org/v2/directions/foot-walking/geojson';

    const orsRes = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: process.env.ORS_API_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        coordinates: [
          [from.lng, from.lat],
          [to.lng, to.lat],
        ],
      }),
    });

    const data = await orsRes.json();

    if (!orsRes.ok) {
      console.error('ORS error:', data);
      return res.status(500).json({
        message: data?.error?.message || data?.message || 'Error en ORS',
        details: data,
      });
    }

    const route = data?.features?.[0];

    if (!route) {
      console.error('Respuesta ORS sin features:', data);
      return res.status(500).json({
        message: 'ORS no devolvió una ruta válida',
        details: data,
      });
    }

    res.json({
      distance: route.properties?.summary?.distance ?? 0,
      duration: route.properties?.summary?.duration ?? 0,
      geometry: route.geometry,
    });
  } catch (error) {
    console.error('Error interno routing:', error);
    res.status(500).json({ message: 'Error interno' });
  }
});

export default router;