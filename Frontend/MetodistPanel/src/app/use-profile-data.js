import {useEffect, useEffectEvent, useState} from 'react';
import {authApi} from '../api';
import {createUserProfileDraft, mapUserActivities, mapUserMuseums, splitFullName} from './utils';

export function useProfileData({
  session,
  isAuthenticated,
  currentUser,
  onSessionRefresh,
}) {
  const [userProfile, setUserProfile] = useState(() => createUserProfileDraft(session?.user));
  const [userProfileDraft, setUserProfileDraft] = useState(() => createUserProfileDraft(session?.user));
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileError, setProfileError] = useState('');

  const loadUserProfileData = async (userId) => {
    if (!userId) {
      return;
    }

    const [userResult, rolesResult, museumsResult, activityResult] = await Promise.allSettled([
      authApi.getUser(userId),
      authApi.getRoles(userId),
      authApi.getMuseums(userId),
      authApi.getActivity(userId),
    ]);

    const baseUser = userResult.status === 'fulfilled' ? userResult.value.user : currentUser;

    const nextProfile = {
      ...createUserProfileDraft(baseUser),
      roles: rolesResult.status === 'fulfilled' ? rolesResult.value.roles || [] : createUserProfileDraft(baseUser).roles,
      museums: museumsResult.status === 'fulfilled' ? mapUserMuseums(museumsResult.value.museums) : [],
      activities: activityResult.status === 'fulfilled' ? mapUserActivities(activityResult.value.activities) : [],
    };

    setUserProfile(nextProfile);
    setUserProfileDraft(nextProfile);
  };

  const loadUserProfileDataEvent = useEffectEvent(loadUserProfileData);

  const handleSaveUserProfile = async () => {
    if (!currentUser?.id) {
      return;
    }

    setProfileSaving(true);
    setProfileError('');

    try {
      const fullName = `${userProfileDraft.firstName} ${userProfileDraft.lastName}`.trim();
      const response = await authApi.updateUser(currentUser.id, {
        full_name: fullName,
        phone: userProfileDraft.phone,
        position: userProfileDraft.position,
        about: userProfileDraft.about,
        birth_date: userProfileDraft.birthDate,
        gender: userProfileDraft.gender,
        timezone: userProfileDraft.timezone,
        interface_language: userProfileDraft.interfaceLanguage,
        extra_languages: userProfileDraft.extraLanguages,
        note: userProfileDraft.note,
        notifications_enabled: userProfileDraft.notifications,
      });

      const savedProfile = {
        ...userProfileDraft,
        ...createUserProfileDraft(response.user),
        roles: userProfileDraft.roles,
        museums: userProfileDraft.museums,
        activities: userProfileDraft.activities,
      };

      setUserProfile(savedProfile);
      setUserProfileDraft(savedProfile);

      if (session) {
        onSessionRefresh({...session, user: response.user});
      }
    } catch {
      setProfileError('Не удалось сохранить профиль. Проверьте AuthService и попробуйте снова.');
    } finally {
      setProfileSaving(false);
    }
  };

  useEffect(() => {
    const nextProfile = createUserProfileDraft(currentUser);
    setUserProfile((prev) => ({
      ...nextProfile,
      ...prev,
      email: currentUser?.email || prev.email || nextProfile.email,
      firstName: splitFullName(currentUser?.full_name || currentUser?.fullName || '').firstName || prev.firstName,
      lastName: splitFullName(currentUser?.full_name || currentUser?.fullName || '').lastName || prev.lastName,
    }));
    setUserProfileDraft((prev) => ({
      ...nextProfile,
      ...prev,
      email: currentUser?.email || prev.email || nextProfile.email,
      firstName: splitFullName(currentUser?.full_name || currentUser?.fullName || '').firstName || prev.firstName,
      lastName: splitFullName(currentUser?.full_name || currentUser?.fullName || '').lastName || prev.lastName,
    }));
  }, [currentUser]);

  useEffect(() => {
    if (!isAuthenticated || !currentUser?.id) {
      return;
    }

    loadUserProfileDataEvent(currentUser.id);
  }, [currentUser?.id, isAuthenticated]);

  return {
    userProfile,
    userProfileDraft,
    setUserProfileDraft,
    profileSaving,
    profileError,
    handleSaveUserProfile,
  };
}
