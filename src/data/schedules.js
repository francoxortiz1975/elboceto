// Timetables that can be imported into the plan from the ⋮ menu ("HORARIOS").
// Importing is idempotent: every event has a stable id, so running it twice
// adds nothing, and edits or deletions made afterwards are never overwritten.
//
// An event: { day: 'YYYY-MM-DD', from: 'HH:MM', to: 'HH:MM', text, note }
// `text` is the block title (class and room); `note` is shown as a tooltip.

const e = (day, from, to, title, room, teacher) => ({ day, from, to, text: `${title} · ${room}`, note: teacher });

export const SCHEDULES = [
  {
    id: 'im-g2-2026-11-02',
    label: 'Clases IM · grupo 2 · 2–6 nov',
    area: 'School',
    items: [
      // Lundi 02/11
      e('2026-11-02', '08:30', '10:00', 'Organisation et communication (app)', 'Salle A Bis', 'RANTONNET KRYSTELLE'),
      e('2026-11-02', '10:15', '11:45', 'Organisation et communication (app)', 'Salle A Bis', 'RANTONNET KRYSTELLE'),
      e('2026-11-02', '12:00', '12:30', 'Réunion', 'Salle A Bis', 'MANOUVRIER MAUDE'),
      e('2026-11-02', '13:45', '15:15', 'Marketing (app)', 'F303', 'LASRI SARAH'),
      e('2026-11-02', '15:30', '17:00', 'Marketing (app)', 'F303', 'LASRI SARAH'),
      // Mardi 03/11
      e('2026-11-03', '10:15', '11:45', 'Introduction to Machine Learning (app)', 'Salle D', 'LESCA JULIEN'),
      e('2026-11-03', '12:00', '13:30', 'Introduction to Machine Learning (app)', 'A203', 'LESCA JULIEN'),
      e('2026-11-03', '17:15', '18:45', "Système d'information avancé 1 (app)", 'B 206', 'DEDENIS ALAIN'),
      e('2026-11-03', '19:00', '20:30', "Système d'information avancé 1 (app)", 'B 206', 'DEDENIS ALAIN'),
      // Mercredi 04/11
      e('2026-11-04', '10:15', '11:45', 'Programmation Objet avancée (app)', 'A306', 'PETROSSIAN ARMEN'),
      e('2026-11-04', '12:00', '13:30', 'Programmation Objet avancée (app)', 'A306', 'PETROSSIAN ARMEN'),
      // Jeudi 05/11
      e('2026-11-05', '08:30', '10:00', 'Système et algorithmiques répartis (app)', 'B 317', 'EL HADDAD JOYCE'),
      e('2026-11-05', '10:15', '11:45', 'Système et algorithmiques répartis (app)', 'B 317', 'EL HADDAD JOYCE'),
      e('2026-11-05', '13:45', '15:15', 'Systèmes de gestion de base de données (app)', 'F211', 'BELHAJJAME KHALID'),
      e('2026-11-05', '15:30', '17:00', 'Systèmes de gestion de base de données (app)', 'F211', 'BELHAJJAME KHALID'),
      e('2026-11-05', '17:15', '18:45', "Système d'information avancé 1 (app)", 'D 304', 'MOATASSIM MEHDI'),
      e('2026-11-05', '19:00', '20:30', "Système d'information avancé 1 (app)", 'D 304', 'MOATASSIM MEHDI'),
      // Vendredi 06/11
      e('2026-11-06', '10:15', '11:45', 'Systèmes de gestion de base de données (app)', 'F307', 'BELHAJJAME KHALID'),
      e('2026-11-06', '12:00', '13:30', 'Systèmes de gestion de base de données (app)', 'F307', 'BELHAJJAME KHALID')
    ]
  }
];
