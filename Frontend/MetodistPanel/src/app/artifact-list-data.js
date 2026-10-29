// Fetch every page so archived rows never displace active exhibits from the list.
export async function loadAllArtifacts(list) {
  const artifacts = [];
  let page = 1;
  while (true) {
    const response = await list({page, limit: 500});
    const items = response?.artifacts ?? [];
    artifacts.push(...items);
    if (!items.length || !response?.pagination || artifacts.length >= response.pagination.total) break;
    page += 1;
  }
  return {artifacts};
}
