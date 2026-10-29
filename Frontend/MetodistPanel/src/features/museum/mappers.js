import {MUSEUM_PROFILE_STATS} from './demo-data';

export function parseContacts(contacts) {
  if (!contacts) {
    return {};
  }

  if (typeof contacts === 'object') {
    return contacts;
  }

  try {
    return JSON.parse(contacts);
  } catch {
    return {};
  }
}

export function mapMuseumProfileData(museum) {
  if (!museum) {
    return {
      name: '', shortDescription: '', website: '', founded: '', address: '', code: '', description: '',
      timezone: 'moscow',
      logoUrl: '',
      contacts: parseContacts('{"email":"info@shm.ru","phone":"+7 (495) 692-01-51","working_hours":"Ежедневно 10:00 – 21:00"}'),
    };
  }

  return {
    name: museum.name || '',
    shortDescription: museum.short_description || '',
    website: museum.website || '',
    founded: museum.founded_year ? String(museum.founded_year) : '',
    address: museum.address || '',
    code: museum.code || '',
    description: museum.description || '',
    timezone: museum.timezone || 'moscow',
    logoUrl: museum.logo_url || '',
    contacts: parseContacts(museum.contacts),
  };
}

export function mapMuseumStatsData(stats) {
  if (!stats) {
    return MUSEUM_PROFILE_STATS;
  }

  return [
    {title: 'Экспонатов', value: String(stats.artifacts_count ?? 0)},
    {title: 'Маршрутов', value: String(stats.routes_count ?? 0)},
    {title: 'Посетителей', value: String(stats.visitors_count ?? 0)},
  ];
}

