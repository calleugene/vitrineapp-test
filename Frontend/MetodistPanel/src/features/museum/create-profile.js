export async function createProfileWithRecovery(body, api) {
  try {
    return await api.createProfile(body);
  } catch (error) {
    if (error?.status === 401 || error?.status === 403 || error?.status === 400) throw error;

    try {
      const response = await api.getProfile();
      const museum = response?.museum;
      const matches = museum && Object.entries(body).every(([key, value]) =>
        String(museum[key] ?? '').trim() === String(value ?? '').trim());
      if (matches) return response;
    } catch {
      // The original creation error is more useful when recovery cannot confirm a save.
    }
    throw error;
  }
}
