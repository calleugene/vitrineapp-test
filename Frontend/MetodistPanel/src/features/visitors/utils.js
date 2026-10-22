export function parseVisitorDateTime(value) {
  if (!value) {
    return 0;
  }

  const [datePart = '', timePart = ''] = value.split(',').map((part) => part.trim());
  const [day = '0', month = '0', year = '0'] = datePart.split('.');
  const [hours = '0', minutes = '0'] = timePart.split(':');

  return new Date(Number(year), Number(month) - 1, Number(day), Number(hours), Number(minutes)).getTime();
}

export function parseDurationMinutes(value) {
  const match = String(value).match(/\d+/);
  return match ? Number(match[0]) : 0;
}

export function parseVisitorCount(value) {
  const match = String(value).match(/\d+/);
  return match ? Number(match[0]) : 0;
}

