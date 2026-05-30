export type NotificationItem = {
  id: string;
  text: string;
  date: string;
  time: string;
  relativeTime: string;
  isRead: boolean;
  link: string;
};

export const INITIAL_NOTIFICATIONS: NotificationItem[] = [
  {
    id: "created-room-americana",
    text: "Tu nuevo anuncio de Cuarto 'Cuarto en la Americana' se ha creado exitosamente, no olvides publicarlo.",
    date: "30 may 2026",
    time: "09:15",
    relativeTime: "Hace 2 horas",
    isRead: false,
    link: "/publicar/vista-previa?listing=cuarto-americana",
  },
  {
    id: "created-property-providencia",
    text: "Tu nuevo anuncio de Propiedad 'Casa en Providencia' se ha creado exitosamente, no olvides publicarlo.",
    date: "29 may 2026",
    time: "18:42",
    relativeTime: "Hace 5 horas",
    isRead: false,
    link: "/publicar/vista-previa?listing=casa-providencia",
  },
  {
    id: "published-room-americana",
    text: "Has publicado exitosamente tu anuncio de Cuarto 'Cuarto en la Americana'.",
    date: "28 may 2026",
    time: "11:03",
    relativeTime: "Ayer",
    isRead: true,
    link: "/publicar/vista-previa?listing=cuarto-americana",
  },
  {
    id: "reminder-room-americana",
    text: "Tu anuncio 'Cuarto en la Americana' lleva 3 días creado sin publicarse. ¡Publícalo hoy!",
    date: "28 may 2026",
    time: "08:00",
    relativeTime: "Ayer",
    isRead: false,
    link: "/publicar/vista-previa?listing=cuarto-americana",
  },
  {
    id: "message-inquiry-chapultepec",
    text: "Tienes un nuevo mensaje sobre tu anuncio 'Cuarto cerca de Chapultepec'.",
    date: "27 may 2026",
    time: "21:10",
    relativeTime: "Hace 2 días",
    isRead: false,
    link: "/mensajes",
  },
  {
    id: "profile-incomplete",
    text: "Completa tu perfil agregando tu número de WhatsApp para generar más confianza.",
    date: "27 may 2026",
    time: "10:00",
    relativeTime: "Hace 3 días",
    isRead: true,
    link: "/perfil",
  },
  {
    id: "published-property-providencia",
    text: "Has publicado exitosamente tu anuncio de Propiedad 'Casa en Providencia'.",
    date: "26 may 2026",
    time: "16:45",
    relativeTime: "Hace 4 días",
    isRead: true,
    link: "/publicar/vista-previa?listing=casa-providencia",
  },
  {
    id: "reminder-property-providencia",
    text: "Tu anuncio 'Casa en Providencia' lleva 5 días sin actualizarse. ¿Sigues buscando roomies?",
    date: "25 may 2026",
    time: "09:30",
    relativeTime: "Hace 5 días",
    isRead: false,
    link: "/publicar/vista-previa?listing=casa-providencia",
  },
  {
    id: "group-invite",
    text: "Te invitaron a unirte a la comunidad 'Roomies GDL Centro'.",
    date: "24 may 2026",
    time: "14:20",
    relativeTime: "Hace 6 días",
    isRead: true,
    link: "/grupos",
  },
  {
    id: "listing-view-milestone",
    text: "Tu anuncio 'Cuarto en la Americana' alcanzó 50 visitas esta semana.",
    date: "23 may 2026",
    time: "08:55",
    relativeTime: "Hace 1 semana",
    isRead: false,
    link: "/mis-anuncios",
  },
];
