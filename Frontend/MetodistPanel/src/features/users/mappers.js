import {formatDateTimeLabel} from '../../app/date';
import {PROFILE_ROLE_OPTIONS, USER_MUSEUM_ACCESS_LABELS, USER_PROFILE_FALLBACKS} from './config';

const PROFILE_ROLE_LABELS = new Map(PROFILE_ROLE_OPTIONS.map(({value, content}) => [value, content]));

export function splitFullName(fullName = '') {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  return {
    firstName: parts[0] || USER_PROFILE_FALLBACKS.firstName,
    lastName: parts.slice(1).join(' ') || USER_PROFILE_FALLBACKS.lastName,
  };
}

export function createUserProfileDraft(user) {
  const extraLanguagesRaw = user?.extra_languages || user?.extraLanguages || '[]';
  let extraLanguages = ['en', 'de'];

  try {
    const parsed = typeof extraLanguagesRaw === 'string' ? JSON.parse(extraLanguagesRaw || '[]') : extraLanguagesRaw;
    if (Array.isArray(parsed) && parsed.length > 0) {
      extraLanguages = parsed;
    }
  } catch {
    // Keep fallback defaults for malformed legacy payloads.
  }

  const nameParts = splitFullName(user?.full_name || user?.fullName || '');

  return {
    firstName: nameParts.firstName,
    lastName: nameParts.lastName,
    email: user?.email || USER_PROFILE_FALLBACKS.email,
    phone: user?.phone || USER_PROFILE_FALLBACKS.phone,
    position: user?.position || user?.role || 'methodist',
    about: user?.about || USER_PROFILE_FALLBACKS.about,
    interfaceLanguage: user?.interface_language || user?.interfaceLanguage || 'ru',
    notifications: user?.notifications_enabled ?? user?.notifications ?? true,
    birthDate: user?.birth_date || user?.birthDate || '1988-05-15',
    gender: user?.gender || 'female',
    timezone: user?.timezone || 'moscow',
    extraLanguages,
    note: user?.note || '',
    status: user?.status || 'active',
    registeredAt: formatDateTimeLabel(user?.registered_at || user?.registeredAt),
    lastLoginAt: formatDateTimeLabel(user?.last_login_at || user?.lastLoginAt),
    userId: user?.id || '10001',
    registrationSource: user?.registration_source || user?.registrationSource || USER_PROFILE_FALLBACKS.registrationSource,
    twoFactorEnabled: user?.two_factor_enabled ?? user?.twoFactorEnabled ?? false,
    roles: [PROFILE_ROLE_LABELS.get(user?.role) || PROFILE_ROLE_LABELS.get('methodist')],
    museums: [],
    activities: [],
  };
}

export function mapUserMuseums(museums) {
  if (!Array.isArray(museums) || museums.length === 0) {
    return [];
  }

  return museums.map((museum) => ({
    name: museum.name,
    city: museum.city || '—',
    accessLevel: museum.access_level === 'edit' ? 'edit' : 'view',
    status: USER_MUSEUM_ACCESS_LABELS[museum.access_level === 'edit' ? 'edit' : 'view'],
  }));
}

export function mapUserActivities(activities) {
  if (!Array.isArray(activities) || activities.length === 0) {
    return [];
  }

  return activities.map((activity) => ({
    id: activity.id,
    title: activity.action,
    meta: activity.details || '',
    createdAt: formatDateTimeLabel(activity.created_at),
  }));
}
