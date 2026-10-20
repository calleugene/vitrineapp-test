export async function ensureMuseumSession(session, authApi) {
  if (session?.isMock || session?.user?.role !== 'methodist' || session.user.museum_id) {
    return session;
  }

  const response = await authApi.provisionMuseumContext(session.accessToken);
  if (!response?.accessToken || !response?.user?.museum_id || response.user.id !== session.user.id) {
    throw new Error('museum_context_unavailable');
  }

  return {
    ...session,
    accessToken: response.accessToken,
    tokenType: response.tokenType || session.tokenType,
    user: response.user,
  };
}
