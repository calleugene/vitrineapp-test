// Keep destination text in query parameters, never interpolate it as a URL.
export function museumDirections(address) {
  const destination = typeof address === 'string' ? address.trim() : '';
  if (!destination) return [];
  return [
    {name: 'Яндекс Карты', base: 'https://yandex.ru/maps/', params: {mode: 'routes', rtext: `~${destination}`}},
    {name: 'Apple Maps', base: 'https://maps.apple.com/directions', params: {destination}},
    {name: 'Google Maps', base: 'https://www.google.com/maps/dir/', params: {api: '1', destination}},
  ].map(({name, base, params}) => ({name, href: `${base}?${new URLSearchParams(params)}`}));
}
