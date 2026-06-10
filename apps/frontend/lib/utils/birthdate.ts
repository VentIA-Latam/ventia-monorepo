/**
 * Helpers para mostrar contexto de cumpleaños en el panel del contacto.
 *
 * Decisión sobre 29-feb: un cumpleaños 29-feb en un año no bisiesto se trata
 * como si fuera el 1 de marzo. Esto evita días "fantasma" sin propietario y
 * mantiene la cuenta de días estable.
 */

function toIsoStartOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

/**
 * Construye la fecha del próximo aniversario del cumpleaños relativa a `today`.
 * Si el aniversario de este año ya pasó (o es hoy), devuelve el del próximo año.
 */
function nextAnniversary(birthMonth: number, birthDay: number, today: Date): Date {
  const todayStart = toIsoStartOfDay(today);
  const tryYear = (year: number) => {
    // 29-feb en año no bisiesto → 1-mar.
    const isFeb29 = birthMonth === 1 && birthDay === 29;
    const month = birthMonth;
    const day = isFeb29 && !isLeapYear(year) ? 1 : birthDay;
    const actualMonth = isFeb29 && !isLeapYear(year) ? 2 : month;
    return new Date(year, actualMonth, day);
  };

  let candidate = tryYear(todayStart.getFullYear());
  if (candidate < todayStart) {
    candidate = tryYear(todayStart.getFullYear() + 1);
  }
  return candidate;
}

/**
 * Días hasta el próximo aniversario del cumpleaños. 0 si es hoy.
 */
export function daysUntilBirthday(isoDate: string, today: Date = new Date()): number {
  const [yearStr, monthStr, dayStr] = isoDate.split("-");
  const birthMonth = Number(monthStr) - 1; // JS months are 0-indexed
  const birthDay = Number(dayStr);
  if (Number.isNaN(birthMonth) || Number.isNaN(birthDay) || !yearStr) {
    return Number.POSITIVE_INFINITY;
  }

  const todayStart = toIsoStartOfDay(today);
  const target = nextAnniversary(birthMonth, birthDay, today);
  const msPerDay = 1000 * 60 * 60 * 24;
  return Math.round((target.getTime() - todayStart.getTime()) / msPerDay);
}

/**
 * Etiqueta secundaria del panel:
 *  - "¡Hoy cumple!" cuando es hoy.
 *  - "cumple mañana" cuando faltan exactamente 1 día.
 *  - "cumple en N días" para 2..30 días.
 *  - null si faltan más de 30 días (no se muestra sufijo para reducir ruido).
 */
export function birthdayLabel(
  isoDate: string,
  today: Date = new Date()
): "¡Hoy cumple!" | "cumple mañana" | `cumple en ${number} días` | null {
  const days = daysUntilBirthday(isoDate, today);
  if (days === 0) return "¡Hoy cumple!";
  if (days === 1) return "cumple mañana";
  if (days <= 30) return `cumple en ${days} días`;
  return null;
}
