import {useState} from 'react';
import {museumApi} from '../../api';
import {MUSEUM_ERRORS} from './config';
import {mapMuseumProfileData} from './mappers';
import {normalizeWebsite} from './utils';
import {getMuseumProfileLoadState, INITIAL_MUSEUM_PROFILE_LOAD_STATE} from './profile-load-state';
import {createProfileWithRecovery} from './create-profile';

export function useMuseumProfile() {
  const [museumProfile, setMuseumProfile] = useState(() => mapMuseumProfileData(null));
  const [museumProfileSaved, setMuseumProfileSaved] = useState(() => mapMuseumProfileData(null));
  const [museumProfileSaving, setMuseumProfileSaving] = useState(false);
  const [museumProfileError, setMuseumProfileError] = useState('');
  const [museumProfileLoadState, setMuseumProfileLoadState] = useState(INITIAL_MUSEUM_PROFILE_LOAD_STATE);

  const loadMuseumProfile = async () => {
    setMuseumProfileLoadState((state) => getMuseumProfileLoadState(state, {type: 'start'}));
    try {
      const response = await museumApi.getProfile();
      applyMuseumProfile(mapMuseumProfileData(response.museum));
      setMuseumProfileLoadState((state) => getMuseumProfileLoadState(state, {type: 'success'}));
    } catch (error) {
      const message = error?.status === 401
        ? MUSEUM_ERRORS.loadUnauthorized
        : MUSEUM_ERRORS.load;
      setMuseumProfileLoadState((state) => getMuseumProfileLoadState(state, {
        type: 'failure',
        status: error?.status,
        message,
      }));
    }
  };

  const applyMuseumProfile = (nextProfile) => {
    setMuseumProfile(nextProfile);
    setMuseumProfileSaved(nextProfile);
  };

  const saveMuseumProfile = async (profile, creating) => {
    setMuseumProfileSaving(true); setMuseumProfileError('');
    try {
      const body = {name: profile.name, short_description: profile.shortDescription, description: profile.description, website: normalizeWebsite(profile.website).value, address: profile.address, logo_url: profile.logoUrl};
      const response = creating ? await createProfileWithRecovery(body, museumApi) : await museumApi.updateProfile(body);
      applyMuseumProfile(mapMuseumProfileData(response.museum));
      setMuseumProfileLoadState((state) => getMuseumProfileLoadState(state, {type: 'success'}));
      return true;
    } catch (error) {
      setMuseumProfileError(error?.status === 401 ? MUSEUM_ERRORS.unauthorized : MUSEUM_ERRORS.save);
      return false;
    } finally { setMuseumProfileSaving(false); }
  };

  const resetMuseumProfile = () => setMuseumProfile(museumProfileSaved);

  return {
    museumProfile,
    setMuseumProfile,
    applyMuseumProfile,
    resetMuseumProfile,
    saveMuseumProfile,
    museumProfileSaving,
    museumProfileError,
    museumProfileLoadState,
    loadMuseumProfile,
  };
}
