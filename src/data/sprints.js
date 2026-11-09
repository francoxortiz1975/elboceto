// Loginet sprints, one block each (source: "Loginet - Propuesta Completa", cronograma). Each
// one is imported from the ⋮ menu ("SPRINTS LOGINET") on the day you start it,
// normally the Monday meeting. Tasks land in the Loginet area as untimed
// blocks on that day, and importing again never duplicates them.

const S = (n, title, tasks, deliverable, optional) => ({ n, title, tasks, deliverable, optional: !!optional });

const ALL = [
  S(4, 'Dominio y despliegue', [
    'Conexión de dominio y despliegue',
    'Notificación fallback de errores al desarrollador'
  ], 'MVP en producción'),
  S(5, 'Blog: estructura y publicación', [
    'Blog funcional: estructura y publicación',
    'Categorías reales'
  ], 'Blog en modo edición funcionando'),
  S(6, 'Blog: pulido y pruebas', [
    'Blog: pulido',
    'Blog: pruebas'
  ], 'Blog aprobado'),
  S(7, 'Cookies y Analytics', [
    'Migración de cookies (CookieYes)',
    'Migración de Google Analytics / GTM'
  ], 'Tracking validado'),
  S(8, 'WhatsApp y correcciones', [
    'Pop-up de WhatsApp',
    'Correcciones generales'
  ], 'Base aprobada'),
  S(9, 'Nosotros y certificaciones', [
    'Página Nosotros: misión, visión, perfil del fundador',
    'Pulido visual',
    'Certificaciones interactivas',
    'Testimonios y logos de clientes'
  ], 'Diseño refinado aprobado'),
  S(10, 'Funcionalidades de blog', [
    'Funcionalidades adicionales de blog',
    'Coordinar con el administrador de blog'
  ], 'Blog completo'),
  S(11, 'SEO y velocidad', [
    'SEO',
    'Velocidad',
    'Pruebas responsive'
  ], 'Sitio optimizado'),
  S(12, 'Cierre y capacitación', [
    'Ajustes finales y pruebas',
    'Capacitación al equipo',
    'Coordinar con el administrador de WhatsApp y correo'
  ], 'Cierre y lanzamiento final'),
  S(13, 'Wizard de calificación (opcional)', [
    'Wizard de calificación de servicios',
    'Estimación de costos integrada'
  ], 'Herramienta de calificación de leads funcionando', true),
  S(14, 'Página FAQ (opcional)', ['Página de Preguntas Frecuentes (FAQ)'], 'Página FAQ publicada', true),
  S(15, 'Chatbot IA (opcional)', [
    'Chatbot con IA vía OpenRouter',
    'Integrar el chatbot a la página FAQ'
  ], 'Chatbot funcionando', true),
  S(16, 'Versión en inglés (opcional)', ['Versión en inglés del sitio'], 'Sitio bilingüe publicado', true)
];

// Sprint 4 (domain) is postponed until after sprint 6.
export const SPRINTS = (() => {
  const rest = ALL.filter((x) => x.n !== 4);
  const at = rest.findIndex((x) => x.n === 6) + 1;
  return [...rest.slice(0, at), ALL.find((x) => x.n === 4), ...rest.slice(at)];
})();

// A sprint as a schedule that importSchedule() understands: untimed blocks on `day`.
export function sprintSchedule(sprint, day) {
  const text = (t) => `S${sprint.n} · ${t}`;
  return {
    id: `loginet-sprint-${sprint.n}`,
    area: 'Loginet',
    items: [
      ...sprint.tasks.map((t, i) => ({ day, key: `t${i}`, text: text(t) })),
      { day, key: 'deliverable', text: text(`Entregable: ${sprint.deliverable}`) }
    ]
  };
}
