const EMPTY = '\u2014';

export function displayValue(value: string | null): string {
  const trimmed = value?.trim() ?? '';
  return trimmed.length > 0 ? trimmed : EMPTY;
}

export function memberLabel(member: {
  name: string | null;
  email: string | null;
  userId: string;
}): string {
  if (member.name?.trim()) return member.name.trim();
  if (member.email?.trim()) return member.email.trim();
  return member.userId;
}

export function roleLabel(role: 'owner' | 'admin'): string {
  return role === 'owner' ? 'Owner' : 'Admin';
}
