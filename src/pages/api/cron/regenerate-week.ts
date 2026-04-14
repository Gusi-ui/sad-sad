import type { APIRoute } from 'astro';
import { db } from '../../../lib/db';
import { datesOfIsoWeek, getIsoWeekKey, toYmd } from '../../../lib/dates';
import { generateWeek } from '../../../lib/schedule-generator';
import { bumpManyWorkerAssignmentsVersions } from '../../../lib/realtime';
import { sendPushToWorkerIds } from '../../../lib/push';

export const GET: APIRoute = async ({ request, locals }) => {
  const url = new URL(request.url);
  const token = url.searchParams.get('token');

  // Asegúrate de definir CRON_SECRET en tus variables de entorno (.dev.vars y Cloudflare Dashboard)
  const expectedToken = import.meta.env.CRON_SECRET || 'secret-cron-token-123';

  if (token !== expectedToken) {
    return new Response('Unauthorized', { status: 401 });
  }

  try {
    const database = db();
    
    // Calculamos las fechas de la próxima semana
    const nextWeekDate = new Date();
    nextWeekDate.setDate(nextWeekDate.getDate() + 7);
    const nextWeekKey = getIsoWeekKey(nextWeekDate);
    const weekDates = datesOfIsoWeek(nextWeekKey);
    
    if (!weekDates) {
      return new Response('Error calculando fechas', { status: 500 });
    }

    const dates = weekDates.map((d) => ({ d: new Date(d), ymd: toYmd(new Date(d)) }));
    
    // Regeneramos la semana basándonos en plantillas
    await generateWeek(database, dates, true);

    // Actualizamos las notificaciones
    const allWorkers = await database
      .prepare(`SELECT id FROM workers WHERE active = 1`)
      .all<{ id: string }>();
    
    const workerIds = allWorkers.results.map((w) => w.id);
    await bumpManyWorkerAssignmentsVersions(database, workerIds);
    
    const cf = locals.cfContext;
    cf?.waitUntil(
      sendPushToWorkerIds(database, workerIds, {
        title: 'Planificación actualizada',
        body: 'Se ha generado tu agenda para la próxima semana. Entra para verla.',
        url: '/w/planning'
      }) as any
    );

    return new Response(`Agenda de la semana ${nextWeekKey} regenerada con éxito.`, { status: 200 });
  } catch (error) {
    console.error('Error en cron:', error);
    return new Response('Error interno del servidor', { status: 500 });
  }
};